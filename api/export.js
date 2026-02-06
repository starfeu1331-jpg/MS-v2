import { PrismaClient } from '@prisma/client'
import ExcelJS from 'exceljs'

const prisma = new PrismaClient({ log: ['error', 'warn'] })

const serializeJSON = (obj) => {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  ))
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { type } = req.query

  // Route vers export RFM pour IA
  if (type === 'rfm-ai') {
    return handleRFMAIExport(req, res)
  }

  // Route vers export RFM Audit Excel
  if (type === 'rfm-audit-excel') {
    return handleRFMAuditExcel(req, res)
  }

  // Export normal
  try {
    console.log('🚀 Export API - Début');

    // 1. Familles
    const famillesData = await prisma.$queryRaw`
      SELECT 
        p.famille,
        SUM(t.ca)::float as ca,
        COUNT(*)::int as volume
      FROM transactions t
      JOIN produits p ON t.produit = p.id
      WHERE p.famille IS NOT NULL AND p.famille != ''
      GROUP BY p.famille
      ORDER BY ca DESC
    `;

    // 2. Top 100 Produits
    const produitsData = await prisma.$queryRaw`
      SELECT 
        p.id as numero,
        p.famille,
        p.sous_famille as "sousFamille",
        SUM(t.ca)::float as ca,
        COUNT(*)::int as volume
      FROM transactions t
      JOIN produits p ON t.produit = p.id
      GROUP BY p.id, p.famille, p.sous_famille
      ORDER BY ca DESC
      LIMIT 100
    `;

    // 3. Top 100 Clients
    const clientsData = await prisma.$queryRaw`
      SELECT 
        c.carte,
        c.nom,
        c.prenom,
        c.email,
        c.telephone,
        c.sexe,
        c.ville,
        c.cp,
        SUM(t.ca)::float as ca_total,
        COUNT(DISTINCT t.facture)::int as nb_achats,
        (SUM(t.ca) / COUNT(DISTINCT t.facture))::float as panier_moyen,
        MAX(t.date)::text as dernier_achat
      FROM transactions t
      JOIN clients c ON t.carte = c.carte
      WHERE t.carte != '0'
      GROUP BY c.carte, c.nom, c.prenom, c.email, c.telephone, c.sexe, c.ville, c.cp
      ORDER BY ca_total DESC
      LIMIT 100
    `;

    // 4. Magasins
    const magasinsData = await prisma.$queryRaw`
      SELECT 
        t.depot as magasin,
        SUM(t.ca)::float as ca,
        COUNT(*)::int as volume,
        (SUM(t.ca) / COUNT(*))::float as panier_moyen
      FROM transactions t
      WHERE t.depot IS NOT NULL AND t.depot != ''
      GROUP BY t.depot
      ORDER BY ca DESC
    `;

    // 5. Stats globales
    const statsGlobales = await prisma.$queryRaw`
      SELECT 
        SUM(ca)::float as ca_total,
        COUNT(*)::int as nb_transactions,
        COUNT(DISTINCT carte)::int as nb_clients
      FROM transactions
      WHERE carte != '0'
    `;

    const webStats = await prisma.$queryRaw`
      SELECT 
        SUM(ca)::float as ca,
        COUNT(*)::int as volume
      FROM transactions
      WHERE depot = 'WEB'
    `;

    const fideliteStats = await prisma.$queryRaw`
      WITH client_purchases AS (
        SELECT carte, COUNT(DISTINCT facture) as nb_achats
        FROM transactions
        WHERE carte != '0'
        GROUP BY carte
      )
      SELECT 
        SUM(CASE WHEN nb_achats > 1 THEN 1 ELSE 0 END)::int as fideles,
        SUM(CASE WHEN nb_achats = 1 THEN 1 ELSE 0 END)::int as non_fideles
      FROM client_purchases
    `;

    // Formater les résultats
    const familles = {};
    famillesData.forEach(f => {
      familles[f.famille] = {
        ca: f.ca || 0,
        volume: f.volume || 0
      };
    });

    const produits = {};
    produitsData.forEach(p => {
      produits[p.numero] = {
        famille: p.famille || 'Non défini',
        sousFamille: p.sousFamille || 'Non défini',
        ca: p.ca || 0,
        volume: p.volume || 0
      };
    });

    const allClients = new Map();
    clientsData.forEach(c => {
      allClients.set(c.carte, {
        ville: c.ville || '',
        cp: c.cp || '',
        ca_total: c.ca_total || 0,
        achats: Array(c.nb_achats || 0).fill(null),
        panier_moyen: c.panier_moyen || 0
      });
    });

    const magasinsObj = {};
    magasinsData.forEach(m => {
      magasinsObj[m.magasin] = {
        ca: m.ca || 0,
        volume: m.volume || 0,
        panier_moyen: m.panier_moyen || 0
      };
    });

    const result = {
      familles,
      produits,
      allClients: Array.from(allClients.entries()).map(([carte, data]) => ({
        carte,
        ...data
      })),
      geo: {
        magasins: magasinsObj
      },
      webStats: {
        ca: webStats[0]?.ca || 0,
        volume: webStats[0]?.volume || 0
      },
      fidelite: {
        oui: fideliteStats[0]?.fideles || 0,
        non: fideliteStats[0]?.non_fideles || 0
      },
      stats: {
        ca_total: statsGlobales[0]?.ca_total || 0,
        nb_transactions: statsGlobales[0]?.nb_transactions || 0,
        nb_clients: statsGlobales[0]?.nb_clients || 0
      }
    };

    res.status(200).json(serializeJSON(result));
  } catch (error) {
    console.error('❌ Erreur Export API:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORT RFM POUR IA - Handler séparé
// ═══════════════════════════════════════════════════════════════════════
async function handleRFMAIExport(req, res) {
  try {
    console.log('🤖 Export RFM pour IA - Début')
    const today = new Date()

    // 1. Récupérer TOUTES les données RFM avec segmentation
    const clientsRFM = await prisma.$queryRawUnsafe(`
      WITH client_metrics AS (
        SELECT 
          c.carte::text,
          c.nom::text,
          c.prenom::text,
          c.email::text,
          c.telephone::text,
          c.sexe::text,
          c.ville::text,
          c.cp::text,
          COUNT(t.id)::int as frequency,
          SUM(t.ca)::numeric as monetary,
          EXTRACT(DAY FROM (CURRENT_DATE - MAX(t.date)))::int as recency,
          MAX(t.date)::text as last_date,
          MIN(t.date)::text as first_date
        FROM clients c
        INNER JOIN transactions t ON c.carte = t.carte
        WHERE c.carte != '0'
        GROUP BY c.carte, c.nom, c.prenom, c.email, c.telephone, c.sexe, c.ville, c.cp
        HAVING SUM(t.ca) > 0
      ),
      rfm_scores AS (
        SELECT 
          carte, nom, prenom, email, telephone, sexe, ville, cp,
          frequency, monetary, recency, last_date, first_date,
          (6 - NTILE(5) OVER (ORDER BY recency ASC))::int as r,
          (6 - NTILE(5) OVER (ORDER BY frequency DESC))::int as f,
          (6 - NTILE(5) OVER (ORDER BY monetary DESC))::int as m
        FROM client_metrics
      )
      SELECT * FROM rfm_scores ORDER BY monetary DESC
    `)

    // 2. Appliquer la segmentation
    const clientsWithSegments = clientsRFM.map(client => {
      const R = parseInt(client.r)
      const F = parseInt(client.f)
      const M = parseInt(client.m)
      
      let segment = ''
      if (R === 5 && F === 5 && M === 5) {
        segment = 'Ultra Champions'
      } else if (R >= 4 && F >= 4 && M >= 4) {
        segment = 'Champions'
      } else if (R >= 3 && F >= 3 && M >= 3) {
        segment = 'Loyaux'
      } else if (R >= 4 && F === 3) {
        segment = 'Nouveaux'
      } else if (R === 3 && F === 3) {
        segment = 'Occasionnels'
      } else if (F >= 3 && R <= 2) {
        segment = 'À Risque'
      } else {
        segment = 'Perdus'
      }
      
      return { ...client, segment, R, F, M }
    })

    // 3. Calculer les statistiques globales
    const totalClients = clientsWithSegments.length
    const totalCA = clientsWithSegments.reduce((sum, c) => sum + parseFloat(c.monetary), 0)
    const avgRecency = clientsWithSegments.reduce((sum, c) => sum + parseInt(c.recency), 0) / totalClients
    const avgFrequency = clientsWithSegments.reduce((sum, c) => sum + parseInt(c.frequency), 0) / totalClients
    const avgMonetary = totalCA / totalClients

    // 4. Stats par segment
    const segmentStats = {}
    const segments = ['Ultra Champions', 'Champions', 'Loyaux', 'Nouveaux', 'Occasionnels', 'À Risque', 'Perdus']
    
    segments.forEach(seg => {
      const clients = clientsWithSegments.filter(c => c.segment === seg)
      const count = clients.length
      const ca = clients.reduce((sum, c) => sum + parseFloat(c.monetary), 0)
      const avgRec = count > 0 ? clients.reduce((sum, c) => sum + parseInt(c.recency), 0) / count : 0
      const avgFreq = count > 0 ? clients.reduce((sum, c) => sum + parseInt(c.frequency), 0) / count : 0
      const avgMon = count > 0 ? ca / count : 0
      
      // Stats H/F pour ce segment
      const hommes = clients.filter(c => c.sexe === 'H').length
      const femmes = clients.filter(c => c.sexe === 'F').length
      const caHommes = clients.filter(c => c.sexe === 'H').reduce((sum, c) => sum + parseFloat(c.monetary), 0)
      const caFemmes = clients.filter(c => c.sexe === 'F').reduce((sum, c) => sum + parseFloat(c.monetary), 0)
      
      segmentStats[seg] = {
        count,
        percentage: (count / totalClients * 100).toFixed(2),
        ca: ca.toFixed(2),
        caPercentage: (ca / totalCA * 100).toFixed(2),
        avgRecency: avgRec.toFixed(1),
        avgFrequency: avgFreq.toFixed(1),
        avgMonetary: avgMon.toFixed(2),
        hommes,
        femmes,
        pourcentageHommes: hommes + femmes > 0 ? (hommes / (hommes + femmes) * 100).toFixed(1) : 0,
        pourcentageFemmes: hommes + femmes > 0 ? (femmes / (hommes + femmes) * 100).toFixed(1) : 0,
        caHommes: caHommes.toFixed(2),
        caFemmes: caFemmes.toFixed(2),
        panierMoyenHommes: hommes > 0 ? (caHommes / hommes).toFixed(2) : 0,
        panierMoyenFemmes: femmes > 0 ? (caFemmes / femmes).toFixed(2) : 0
      }
    })

    // 5. Stats globales H/F
    const statsGlobalesHF = {
      totalHommes: clientsWithSegments.filter(c => c.sexe === 'H').length,
      totalFemmes: clientsWithSegments.filter(c => c.sexe === 'F').length,
      caHommes: clientsWithSegments.filter(c => c.sexe === 'H').reduce((sum, c) => sum + parseFloat(c.monetary), 0).toFixed(2),
      caFemmes: clientsWithSegments.filter(c => c.sexe === 'F').reduce((sum, c) => sum + parseFloat(c.monetary), 0).toFixed(2)
    }

    // 6. Distribution des scores
    const distributionR = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    const distributionF = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    const distributionM = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    
    clientsWithSegments.forEach(c => {
      distributionR[c.R]++
      distributionF[c.F]++
      distributionM[c.M]++
    })

    // 7. Top 10 villes
    const villesStats = {}
    clientsWithSegments.forEach(c => {
      const ville = c.ville || 'Inconnue'
      if (!villesStats[ville]) {
        villesStats[ville] = { count: 0, ca: 0 }
      }
      villesStats[ville].count++
      villesStats[ville].ca += parseFloat(c.monetary)
    })
    
    const topVilles = Object.entries(villesStats)
      .sort((a, b) => b[1].ca - a[1].ca)
      .slice(0, 10)
      .map(([ville, stats]) => ({
        ville,
        clients: stats.count,
        ca: stats.ca.toFixed(2),
        panierMoyen: (stats.ca / stats.count).toFixed(2)
      }))

    // 8. Générer le document texte formaté pour l'IA
    const document = generateAIDocument({
      totalClients,
      totalCA,
      avgRecency,
      avgFrequency,
      avgMonetary,
      segmentStats,
      statsGlobalesHF,
      distributionR,
      distributionF,
      distributionM,
      topVilles,
      dateAnalyse: today.toLocaleDateString('fr-FR')
    })

    // Retourner à la fois le texte et les données structurées
    res.status(200).json({
      success: true,
      document,
      rawData: {
        totalClients,
        totalCA: totalCA.toFixed(2),
        segmentStats,
        statsGlobalesHF,
        topVilles
      }
    })

  } catch (error) {
    console.error('❌ Erreur Export RFM IA:', error)
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

// Fonction pour générer le document formaté pour l'IA
function generateAIDocument(data) {
  const {
    totalClients, totalCA, avgRecency, avgFrequency, avgMonetary,
    segmentStats, statsGlobalesHF, distributionR, distributionF, distributionM,
    topVilles, dateAnalyse
  } = data

  return `
═══════════════════════════════════════════════════════════════════════
        ANALYSE RFM COMPLÈTE - DOCUMENT POUR ANALYSE QUALITATIVE IA
═══════════════════════════════════════════════════════════════════════

Date de l'analyse : ${dateAnalyse}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. VUE D'ENSEMBLE DE LA CLIENTÈLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Notre base de données contient ${totalClients.toLocaleString('fr-FR')} clients actifs qui ont 
généré un chiffre d'affaires total de ${totalCA.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}€.

▸ COMPORTEMENT MOYEN D'UN CLIENT :
  • Récence moyenne : ${avgRecency.toFixed(1)} jours depuis le dernier achat
  • Fréquence moyenne : ${avgFrequency.toFixed(1)} achats par client
  • Montant moyen dépensé : ${avgMonetary.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}€ par client

▸ RÉPARTITION HOMMES / FEMMES :
  • Hommes : ${statsGlobalesHF.totalHommes.toLocaleString('fr-FR')} clients (${(statsGlobalesHF.totalHommes / totalClients * 100).toFixed(1)}%)
    → CA généré : ${parseFloat(statsGlobalesHF.caHommes).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}€
    → Panier moyen : ${(statsGlobalesHF.caHommes / statsGlobalesHF.totalHommes).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}€
  
  • Femmes : ${statsGlobalesHF.totalFemmes.toLocaleString('fr-FR')} clients (${(statsGlobalesHF.totalFemmes / totalClients * 100).toFixed(1)}%)
    → CA généré : ${parseFloat(statsGlobalesHF.caFemmes).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}€
    → Panier moyen : ${(statsGlobalesHF.caFemmes / statsGlobalesHF.totalFemmes).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}€

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. ANALYSE DÉTAILLÉE PAR SEGMENT RFM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${Object.entries(segmentStats).map(([segment, stats]) => `
┌─────────────────────────────────────────────────────────────────────┐
│ ${segment.toUpperCase().padEnd(67, ' ')} │
└─────────────────────────────────────────────────────────────────────┘

Ce segment représente ${stats.count.toLocaleString('fr-FR')} clients (${stats.percentage}% de la base),
qui génèrent ${parseFloat(stats.ca).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}€ de CA (${stats.caPercentage}% du CA total).

▸ COMPORTEMENT D'ACHAT :
  • Récence moyenne : ${stats.avgRecency} jours (dernier achat il y a ${stats.avgRecency} jours en moyenne)
  • Fréquence moyenne : ${stats.avgFrequency} achats par client
  • Montant moyen dépensé : ${parseFloat(stats.avgMonetary).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}€ par client

▸ PROFIL HOMMES / FEMMES :
  • Hommes : ${stats.hommes.toLocaleString('fr-FR')} (${stats.pourcentageHommes}%)
    → CA : ${parseFloat(stats.caHommes).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}€
    → Panier moyen : ${parseFloat(stats.panierMoyenHommes).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}€
  
  • Femmes : ${stats.femmes.toLocaleString('fr-FR')} (${stats.pourcentageFemmes}%)
    → CA : ${parseFloat(stats.caFemmes).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}€
    → Panier moyen : ${parseFloat(stats.panierMoyenFemmes).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}€

▸ INTERPRÉTATION :
${getSegmentInterpretation(segment, stats)}
`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. DISTRIBUTION DES SCORES RFM (1 = Faible, 5 = Excellent)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▸ RÉCENCE (R) - Combien de temps depuis le dernier achat :
  Score 5 (Très récent) : ${distributionR[5].toLocaleString('fr-FR')} clients (${(distributionR[5] / totalClients * 100).toFixed(1)}%)
  Score 4 (Récent)      : ${distributionR[4].toLocaleString('fr-FR')} clients (${(distributionR[4] / totalClients * 100).toFixed(1)}%)
  Score 3 (Moyen)       : ${distributionR[3].toLocaleString('fr-FR')} clients (${(distributionR[3] / totalClients * 100).toFixed(1)}%)
  Score 2 (Ancien)      : ${distributionR[2].toLocaleString('fr-FR')} clients (${(distributionR[2] / totalClients * 100).toFixed(1)}%)
  Score 1 (Très ancien) : ${distributionR[1].toLocaleString('fr-FR')} clients (${(distributionR[1] / totalClients * 100).toFixed(1)}%)

▸ FRÉQUENCE (F) - Nombre d'achats :
  Score 5 (Très fréquent) : ${distributionF[5].toLocaleString('fr-FR')} clients (${(distributionF[5] / totalClients * 100).toFixed(1)}%)
  Score 4 (Fréquent)      : ${distributionF[4].toLocaleString('fr-FR')} clients (${(distributionF[4] / totalClients * 100).toFixed(1)}%)
  Score 3 (Moyen)         : ${distributionF[3].toLocaleString('fr-FR')} clients (${(distributionF[3] / totalClients * 100).toFixed(1)}%)
  Score 2 (Rare)          : ${distributionF[2].toLocaleString('fr-FR')} clients (${(distributionF[2] / totalClients * 100).toFixed(1)}%)
  Score 1 (Très rare)     : ${distributionF[1].toLocaleString('fr-FR')} clients (${(distributionF[1] / totalClients * 100).toFixed(1)}%)

▸ MONTANT (M) - Valeur dépensée :
  Score 5 (Très élevé) : ${distributionM[5].toLocaleString('fr-FR')} clients (${(distributionM[5] / totalClients * 100).toFixed(1)}%)
  Score 4 (Élevé)      : ${distributionM[4].toLocaleString('fr-FR')} clients (${(distributionM[4] / totalClients * 100).toFixed(1)}%)
  Score 3 (Moyen)      : ${distributionM[3].toLocaleString('fr-FR')} clients (${(distributionM[3] / totalClients * 100).toFixed(1)}%)
  Score 2 (Faible)     : ${distributionM[2].toLocaleString('fr-FR')} clients (${(distributionM[2] / totalClients * 100).toFixed(1)}%)
  Score 1 (Très faible): ${distributionM[1].toLocaleString('fr-FR')} clients (${(distributionM[1] / totalClients * 100).toFixed(1)}%)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. TOP 10 DES VILLES PAR CHIFFRE D'AFFAIRES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${topVilles.map((v, i) => `
${(i + 1).toString().padStart(2, ' ')}. ${v.ville.padEnd(30, ' ')} │ ${v.clients.toString().padStart(6, ' ')} clients │ CA: ${parseFloat(v.ca).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}€ │ Panier: ${parseFloat(v.panierMoyen).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}€`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. RECOMMANDATIONS ET QUESTIONS POUR L'ANALYSE QUALITATIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Sur la base de ces données, voici les axes d'analyse recommandés :

1. Quels sont les segments prioritaires pour maximiser le CA ?
2. Comment réactiver les clients "À Risque" et "Perdus" ?
3. Y a-t-il des différences comportementales H/F exploitables ?
4. Quelles actions marketing ciblées par segment ?
5. Comment transformer les "Nouveaux" en "Champions" ?
6. Les villes à fort CA nécessitent-elles des actions spécifiques ?
7. Quelle stratégie de fidélisation pour les "Occasionnels" ?

═══════════════════════════════════════════════════════════════════════
                    FIN DU DOCUMENT D'ANALYSE RFM
═══════════════════════════════════════════════════════════════════════
`
}

// Fonction helper pour l'interprétation des segments
function getSegmentInterpretation(segment, stats) {
  const interpretations = {
    'Ultra Champions': `Les Ultra Champions sont l'élite de votre clientèle. Avec des scores parfaits (R=5, F=5, M=5), 
ils achètent fréquemment, récemment et dépensent beaucoup. Ce sont vos ambassadeurs naturels. 
Stratégie : Programmes VIP, avant-premières, cadeaux exclusifs pour maintenir leur engagement exceptionnel.`,
    
    'Champions': `Les Champions sont vos meilleurs clients réguliers. Excellents sur tous les critères (R≥4, F≥4, M≥4),
ils génèrent un CA important de manière constante. Ce segment est crucial pour la stabilité de l'entreprise.
Stratégie : Fidélisation premium, offres personnalisées, programmes de parrainage pour transformer certains en Ultra Champions.`,
    
    'Loyaux': `Les clients Loyaux sont fiables et réguliers (R≥3, F≥3, M≥3). Ils ne sont peut-être pas les plus 
dépensiers, mais leur constance est précieuse. Ils représentent souvent le cœur de la clientèle stable.
Stratégie : Encourager la montée en gamme, programmes de points, communications régulières pour maintenir l'engagement.`,
    
    'Nouveaux': `Les Nouveaux clients ont acheté très récemment (R≥4) mais avec une fréquence moyenne (F=3). 
C'est une période critique : ils testent encore votre offre. Leur avenir dépend de leur expérience actuelle.
Stratégie : Onboarding soigné, offres de bienvenue, enquêtes de satisfaction, relances rapides pour la 2e commande.`,
    
    'Occasionnels': `Les clients Occasionnels ont une récence et fréquence moyennes (R=3, F=3). Ils connaissent 
votre marque mais n'ont pas développé de routine d'achat. Ils peuvent basculer vers la fidélité ou l'abandon.
Stratégie : Campagnes de réactivation, offres flash, programmes de fidélité pour augmenter la fréquence d'achat.`,
    
    'À Risque': `ALERTE ! Ces clients étaient fidèles (F≥3) mais ne sont pas revenus récemment (R≤2). 
Ils vous connaissent bien mais semblent avoir cessé d'acheter. C'est le moment d'agir avant de les perdre définitivement.
Stratégie : Campagnes de win-back urgentes, enquêtes "Pourquoi êtes-vous parti ?", offres exceptionnelles de retour.`,
    
    'Perdus': `Les clients Perdus ont une mauvaise récence ET une mauvaise fréquence. Ils n'achètent plus ou très rarement. 
Bien qu'il soit difficile de les réactiver, certains peuvent revenir avec la bonne approche.
Stratégie : Campagnes de reconquête à faible coût (email), offres de "dernière chance", ou accepter la perte et se concentrer sur les autres segments.`
  }
  
  return interpretations[segment] || 'Segment à analyser en détail.'
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORT RFM AUDIT EXCEL - Handler séparé
// ═══════════════════════════════════════════════════════════════════════
async function handleRFMAuditExcel(req, res) {
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
          MAX(t.date)::date as derniere_visite,
          MIN(t.date)::date as premiere_visite,
          COUNT(DISTINCT t.date::date)::int as frequence,
          ROUND(SUM(t.ca)::numeric, 2)::float as montant_total
        FROM transactions t
        LEFT JOIN clients c ON t.carte = c.carte
        WHERE t.carte IS NOT NULL AND t.carte != '0'
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
          EXTRACT(DAY FROM (CURRENT_DATE - MAX(t.date)))::int as recency,
          COUNT(*)::int as frequency,
          SUM(t.ca)::float as monetary
        FROM transactions t
        WHERE t.carte IS NOT NULL AND t.carte != '0'
        GROUP BY t.carte
        HAVING SUM(t.ca) > 0
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
          EXTRACT(DAY FROM (CURRENT_DATE - MAX(t.date)))::int as recency,
          COUNT(*)::int as frequency,
          SUM(t.ca)::float as monetary
        FROM transactions t
        WHERE t.carte IS NOT NULL AND t.carte != '0'
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
