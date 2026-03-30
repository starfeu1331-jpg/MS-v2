#!/usr/bin/env node
/**
 * Import Survey CSV into the database
 * Usage: node scripts/import-survey.js "/path/to/file.csv" "Title"
 */
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config({ path: '.env.production' });
const prisma = new PrismaClient({ log: ['error'] });

const LIKERT_TERMS = ['excellent', 'très satisfaisant', 'satisfaisant', 'correct', 'insuffisant',
  'tout à fait d\'accord', 'plutôt d\'accord', 'plutôt pas d\'accord', 'pas du tout d\'accord'];

function detectQuestionType(values) {
  const nonEmpty = values.filter(v => v && v.trim());
  if (nonEmpty.length === 0) return 'FREE_TEXT';
  const allNumeric = nonEmpty.every(v => /^\d+$/.test(v.trim()));
  if (allNumeric) {
    const nums = nonEmpty.map(Number);
    return (Math.min(...nums) >= 0 && Math.max(...nums) <= 10) ? 'NPS' : 'NUMERIC';
  }
  if (nonEmpty.some(v => LIKERT_TERMS.some(t => v.toLowerCase().includes(t)))) return 'LIKERT';
  if (nonEmpty.some(v => v.includes(', ') && v.length > 40)) return 'MULTIPLE_CHOICE';
  const unique = new Set(nonEmpty.map(v => v.trim()));
  if (unique.size <= 15) return 'SINGLE_CHOICE';
  return unique.size > 50 ? 'FREE_TEXT' : 'SINGLE_CHOICE';
}

function makeShortLabel(label) {
  let s = label.replace(/^\d+\.\s*/, '').trim();
  const m = s.match(/\[(.+?)\]/);
  if (m) return m[1];
  return s.length > 60 ? s.substring(0, 57) + '…' : s;
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || (c === '\r' && next === '\n')) {
        row.push(field); field = '';
        if (row.some(f => f.trim())) rows.push(row);
        row = [];
        if (c === '\r') i++;
      } else field += c;
    }
  }
  row.push(field);
  if (row.some(f => f.trim())) rows.push(row);
  return rows;
}

