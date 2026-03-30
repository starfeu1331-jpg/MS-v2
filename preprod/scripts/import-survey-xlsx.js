#!/usr/bin/env node
/**
 * Import survey: "Questionnaire Non-Client / Étude de marché"
 * - Reads from pre-converted CSV
 * - Handles "|" as multi-choice separator
 * - Handles "-" as skip/routing (not stored)
 * - Explicit question type mapping per question
 * - Grouped sub-questions (Q14-*, Q16-*, Q21-*)
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';

config({ path: '.env.production' });
const prisma = new PrismaClient({ log: ['error'] });

function esc(s) { return s ? s.replace(/'/g, "''") : ''; }

// ── Question definitions (manual mapping based on analysis) ──
const QUESTION_DEFS = [
  // col, key, shortLabel, type, groupLabel
  [2,  'Q1',   'Sexe', 'SINGLE_CHOICE', null],
  [3,  'Q2',   'Tranche d\'âge', 'SINGLE_CHOICE', null],
  [4,  'Q3',   'Catégorie socio-professionnelle', 'SINGLE_CHOICE', null],
  [5,  'Q4',   'Activité principale', 'FREE_TEXT', null],
  [6,  'Q5',   'Situation de logement', 'SINGLE_CHOICE', null],
  [7,  'Q6',   'Revenu net mensuel du foyer', 'SINGLE_CHOICE', null],
  [8,  'Q7',   'Projets habitat 24 derniers mois', 'MULTIPLE_CHOICE', null],
  [9,  'Q8',   'Enseignes connues (notoriété)', 'MULTIPLE_CHOICE', null],
  [10, 'Q9',   'Rapport à Décor Discount', 'SINGLE_CHOICE', null],
  [11, 'Q10',  'Type(s) de projet réalisé/prévu', 'MULTIPLE_CHOICE', null],
  [12, 'Q11',  'Budget total du projet', 'SINGLE_CHOICE', null],
  [13, 'Q12',  'Mode d\'achat', 'MULTIPLE_CHOICE', null],
  [14, 'Q13',  'Lieux d\'achat', 'MULTIPLE_CHOICE', null],
  // Q14 grouped: importance critères
  [15, 'Q14-1', 'Le niveau de prix', 'LIKERT', 'Importance des critères de choix d\'enseigne'],
  [16, 'Q14-2', 'La qualité des conseils en magasin', 'LIKERT', 'Importance des critères de choix d\'enseigne'],
  [17, 'Q14-3', 'Le large choix de produits', 'LIKERT', 'Importance des critères de choix d\'enseigne'],
  [18, 'Q14-4', 'Les services proposés (livraison, pose…)', 'LIKERT', 'Importance des critères de choix d\'enseigne'],
  [19, 'Q14-5', 'L\'inspiration / idées déco', 'LIKERT', 'Importance des critères de choix d\'enseigne'],
  [20, 'Q14-6', 'La notoriété / confiance enseigne', 'LIKERT', 'Importance des critères de choix d\'enseigne'],
  [21, 'Q14-7', 'Les promotions en cours', 'LIKERT', 'Importance des critères de choix d\'enseigne'],
  [22, 'Q14-8', 'Le stock disponible', 'LIKERT', 'Importance des critères de choix d\'enseigne'],
  [23, 'Q14-9', 'La qualité des produits', 'LIKERT', 'Importance des critères de choix d\'enseigne'],
  [24, 'Q15',  'Préférence taille magasin', 'SINGLE_CHOICE', null],
  // Q16 grouped: perception prix bas par univers
  [25, 'Q16-1', 'Revêtement de sol intérieur', 'LIKERT', 'Perception prix bas par univers produit'],
  [26, 'Q16-2', 'Gazon synthétique', 'LIKERT', 'Perception prix bas par univers produit'],
  [27, 'Q16-3', 'Peinture', 'LIKERT', 'Perception prix bas par univers produit'],
  [28, 'Q16-4', 'Papier peint / revêtement mural', 'LIKERT', 'Perception prix bas par univers produit'],
  [29, 'Q16-5', 'Tissus / mercerie', 'LIKERT', 'Perception prix bas par univers produit'],
  [30, 'Q16-6', 'Décoration intérieure', 'LIKERT', 'Perception prix bas par univers produit'],
  [31, 'Q17',  'Image "Décor Discount" (particuliers)', 'SINGLE_CHOICE', null],
  [32, 'Q18',  'Évocation du mot "discount" (particuliers)', 'MULTIPLE_CHOICE', null],
  // Q19-Q20: conditional (connaissent de nom only)
  [33, 'Q19',  'Raisons de non-achat (connaissent de nom)', 'MULTIPLE_CHOICE', null],
  [34, 'Q20',  'Incitations possibles à l\'achat', 'MULTIPLE_CHOICE', null],
  // Q21 grouped: crédibilité DD par univers (conditional)
  [35, 'Q21-1', 'Revêtement de sol intérieur', 'LIKERT', 'Crédibilité Décor Discount par univers'],
  [36, 'Q21-2', 'Gazon synthétique', 'LIKERT', 'Crédibilité Décor Discount par univers'],
  [37, 'Q21-3', 'Peinture', 'LIKERT', 'Crédibilité Décor Discount par univers'],
  [38, 'Q21-4', 'Papier peint / revêtement mural', 'LIKERT', 'Crédibilité Décor Discount par univers'],
  [39, 'Q21-5', 'Tissus / mercerie', 'LIKERT', 'Crédibilité Décor Discount par univers'],
  [40, 'Q21-6', 'Décoration intérieure', 'LIKERT', 'Crédibilité Décor Discount par univers'],
  // Q22-Q26: conditional (pros only)
  [41, 'Q22',  'Critères choix enseigne (pros)', 'MULTIPLE_CHOICE', null],
  [42, 'Q23',  'Image "Décor Discount" (pros)', 'SINGLE_CHOICE', null],
  [43, 'Q24',  'Évocation du mot "discount" (pros)', 'MULTIPLE_CHOICE', null],
  [44, 'Q25',  'Raisons non-utilisation DD (pros)', 'MULTIPLE_CHOICE', null],
  [45, 'Q26',  'Éléments indispensables nouveau fournisseur (pros)', 'MULTIPLE_CHOICE', null],
  [46, 'Q27',  'Code postal', 'FREE_TEXT', null],
];

// ── CSV parser ──
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

async function main() {
  const csvPath = process.argv[2] || '/tmp/questionnaire_non_client.csv';
  const title = process.argv[3] || 'Étude de marché – Non-clients (Mars 2026)';

  console.log('📄 Lecture du fichier CSV…');
  const rows = parseCSV(readFileSync(csvPath, 'utf-8'));
  const headers = rows[0];
  const data = rows.slice(1).filter(r => r[0] && r[0].trim() !== '');
  console.log(`   ${headers.length} colonnes, ${data.length} répondants`);

  // Build options for each question by scanning data
  const questionOptions = {};
  for (const [col, key, , type] of QUESTION_DEFS) {
    if (type === 'SINGLE_CHOICE' || type === 'LIKERT') {
      const vals = new Set();
      for (const row of data) {
        const v = (row[col] || '').trim();
        if (v && v !== '-') vals.add(v);
      }
      questionOptions[key] = [...vals];
    } else if (type === 'MULTIPLE_CHOICE') {
      const vals = new Set();
      for (const row of data) {
        const v = (row[col] || '').trim();
        if (v && v !== '-') {
          for (const opt of v.split('|')) {
            const t = opt.trim();
            if (t) vals.add(t);
          }
        }
      }
      questionOptions[key] = [...vals];
    }
  }

  // 1. Create survey
  const surveyId = randomUUID();
  await prisma.$queryRawUnsafe(
    `INSERT INTO surveys (id, title, description, source_file, respondents, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
    surveyId, title,
    'Étude quantitative auprès de non-clients Décor Discount – Panel national, 589 répondants. Analyse notoriété, image, critères de choix, perception prix, crédibilité par univers produit.',
    'questionnaire non client mi data.xlsx', data.length
  );
  console.log(`📊 Survey créée: ${surveyId}`);

  // 2. Create questions
  const qMap = {}; // key -> { id, col, type }
  const qInserts = [];
  for (let pos = 0; pos < QUESTION_DEFS.length; pos++) {
    const [col, key, shortLabel, type, groupLabel] = QUESTION_DEFS[pos];
    const fullLabel = headers[col] ? headers[col].trim() : key;
    const qId = randomUUID();
    const opts = questionOptions[key] || null;

    qMap[key] = { id: qId, col, type };

    qInserts.push(
      `('${qId}','${surveyId}',${pos + 1},'${esc(key)}','${esc(fullLabel)}','${esc(shortLabel)}','${type}',${groupLabel ? 'true' : 'false'},${groupLabel ? `'${esc(groupLabel)}'` : 'NULL'},${opts ? `'${esc(JSON.stringify(opts))}'::jsonb` : 'NULL'},false)`
    );
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO survey_questions (id, survey_id, position, question_key, label, short_label, type, is_grouped, group_label, options, is_identity)
     VALUES ${qInserts.join(',\n')}`
  );
  console.log(`❓ ${qInserts.length} questions créées`);

  // 3. Import respondents + answers in batches
  console.log('👥 Import des répondants et réponses…');
  const BATCH_SIZE = 25;
  let totalAnswers = 0;

  for (let b = 0; b < data.length; b += BATCH_SIZE) {
    const batch = data.slice(b, b + BATCH_SIZE);
    const respValues = [];
    const ansValues = [];

    for (const row of batch) {
      const respondentId = randomUUID();

      // No identity columns in this XLSX (no email, no name, just "Répondant n°X")
      respValues.push(
        `('${respondentId}','${surveyId}',NULL,NULL,NULL,NULL)`
      );

      for (const def of QUESTION_DEFS) {
        const [col, key, , type] = def;
        const q = qMap[key];
        const raw = (row[col] ?? '').trim();

        // Skip empty or "-" (routing skip)
        if (!raw || raw === '-') continue;

        if (type === 'MULTIPLE_CHOICE') {
          // Split by "|"
          for (const opt of raw.split('|').map(o => o.trim()).filter(Boolean)) {
            ansValues.push(`('${randomUUID()}','${respondentId}','${q.id}','${esc(opt)}',NULL)`);
            totalAnswers++;
          }
        } else if (type === 'NUMERIC') {
          const num = parseFloat(raw);
          ansValues.push(`('${randomUUID()}','${respondentId}','${q.id}','${esc(raw)}',${isNaN(num) ? 'NULL' : num})`);
          totalAnswers++;
        } else {
          // SINGLE_CHOICE, LIKERT, FREE_TEXT
          ansValues.push(`('${randomUUID()}','${respondentId}','${q.id}','${esc(raw)}',NULL)`);
          totalAnswers++;
        }
      }
    }

    // INSERT respondents
    if (respValues.length > 0) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO survey_respondents (id, survey_id, responded_at, first_name, last_name, email)
         VALUES ${respValues.join(',\n')}`
      );
    }

    // INSERT answers in chunks
    const ANS_CHUNK = 500;
    for (let a = 0; a < ansValues.length; a += ANS_CHUNK) {
      const chunk = ansValues.slice(a, a + ANS_CHUNK);
      await prisma.$executeRawUnsafe(
        `INSERT INTO survey_answers (id, respondent_id, question_id, value, numeric_value)
         VALUES ${chunk.join(',\n')}`
      );
    }

    process.stdout.write(`\r   ${Math.min(b + BATCH_SIZE, data.length)}/${data.length} répondants importés…`);
  }

  console.log(`\n✅ Import terminé !`);
  console.log(`   📊 ${data.length} répondants`);
  console.log(`   ❓ ${QUESTION_DEFS.length} questions`);
  console.log(`   💬 ${totalAnswers} réponses individuelles`);
  console.log(`   🆔 Survey ID: ${surveyId}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
