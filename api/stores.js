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

      // Essayer avec et sans le préfixe "M"
      const storeCodeWithM = storeCode.startsWith('M') ? storeCode : `M${storeCode}`;
      const storeCodeWithoutM = storeCode.replace(/^M/, '');
      
      console.log(`  🔍 Test codes: "${storeCode}", "${storeCodeWithM}", "${storeCodeWithoutM}"`);

      // D'abord vérifier combien de transactions ce magasin a (tester les 3 formats)
      const totalTx = await prisma.$queryRaw`
        SELECT 
          COUNT(*)::int as nb_tx,
          COUNT(DISTINCT t.carte)::int as nb_clients,
          SUM(t.ca)::numeric as ca_total
        FROM transactions t
        WHERE (t.depot = ${storeCode} OR t.depot = ${storeCodeWithM} OR t.depot = ${storeCodeWithoutM})
          AND t.ca > 0
      `;
      console.log(`  📊 Magasin ${storeCode}: ${totalTx[0].nb_tx} transactions, ${totalTx[0].nb_clients} clients, ${parseFloat(totalTx[0].ca_total || 0).toFixed(0)}€ CA`);

      // Requête ultra-simple: tous les CP avec leur CA pour ce magasin (tester les 3 formats)
      const zones = await prisma.$queryRaw`
        SELECT 
          c.cp::text as cp,
          STRING_AGG(DISTINCT c.ville, ', ') as ville,
          COUNT(DISTINCT t.carte)::int as nb_clients,
          SUM(t.ca)::numeric as total_ca,
          COUNT(*)::int as nb_transactions
        FROM transactions t
        INNER JOIN clients c ON t.carte = c.carte
        WHERE (t.depot = ${storeCode} OR t.depot = ${storeCodeWithM} OR t.depot = ${storeCodeWithoutM})
          AND t.ca > 0
          AND c.cp IS NOT NULL 
          AND c.cp != ''
        GROUP BY c.cp
        HAVING COUNT(DISTINCT t.carte) >= 10
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

  // Route par défaut: Module Performance Magasins - Refonte complète
  try {
    console.log('🔄 API Stores: Calcul performances magasins...')

    // 1. Récupérer tous les magasins physiques (pas dépôts logistiques)
    const magasinsTable = await prisma.magasin.findMany({
      where: {
        code: {
          not: {
            startsWith: 'D' // Exclure D10, D11 (dépôts logistiques)
          }
        }
      },
      orderBy: { nom: 'asc' }
    })

    console.log(`📊 ${magasinsTable.length} magasins physiques trouvés`)

    // 2. Stats détaillées par magasin
    const magasinsStats = await prisma.$queryRaw`
      SELECT 
        t.depot::text as code,
        SUM(t.ca)::numeric as ca_total,
        COUNT(DISTINCT t.carte)::int as nb_clients,
        COUNT(DISTINCT CASE WHEN client_achats.nb_achats > 1 THEN t.carte END)::int as nb_clients_actifs,
        COUNT(DISTINCT CASE WHEN client_achats.nb_achats >= 3 THEN t.carte END)::int as nb_clients_fideles,
        COUNT(*)::int as nb_transactions,
        AVG(t.ca)::numeric as panier_moyen
      FROM transactions t
      LEFT JOIN (
        SELECT carte, COUNT(*) as nb_achats
        FROM transactions
        WHERE ca > 0 AND carte != '0'
        GROUP BY carte
      ) client_achats ON t.carte = client_achats.carte
      WHERE t.ca > 0 
        AND t.depot IS NOT NULL 
        AND t.depot NOT LIKE 'D%'
        AND t.carte != '0'
      GROUP BY t.depot
    `

    // 3. Top 10 produits par magasin (familles)
    const topProduitsParMagasin = await prisma.$queryRaw`
      WITH ranked_products AS (
        SELECT 
          t.depot::text as code,
          p.famille::text,
          SUM(t.ca)::numeric as ca,
          COUNT(*)::int as volume,
          ROW_NUMBER() OVER (PARTITION BY t.depot ORDER BY SUM(t.ca) DESC) as rang
        FROM transactions t
        INNER JOIN produits p ON t.produit = p.id
        WHERE t.ca > 0 
          AND t.depot IS NOT NULL 
          AND t.depot NOT LIKE 'D%'
          AND p.famille IS NOT NULL
        GROUP BY t.depot, p.famille
      )
      SELECT code, famille, ca, volume, rang
      FROM ranked_products
      WHERE rang <= 10
      ORDER BY code, rang
    `

    // 4. Top 10 clients VIP par magasin
    const topClientsParMagasin = await prisma.$queryRaw`
      WITH ranked_clients AS (
        SELECT 
          t.depot::text as code_magasin,
          t.carte::text,
          c.nom,
          c.prenom,
          c.email,
          c.telephone,
          c.sexe,
          c.ville,
          c.cp,
          SUM(t.ca)::numeric as ca_client,
          COUNT(*)::int as nb_achats_magasin,
          MAX(t.date) as dernier_achat,
          ROW_NUMBER() OVER (PARTITION BY t.depot ORDER BY SUM(t.ca) DESC) as rang
        FROM transactions t
        INNER JOIN clients c ON t.carte = c.carte
        WHERE t.ca > 0 
          AND t.depot IS NOT NULL 
          AND t.depot NOT LIKE 'D%'
          AND t.carte != '0'
        GROUP BY t.depot, t.carte, c.nom, c.prenom, c.email, c.telephone, c.sexe, c.ville, c.cp
      )
      SELECT *
      FROM ranked_clients
      WHERE rang <= 10
      ORDER BY code_magasin, rang
    `

    // 5. Top 10 zones chalandise par magasin (CP)
    const zonesParMagasin = await prisma.$queryRaw`
      WITH ranked_zones AS (
        SELECT 
          t.depot::text as code_magasin,
          c.cp::text,
          STRING_AGG(DISTINCT c.ville, ', ') as ville,
          COUNT(DISTINCT t.carte)::int as nb_clients,
          SUM(t.ca)::numeric as ca_zone,
          COUNT(*)::int as nb_transactions,
          ROW_NUMBER() OVER (PARTITION BY t.depot ORDER BY SUM(t.ca) DESC) as rang
        FROM transactions t
        INNER JOIN clients c ON t.carte = c.carte
        WHERE t.ca > 0 
          AND t.depot IS NOT NULL 
          AND t.depot NOT LIKE 'D%'
          AND t.carte != '0'
          AND c.cp IS NOT NULL
          AND c.cp != ''
        GROUP BY t.depot, c.cp
      )
      SELECT *
      FROM ranked_zones
      WHERE rang <= 10
      ORDER BY code_magasin, rang
    `

    // 6. Construire le résultat final
    const statsMap = {}
    magasinsStats.forEach(row => {
      const taux_fidelite = row.nb_clients > 0 ? (Number(row.nb_clients_fideles) / Number(row.nb_clients)) * 100 : 0
      statsMap[row.code] = {
        ca_total: Number(row.ca_total),
        nb_clients: Number(row.nb_clients),
        nb_clients_actifs: Number(row.nb_clients_actifs),
        nb_clients_fideles: Number(row.nb_clients_fideles),
        nb_transactions: Number(row.nb_transactions),
        panier_moyen: Number(row.panier_moyen),
        taux_fidelite: taux_fidelite
      }
    })

    // Grouper top produits
    const produitsMap = {}
    topProduitsParMagasin.forEach(row => {
      if (!produitsMap[row.code]) produitsMap[row.code] = []
      produitsMap[row.code].push({
        famille: row.famille,
        ca: Number(row.ca),
        volume: Number(row.volume),
        rang: Number(row.rang)
      })
    })

    // Grouper top clients
    const clientsMap = {}
    topClientsParMagasin.forEach(row => {
      if (!clientsMap[row.code_magasin]) clientsMap[row.code_magasin] = []
      clientsMap[row.code_magasin].push({
        carte: row.carte,
        nom: row.nom,
        prenom: row.prenom,
        email: row.email,
        telephone: row.telephone,
        sexe: row.sexe,
        ville: row.ville,
        cp: row.cp,
        ca_client: Number(row.ca_client),
        nb_achats: Number(row.nb_achats_magasin),
        dernier_achat: row.dernier_achat
      })
    })

    // Grouper zones
    const zonesMap = {}
    zonesParMagasin.forEach(row => {
      if (!zonesMap[row.code_magasin]) zonesMap[row.code_magasin] = []
      zonesMap[row.code_magasin].push({
        cp: row.cp,
        ville: row.ville,
        nb_clients: Number(row.nb_clients),
        ca_zone: Number(row.ca_zone),
        nb_transactions: Number(row.nb_transactions)
      })
    })

    // Construire tableau final magasins
    const magasins = magasinsTable.map(mag => {
      const stats = statsMap[mag.code] || {
        ca_total: 0,
        nb_clients: 0,
        nb_clients_actifs: 0,
        nb_clients_fideles: 0,
        nb_transactions: 0,
        panier_moyen: 0,
        taux_fidelite: 0
      }

      const topProduits = produitsMap[mag.code] || []
      const topClients = clientsMap[mag.code] || []
      const zones = zonesMap[mag.code] || []

      return {
        code: mag.code,
        nom: mag.nom,
        ville: mag.ville || 'Non renseignée',
        cp: mag.cp,
        lat: mag.lat,
        lon: mag.lon,
        stats,
        top_produits: topProduits,
        top_clients: topClients,
        zones_chalandise: zones,
        top_famille: topProduits[0]?.famille || 'N/A'
      }
    }).filter(mag => mag.stats.ca_total > 0) // Garder seulement magasins avec CA

    // Stats réseau
    const ca_total_reseau = magasins.reduce((sum, m) => sum + m.stats.ca_total, 0)
    const nb_clients_total = magasins.reduce((sum, m) => sum + m.stats.nb_clients, 0)
    const nb_transactions_total = magasins.reduce((sum, m) => sum + m.stats.nb_transactions, 0)
    const panier_moyen_reseau = ca_total_reseau / nb_transactions_total

    console.log(`✅ API Stores: ${magasins.length} magasins avec données`)

    res.status(200).json({
      magasins,
      stats_reseau: {
        ca_total: ca_total_reseau,
        nb_magasins: magasins.length,
        nb_clients_total,
        nb_transactions_total,
        panier_moyen_reseau
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
