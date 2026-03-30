#!/usr/bin/env node
/**
 * Fast batch import of survey CSV using multi-row INSERT
 */
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { randomUUID } from 'crypto';

config({ path: '.env.production' });
const prisma = new PrismaClient({ log: ['error'] });

const LIKERT_TERMS = ['excellent', 'très satisfaisant', 'satisfaisant', 'correct', 'insuffisant',
  'tout à fait d\'accord', 'plutôt d\'accord', 'plutôt pas d\'accord', 'pas du tout d\'accord'];

function detectType(values) {
  const ne = values.filter(v => v?.trim());
  if (!ne.length) return 'FREE_TEXT';
  if (ne.every(v => /^\d+$/.test(v.trim()))) {
    const nums = ne.map(Number);
    return (Math.min(...nums) >= 0 && Math.max(...nums) <= 10) ? 'NPS' : 'NUMERIC';
  }
  if (ne.some(v => LIKERT_TERMS.some(t => v.toLowerCase().includes(t)))) return 'LIKERT';
  if (ne.some(v => v.includes(', ') && v.length > 40)) return 'MULTIPLE_CHOICE';
  const u = new Set(ne.map(v => v.trim()));
  return u.size <= 15 ? 'SINGLE_CHOICE' : u.size > 50 ? 'FREE_TEXT' : 'SINGLE_CHOICE';
}

function shortLabel(label) {
  let s = label.replace(/^\d+\.\s*/, '').trim();
  const m = s.match(/\[(.+?)\]/);
  if (m) return m[1];
  return s.length > 60 ? s.substring(0, 57) + '…' : s;
}

