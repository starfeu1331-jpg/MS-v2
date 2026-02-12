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

    // 2. Appliquer la segmentation (basée sur les critères stricts définis)
    const clientsWithSegments = clientsRFM.map(client => {
      const R = parseInt(client.r)
      const F = parseInt(client.f)
      const M = parseInt(client.m)
      
      let segment = ''
      if (R === 5 && F === 5 && M === 5) {
        segment = 'Ultra Champions'  // Excellence absolue
      } else if (R >= 4 && F >= 4 && M >= 4) {
        segment = 'Champions'  // Excellents partout
      } else if (F >= 4) {
        // Tous les clients avec haute fréquence (F>=4)
        if (R <= 2) {
          segment = 'À Risque'  // Anciens bons clients (R<=2 ET F>=4)
        } else {
          segment = 'Loyaux'  // Clients fidèles (F>=4, pas Champions)
        }
      } else if (F <= 2 && R >= 4) {
        segment = 'Nouveaux'  // Clients récents avec peu d'achats
      } else if (R <= 2) {
        segment = 'Perdus'  // Clients inactifs (R<=2, F<4)
      } else {
        segment = 'Occasionnels'  // Tous les autres cas
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
    console.log('🔬 Génération Excel Audit RFM TECHNIQUE - Début')
    const today = new Date()

    // ============================================================================
    // ÉTAPE 1: Charger TOUTES les transactions brutes (limité à 5000 pour Excel)
    // ============================================================================
    const rawTransactions = await prisma.$queryRaw`
      SELECT 
        t.carte,
        c.nom,
        c.prenom,
        c.email,
        c.ville,
        c.cp,
        c.sexe,
        t.date::date as date_achat,
        t.ca::float as montant,
        t.facture
      FROM transactions t
      LEFT JOIN clients c ON t.carte = c.carte
      WHERE t.carte IS NOT NULL 
        AND t.carte != '0'
        AND t.ca > 0
      ORDER BY t.ca DESC, t.date DESC
      LIMIT 5000
    `
    
    console.log(`✅ ${rawTransactions.length} transactions chargées`)

    // Créer le workbook
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Magic Système - Audit RFM'
    workbook.created = today

    // ============================================================================
    // ONGLET 1: TRANSACTIONS BRUTES (Source de données)
    // ============================================================================
    const sheet1 = workbook.addWorksheet('1-Transactions', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    })
    
    sheet1.columns = [
      { header: 'N° Carte', key: 'carte', width: 12 },
      { header: 'Nom', key: 'nom', width: 18 },
      { header: 'Prénom', key: 'prenom', width: 18 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Ville', key: 'ville', width: 18 },
      { header: 'CP', key: 'cp', width: 8 },
      { header: 'Sexe', key: 'sexe', width: 6 },
      { header: 'Date Achat', key: 'date_achat', width: 12 },
      { header: 'Montant (€)', key: 'montant', width: 12 },
      { header: 'N° Facture', key: 'facture', width: 15 }
    ]
    
    // Style header
    sheet1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }
    sheet1.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
    
    // Insérer les données
    rawTransactions.forEach(tx => {
      sheet1.addRow({
        carte: tx.carte,
        nom: tx.nom || '',
        prenom: tx.prenom || '',
        email: tx.email || '',
        ville: tx.ville || '',
        cp: tx.cp || '',
        sexe: tx.sexe || '',
        date_achat: tx.date_achat,
        montant: tx.montant,
        facture: tx.facture || ''
      })
    })

    console.log('✅ Onglet 1 créé')

    // ============================================================================
    // ONGLET 2: AGRÉGATION PAR CLIENT (Avec formules Excel)
    // ============================================================================
    const sheet2 = workbook.addWorksheet('2-Clients_Agreges', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    })
    
    const uniqueClients = [...new Map(rawTransactions.map(t => [t.carte, {
      carte: t.carte,
      nom: t.nom || '',
      prenom: t.prenom || '',
      email: t.email || '',
      ville: t.ville || '',
      cp: t.cp || '',
      sexe: t.sexe || ''
    }])).values()]

    sheet2.columns = [
      { header: 'N° Carte', key: 'carte', width: 12 },
      { header: 'Nom client', key: 'nom_complet', width: 30 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Date dernière visite', key: 'derniere_visite', width: 18 },
      { header: 'Date première visite', key: 'premiere_visite', width: 18 },
      { header: 'CA Total (€)', key: 'ca_total', width: 15 },
      { header: 'Nb transactions', key: 'nb_transactions', width: 15 }
    ]
    
    sheet2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }
    sheet2.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
    
    // Limiter à 1000 clients pour performance
    const topClients = uniqueClients.slice(0, 1000)
    
    topClients.forEach((client, idx) => {
      const rowNum = idx + 2
      const carte = client.carte
      
      sheet2.addRow({
        carte: carte,
        nom_complet: `${client.prenom} ${client.nom}`.trim() || 'N/A',
        email: client.email,
        derniere_visite: '', // Formule
        premiere_visite: '', // Formule
        ca_total: '', // Formule
        nb_transactions: '' // Formule
      })
      
      // FORMULES EXCEL qui pointent vers l'onglet 1
      // Dernière visite = MAX avec SI (formule matricielle, plage définie)
      sheet2.getCell(`D${rowNum}`).value = {
        formula: `MAX(SI('1-Transactions'!$A$2:$A$5001=A${rowNum};'1-Transactions'!$H$2:$H$5001))`
      }
      
      // Première visite = MIN avec SI (formule matricielle)
      sheet2.getCell(`E${rowNum}`).value = {
        formula: `MIN(SI('1-Transactions'!$A$2:$A$5001=A${rowNum};'1-Transactions'!$H$2:$H$5001))`
      }
      
      // CA Total = SOMME conditionnelle
      sheet2.getCell(`F${rowNum}`).value = {
        formula: `SOMME.SI('1-Transactions'!$A:$A;A${rowNum};'1-Transactions'!$I:$I)`
      }
      
      // Nb transactions = COMPTE conditionnel
      sheet2.getCell(`G${rowNum}`).value = {
        formula: `NB.SI('1-Transactions'!$A:$A;A${rowNum})`
      }
    })

    console.log('✅ Onglet 2 créé avec FORMULES liées à onglet 1')

    // ============================================================================
    // ONGLET 3: MÉTRIQUES RFM (Calculs avec formules)
    // ============================================================================
    const sheet3 = workbook.addWorksheet('3-Metriques_RFM', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    })
    
    sheet3.columns = [
      { header: 'N° Carte', key: 'carte', width: 12 },
      { header: 'Recency (jours)', key: 'recency', width: 16 },
      { header: 'Frequency (nb)', key: 'frequency', width: 16 },
      { header: 'Monetary (€)', key: 'monetary', width: 16 }
    ]
    
    sheet3.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet3.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } }
    sheet3.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
    
    topClients.forEach((client, idx) => {
      const rowNum = idx + 2
      const sheet2RowNum = idx + 2
      
      sheet3.addRow({
        carte: client.carte,
        recency: '', // Formule
        frequency: '', // Formule
        monetary: '' // Formule
      })
      
      // RECENCY = Aujourd'hui - Date dernière visite (référence à l'onglet 2)
      sheet3.getCell(`B${rowNum}`).value = {
        formula: `AUJOURDHUI()-'2-Clients_Agreges'!D${sheet2RowNum}`
      }
      
      // FREQUENCY = Nombre de transactions (référence à l'onglet 2)
      sheet3.getCell(`C${rowNum}`).value = {
        formula: `'2-Clients_Agrégés'!G${sheet2RowNum}`
      }
      
      // MONETARY = CA Total (référence à l'onglet 2)
      sheet3.getCell(`D${rowNum}`).value = {
        formula: `'2-Clients_Agrégés'!F${sheet2RowNum}`
      }
    })

    console.log('✅ Onglet 3 créé avec FORMULES liées à onglet 2')

    // ============================================================================
    // ONGLET 4: SEUILS DE QUINTILES (Calcul des percentiles)
    // ============================================================================
    const sheet4 = workbook.addWorksheet('4-Seuils_Quintiles', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    })
    
    sheet4.columns = [
      { header: 'Métrique', key: 'metric', width: 20 },
      { header: 'Q1 (20%)', key: 'q1', width: 12 },
      { header: 'Q2 (40%)', key: 'q2', width: 12 },
      { header: 'Q3 (60%)', key: 'q3', width: 12 },
      { header: 'Q4 (80%)', key: 'q4', width: 12 },
      { header: 'Formule utilisée', key: 'formule', width: 40 }
    ]
    
    sheet4.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet4.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } }
    sheet4.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
    
    const lastRow = topClients.length + 1
    
    // Ligne Recency
    sheet4.addRow({ metric: 'Recency (jours)' })
    sheet4.getCell('B2').value = { formula: `CENTILE('3-Metriques_RFM'!B2:B${lastRow};0,2)` }
    sheet4.getCell('C2').value = { formula: `CENTILE('3-Metriques_RFM'!B2:B${lastRow};0,4)` }
    sheet4.getCell('D2').value = { formula: `CENTILE('3-Metriques_RFM'!B2:B${lastRow};0,6)` }
    sheet4.getCell('E2').value = { formula: `CENTILE('3-Metriques_RFM'!B2:B${lastRow};0,8)` }
    sheet4.getCell('F2').value = '=CENTILE(colonne_recency; 0,2 à 0,8)'
    
    // Ligne Frequency
    sheet4.addRow({ metric: 'Frequency (nb)' })
    sheet4.getCell('B3').value = { formula: `CENTILE('3-Metriques_RFM'!C2:C${lastRow};0,2)` }
    sheet4.getCell('C3').value = { formula: `CENTILE('3-Metriques_RFM'!C2:C${lastRow};0,4)` }
    sheet4.getCell('D3').value = { formula: `CENTILE('3-Metriques_RFM'!C2:C${lastRow};0,6)` }
    sheet4.getCell('E3').value = { formula: `CENTILE('3-Metriques_RFM'!C2:C${lastRow};0,8)` }
    sheet4.getCell('F3').value = '=CENTILE(colonne_frequency; 0,2 à 0,8)'
    
    // Ligne Monetary
    sheet4.addRow({ metric: 'Monetary (€)' })
    sheet4.getCell('B4').value = { formula: `CENTILE('3-Metriques_RFM'!D2:D${lastRow};0,2)` }
    sheet4.getCell('C4').value = { formula: `CENTILE('3-Metriques_RFM'!D2:D${lastRow};0,4)` }
    sheet4.getCell('D4').value = { formula: `CENTILE('3-Metriques_RFM'!D2:D${lastRow};0,6)` }
    sheet4.getCell('E4').value = { formula: `CENTILE('3-Metriques_RFM'!D2:D${lastRow};0,8)` }
    sheet4.getCell('F4').value = '=CENTILE(colonne_monetary; 0,2 à 0,8)'

    console.log('✅ Onglet 4 créé avec FORMULES PERCENTILE')

    // ============================================================================
    // ONGLET 5: SCORES RFM (Attribution avec formules IFS)
    // ============================================================================
    const sheet5 = workbook.addWorksheet('5-Scores_RFM', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    })
    
    sheet5.columns = [
      { header: 'N° Carte', key: 'carte', width: 12 },
      { header: 'R (1-5)', key: 'r_score', width: 10 },
      { header: 'F (1-5)', key: 'f_score', width: 10 },
      { header: 'M (1-5)', key: 'm_score', width: 10 },
      { header: 'Score Total', key: 'total', width: 12 },
      { header: '% Position', key: 'pct', width: 12 }
    ]
    
    sheet5.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet5.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEA580C' } }
    sheet5.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
    
    topClients.forEach((client, idx) => {
      const rowNum = idx + 2
      const sheet3RowNum = idx + 2
      
      sheet5.addRow({ carte: client.carte })
      
      // SCORE R (inversé car moins de jours = meilleur) avec SI imbriqués
      sheet5.getCell(`B${rowNum}`).value = {
        formula: `SI('3-Metriques_RFM'!B${sheet3RowNum}<='4-Seuils_Quintiles'!$B$2;5;SI('3-Metriques_RFM'!B${sheet3RowNum}<='4-Seuils_Quintiles'!$C$2;4;SI('3-Metriques_RFM'!B${sheet3RowNum}<='4-Seuils_Quintiles'!$D$2;3;SI('3-Metriques_RFM'!B${sheet3RowNum}<='4-Seuils_Quintiles'!$E$2;2;1))))`
      }
      
      // SCORE F (normal: plus = meilleur) avec SI imbriqués
      sheet5.getCell(`C${rowNum}`).value = {
        formula: `SI('3-Metriques_RFM'!C${sheet3RowNum}<='4-Seuils_Quintiles'!$B$3;1;SI('3-Metriques_RFM'!C${sheet3RowNum}<='4-Seuils_Quintiles'!$C$3;2;SI('3-Metriques_RFM'!C${sheet3RowNum}<='4-Seuils_Quintiles'!$D$3;3;SI('3-Metriques_RFM'!C${sheet3RowNum}<='4-Seuils_Quintiles'!$E$3;4;5))))`
      }
      
      // SCORE M (normal: plus = meilleur) avec SI imbriqués
      sheet5.getCell(`D${rowNum}`).value = {
        formula: `SI('3-Metriques_RFM'!D${sheet3RowNum}<='4-Seuils_Quintiles'!$B$4;1;SI('3-Metriques_RFM'!D${sheet3RowNum}<='4-Seuils_Quintiles'!$C$4;2;SI('3-Metriques_RFM'!D${sheet3RowNum}<='4-Seuils_Quintiles'!$D$4;3;SI('3-Metriques_RFM'!D${sheet3RowNum}<='4-Seuils_Quintiles'!$E$4;4;5))))`
      }
      
      // SCORE TOTAL = R + F + M
      sheet5.getCell(`E${rowNum}`).value = {
        formula: `B${rowNum}+C${rowNum}+D${rowNum}`
      }
      
      // % Position = (Score / 15) * 100
      sheet5.getCell(`F${rowNum}`).value = {
        formula: `ARRONDI((E${rowNum}/15)*100;0)&"%"`
      }
    })

    console.log('✅ Onglet 5 créé avec FORMULES IFS pour scores')

    // ============================================================================
    // ONGLET 6: SEGMENTATION FINALE (Avec formules IFS)
    // ============================================================================
    const sheet6 = workbook.addWorksheet('6-Segments', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    })
    
    sheet6.columns = [
      { header: 'N° Carte', key: 'carte', width: 12 },
      { header: 'Nom client', key: 'nom', width: 25 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Score Total', key: 'score', width: 12 },
      { header: 'Segment', key: 'segment', width: 20 },
      { header: 'Priorité', key: 'priorite', width: 10 }
    ]
    
    sheet6.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet6.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } }
    sheet6.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
    
    topClients.forEach((client, idx) => {
      const rowNum = idx + 2
      const sheet2RowNum = idx + 2
      const sheet5RowNum = idx + 2
      
      sheet6.addRow({
        carte: client.carte,
        nom: '',
        email: '',
        score: '',
        segment: '',
        priorite: ''
      })
      
      // NOM depuis onglet 2
      sheet6.getCell(`B${rowNum}`).value = {
        formula: `'2-Clients_Agrégés'!B${sheet2RowNum}`
      }
      
      // EMAIL depuis onglet 2
      sheet6.getCell(`C${rowNum}`).value = {
        formula: `'2-Clients_Agrégés'!C${sheet2RowNum}`
      }
      
      // SCORE depuis onglet 5
      sheet6.getCell(`D${rowNum}`).value = {
        formula: `'5-Scores_RFM'!E${sheet5RowNum}`
      }
      
      // SEGMENT basé sur score avec SI imbriqués (compatible Excel 2007+)
      sheet6.getCell(`E${rowNum}`).value = {
        formula: `SI(D${rowNum}>=13;"👑 Champions";SI(D${rowNum}>=11;"⭐ Fidèles";SI(D${rowNum}>=9;"💎 Potentiels";SI(D${rowNum}>=7;"⚠️ Risque";"😴 Endormis"))))`
      }
      
      // PRIORITÉ basée sur score avec SI imbriqués
      sheet6.getCell(`F${rowNum}`).value = {
        formula: `SI(D${rowNum}>=13;"P1";SI(D${rowNum}>=11;"P2";SI(D${rowNum}>=9;"P3";SI(D${rowNum}>=7;"P4";"P5"))))`
      }
      
      // Colorer selon segment (formule conditionnelle dans le style)
      const scoreVal = topClients.length > 100 ? null : null // On peut pas pré-calculer facilement
    })

    console.log('✅ Onglet 6 créé avec FORMULES de segmentation')

    // ============================================================================
    // ONGLET 7: DOCUMENTATION & AUDIT
    // ============================================================================
    const sheet7 = workbook.addWorksheet('DOCUMENTATION')
    sheet7.columns = [
      { header: 'Section', key: 'section', width: 30 },
      { header: 'Explication', key: 'explication', width: 80 }
    ]
    
    sheet7.getRow(1).font = { bold: true, size: 14 }
    
    sheet7.addRow({
      section: '🎯 OBJECTIF',
      explication: 'Ce fichier Excel est un AUDIT TRAIL COMPLET où TOUTES les formules sont visibles et vérifiables manuellement.'
    })
    
    sheet7.addRow({
      section: '📊 Onglet 1 - Transactions',
      explication: `${rawTransactions.length} transactions brutes issues de la base de données. SOURCE DE VÉRITÉAll other tabs calculate from this data using Excel formulas.`
    })
    
    sheet7.addRow({
      section: '📈 Onglet 2 - Clients Agrégés',
      explication: `${topClients.length} clients agrégés. FORMULES: MAXIFS(), MINIFS(), SUMIF(), COUNTIF() pointant vers onglet 1. Double-cliquez sur les cellules D2, E2, F2, G2 pour voir les formules.`
    })
    
    sheet7.addRow({
      section: '🔢 Onglet 3 - Métriques RFM',
      explication: 'Calcul des 3 dimensions RFM. FORMULES: Recency = TODAY() - date dernière visite, Frequency = nb transactions, Monetary = CA total. Références à onglet 2.'
    })
    
    sheet7.addRow({
      section: '🎚️ Onglet 4 - Seuils Quintiles',
      explication: 'Calcul des seuils de quintiles (20%, 40%, 60%, 80%). FORMULES: PERCENTILE() sur les colonnes de l\'onglet 3. Ces seuils servent à attribuer les scores.'
    })
    
    sheet7.addRow({
      section: '⭐ Onglet 5 - Scores RFM',
      explication: 'Attribution des scores de 1 à 5. FORMULES: IFS() comparant chaque métrique avec les seuils de l\'onglet 4. R inversé (moins de jours = meilleur), F et M normaux (plus = meilleur).'
    })
    
    sheet7.addRow({
      section: '🏆 Onglet 6 - Segments',
      explication: 'Segmentation finale basée sur score total. FORMULES: IFS() sur score total. Champions (13-15), Fidèles (11-12), Potentiels (9-10), Risque (7-8), Endormis (3-6).'
    })
    
    sheet7.addRow({
      section: '✅ VÉRIFICATION MANUELLE',
      explication: 'Double-cliquez sur N\'IMPORTE QUELLE cellule des onglets 2 à 6 pour voir la FORMULE. Vous pouvez modifier les formules, recalculer, vérifier étape par étape.'
    })
    
    sheet7.addRow({
      section: '🔬 ALGORITHME RFM',
      explication: 'Recency: moins de jours depuis dernier achat = meilleur (score inversé). Frequency: plus d\'achats = meilleur. Monetary: plus de CA = meilleur. Quintiles divisent en 5 groupes égaux (20% chacun).'
    })
    
    sheet7.addRow({
      section: '📅 Généré le',
      explication: today.toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })
    })
    
    sheet7.addRow({
      section: '💡 ASTUCE EXCEL',
      explication: 'Utilisez Ctrl+` (accent grave) pour afficher TOUTES les formules en mode texte dans un onglet. Ou Formules > Afficher les formules.'
    })

    console.log('✅ Onglet 7 documentation créé')

    // Générer et envoyer
    const buffer = await workbook.xlsx.writeBuffer()
    
    console.log('✅ Excel Audit RFM TECHNIQUE généré avec succès')
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=RFM_Audit_Technique_${today.toISOString().split('T')[0]}.xlsx`)
    res.send(Buffer.from(buffer))

  } catch (error) {
    console.error('❌ Erreur génération Excel Audit:', error)
    res.status(500).json({ 
      error: 'Erreur génération Excel',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  } finally {
    await prisma.$disconnect()
  }
}
