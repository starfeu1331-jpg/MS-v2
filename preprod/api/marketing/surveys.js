import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config({ path: '.env.production' });

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// ═══════════════════════════════════════════════════════
// API Surveys – CRUD + Import CSV + Résultats + Filtrage croisé
// ═══════════════════════════════════════════════════════

const serializeJSON = (obj) =>
  JSON.parse(JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? Number(v) : v)));

// ─── Auto-détection du type de question ────────────────
function detectQuestionType(values) {
  const nonEmpty = values.filter(v => v && v.trim());
  if (nonEmpty.length === 0) return 'FREE_TEXT';

  // Check NPS (all numeric 0-10)
  const allNumeric = nonEmpty.every(v => /^\d+$/.test(v.trim()));
  if (allNumeric) {
    const nums = nonEmpty.map(Number);
    const max = Math.max(...nums);
    const min = Math.min(...nums);
    if (min >= 0 && max <= 10) return 'NPS';
    return 'NUMERIC';
  }

  // Check Likert scales
  const likertTerms = ['excellent', 'très satisfaisant', 'satisfaisant', 'correct', 'insuffisant',
    'tout à fait d\'accord', 'plutôt d\'accord', 'plutôt pas d\'accord', 'pas du tout d\'accord',
    'pas d\'accord', 'd\'accord'];
  const hasLikert = nonEmpty.some(v => likertTerms.some(t => v.toLowerCase().includes(t)));
  if (hasLikert) return 'LIKERT';

  // Check multi-choice (contains comma-separated options in values)
  const hasMulti = nonEmpty.some(v => v.includes(', ') && v.length > 40);
  if (hasMulti) return 'MULTIPLE_CHOICE';

  // Count unique values
  const unique = new Set(nonEmpty.map(v => v.trim()));
  if (unique.size <= 15) return 'SINGLE_CHOICE';
  if (unique.size > 50) return 'FREE_TEXT';
  return 'SINGLE_CHOICE';
}

// ─── Raccourcir un label de question ───────────────────
function makeShortLabel(label) {
  // Remove numbering prefix like "1. ", "14. "
  let s = label.replace(/^\d+\.\s*/, '').trim();
  // If it has a bracket sub-question, extract it
  const bracketMatch = s.match(/\[(.+?)\]/);
  if (bracketMatch) return bracketMatch[1];
  // Truncate
  if (s.length > 60) s = s.substring(0, 57) + '…';
  return s;
}

// ─── Detect grouped questions (same number prefix) ────
function detectGrouping(headers) {
  const groups = {};
  for (const h of headers) {
    const match = h.match(/^(\d+)\.\s+(.+?)(?:\s*\[(.+?)\])?$/);
    if (match) {
      const num = match[1];
      if (!groups[num]) groups[num] = [];
      groups[num].push(h);
    }
  }
  // Only headers appearing 2+ times with same number are grouped
  const grouped = {};
  for (const [num, list] of Object.entries(groups)) {
    if (list.length > 1) {
      for (const h of list) grouped[h] = num;
    }
  }
  return grouped;
}

// ─── Parse Google Forms CSV date ─────────────────────
function parseGFormsDate(str) {
  if (!str) return null;
  // Format: "19/02/2026 16:07:02"
  const match = str.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    return new Date(`${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}:${match[6]}`);
  }
  return null;
}