function parseCSV(text) {
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inQ) {
      if (c === '"' && n === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || (c === '\r' && n === '\n')) {
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

function parseDate(str) {
  if (!str) return null;
  const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  return m ? new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}`) : null;
}

function detectGrouping(headers) {
  const g = {};
  for (const h of headers) {
    const m = h.match(/^(\d+)\.\s+(.+?)(?:\s*\[(.+?)\])?$/);
    if (m) { g[m[1]] = g[m[1]] || []; g[m[1]].push(h); }
  }
  const out = {};
  for (const [n, l] of Object.entries(g)) if (l.length > 1) l.forEach(h => out[h] = n);
  return out;
}

function esc(s) { return s ? s.replace(/'/g, "''") : ''; }

async function main() {
  const csvPath = process.argv[2];
  const title = process.argv[3] || 'Enquête importée';
  if (!csvPath) { console.error('Usage: node import-survey-fast.js <csv> [title]'); process.exit(1); }

  console.log(`📄 Lecture…`);
  const rows = parseCSV(readFileSync(csvPath, 'utf-8'));
  const headers = rows[0];
  const data = rows.slice(1).filter(r => r.some(c => c.trim()));
  console.log(`   ${headers.length} colonnes, ${data.length} répondants`);

  // Identity columns
  const id = { h: null, p: null, n: null, e: null };
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().trim();
    if (h.includes('horodateur') || h.includes('timestamp')) id.h = i;
    else if (h.includes('prénom') || h.includes('prenom')) id.p = i;
    else if (h.includes('nom') && !h.includes('prénom')) id.n = i;
    else if (h.includes('e-mail') || h.includes('email')) id.e = i;
  }

  const grouped = detectGrouping(headers);
  const fileName = csvPath.split('/').pop();

  // 1. Create survey
  const surveyId = randomUUID();
  await prisma.$queryRawUnsafe(`
    INSERT INTO surveys (id, title, description, source_file, respondents, created_at, updated_at)
    VALUES ($1, $2, NULL, $3, $4, NOW(), NOW())
  `, surveyId, title, fileName, data.length);
  console.log(`📊 Survey: ${surveyId}`);

  // 2. Create questions (batch)
  const qMap = {}; // colIndex -> { id, type }
  let pos = 0;
  const qValues = [];
  for (let i = 0; i < headers.length; i++) {
    if ([id.h, id.p, id.n, id.e].includes(i)) continue;
    pos++;
    const label = headers[i].trim();
    const vals = data.map(r => r[i] || '');
    const type = detectType(vals);
    const grp = grouped[label];
    const gLabel = grp ? label.replace(/\s*\[.+?\]\s*$/, '').replace(/^\d+\.\s*/, '').trim() : null;
    const qId = randomUUID();
    const sl = shortLabel(label);

    let opts = null;
    if (type === 'SINGLE_CHOICE' || type === 'LIKERT') {
      opts = [...new Set(vals.filter(v => v.trim()).map(v => v.trim()))];
    } else if (type === 'MULTIPLE_CHOICE') {
      const s = new Set(); vals.forEach(v => v.trim() && v.split(', ').forEach(o => o.trim() && s.add(o.trim()))); opts = [...s];
    }

    qMap[i] = { id: qId, type };
    qValues.push(`('${qId}','${surveyId}',${pos},'Q${pos}','${esc(label)}','${esc(sl)}','${type}',${!!grp},${gLabel ? `'${esc(gLabel)}'` : 'NULL'},${opts ? `'${esc(JSON.stringify(opts))}'::jsonb` : 'NULL'},false)`);
  }

  await prisma.$executeRawUnsafe(`
    INSERT INTO survey_questions (id, survey_id, position, question_key, label, short_label, type, is_grouped, group_label, options, is_identity)
    VALUES ${qValues.join(',\n')}
  `);
  console.log(`❓ ${qValues.length} questions créées`);

  // 3. Respondents + Answers in bigger batches
  console.log('👥 Import des répondants et réponses…');
  const BATCH = 25; // respondents per batch
  let done = 0;

  for (let b = 0; b < data.length; b += BATCH) {
    const batch = data.slice(b, b + BATCH);
    const respValues = [];
    const ansValues = [];

    for (const row of batch) {
      const rId = randomUUID();
      const dt = id.h !== null ? parseDate(row[id.h]) : null;
      const fn = id.p !== null ? esc((row[id.p] || '').trim()) : '';
      const ln = id.n !== null ? esc((row[id.n] || '').trim()) : '';
      const em = id.e !== null ? esc((row[id.e] || '').trim()) : '';

      respValues.push(`('${rId}','${surveyId}',${dt ? `'${dt.toISOString()}'` : 'NULL'},${fn ? `'${fn}'` : 'NULL'},${ln ? `'${ln}'` : 'NULL'},${em ? `'${em}'` : 'NULL'})`);

      for (let i = 0; i < headers.length; i++) {
        if (!qMap[i]) continue;
        const { id: qId, type } = qMap[i];
        const raw = (row[i] || '').trim();
        if (!raw) continue;

        if (type === 'MULTIPLE_CHOICE') {
          for (const opt of raw.split(', ').map(o => o.trim()).filter(Boolean)) {
            ansValues.push(`('${randomUUID()}','${rId}','${qId}','${esc(opt)}',NULL)`);
          }
        } else if (type === 'NPS' || type === 'NUMERIC') {
          const num = parseFloat(raw);
          ansValues.push(`('${randomUUID()}','${rId}','${qId}','${esc(raw)}',${isNaN(num) ? 'NULL' : num})`);
        } else {
          ansValues.push(`('${randomUUID()}','${rId}','${qId}','${esc(raw)}',NULL)`);
        }
      }
    }

    // Batch INSERT respondents
    if (respValues.length > 0) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO survey_respondents (id, survey_id, responded_at, first_name, last_name, email)
        VALUES ${respValues.join(',\n')}
      `);
    }

    // Batch INSERT answers (split if huge)
    const ANS_BATCH = 500;
    for (let a = 0; a < ansValues.length; a += ANS_BATCH) {
      const chunk = ansValues.slice(a, a + ANS_BATCH);
      await prisma.$executeRawUnsafe(`
        INSERT INTO survey_answers (id, respondent_id, question_id, value, numeric_value)
        VALUES ${chunk.join(',\n')}
      `);
    }

    done += batch.length;
    process.stdout.write(`\r   ${done}/${data.length} (${Math.round(done/data.length*100)}%)…`);
  }

  console.log(`\n\n✅ Import terminé !`);
  console.log(`   📊 ${title}`);
  console.log(`   👥 ${data.length} répondants`);
  console.log(`   ❓ ${Object.keys(qMap).length} questions`);

  const ansCt = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int as c FROM survey_answers WHERE question_id IN (SELECT id FROM survey_questions WHERE survey_id = $1)', surveyId);
  console.log(`   💬 ${ansCt[0].c} réponses individuelles`);

  await prisma.$disconnect();
}

main().catch(e => { console.error('❌', e); process.exit(1); });