function parseGFormsDate(str) {
  if (!str) return null;
  const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  return m ? new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}`) : null;
}

function detectGrouping(headers) {
  const groups = {};
  for (const h of headers) {
    const m = h.match(/^(\d+)\.\s+(.+?)(?:\s*\[(.+?)\])?$/);
    if (m) { groups[m[1]] = groups[m[1]] || []; groups[m[1]].push(h); }
  }
  const out = {};
  for (const [num, list] of Object.entries(groups)) {
    if (list.length > 1) list.forEach(h => out[h] = num);
  }
  return out;
}

async function main() {
  const csvPath = process.argv[2];
  const title = process.argv[3] || 'Enquête importée';

  if (!csvPath) {
    console.error('Usage: node import-survey.js <csv-path> [title]');
    process.exit(1);
  }

  console.log(`📄 Lecture de ${csvPath}…`);
  const text = readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(text);
  const headers = rows[0];
  const dataRows = rows.slice(1).filter(r => r.some(c => c.trim()));
  console.log(`   ${headers.length} colonnes, ${dataRows.length} répondants`);

  // Identity columns
  const idCols = { horodateur: null, prenom: null, nom: null, email: null };
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().trim();
    if (h.includes('horodateur') || h.includes('timestamp')) idCols.horodateur = i;
    else if (h.includes('prénom') || h.includes('prenom') || h === 'first name') idCols.prenom = i;
    else if (h.includes('nom') && !h.includes('prénom') && !h.includes('prenom')) idCols.nom = i;
    else if (h.includes('e-mail') || h.includes('email') || h.includes('adresse e-mail')) idCols.email = i;
  }

  const groupedMap = detectGrouping(headers);

  // Create survey
  console.log('📊 Création de l\'enquête…');
  const fileName = csvPath.split('/').pop();
  const [survey] = await prisma.$queryRawUnsafe(`
    INSERT INTO surveys (id, title, description, source_file, respondents, created_at, updated_at)
    VALUES (gen_random_uuid()::text, $1, NULL, $2, $3, NOW(), NOW())
    RETURNING id
  `, title, fileName, dataRows.length);
  const surveyId = survey.id;
  console.log(`   Survey ID: ${surveyId}`);

  // Create questions
  console.log('❓ Création des questions…');
  const questionMap = {};
  let position = 0;
  for (let i = 0; i < headers.length; i++) {
    if (Object.values(idCols).includes(i)) continue;
    position++;
    const label = headers[i].trim();
    const values = dataRows.map(r => r[i] || '');
    const type = detectQuestionType(values);
    const grouped = groupedMap[label];
    const groupLabel = grouped ? label.replace(/\s*\[.+?\]\s*$/, '').replace(/^\d+\.\s*/, '').trim() : null;
    const qKey = `Q${position}`;
    const shortLabel = makeShortLabel(label);

    let options = null;
    if (type === 'SINGLE_CHOICE' || type === 'LIKERT') {
      options = [...new Set(values.filter(v => v.trim()).map(v => v.trim()))];
    } else if (type === 'MULTIPLE_CHOICE') {
      const allOpts = new Set();
      values.forEach(v => v.trim() && v.split(', ').forEach(o => o.trim() && allOpts.add(o.trim())));
      options = [...allOpts];
    }

    const [q] = await prisma.$queryRawUnsafe(`
      INSERT INTO survey_questions (id, survey_id, position, question_key, label, short_label, type, is_grouped, group_label, options, is_identity)
      VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6::"SurveyQuestionType", $7, $8, $9::jsonb, false)
      RETURNING id
    `, surveyId, position, qKey, label, shortLabel, type, !!grouped, groupLabel, options ? JSON.stringify(options) : null);

    questionMap[i] = { id: q.id, type };
    console.log(`   ${qKey}: ${shortLabel} (${type})`);
  }

  // Create respondents + answers
  console.log('👥 Import des répondants…');
  const BATCH = 50;
  let count = 0;
  for (let b = 0; b < dataRows.length; b += BATCH) {
    const batch = dataRows.slice(b, b + BATCH);
    for (const row of batch) {
      const respondedAt = idCols.horodateur !== null ? parseGFormsDate(row[idCols.horodateur]) : null;
      const firstName = idCols.prenom !== null ? (row[idCols.prenom] || '').trim() : null;
      const lastName = idCols.nom !== null ? (row[idCols.nom] || '').trim() : null;
      const email = idCols.email !== null ? (row[idCols.email] || '').trim() : null;

      const [resp] = await prisma.$queryRawUnsafe(`
        INSERT INTO survey_respondents (id, survey_id, responded_at, first_name, last_name, email)
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5)
        RETURNING id
      `, surveyId, respondedAt, firstName, lastName, email);

      for (let i = 0; i < headers.length; i++) {
        if (!questionMap[i]) continue;
        const { id: qId, type } = questionMap[i];
        const raw = (row[i] || '').trim();
        if (!raw) continue;

        if (type === 'MULTIPLE_CHOICE') {
          for (const opt of raw.split(', ').map(o => o.trim()).filter(Boolean)) {
            await prisma.$queryRawUnsafe(`
              INSERT INTO survey_answers (id, respondent_id, question_id, value, numeric_value)
              VALUES (gen_random_uuid()::text, $1, $2, $3, NULL)
            `, resp.id, qId, opt);
          }
        } else if (type === 'NPS' || type === 'NUMERIC') {
          const num = parseFloat(raw);
          await prisma.$queryRawUnsafe(`
            INSERT INTO survey_answers (id, respondent_id, question_id, value, numeric_value)
            VALUES (gen_random_uuid()::text, $1, $2, $3, $4)
          `, resp.id, qId, raw, isNaN(num) ? null : num);
        } else {
          await prisma.$queryRawUnsafe(`
            INSERT INTO survey_answers (id, respondent_id, question_id, value, numeric_value)
            VALUES (gen_random_uuid()::text, $1, $2, $3, NULL)
          `, resp.id, qId, raw);
        }
      }
      count++;
    }
    process.stdout.write(`\r   ${count}/${dataRows.length} répondants importés…`);
  }

  console.log(`\n\n✅ Import terminé !`);
  console.log(`   📊 Enquête : ${title}`);
  console.log(`   👥 ${dataRows.length} répondants`);
  console.log(`   ❓ ${Object.keys(questionMap).length} questions`);

  await prisma.$disconnect();
}

main().catch(e => { console.error('❌', e); process.exit(1); });
