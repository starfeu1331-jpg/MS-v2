import { PrismaClient } from '@prisma/client'

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
    return res.status(200).end()
  }

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
  } finally {
    await prisma.$disconnect()
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