// ═══════════════════════════════════════════════════════
// Handler principal
// ═══════════════════════════════════════════════════════
export default async function handler(req, res) {
  const method = req.method;

  // ---------- GET /api/surveys ----------
  if (method === 'GET' && !req.query.id) {
    return getSurveysList(req, res);
  }

  // ---------- GET /api/surveys?id=xxx ----------
  if (method === 'GET' && req.query.id) {
    return getSurveyDetail(req, res);
  }

  // ---------- POST /api/surveys (import CSV) ----------
  if (method === 'POST') {
    return importSurvey(req, res);
  }

  // ---------- DELETE /api/surveys?id=xxx ----------
  if (method === 'DELETE') {
    return deleteSurvey(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// ═══════════════════════════════════════════════════════
// GET /api/surveys → Liste des enquêtes
// ═══════════════════════════════════════════════════════
async function getSurveysList(req, res) {
  const surveys = await prisma.$queryRawUnsafe(`
    SELECT s.id, s.title, s.description, s.source_file, s.respondents, s.created_at,
           (SELECT COUNT(*)::int FROM survey_questions WHERE survey_id = s.id AND is_identity = false) as question_count
    FROM surveys s
    ORDER BY s.created_at DESC
  `);
  return res.json(serializeJSON(surveys));
}

// ═══════════════════════════════════════════════════════
// GET /api/surveys?id=xxx → Détail + résultats + filtrage croisé
// ═══════════════════════════════════════════════════════
async function getSurveyDetail(req, res) {
  const { id } = req.query;

  // Parse active filters from query: filters=Q_ID:value,Q_ID2:value2
  const filterStr = req.query.filters || '';
  const activeFilters = [];
  if (filterStr) {
    for (const f of filterStr.split('||')) {
      const [qId, ...rest] = f.split('::');
      if (qId && rest.length) activeFilters.push({ questionId: qId, value: rest.join('::') });
    }
  }

  // Parse RFM segment filter
  const rfmSegmentsParam = req.query.rfmSegments || '';
  const selectedRfmSegments = rfmSegmentsParam ? rfmSegmentsParam.split(',').map(s => s.trim()).filter(Boolean) : [];

  // 1. Survey info
  const surveyRows = await prisma.$queryRawUnsafe(
    `SELECT * FROM surveys WHERE id = $1`, id
  );
  if (!surveyRows.length) return res.status(404).json({ error: 'Enquête introuvable' });
  const survey = surveyRows[0];

  // 2. Questions
  const questions = await prisma.$queryRawUnsafe(`
    SELECT id, position, question_key, label, short_label, type, is_grouped, group_label, options, is_identity
    FROM survey_questions
    WHERE survey_id = $1
    ORDER BY position
  `, id);

  // 3. Compute RFM segment stats for this survey (always, for the UI)
  const rfmStatsRows = await prisma.$queryRawUnsafe(`
    SELECT c.rfm_segment as segment, COUNT(DISTINCT sr.id)::int as count
    FROM survey_respondents sr
    JOIN clients c ON LOWER(TRIM(sr.email)) = LOWER(TRIM(c.email))
    WHERE sr.survey_id = $1
      AND sr.email IS NOT NULL AND sr.email != ''
      AND c.rfm_segment IS NOT NULL
    GROUP BY c.rfm_segment
    ORDER BY count DESC
  `, id);

  const matchedCountRows = await prisma.$queryRawUnsafe(`
    SELECT COUNT(DISTINCT sr.id)::int as cnt
    FROM survey_respondents sr
    JOIN clients c ON LOWER(TRIM(sr.email)) = LOWER(TRIM(c.email))
    WHERE sr.survey_id = $1 AND sr.email IS NOT NULL AND sr.email != ''
  `, id);
  const matchedClientsCount = matchedCountRows[0]?.cnt || 0;

  // 3b. Build respondent IDs set from RFM segment filter
  let rfmRespondentIds = null;
  if (selectedRfmSegments.length > 0) {
    const segPlaceholders = selectedRfmSegments.map((_, i) => `$${i + 2}`).join(',');
    const rfmRows = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT sr.id as respondent_id
      FROM survey_respondents sr
      JOIN clients c ON LOWER(TRIM(sr.email)) = LOWER(TRIM(c.email))
      WHERE sr.survey_id = $1
        AND sr.email IS NOT NULL AND sr.email != ''
        AND c.rfm_segment IN (${segPlaceholders})
    `, id, ...selectedRfmSegments);
    rfmRespondentIds = new Set(rfmRows.map(r => r.respondent_id));
  }

  // 3c. Build respondent IDs set from question filters
  // Group filters by questionId: OR within same question, AND across questions
  const filtersByQuestion = {};
  for (const f of activeFilters) {
    if (!filtersByQuestion[f.questionId]) filtersByQuestion[f.questionId] = [];
    filtersByQuestion[f.questionId].push(f.value);
  }
  const filteredQuestionIds = Object.keys(filtersByQuestion);

  // Pre-compute respondent sets per question filter (for reuse)
  const respondentSetByQuestion = {};
  for (const [questionId, values] of Object.entries(filtersByQuestion)) {
    let matchingIds;
    if (values.length === 1) {
      matchingIds = await prisma.$queryRawUnsafe(`
        SELECT DISTINCT respondent_id FROM survey_answers
        WHERE question_id = $1 AND value = $2
      `, questionId, values[0]);
    } else {
      const placeholders = values.map((_, i) => `$${i + 2}`).join(',');
      matchingIds = await prisma.$queryRawUnsafe(`
        SELECT DISTINCT respondent_id FROM survey_answers
        WHERE question_id = $1 AND value IN (${placeholders})
      `, questionId, ...values);
    }
    respondentSetByQuestion[questionId] = new Set(matchingIds.map(r => r.respondent_id));
  }

  // Intersect ALL question filters + RFM for the global respondent set
  function intersectSets(sets) {
    let result = null;
    for (const s of sets) {
      if (result === null) result = new Set(s);
      else result = new Set([...result].filter(x => s.has(x)));
    }
    return result;
  }

  const allSets = [];
  if (rfmRespondentIds) allSets.push(rfmRespondentIds);
  for (const qId of filteredQuestionIds) allSets.push(respondentSetByQuestion[qId]);
  
  let respondentFilter = null;
  if (allSets.length > 0) {
    respondentFilter = intersectSets(allSets) || new Set();
  }

  const filteredCount = respondentFilter ? respondentFilter.size : survey.respondents;

  // 4. Compute results for each non-identity question
  // For each question: use respondent set EXCLUDING its own filter (cross-filter logic)
  const results = [];
  for (const q of questions) {
    if (q.is_identity) continue;

    // Build respondent set for THIS question's chart: exclude own filter, keep all others
    let qRespondentFilter;
    if (filteredQuestionIds.includes(q.id)) {
      const otherSets = [];
      if (rfmRespondentIds) otherSets.push(rfmRespondentIds);
      for (const qId of filteredQuestionIds) {
        if (qId !== q.id) otherSets.push(respondentSetByQuestion[qId]);
      }
      qRespondentFilter = otherSets.length > 0 ? (intersectSets(otherSets) || new Set()) : null;
    } else {
      qRespondentFilter = respondentFilter;
    }

    let answers;
    if (qRespondentFilter && qRespondentFilter.size > 0) {
      const idList = [...qRespondentFilter];
      const placeholders = idList.map((_, i) => `$${i + 2}`).join(',');
      answers = await prisma.$queryRawUnsafe(`
        SELECT value, numeric_value, respondent_id FROM survey_answers
        WHERE question_id = $1 AND respondent_id IN (${placeholders})
      `, q.id, ...idList);
    } else if (qRespondentFilter && qRespondentFilter.size === 0) {
      answers = [];
    } else {
      answers = await prisma.$queryRawUnsafe(`
        SELECT value, numeric_value, respondent_id FROM survey_answers
        WHERE question_id = $1
      `, q.id);
    }

    // Count distinct respondents (important for MULTIPLE_CHOICE where 1 respondent = N rows)
    const distinctRespondents = new Set(answers.map(a => a.respondent_id)).size;

    const result = {
      questionId: q.id,
      questionKey: q.question_key,
      label: q.label,
      shortLabel: q.short_label,
      type: q.type,
      isGrouped: q.is_grouped,
      groupLabel: q.group_label,
      options: q.options,
      totalAnswers: distinctRespondents,
      distribution: null,
      nps: null,
      average: null,
    };

    if (q.type === 'NPS') {
      const scores = answers.filter(a => a.numeric_value !== null).map(a => Number(a.numeric_value));
      const promoters = scores.filter(s => s >= 9).length;
      const passives = scores.filter(s => s >= 7 && s <= 8).length;
      const detractors = scores.filter(s => s <= 6).length;
      const total = scores.length || 1;
      const npsScore = Math.round(((promoters - detractors) / total) * 100);
      const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0;

      // Distribution by score
      const dist = {};
      for (const s of scores) { dist[s] = (dist[s] || 0) + 1; }

      result.nps = {
        score: npsScore,
        promoters: { count: promoters, pct: Math.round((promoters / total) * 100) },
        passives: { count: passives, pct: Math.round((passives / total) * 100) },
        detractors: { count: detractors, pct: Math.round((detractors / total) * 100) },
      };
      result.average = parseFloat(avg);
      result.distribution = Object.entries(dist)
        .map(([value, count]) => ({ value, count, pct: Math.round((count / total) * 100) }))
        .sort((a, b) => Number(a.value) - Number(b.value));
    } else if (q.type === 'NUMERIC') {
      const nums = answers.filter(a => a.numeric_value !== null).map(a => Number(a.numeric_value));
      result.average = nums.length ? parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)) : 0;
      const dist = {};
      for (const n of nums) { dist[n] = (dist[n] || 0) + 1; }
      result.distribution = Object.entries(dist)
        .map(([value, count]) => ({ value, count, pct: Math.round((count / answers.length) * 100) }))
        .sort((a, b) => Number(a.value) - Number(b.value));
    } else {
      // SINGLE_CHOICE, MULTIPLE_CHOICE, LIKERT, FREE_TEXT
      const dist = {};
      for (const a of answers) {
        const v = a.value || '(vide)';
        dist[v] = (dist[v] || 0) + 1;
      }
      // For MULTIPLE_CHOICE, pct = (count / distinct respondents) since 1 person can pick multiple options
      // For others, pct = (count / total answers) since 1 person = 1 answer
      const total = (q.type === 'MULTIPLE_CHOICE' ? distinctRespondents : answers.length) || 1;
      result.distribution = Object.entries(dist)
        .map(([value, count]) => ({ value, count, pct: Math.round((count / total) * 100) }))
        .sort((a, b) => b.count - a.count);
    }

    results.push(result);
  }

  // 5. Timeline (responses over time)
  let timeline = [];
  if (!respondentFilter) {
    timeline = await prisma.$queryRawUnsafe(`
      SELECT DATE(responded_at) as date, COUNT(*)::int as count
      FROM survey_respondents
      WHERE survey_id = $1 AND responded_at IS NOT NULL
      GROUP BY DATE(responded_at)
      ORDER BY date
    `, id);
  } else if (respondentFilter.size > 0) {
    const idList = [...respondentFilter];
    const placeholders = idList.map((_, i) => `$${i + 2}`).join(',');
    timeline = await prisma.$queryRawUnsafe(`
      SELECT DATE(responded_at) as date, COUNT(*)::int as count
      FROM survey_respondents
      WHERE survey_id = $1 AND id IN (${placeholders}) AND responded_at IS NOT NULL
      GROUP BY DATE(responded_at)
      ORDER BY date
    `, id, ...idList);
  }

  // 6. Respondents list (paginated) for detail view
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 50;
  const offset = (page - 1) * pageSize;

  let respondents = [];
  let respondentsTotal = 0;

  if (req.query.respondents === 'true') {
    if (respondentFilter && respondentFilter.size > 0) {
      const idList = [...respondentFilter];
      const placeholders = idList.map((_, i) => `$${i + 2}`).join(',');
      respondentsTotal = respondentFilter.size;
      respondents = await prisma.$queryRawUnsafe(`
        SELECT sr.id, sr.first_name, sr.last_name, sr.email, sr.responded_at,
               json_agg(json_build_object('questionId', sa.question_id, 'value', sa.value, 'numericValue', sa.numeric_value)) as answers
        FROM survey_respondents sr
        LEFT JOIN survey_answers sa ON sa.respondent_id = sr.id
        WHERE sr.survey_id = $1 AND sr.id IN (${placeholders})
        GROUP BY sr.id
        ORDER BY sr.responded_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `, id, ...idList);
    } else if (!respondentFilter) {
      const countRows = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as total FROM survey_respondents WHERE survey_id = $1`, id
      );
      respondentsTotal = countRows[0].total;
      respondents = await prisma.$queryRawUnsafe(`
        SELECT sr.id, sr.first_name, sr.last_name, sr.email, sr.responded_at,
               json_agg(json_build_object('questionId', sa.question_id, 'value', sa.value, 'numericValue', sa.numeric_value)) as answers
        FROM survey_respondents sr
        LEFT JOIN survey_answers sa ON sa.respondent_id = sr.id
        WHERE sr.survey_id = $1
        GROUP BY sr.id
        ORDER BY sr.responded_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `, id);
    }
  }

  return res.json(serializeJSON({
    survey,
    questions: questions.filter(q => !q.is_identity),
    results,
    timeline,
    filteredCount,
    totalCount: survey.respondents,
    activeFilters,
    selectedRfmSegments,
    rfmStats: rfmStatsRows.map(r => ({ segment: r.segment, count: r.count })),
    matchedClientsCount,
    respondents: req.query.respondents === 'true' ? { data: respondents, total: respondentsTotal, page, pageSize } : undefined,
  }));
}

// ═══════════════════════════════════════════════════════
// POST /api/surveys → Import CSV
// ═══════════════════════════════════════════════════════
async function importSurvey(req, res) {
  const { title, description, csvData, fileName } = req.body;

  if (!csvData || !title) {
    return res.status(400).json({ error: 'title et csvData requis' });
  }

  try {
    // Parse CSV
    const rows = parseCSV(csvData);
    if (rows.length < 2) return res.status(400).json({ error: 'CSV vide ou invalide' });

    const headers = rows[0];
    const dataRows = rows.slice(1).filter(r => r.some(c => c.trim()));

    // Detect identity columns
    const identityCols = {
      horodateur: null,
      prenom: null,
      nom: null,
      email: null,
    };
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase().trim();
      if (h.includes('horodateur') || h.includes('timestamp')) identityCols.horodateur = i;
      else if (h.includes('prénom') || h.includes('prenom') || h === 'first name') identityCols.prenom = i;
      else if (h.includes('nom') && !h.includes('prénom') && !h.includes('prenom')) identityCols.nom = i;
      else if (h.includes('e-mail') || h.includes('email') || h.includes('adresse e-mail')) identityCols.email = i;
    }

    // Detect grouped questions
    const groupedMap = detectGrouping(headers);

    // Create survey
    const surveyResult = await prisma.$queryRawUnsafe(`
      INSERT INTO surveys (id, title, description, source_file, respondents, created_at, updated_at)
      VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW(), NOW())
      RETURNING id
    `, title, description || null, fileName || null, dataRows.length);
    const surveyId = surveyResult[0].id;

    // Create questions
    const questionMap = {};
    let position = 0;
    for (let i = 0; i < headers.length; i++) {
      const isIdentity = Object.values(identityCols).includes(i);
      if (isIdentity) continue; // Skip identity columns in questions (stored separately on respondent)

      position++;
      const label = headers[i].trim();
      const values = dataRows.map(r => r[i] || '');
      const type = detectQuestionType(values);
      const grouped = groupedMap[label];
      const groupLabel = grouped
        ? label.replace(/\s*\[.+?\]\s*$/, '').replace(/^\d+\.\s*/, '').trim()
        : null;

      const qKey = `Q${position}`;
      const shortLabel = makeShortLabel(label);

      // Collect options for choice types
      let options = null;
      if (type === 'SINGLE_CHOICE' || type === 'LIKERT') {
        const unique = [...new Set(values.filter(v => v.trim()).map(v => v.trim()))];
        options = unique;
      } else if (type === 'MULTIPLE_CHOICE') {
        const allOpts = new Set();
        for (const v of values) {
          if (v.trim()) {
            for (const opt of v.split(', ')) {
              const trimmed = opt.trim();
              if (trimmed) allOpts.add(trimmed);
            }
          }
        }
        options = [...allOpts];
      }

      const qResult = await prisma.$queryRawUnsafe(`
        INSERT INTO survey_questions (id, survey_id, position, question_key, label, short_label, type, is_grouped, group_label, options, is_identity)
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6::"SurveyQuestionType", $7, $8, $9::jsonb, false)
        RETURNING id
      `, surveyId, position, qKey, label, shortLabel, type, !!grouped, groupLabel, options ? JSON.stringify(options) : null);

      questionMap[i] = { id: qResult[0].id, type };
    }

    // Create respondents + answers in batches
    const BATCH_SIZE = 50;
    for (let b = 0; b < dataRows.length; b += BATCH_SIZE) {
      const batch = dataRows.slice(b, b + BATCH_SIZE);

      for (const row of batch) {
        const respondedAt = identityCols.horodateur !== null ? parseGFormsDate(row[identityCols.horodateur]) : null;
        const firstName = identityCols.prenom !== null ? (row[identityCols.prenom] || '').trim() : null;
        const lastName = identityCols.nom !== null ? (row[identityCols.nom] || '').trim() : null;
        const email = identityCols.email !== null ? (row[identityCols.email] || '').trim() : null;

        const respResult = await prisma.$queryRawUnsafe(`
          INSERT INTO survey_respondents (id, survey_id, responded_at, first_name, last_name, email)
          VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5)
          RETURNING id
        `, surveyId, respondedAt, firstName, lastName, email);
        const respondentId = respResult[0].id;

        // Insert answers
        for (let i = 0; i < headers.length; i++) {
          if (!questionMap[i]) continue;
          const { id: questionId, type } = questionMap[i];
          const rawValue = (row[i] || '').trim();
          if (!rawValue) continue;

          if (type === 'MULTIPLE_CHOICE') {
            // Split multi-choice and insert one row per option
            const opts = rawValue.split(', ').map(o => o.trim()).filter(Boolean);
            for (const opt of opts) {
              await prisma.$queryRawUnsafe(`
                INSERT INTO survey_answers (id, respondent_id, question_id, value, numeric_value)
                VALUES (gen_random_uuid()::text, $1, $2, $3, NULL)
              `, respondentId, questionId, opt);
            }
          } else if (type === 'NPS' || type === 'NUMERIC') {
            const num = parseFloat(rawValue);
            await prisma.$queryRawUnsafe(`
              INSERT INTO survey_answers (id, respondent_id, question_id, value, numeric_value)
              VALUES (gen_random_uuid()::text, $1, $2, $3, $4)
            `, respondentId, questionId, rawValue, isNaN(num) ? null : num);
          } else {
            await prisma.$queryRawUnsafe(`
              INSERT INTO survey_answers (id, respondent_id, question_id, value, numeric_value)
              VALUES (gen_random_uuid()::text, $1, $2, $3, NULL)
            `, respondentId, questionId, rawValue);
          }
        }
      }
    }

    return res.json({
      success: true,
      surveyId,
      respondents: dataRows.length,
      questions: Object.keys(questionMap).length,
    });
  } catch (error) {
    console.error('Import survey error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ═══════════════════════════════════════════════════════
// DELETE /api/surveys?id=xxx → Supprimer une enquête
// ═══════════════════════════════════════════════════════
async function deleteSurvey(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id requis' });

  await prisma.$queryRawUnsafe(`DELETE FROM surveys WHERE id = $1`, id);
  return res.json({ success: true });
}

// ═══════════════════════════════════════════════════════
// CSV Parser (handle quoted fields, newlines in quotes)
// ═══════════════════════════════════════════════════════
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n' || (c === '\r' && next === '\n')) {
        row.push(field);
        field = '';
        if (row.some(f => f.trim())) rows.push(row);
        row = [];
        if (c === '\r') i++;
      } else {
        field += c;
      }
    }
  }
  // Last field/row
  row.push(field);
  if (row.some(f => f.trim())) rows.push(row);

  return rows;
}

