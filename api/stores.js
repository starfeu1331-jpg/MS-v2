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

  // Route: /api/stores?action=catchment&storeCode=XXX (VERSION ULTRA-SIMPLE)
  const { action, storeCode } = req.query;

  if (action === 'catchment') {
    if (!storeCode) {
      return res.status(400).json({ error: 'storeCode requis' });
    }

    try {
      console.log(`🔍 [SIMPLE] Récupération zones pour magasin ${storeCode}...`);

      // Requête ultra-simple: tous les CP avec leur CA pour ce magasin
      const zones = await prisma.$queryRaw`
        SELECT 
          c.cp::text as cp,
          STRING_AGG(DISTINCT c.ville, ', ') as ville,
          COUNT(DISTINCT t.carte)::int as nb_clients,
          SUM(t.ca)::numeric as total_ca,
          COUNT(*)::int as nb_transactions
        FROM transactions t
        INNER JOIN clients c ON t.carte = c.carte
        WHERE t.depot = ${storeCode}
          AND t.ca > 0
          AND c.cp IS NOT NULL 
          AND c.cp != ''
        GROUP BY c.cp
        HAVING COUNT(*) >= 10
        ORDER BY SUM(t.ca) DESC
      `;

      const formattedZones = zones.map(row => ({
        cp: row.cp,
        ville: row.ville,
        nbClients: row.nb_clients,
        totalCA: parseFloat(row.total_ca),
        nbTransactions: row.nb_transactions
      }));

      console.log(`✅ ${formattedZones.length} zones trouvées pour ${storeCode}`);
      if (formattedZones.length > 0) {
        console.log(`  Top 3: ${formattedZones.slice(0, 3).map(z => `${z.cp} (${z.ville}): ${z.nbClients} clients`).join(' | ')}`);
      }

      return res.status(200).json({
        success: true,
        storeCode,
        data: formattedZones
      });

    } catch (error) {
      console.error(`❌ Erreur catchment pour ${storeCode}:`, error);
      return res.status(500).json({ 
        error: 'Erreur serveur',
        details: error.message 
      });
    } finally {
      await prisma.$disconnect();
    }
  }

  // Route: /api/stores?action=list (récupérer la liste des magasins)
  if (action === 'list') {
    try {
      const storesList = await prisma.magasin.findMany({
        orderBy: { nom: 'asc' }
      });
      return res.json({ stores: storesList });
    } catch (error) {
      console.error('Erreur récupération magasins:', error);
      return res.status(500).json({ error: 'Erreur serveur' });
    } finally {
      await prisma.$disconnect();
    }
  }

  // Route: /api/stores?action=allStores (TOUS les magasins avec leurs zones)
  if (action === 'allStores') {
    try {
      // Récupérer tous les magasins
      const stores = await prisma.magasin.findMany();
      
      console.log(`🔄 Récupération zones pour ${stores.length} magasins...`);
      
      // OPTIMISATION: UNE SEULE requête SQL pour TOUS les magasins
      const allStoreData = await prisma.$queryRaw`
        SELECT 
          t.depot as store_code,
          c.cp::text,
          STRING_AGG(DISTINCT c.ville, ', ') as ville,
          COUNT(DISTINCT t.carte)::int as nb_clients,
          SUM(t.ca)::numeric as total_ca,
          COUNT(*)::int as nb_transactions
        FROM transactions t
        INNER JOIN clients c ON t.carte = c.carte
        WHERE t.ca > 0 
          AND c.cp IS NOT NULL 
          AND c.cp != '' 
          AND t.carte != '0'
        GROUP BY t.depot, c.cp
        HAVING COUNT(*) >= 10
        ORDER BY t.depot, SUM(t.ca) DESC
      `;
      
      console.log(`✅ Requête SQL: ${allStoreData.length} lignes récupérées`);
      
      // Grouper par magasin
      const storeDataMap = {};
      allStoreData.forEach(row => {
        if (!storeDataMap[row.store_code]) {
          storeDataMap[row.store_code] = [];
        }
        storeDataMap[row.store_code].push(row);
      });
      
      const allStoresData = [];
      
      for (const store of stores) {
        const storeData = storeDataMap[store.code] || [];
        
        if (storeData.length === 0) continue;
        
        // IMPORTANT: Toujours inclure le CP du magasin lui-même, même s'il n'a pas de transactions
        const storeCPExists = storeData.find(row => row.cp === store.cp);
        if (!storeCPExists && store.cp) {
          storeData.push({
            cp: store.cp,
            ville: store.ville,
            nb_clients: 0,
            total_ca: 0,
            nb_transactions: 0
          });
        }
        
        // NOUVELLE APPROCHE: Calcul par DÉCILES (percentiles de rang)
        // Trier par CA et clients pour attribuer un rang percentile
        const sortedByCA = [...storeData].sort((a, b) => Number(b.total_ca) - Number(a.total_ca));
        const sortedByClients = [...storeData].sort((a, b) => Number(b.nb_clients) - Number(a.nb_clients));
        
        console.log(`📊 Magasin ${store.code} (${store.nom}):`, {
          nbZones: storeData.length,
          cpList: storeData.map(r => r.cp).join(', '),
          maxCA: Number(sortedByCA[0].total_ca).toFixed(2),
          minCA: Number(sortedByCA[sortedByCA.length - 1].total_ca).toFixed(2),
          maxClients: Number(sortedByClients[0].nb_clients)
        });
        
        // Créer un mapping CP → rang percentile
        const caRankMap = {};
        const clientsRankMap = {};
        
        sortedByCA.forEach((row, index) => {
          // Rang percentile: meilleur = 1.0, pire = 0.0
          caRankMap[row.cp] = 1 - (index / storeData.length);
        });
        
        sortedByClients.forEach((row, index) => {
          clientsRankMap[row.cp] = 1 - (index / storeData.length);
        });
        
        storeData.forEach(row => {
          allStoresData.push({
            storeCode: store.code,
            storeName: store.nom,
            storeCP: store.cp,
            storeCity: store.ville,
            cp: row.cp,
            ville: row.ville || 'Inconnue',
            nbClients: Number(row.nb_clients),
            totalCA: Number(row.total_ca),
            nbTransactions: Number(row.nb_transactions),
            intensiteCA: caRankMap[row.cp],
            intensiteClients: clientsRankMap[row.cp],
          });
        });
      }
      
      // NE PAS dédupliquer ici - on envoie TOUTES les zones de TOUS les magasins
      // La déduplication se fera dans le frontend si nécessaire (affichage "tous les magasins")
      
      return res.json({
        stores,
        zones: allStoresData, // TOUTES les zones, pas dédupliquées
        totalStores: stores.length,
        totalZones: allStoresData.length,
      });
    } catch (error) {
      console.error('Erreur allStores:', error);
      return res.status(500).json({ error: 'Erreur serveur', details: error.message });
    } finally {
      await prisma.$disconnect();
    }
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

    // Grouper UNIQUEMENT par CP (pas par ville) pour éviter duplications
    const groupedData = {};

    transactions.forEach((transaction) => {
      const client = transaction.client;
      if (!client || !client.cp) return;

      const cp = client.cp;

      if (!groupedData[cp]) {
        groupedData[cp] = {
          cp,
          villes: new Set(),
          nbClients: new Set(),
          totalCA: 0,
          nbTransactions: 0,
        };
      }

      if (client.ville) groupedData[cp].villes.add(client.ville);
      groupedData[cp].nbClients.add(client.carte);
      groupedData[cp].totalCA += transaction.ca || 0;
      groupedData[cp].nbTransactions += 1;
    });

    // Convertir en array, filtrer < 10 transactions, calculer intensités
    const data = Object.values(groupedData)
      .filter((item) => item.nbTransactions >= 10) // Seuil de significativité
      .map((item) => ({
        cp: item.cp,
        ville: Array.from(item.villes).join(', ') || 'N/A',
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
