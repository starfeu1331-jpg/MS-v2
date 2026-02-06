import { PrismaClient } from '@prisma/client'
import ExcelJS from 'exceljs'

const prisma = new PrismaClient({ log: ['error', 'warn'] })

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    console.log('🔬 Génération Excel Audit RFM - Début')

    // 1. RÉCUPÉRER LES DONNÉES BRUTES (échantillon de 100 clients pour lisibilité)
    const rawData = await prisma.$queryRaw`
      WITH client_transactions AS (
        SELECT 
          t.carte,
          c.email,
          c.nom,
          c.prenom,
          c.ville,
          c.cp,
          MAX(t.date_vente)::date as derniere_visite,
          MIN(t.date_vente)::date as premiere_visite,
          COUNT(DISTINCT t.date_vente::date)::int as frequence,
          ROUND(SUM(t.ca)::numeric, 2)::float as montant_total
        FROM transactions t
        LEFT JOIN clients c ON t.carte = c.carte
        WHERE t.carte IS NOT NULL
        GROUP BY t.carte, c.email, c.nom, c.prenom, c.ville, c.cp
        HAVING COUNT(*) >= 2
      )
      SELECT *
      FROM client_transactions
      ORDER BY montant_total DESC
      LIMIT 100
    `

    // 2. CALCULER LES MÉTRIQUES RFM (avec toute la base pour les percentiles)
    const rfmMetrics = await prisma.$queryRaw`
      WITH client_metrics AS (
        SELECT 
          t.carte,
          CURRENT_DATE - MAX(t.date_vente)::date as recency,
          COUNT(DISTINCT t.date_vente::date)::int as frequency,
          SUM(t.ca)::float as monetary
        FROM transactions t
        WHERE t.carte IS NOT NULL
        GROUP BY t.carte
        HAVING COUNT(*) >= 2
      )
      SELECT 
        carte,
        recency,
        frequency,
        monetary,
        (6 - NTILE(5) OVER (ORDER BY recency ASC))::int as r_score,
        NTILE(5) OVER (ORDER BY frequency ASC)::int as f_score,
        NTILE(5) OVER (ORDER BY monetary ASC)::int as m_score
      FROM client_metrics
      ORDER BY monetary DESC
      LIMIT 100
    `

    // 3. CALCULER LES SEUILS DE QUINTILES
    const quintileThresholds = await prisma.$queryRaw`
      WITH client_metrics AS (
        SELECT 
          CURRENT_DATE - MAX(t.date_vente)::date as recency,
          COUNT(DISTINCT t.date_vente::date)::int as frequency,
          SUM(t.ca)::float as monetary
        FROM transactions t
        WHERE t.carte IS NOT NULL
        GROUP BY t.carte
        HAVING COUNT(*) >= 2
      )
      SELECT 
        PERCENTILE_CONT(0.2) WITHIN GROUP (ORDER BY recency) as r_q1,
        PERCENTILE_CONT(0.4) WITHIN GROUP (ORDER BY recency) as r_q2,
        PERCENTILE_CONT(0.6) WITHIN GROUP (ORDER BY recency) as r_q3,
        PERCENTILE_CONT(0.8) WITHIN GROUP (ORDER BY recency) as r_q4,
        PERCENTILE_CONT(0.2) WITHIN GROUP (ORDER BY frequency) as f_q1,
        PERCENTILE_CONT(0.4) WITHIN GROUP (ORDER BY frequency) as f_q2,
        PERCENTILE_CONT(0.6) WITHIN GROUP (ORDER BY frequency) as f_q3,
        PERCENTILE_CONT(0.8) WITHIN GROUP (ORDER BY frequency) as f_q4,
        PERCENTILE_CONT(0.2) WITHIN GROUP (ORDER BY monetary) as m_q1,
        PERCENTILE_CONT(0.4) WITHIN GROUP (ORDER BY monetary) as m_q2,
        PERCENTILE_CONT(0.6) WITHIN GROUP (ORDER BY monetary) as m_q3,
        PERCENTILE_CONT(0.8) WITHIN GROUP (ORDER BY monetary) as m_q4
      FROM client_metrics
    `

    const thresholds = quintileThresholds[0]

    // 4. CRÉER LE WORKBOOK EXCEL
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Magic Système'
    workbook.created = new Date()
    
    // ===============================
    // ONGLET 1: DONNÉES BRUTES
    // ===============================
    const sheetRaw = workbook.addWorksheet('1. Données Brutes', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    })
    
    sheetRaw.columns = [
      { header: 'N° Carte', key: 'carte', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Nom', key: 'nom', width: 20 },
      { header: 'Prénom', key: 'prenom', width: 20 },
      { header: 'Ville', key: 'ville', width: 20 },
      { header: 'CP', key: 'cp', width: 10 },
      { header: 'Dernière Visite', key: 'derniere_visite', width: 15 },
      { header: 'Première Visite', key: 'premiere_visite', width: 15 },
      { header: 'Fréquence', key: 'frequence', width: 12 },
      { header: 'Montant Total', key: 'montant_total', width: 15 }
    ]
    
    // Style d'en-tête
    sheetRaw.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheetRaw.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }
    }
    sheetRaw.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
    
    rawData.forEach(row => {
      sheetRaw.addRow({
        carte: row.carte,
        email: row.email || 'N/A',
        nom: row.nom || 'N/A',
        prenom: row.prenom || 'N/A',
        ville: row.ville || 'N/A',
        cp: row.cp || 'N/A',
        derniere_visite: row.derniere_visite?.toISOString().split('T')[0] || 'N/A',
        premiere_visite: row.premiere_visite?.toISOString().split('T')[0] || 'N/A',
        frequence: row.frequence,
        montant_total: row.montant_total
      })
    })

    // ===============================
    // ONGLET 2: MÉTRIQUES RFM
    // ===============================
    const sheetMetrics = workbook.addWorksheet('2. Métriques RFM', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    })
    
    sheetMetrics.columns = [
      { header: 'N° Carte', key: 'carte', width: 15 },
      { header: 'Recency (jours)', key: 'recency', width: 15 },
      { header: 'Frequency (visites)', key: 'frequency', width: 18 },
      { header: 'Monetary (€)', key: 'monetary', width: 15 }
    ]
    
    sheetMetrics.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheetMetrics.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' }
    }
    sheetMetrics.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
    
    rfmMetrics.forEach(row => {
      sheetMetrics.addRow({
        carte: row.carte,
        recency: row.recency,
        frequency: row.frequency,
        monetary: parseFloat(row.monetary).toFixed(2)
      })
    })

    // ===============================
    // ONGLET 3: SEUILS QUINTILES
    // ===============================
    const sheetThresholds = workbook.addWorksheet('3. Seuils Quintiles', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    })
    
    sheetThresholds.columns = [
      { header: 'Métrique', key: 'metric', width: 20 },
      { header: 'Quintile 1 (0-20%)', key: 'q1', width: 18 },
      { header: 'Quintile 2 (20-40%)', key: 'q2', width: 18 },
      { header: 'Quintile 3 (40-60%)', key: 'q3', width: 18 },
      { header: 'Quintile 4 (60-80%)', key: 'q4', width: 18 },
      { header: 'Quintile 5 (80-100%)', key: 'q5', width: 18 }
    ]
    
    sheetThresholds.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheetThresholds.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDC2626' }
    }
    sheetThresholds.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
    
    sheetThresholds.addRow({
      metric: 'Recency (jours)',
      q1: `≤ ${Math.round(thresholds.r_q1)}`,
      q2: `${Math.round(thresholds.r_q1) + 1} - ${Math.round(thresholds.r_q2)}`,
      q3: `${Math.round(thresholds.r_q2) + 1} - ${Math.round(thresholds.r_q3)}`,
      q4: `${Math.round(thresholds.r_q3) + 1} - ${Math.round(thresholds.r_q4)}`,
      q5: `> ${Math.round(thresholds.r_q4)}`
    })
    
    sheetThresholds.addRow({
      metric: 'Frequency (visites)',
      q1: `≤ ${Math.round(thresholds.f_q1)}`,
      q2: `${Math.round(thresholds.f_q1) + 1} - ${Math.round(thresholds.f_q2)}`,
      q3: `${Math.round(thresholds.f_q2) + 1} - ${Math.round(thresholds.f_q3)}`,
      q4: `${Math.round(thresholds.f_q3) + 1} - ${Math.round(thresholds.f_q4)}`,
      q5: `> ${Math.round(thresholds.f_q4)}`
    })
    
    sheetThresholds.addRow({
      metric: 'Monetary (€)',
      q1: `≤ ${Math.round(thresholds.m_q1)}€`,
      q2: `${Math.round(thresholds.m_q1) + 1}€ - ${Math.round(thresholds.m_q2)}€`,
      q3: `${Math.round(thresholds.m_q2) + 1}€ - ${Math.round(thresholds.m_q3)}€`,
      q4: `${Math.round(thresholds.m_q3) + 1}€ - ${Math.round(thresholds.m_q4)}€`,
      q5: `> ${Math.round(thresholds.m_q4)}€`
    })

    // ===============================
    // ONGLET 4: SCORES RFM (AVEC FORMULES)
    // ===============================
    const sheetScores = workbook.addWorksheet('4. Scores RFM', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    })
    
    sheetScores.columns = [
      { header: 'N° Carte', key: 'carte', width: 15 },
      { header: 'R (Recency)', key: 'r_score', width: 15 },
      { header: 'F (Frequency)', key: 'f_score', width: 15 },
      { header: 'M (Monetary)', key: 'm_score', width: 15 },
      { header: 'Score Total', key: 'total_score', width: 15 },
      { header: '% Position', key: 'percentile', width: 15 }
    ]
    
    sheetScores.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheetScores.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF7C3AED' }
    }
    sheetScores.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
    
    rfmMetrics.forEach((row, index) => {
      const rowNum = index + 2
      sheetScores.addRow({
        carte: row.carte,
        r_score: row.r_score,
        f_score: row.f_score,
        m_score: row.m_score,
        total_score: '', // Sera une formule
        percentile: '' // Sera une formule
      })
      
      // Ajouter les FORMULES (visible dans Excel)
      sheetScores.getCell(`E${rowNum}`).value = { formula: `B${rowNum}+C${rowNum}+D${rowNum}` }
      sheetScores.getCell(`F${rowNum}`).value = { formula: `ROUND((E${rowNum}/15)*100,0)&"%"` }
    })

    // ===============================
    // ONGLET 5: SEGMENTATION FINALE
    // ===============================
    const sheetSegments = workbook.addWorksheet('5. Segments Clients', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    })
    
    sheetSegments.columns = [
      { header: 'N° Carte', key: 'carte', width: 15 },
      { header: 'Nom', key: 'nom', width: 20 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Score Total', key: 'total_score', width: 12 },
      { header: 'Segment', key: 'segment', width: 20 },
      { header: 'Priorité', key: 'priorite', width: 12 }
    ]
    
    sheetSegments.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheetSegments.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEA580C' }
    }
    sheetSegments.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
    
    rfmMetrics.forEach((row, index) => {
      const totalScore = row.r_score + row.f_score + row.m_score
      const client = rawData.find(c => c.carte === row.carte)
      
      let segment = ''
      let priorite = ''
      
      if (totalScore >= 13) {
        segment = '👑 Champions'
        priorite = 'P1'
      } else if (totalScore >= 11) {
        segment = '⭐ Fidèles'
        priorite = 'P2'
      } else if (totalScore >= 9) {
        segment = '💎 Potentiels'
        priorite = 'P3'
      } else if (totalScore >= 7) {
        segment = '⚠️ Risque'
        priorite = 'P4'
      } else {
        segment = '😴 Endormis'
        priorite = 'P5'
      }
      
      const rowNum = index + 2
      sheetSegments.addRow({
        carte: row.carte,
        nom: client?.nom || 'N/A',
        email: client?.email || 'N/A',
        total_score: totalScore,
        segment: segment,
        priorite: priorite
      })
      
      // Colorer selon le segment
      const lastRow = sheetSegments.lastRow
      if (segment.includes('Champions')) {
        lastRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE047' } }
      } else if (segment.includes('Fidèles')) {
        lastRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF86EFAC' } }
      } else if (segment.includes('Potentiels')) {
        lastRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF93C5FD' } }
      } else if (segment.includes('Risque')) {
        lastRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBBF24' } }
      } else {
        lastRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCA5A5' } }
      }
    })

    // ===============================
    // ONGLET 6: DOCUMENTATION
    // ===============================
    const sheetDoc = workbook.addWorksheet('Documentation')
    sheetDoc.columns = [
      { header: 'Section', key: 'section', width: 30 },
      { header: 'Description', key: 'description', width: 80 }
    ]
    
    sheetDoc.getRow(1).font = { bold: true, size: 14 }
    sheetDoc.addRow({
      section: '🎯 Objectif',
      description: 'Ce fichier Excel contient TOUTES les étapes de calcul RFM avec formules visibles pour audit complet.'
    })
    sheetDoc.addRow({
      section: '📊 Onglet 1 - Données Brutes',
      description: 'Transactions agrégées par client : dernière visite, fréquence, montant total (100 meilleurs clients)'
    })
    sheetDoc.addRow({
      section: '📈 Onglet 2 - Métriques RFM',
      description: 'Calcul des 3 dimensions : Recency (jours depuis dernière visite), Frequency (nb visites), Monetary (CA total)'
    })
    sheetDoc.addRow({
      section: '🎚️ Onglet 3 - Seuils Quintiles',
      description: 'Seuils calculés par PERCENTILE pour diviser en 5 groupes égaux (20% chacun). Base: 144k clients.'
    })
    sheetDoc.addRow({
      section: '🔢 Onglet 4 - Scores RFM',
      description: 'Scores de 1 à 5 attribués selon quintiles. FORMULES VISIBLES : Score Total = R+F+M, % Position = (Total/15)*100'
    })
    sheetDoc.addRow({
      section: '🏆 Onglet 5 - Segments',
      description: 'Classification finale : Champions (13-15), Fidèles (11-12), Potentiels (9-10), Risque (7-8), Endormis (3-6)'
    })
    sheetDoc.addRow({
      section: '✅ Vérification',
      description: 'Double-cliquez sur une cellule de l\'onglet 4 pour voir la FORMULE de calcul. Tout est auditable manuellement.'
    })
    sheetDoc.addRow({
      section: '🔬 Algorithme',
      description: 'SQL: NTILE(5) OVER (ORDER BY metric) pour quintiles. R inversé: (6 - NTILE) car plus récent = meilleur.'
    })
    sheetDoc.addRow({
      section: '📅 Généré le',
      description: new Date().toLocaleString('fr-FR')
    })

    // Générer le buffer
    const buffer = await workbook.xlsx.writeBuffer()

    console.log('✅ Excel Audit RFM généré')

    // Retourner le fichier
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=RFM_Audit_Complet_${new Date().toISOString().split('T')[0]}.xlsx`)
    res.send(Buffer.from(buffer))

  } catch (error) {
    console.error('❌ Erreur génération Excel:', error)
    res.status(500).json({ 
      error: 'Erreur lors de la génération du fichier Excel',
      details: error.message 
    })
  } finally {
    await prisma.$disconnect()
  }
}
