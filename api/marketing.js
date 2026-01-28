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
    return res.status(200).end();
  }

  try {
    console.log('🚀 Marketing API - Début');

    // 1. Données mensuelles magasin (clients avec carte)
    const monthlyMagasin = await prisma.$queryRaw`
      SELECT 
        TO_CHAR(t.date, 'YYYY-MM') as month,
        SUM(t.ca)::float as ca,
        COUNT(DISTINCT t.facture)::int as volume,
        COUNT(DISTINCT t.carte)::int as clients
      FROM transactions t
      WHERE t.depot != 'WEB' AND t.carte != '0'
      GROUP BY TO_CHAR(t.date, 'YYYY-MM')
      ORDER BY month DESC
    `;

    const webStats = await prisma.$queryRaw`
      SELECT 
        SUM(ca)::float as ca,
        COUNT(*)::int as volume
      FROM transactions
      WHERE depot = 'WEB'
    `;

    const produitsWeb = await prisma.$queryRaw`
      SELECT 
        p.id as code,
        p.famille,
        p.sous_famille as "sousFamille",
        SUM(t.ca)::float as ca,
        COUNT(*)::int as volume
      FROM transactions t
      JOIN produits p ON t.produit = p.id
      WHERE t.depot = 'WEB'
      GROUP BY p.id, p.famille, p.sous_famille
      ORDER BY ca DESC
      LIMIT 50
    `;

    const produitsMagasin = await prisma.$queryRaw`
      SELECT 
        TO_CHAR(t.date, 'YYYY-MM') as month,
        p.id as code,
        p.famille,
        p.sous_famille as "sousFamille",
        SUM(t.ca)::float as ca,
        COUNT(*)::int as volume
      FROM transactions t
      JOIN produits p ON t.produit = p.id
      WHERE t.depot != 'WEB' AND t.carte != '0'
      GROUP BY TO_CHAR(t.date, 'YYYY-MM'), p.id, p.famille, p.sous_famille
      ORDER BY month DESC, ca DESC
    `;

    const topZones = await prisma.$queryRaw`
      SELECT 
        SUBSTRING(c.cp, 1, 2) as dept,
        SUM(t.ca)::float as ca,
        COUNT(DISTINCT t.carte)::int as clients
      FROM transactions t
      JOIN clients c ON t.carte = c.carte
      WHERE t.carte != '0' AND c.cp IS NOT NULL AND c.cp != ''
      GROUP BY SUBSTRING(c.cp, 1, 2)
      ORDER BY ca DESC
      LIMIT 20
    `;

    const nouveauxClients = await prisma.$queryRaw`
      WITH first_purchase AS (
        SELECT carte, MIN(date) as first_date
        FROM transactions
        WHERE carte != '0'
        GROUP BY carte
      )
      SELECT 
        TO_CHAR(first_date, 'YYYY-MM') as month,
        COUNT(*)::int as "nouveauxClients"
      FROM first_purchase
      GROUP BY TO_CHAR(first_date, 'YYYY-MM')
      ORDER BY month DESC
    `;

    console.log('✅ Step 5: nouveauxClients OK', nouveauxClients.length);

    const produitsWebObj = {};
    produitsWeb.forEach(p => {
      produitsWebObj[p.code] = {
        ca: p.ca || 0,
        volume: p.volume || 0,
        famille: p.famille || 'Non défini',
        sousFamille: p.sousFamille || 'Non défini'
      };
    });

    const produitsMagasinObj = {};
    produitsMagasin.forEach(p => {
      if (!produitsMagasinObj[p.month]) {
        produitsMagasinObj[p.month] = {};
      }
      produitsMagasinObj[p.month][p.code] = {
        ca: p.ca || 0,
        volume: p.volume || 0,
        famille: p.famille || 'Non défini',
        sousFamille: p.sousFamille || 'Non défini'
      };
    });

    const zonesObj = {};
    topZones.forEach(z => {
      zonesObj[z.dept] = {
        ca: z.ca || 0,
        clients: z.clients || 0
      };
    });

    const nouveauxClientsObj = {};
    nouveauxClients.forEach(nc => {
      nouveauxClientsObj[nc.month] = nc.nouveauxClients;
    });

    const result = {
      monthlyStats: monthlyMagasin.map(m => ({
        month: m.month,
        ca: m.ca || 0,
        volume: m.volume || 0,
        clients: m.clients || 0,
        nouveauxClients: nouveauxClientsObj[m.month] || 0
      })),
      webStats: {
        ca: webStats[0]?.ca || 0,
        volume: webStats[0]?.volume || 0
      },
      produitsWeb: produitsWebObj,
      produitsMagasin: produitsMagasinObj,
      zones: zonesObj
    };

    res.status(200).json(serializeJSON(result));
  } catch (error) {
    console.error('❌ Erreur Marketing API:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