// ═══════════════════════════════════════════════════════
// GET /api/surveys/export?id=xxx → Export CSV filtré
// ═══════════════════════════════════════════════════════
export async function exportHandler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id requis' });

  // Parse filters
  const filterStr = req.query.filters || '';
  const activeFilters = [];
  if (filterStr) {
    for (const f of filterStr.split('||')) {
      const [qId, ...rest] = f.split('::');
      if (qId && rest.length) activeFilters.push({ questionId: qId, value: rest.join('::') });
    }
  }

  // Get questions
  const questions = await prisma.$queryRawUnsafe(`
    SELECT id, label, type FROM survey_questions
    WHERE survey_id = $1 AND is_identity = false
    ORDER BY position
  `, id);

  // Get respondent IDs if filtered
  let respondentIds = null;
  if (activeFilters.length > 0) {
    let ids = null;
    for (const f of activeFilters) {
      const matchingIds = await prisma.$queryRawUnsafe(`
        SELECT respondent_id FROM survey_answers WHERE question_id = $1 AND value = $2
      `, f.questionId, f.value);
      const set = new Set(matchingIds.map(r => r.respondent_id));
      ids = ids ? new Set([...ids].filter(x => set.has(x))) : set;
    }
    respondentIds = ids || new Set();
  }

  // Get all respondents
  let respondents;
  if (respondentIds && respondentIds.size > 0) {
    const idList = [...respondentIds];
    const ph = idList.map((_, i) => `$${i + 2}`).join(',');
    respondents = await prisma.$queryRawUnsafe(`
      SELECT sr.id, sr.first_name, sr.last_name, sr.email, sr.responded_at,
             json_agg(json_build_object('questionId', sa.question_id, 'value', sa.value)) as answers
      FROM survey_respondents sr
      LEFT JOIN survey_answers sa ON sa.respondent_id = sr.id
      WHERE sr.survey_id = $1 AND sr.id IN (${ph})
      GROUP BY sr.id
      ORDER BY sr.responded_at
    `, id, ...idList);
  } else if (respondentIds && respondentIds.size === 0) {
    respondents = [];
  } else {
    respondents = await prisma.$queryRawUnsafe(`
      SELECT sr.id, sr.first_name, sr.last_name, sr.email, sr.responded_at,
             json_agg(json_build_object('questionId', sa.question_id, 'value', sa.value)) as answers
      FROM survey_respondents sr
      LEFT JOIN survey_answers sa ON sa.respondent_id = sr.id
      WHERE sr.survey_id = $1
      GROUP BY sr.id
      ORDER BY sr.responded_at
    `, id);
  }

  // Build CSV
  const header = ['Prénom', 'Nom', 'Email', 'Date', ...questions.map(q => q.label)];
  const csvRows = [header.map(h => `"${h.replace(/"/g, '""')}"`).join(',')];

  for (const r of respondents) {
    const answers = Array.isArray(r.answers) ? r.answers : [];
    const answerMap = {};
    for (const a of answers) {
      if (!a.questionId) continue;
      if (answerMap[a.questionId]) {
        answerMap[a.questionId] += ', ' + (a.value || '');
      } else {
        answerMap[a.questionId] = a.value || '';
      }
    }
    const row = [
      r.first_name || '',
      r.last_name || '',
      r.email || '',
      r.responded_at ? new Date(r.responded_at).toLocaleDateString('fr-FR') : '',
      ...questions.map(q => answerMap[q.id] || ''),
    ];
    csvRows.push(row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="export-enquete.csv"`);
  return res.send('\uFEFF' + csvRows.join('\n'));
}
