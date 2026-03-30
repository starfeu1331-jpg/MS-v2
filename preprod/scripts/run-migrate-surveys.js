import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config({ path: '.env.production' });

const prisma = new PrismaClient();

async function migrate() {
  const statements = [
    // Enum
    `DO $$ BEGIN CREATE TYPE "SurveyQuestionType" AS ENUM ('SINGLE_CHOICE','MULTIPLE_CHOICE','LIKERT','NPS','FREE_TEXT','NUMERIC'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

    // Table surveys
    `CREATE TABLE IF NOT EXISTS surveys (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      title TEXT NOT NULL,
      description TEXT,
      source_file TEXT,
      respondents INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // Table questions
    `CREATE TABLE IF NOT EXISTS survey_questions (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      question_key TEXT NOT NULL,
      label TEXT NOT NULL,
      short_label TEXT,
      type "SurveyQuestionType" NOT NULL,
      is_grouped BOOLEAN DEFAULT false,
      group_label TEXT,
      options JSONB,
      is_identity BOOLEAN DEFAULT false
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sq_survey ON survey_questions(survey_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_sq_survey_key ON survey_questions(survey_id, question_key)`,

    // Table respondents
    `CREATE TABLE IF NOT EXISTS survey_respondents (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
      responded_at TIMESTAMPTZ,
      first_name TEXT,
      last_name TEXT,
      email TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sr_survey ON survey_respondents(survey_id)`,

    // Table answers (EAV)
    `CREATE TABLE IF NOT EXISTS survey_answers (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      respondent_id TEXT NOT NULL REFERENCES survey_respondents(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
      value TEXT,
      numeric_value DOUBLE PRECISION
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sa_respondent ON survey_answers(respondent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sa_question ON survey_answers(question_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sa_question_value ON survey_answers(question_id, value)`,
  ];

  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log('OK:', stmt.substring(0, 60) + '...');
    } catch (e) {
      console.log('ERR:', e.message.substring(0, 120));
    }
  }
  await prisma.$disconnect();
  console.log('\n✅ Migration surveys terminée');
}

migrate().catch(e => { console.error(e); process.exit(1); });
