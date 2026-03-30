#!/usr/bin/env node
/**
 * Migration : ajout des colonnes RFM pré-calculées sur la table clients
 * ─────────────────────────────────────────────────────────────────────
 * Colonnes ajoutées :
 *   rfm_r           INT      Score Récence (1-5)
 *   rfm_f           INT      Score Fréquence (1-5)
 *   rfm_m           INT      Score Montant (1-5)
 *   rfm_score       INT      Score combiné (R*100 + F*10 + M, ex: 555)
 *   rfm_segment     VARCHAR  Segment assigné (ex: 'Champions')
 *   rfm_computed_at TIMESTAMP  Date du dernier calcul
 *
 * Usage :
 *   node scripts/migrate-rfm-columns.js
 *
 * Idempotent : peut être relancé sans risque.
 */

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'

config({ path: '.env.production' })

const prisma = new PrismaClient()

async function migrate() {
  console.log('🔧 Migration : ajout des colonnes RFM à la table clients...')
  console.log('')

  const columns = [
    { name: 'rfm_r',           sql: 'ALTER TABLE clients ADD COLUMN IF NOT EXISTS rfm_r INT' },
    { name: 'rfm_f',           sql: 'ALTER TABLE clients ADD COLUMN IF NOT EXISTS rfm_f INT' },
    { name: 'rfm_m',           sql: 'ALTER TABLE clients ADD COLUMN IF NOT EXISTS rfm_m INT' },
    { name: 'rfm_score',       sql: 'ALTER TABLE clients ADD COLUMN IF NOT EXISTS rfm_score INT' },
    { name: 'rfm_segment',     sql: 'ALTER TABLE clients ADD COLUMN IF NOT EXISTS rfm_segment VARCHAR(30)' },
    { name: 'rfm_recency',     sql: 'ALTER TABLE clients ADD COLUMN IF NOT EXISTS rfm_recency INT' },
    { name: 'rfm_frequency',   sql: 'ALTER TABLE clients ADD COLUMN IF NOT EXISTS rfm_frequency INT' },
    { name: 'rfm_monetary',    sql: 'ALTER TABLE clients ADD COLUMN IF NOT EXISTS rfm_monetary NUMERIC' },
    { name: 'rfm_last_date',   sql: 'ALTER TABLE clients ADD COLUMN IF NOT EXISTS rfm_last_date TEXT' },
    { name: 'rfm_first_date',  sql: 'ALTER TABLE clients ADD COLUMN IF NOT EXISTS rfm_first_date TEXT' },
    { name: 'rfm_computed_at', sql: 'ALTER TABLE clients ADD COLUMN IF NOT EXISTS rfm_computed_at TIMESTAMPTZ' },
  ]

  for (const col of columns) {
    try {
      await prisma.$executeRawUnsafe(col.sql)
      console.log(`  ✅ ${col.name}`)
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log(`  ⏭️  ${col.name} (existe déjà)`)
      } else {
        throw e
      }
    }
  }

  // Index sur rfm_segment pour les requêtes filtrées
  console.log('')
  console.log('📇 Création de l\'index sur rfm_segment...')
  try {
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_clients_rfm_segment ON clients (rfm_segment)
    `)
    console.log('  ✅ idx_clients_rfm_segment')
  } catch (e) {
    console.log(`  ⏭️  idx_clients_rfm_segment (existe déjà)`)
  }

  // Index composite pour les lookups rapides RFM
  try {
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_clients_rfm_scores ON clients (rfm_r, rfm_f, rfm_m) WHERE rfm_r IS NOT NULL
    `)
    console.log('  ✅ idx_clients_rfm_scores')
  } catch (e) {
    console.log(`  ⏭️  idx_clients_rfm_scores (existe déjà)`)
  }

  // Vérification
  console.log('')
  const count = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) as total FROM clients
  `)
  console.log(`📊 Table clients : ${Number(count[0].total).toLocaleString('fr-FR')} lignes`)

  const check = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name LIKE 'rfm_%' 
    ORDER BY column_name
  `)
  console.log(`✅ Colonnes RFM vérifiées :`)
  check.forEach(c => console.log(`   ${c.column_name} (${c.data_type})`))

  console.log('')
  console.log('✅ Migration terminée. Exécutez maintenant :')
  console.log('   node scripts/compute-rfm.js')
}

migrate()
  .catch(e => {
    console.error('❌ Erreur migration :', e.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
