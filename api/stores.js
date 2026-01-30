import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['error', 'warn']
})

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Route: /api/stores?action=catchment&storeCode=XXX
  const { action, storeCode } = req.query;

  if (action === 'catchment') {
    return handleCatchmentArea(req, res, storeCode);
  }

  // Route par défaut: liste magasins
  try {
    console.log('🔄 API Stores: Calcul en cours...')

    // Stats par magasin (depot)
    const magasinsData = await prisma.$queryRawUnsafe(`
      SELECT 
        depot::text,
        SUM(ca)::numeric as ca,
        COUNT(*)::int as volume
      FROM transactions
      WHERE ca > 0 AND depot IS NOT NULL AND depot != 'WEB'
      GROUP BY depot
      ORDER BY SUM(ca) DESC
    `)

    // Stats par ville client
    const villesData = await prisma.$queryRawUnsafe(`
      SELECT 
        c.ville::text,
        SUM(t.ca)::numeric as ca,
        COUNT(*)::int as volume,
        COUNT(DISTINCT t.carte)::int as clients
      FROM transactions t
      INNER JOIN clients c ON t.carte = c.carte
      WHERE t.ca > 0 AND c.ville IS NOT NULL AND t.carte != '0'
      GROUP BY c.ville
      ORDER BY SUM(t.ca) DESC
    `)

    // Formater en objet comme attendu
    const magasins = {}
    magasinsData.forEach(row => {
      magasins[row.depot] = {
        ca: Number(row.ca),
        volume: Number(row.volume)
      }
    })

    const villes = {}
    villesData.forEach(row => {
      villes[row.ville] = {
        ca: Number(row.ca),
        volume: Number(row.volume),
        clients: Number(row.clients)
      }
    })

    console.log(`✅ API Stores: ${Object.keys(magasins).length} magasins, ${Object.keys(villes).length} villes`)

    res.status(200).json({
      geo: {
        magasins,
        villes
      }
    })

  } catch (error) {
    console.error('❌ Erreur API Stores:', error)
    res.status(500).json({ 
      error: 'Erreur serveur',
      details: error.message 
    })
  } finally {
    await prisma.$disconnect()
  }
}

// Handler pour Zone de Chalandise
async function handleCatchmentArea(req, res, storeCode) {
  try {
    if (!storeCode) {
      return res.status(400).json({ error: 'storeCode required' });
    }

    // Récupérer toutes les transactions du magasin avec les infos clients
    const transactions = await prisma.transaction.findMany({
      where: {
        depot: storeCode,
      },
      include: {
        client: true,
      },
    });

    if (transactions.length === 0) {
      return res.json({
        storeCode,
        data: [],
        summary: {
          totalClients: 0,
          totalCA: 0,
          uniquePostalCodes: 0,
        },
      });
    }

    // Grouper par CP + Ville avec agrégation
    const groupedData = {};

    transactions.forEach((transaction) => {
      const client = transaction.client;
      if (!client) return;

      const cp = client.cp || 'UNKNOWN';
      const ville = client.ville || 'N/A';
      const key = `${cp}|${ville}`;

      if (!groupedData[key]) {
        groupedData[key] = {
          cp,
          ville,
          nbClients: new Set(),
          totalCA: 0,
          nbTransactions: 0,
        };
      }

      groupedData[key].nbClients.add(client.carte);
      groupedData[key].totalCA += transaction.ca || 0;
      groupedData[key].nbTransactions += 1;
    });

    // Convertir en array et calculer intensités
    const data = Object.values(groupedData)
      .map((item) => ({
        cp: item.cp,
        ville: item.ville,
        nbClients: item.nbClients.size,
        totalCA: Math.round(item.totalCA * 100) / 100,
        nbTransactions: item.nbTransactions,
        intensiteCA: 0, // Sera calculé après
        intensiteClients: 0,
      }))
      .sort((a, b) => b.totalCA - a.totalCA);

    // Calculer les intensités (0-1) basées sur max
    if (data.length > 0) {
      const maxCA = Math.max(...data.map((d) => d.totalCA));
      const maxClients = Math.max(...data.map((d) => d.nbClients));

      data.forEach((item) => {
        item.intensiteCA = maxCA > 0 ? item.totalCA / maxCA : 0;
        item.intensiteClients = maxClients > 0 ? item.nbClients / maxClients : 0;
      });
    }

    // Récupérer info magasin
    const store = await prisma.magasin.findUnique({
      where: { code: storeCode },
    });

    res.json({
      storeCode,
      storeName: store?.nom || storeCode,
      storeCity: store?.ville || '',
      storeCP: store?.cp || '',
      data,
      summary: {
        totalClients: data.reduce((sum, d) => sum + d.nbClients, 0),
        totalCA: data.reduce((sum, d) => sum + d.totalCA, 0),
        uniquePostalCodes: data.length,
        nbTransactions: data.reduce((sum, d) => sum + d.nbTransactions, 0),
      },
    });
  } catch (error) {
    console.error('Error in catchment-area:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await prisma.$disconnect();
  }
}
