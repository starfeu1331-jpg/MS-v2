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

  const { action, storeCode, periodType, periodValue } = req.query;

  // ── Helper: calculer les bornes de dates depuis period ──
  function getPeriodDates(pType, pValue) {
    if (!pType || pType === 'all') return null;
    const now = new Date();
    let startDate, endDate;
    if (pType === 'months') {
      const months = parseInt(pValue);
      if (isNaN(months) || months < 1 || months > 120) return null;
      startDate = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
      endDate = now;
    } else if (pType === 'year') {
      const year = parseInt(pValue);
      if (isNaN(year) || year < 2000 || year > 2100) return null;
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
    } else if (pType === 'custom') {
      const parts = String(pValue).split('_');
      if (parts.length !== 2) return null;
      startDate = new Date(parts[0]);
      endDate = new Date(parts[1]);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;
    } else {
      return null;
    }
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }

  // ── Helper: période N-1 (même durée, 1 an avant) ──
  function getN1Period(dates) {
    if (!dates) return null;
    const s = new Date(dates.startDate);
    const e = new Date(dates.endDate);
    s.setFullYear(s.getFullYear() - 1);
    e.setFullYear(e.getFullYear() - 1);
    return {
      startDate: s.toISOString().split('T')[0],
      endDate: e.toISOString().split('T')[0],
    };
  }

  // ── Helper: évolution % ──
  function evo(current, prev) {
    if (!prev || prev === 0) return null;
    return ((current - prev) / prev) * 100;
  }

  if (action === 'catchment') {
    if (!storeCode) {
      return res.status(400).json({ error: 'storeCode requis' });
    }

    try {
      const period = getPeriodDates(periodType, periodValue);
      console.log(`🔍 Récupération zones pour magasin ${storeCode}${period ? ` (${period.startDate} → ${period.endDate})` : ' (toutes périodes)'}...`);

      // Essayer avec et sans le préfixe "M"
      const storeCodeWithM = storeCode.startsWith('M') ? storeCode : `M${storeCode}`;
      const storeCodeWithoutM = storeCode.replace(/^M/, '');

      let zones;
      if (period) {
        zones = await prisma.$queryRaw`
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
            AND t.date >= ${period.startDate}::date
            AND t.date <= ${period.endDate}::date
          GROUP BY c.cp
          HAVING COUNT(DISTINCT t.carte) >= 10
          ORDER BY SUM(t.ca) DESC
        `;
      } else {
        zones = await prisma.$queryRaw`
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
      }

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
          AND t.depot != '41'
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

  // ══════════════════════════════════════════════════════════════
  // action=overview — Vue réseau avec N-1, univers, classements
  // ══════════════════════════════════════════════════════════════
  if (action === 'overview' || !action) {
    try {
      const period = getPeriodDates(periodType, periodValue);
      const n1Period = getN1Period(period);
      const dateFilter = period
        ? `AND t.date >= '${period.startDate}'::date AND t.date <= '${period.endDate}'::date`
        : '';
      const n1DateFilter = n1Period
        ? `AND t.date >= '${n1Period.startDate}'::date AND t.date <= '${n1Period.endDate}'::date`
        : '';

      console.log(`🔄 API Stores overview${period ? ` (${period.startDate} → ${period.endDate})` : ' (toutes périodes)'}${n1Period ? ` vs N-1 (${n1Period.startDate} → ${n1Period.endDate})` : ''}...`);

      const magasinsTable = await prisma.magasin.findMany({
        where: { code: { not: { startsWith: 'D' } } },
        orderBy: { nom: 'asc' }
      });

      // ── Requête période courante avec univers ──
      const currentStats = await prisma.$queryRawUnsafe(`
        SELECT 
          t.depot::text as code,
          SUM(t.ca)::numeric as ca_total,
          COUNT(DISTINCT t.carte)::int as nb_clients,
          COUNT(DISTINCT CASE WHEN c.rfm_segment IN ('Ultra Champions', 'Champions', 'Loyaux') THEN t.carte END)::int as nb_clients_fideles,
          COUNT(DISTINCT t.facture)::int as nb_factures,
          (SUM(t.ca) / NULLIF(COUNT(DISTINCT t.facture), 0))::numeric as panier_moyen,
          SUM(CASE WHEN p.famille = 'Mur' THEN t.ca ELSE 0 END)::numeric as ca_mur,
          SUM(CASE WHEN p.famille = 'Sol' THEN t.ca ELSE 0 END)::numeric as ca_sol,
          SUM(CASE WHEN p.famille = 'Ameublement' THEN t.ca ELSE 0 END)::numeric as ca_ameub,
          COUNT(DISTINCT CASE WHEN p.famille = 'Mur' THEN t.facture END)::int as nb_tickets_mur,
          COUNT(DISTINCT CASE WHEN p.famille = 'Sol' THEN t.facture END)::int as nb_tickets_sol,
          COUNT(DISTINCT CASE WHEN p.famille = 'Ameublement' THEN t.facture END)::int as nb_tickets_ameub
        FROM transactions t
        LEFT JOIN clients c ON t.carte = c.carte
        LEFT JOIN produits p ON t.produit = p.id
        WHERE t.ca > 0 
          AND t.depot IS NOT NULL 
          AND t.depot NOT LIKE 'D%%'
          AND t.depot != '41'
          AND t.carte != '0'
          ${dateFilter}
        GROUP BY t.depot
      `);

      // ── Requête N-1 (si applicable) ──
      let n1Stats = [];
      if (n1Period) {
        n1Stats = await prisma.$queryRawUnsafe(`
          SELECT 
            t.depot::text as code,
            SUM(t.ca)::numeric as ca_total,
            COUNT(DISTINCT t.carte)::int as nb_clients,
            COUNT(DISTINCT t.facture)::int as nb_factures,
            (SUM(t.ca) / NULLIF(COUNT(DISTINCT t.facture), 0))::numeric as panier_moyen,
            SUM(CASE WHEN p.famille = 'Mur' THEN t.ca ELSE 0 END)::numeric as ca_mur,
            SUM(CASE WHEN p.famille = 'Sol' THEN t.ca ELSE 0 END)::numeric as ca_sol,
            SUM(CASE WHEN p.famille = 'Ameublement' THEN t.ca ELSE 0 END)::numeric as ca_ameub,
            COUNT(DISTINCT CASE WHEN p.famille = 'Mur' THEN t.facture END)::int as nb_tickets_mur,
            COUNT(DISTINCT CASE WHEN p.famille = 'Sol' THEN t.facture END)::int as nb_tickets_sol,
            COUNT(DISTINCT CASE WHEN p.famille = 'Ameublement' THEN t.facture END)::int as nb_tickets_ameub
          FROM transactions t
          LEFT JOIN produits p ON t.produit = p.id
          WHERE t.ca > 0 
            AND t.depot IS NOT NULL 
            AND t.depot NOT LIKE 'D%%'
            AND t.depot != '41'
            AND t.carte != '0'
            ${n1DateFilter}
          GROUP BY t.depot
        `);
      }

      // ── Sous-familles par magasin (période courante) ──
      const sfStats = await prisma.$queryRawUnsafe(`
        SELECT t.depot::text as code, p.famille, p.sous_famille,
          SUM(t.ca)::numeric as ca, COUNT(DISTINCT t.facture)::int as nb_tickets
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE t.ca > 0 AND t.carte != '0'
          AND t.depot IS NOT NULL AND t.depot NOT LIKE 'D%%' AND t.depot != '41'
          AND p.famille IN ('Mur', 'Sol', 'Ameublement')
          ${dateFilter}
        GROUP BY t.depot, p.famille, p.sous_famille
      `);
      let sfStatsN1 = [];
      if (n1Period) {
        sfStatsN1 = await prisma.$queryRawUnsafe(`
          SELECT t.depot::text as code, p.famille, p.sous_famille,
            SUM(t.ca)::numeric as ca, COUNT(DISTINCT t.facture)::int as nb_tickets
          FROM transactions t
          JOIN produits p ON t.produit = p.id
          WHERE t.ca > 0 AND t.carte != '0'
            AND t.depot IS NOT NULL AND t.depot NOT LIKE 'D%%' AND t.depot != '41'
            AND p.famille IN ('Mur', 'Sol', 'Ameublement')
            ${n1DateFilter}
          GROUP BY t.depot, p.famille, p.sous_famille
        `);
      }
      const sfMap = {};
      sfStats.forEach(r => {
        if (!sfMap[r.code]) sfMap[r.code] = {};
        if (!sfMap[r.code][r.famille]) sfMap[r.code][r.famille] = {};
        sfMap[r.code][r.famille][r.sous_famille || 'Autre'] = { ca: Number(r.ca || 0), nb_tickets: Number(r.nb_tickets || 0) };
      });
      const sfMapN1 = {};
      sfStatsN1.forEach(r => {
        if (!sfMapN1[r.code]) sfMapN1[r.code] = {};
        if (!sfMapN1[r.code][r.famille]) sfMapN1[r.code][r.famille] = {};
        sfMapN1[r.code][r.famille][r.sous_famille || 'Autre'] = { ca: Number(r.ca || 0), nb_tickets: Number(r.nb_tickets || 0) };
      });

      // ── Build maps ──
      const currentMap = {};
      currentStats.forEach(row => {
        currentMap[row.code] = {
          ca_total: Number(row.ca_total),
          nb_clients: Number(row.nb_clients),
          nb_clients_fideles: Number(row.nb_clients_fideles),
          nb_factures: Number(row.nb_factures),
          panier_moyen: Number(row.panier_moyen || 0),
          taux_fidelite: row.nb_clients > 0 ? (Number(row.nb_clients_fideles) / Number(row.nb_clients)) * 100 : 0,
          ca_mur: Number(row.ca_mur || 0),
          ca_sol: Number(row.ca_sol || 0),
          ca_ameub: Number(row.ca_ameub || 0),
          nb_tickets_mur: Number(row.nb_tickets_mur || 0),
          nb_tickets_sol: Number(row.nb_tickets_sol || 0),
          nb_tickets_ameub: Number(row.nb_tickets_ameub || 0),
        };
      });

      const n1Map = {};
      n1Stats.forEach(row => {
        n1Map[row.code] = {
          ca_total: Number(row.ca_total),
          nb_clients: Number(row.nb_clients),
          nb_factures: Number(row.nb_factures),
          panier_moyen: Number(row.panier_moyen || 0),
          ca_mur: Number(row.ca_mur || 0),
          ca_sol: Number(row.ca_sol || 0),
          ca_ameub: Number(row.ca_ameub || 0),
          nb_tickets_mur: Number(row.nb_tickets_mur || 0),
          nb_tickets_sol: Number(row.nb_tickets_sol || 0),
          nb_tickets_ameub: Number(row.nb_tickets_ameub || 0),
        };
      });

      // ── Merge magasins avec stats + N-1 ──
      const magasins = magasinsTable.map(mag => {
        const code = mag.code;
        const txCode = currentMap[code] ? code : currentMap[`M${code}`] ? `M${code}` : code.replace(/^M/, '');
        const stats = currentMap[txCode];
        if (!stats || stats.ca_total <= 0) return null;
        const n1 = n1Map[txCode] || null;

        return {
          code,
          nom: mag.nom,
          ville: mag.ville || '',
          cp: mag.cp || '',
          zone: mag.zone || '',
          stats: {
            ...stats,
            ca_n1: n1?.ca_total ?? null,
            evo_ca: evo(stats.ca_total, n1?.ca_total),
            nb_clients_n1: n1?.nb_clients ?? null,
            evo_clients: evo(stats.nb_clients, n1?.nb_clients),
            panier_moyen_n1: n1?.panier_moyen ?? null,
            evo_pm: evo(stats.panier_moyen, n1?.panier_moyen),
            ca_mur_n1: n1?.ca_mur ?? null,
            ca_sol_n1: n1?.ca_sol ?? null,
            ca_ameub_n1: n1?.ca_ameub ?? null,
            evo_mur: evo(stats.ca_mur, n1?.ca_mur),
            evo_sol: evo(stats.ca_sol, n1?.ca_sol),
            evo_ameub: evo(stats.ca_ameub, n1?.ca_ameub),
            nb_factures_n1: n1?.nb_factures ?? null,
            evo_factures: evo(stats.nb_factures, n1?.nb_factures),
            nb_tickets_mur_n1: n1?.nb_tickets_mur ?? null,
            nb_tickets_sol_n1: n1?.nb_tickets_sol ?? null,
            nb_tickets_ameub_n1: n1?.nb_tickets_ameub ?? null,
            evo_tickets_mur: evo(stats.nb_tickets_mur, n1?.nb_tickets_mur),
            evo_tickets_sol: evo(stats.nb_tickets_sol, n1?.nb_tickets_sol),
            evo_tickets_ameub: evo(stats.nb_tickets_ameub, n1?.nb_tickets_ameub),
            pm_mur: stats.nb_tickets_mur > 0 ? stats.ca_mur / stats.nb_tickets_mur : 0,
            pm_sol: stats.nb_tickets_sol > 0 ? stats.ca_sol / stats.nb_tickets_sol : 0,
            pm_ameub: stats.nb_tickets_ameub > 0 ? stats.ca_ameub / stats.nb_tickets_ameub : 0,
            pm_mur_n1: n1?.nb_tickets_mur > 0 ? n1.ca_mur / n1.nb_tickets_mur : null,
            pm_sol_n1: n1?.nb_tickets_sol > 0 ? n1.ca_sol / n1.nb_tickets_sol : null,
            pm_ameub_n1: n1?.nb_tickets_ameub > 0 ? n1.ca_ameub / n1.nb_tickets_ameub : null,
            evo_pm_mur: evo(stats.nb_tickets_mur > 0 ? stats.ca_mur / stats.nb_tickets_mur : 0, n1?.nb_tickets_mur > 0 ? n1.ca_mur / n1.nb_tickets_mur : null),
            evo_pm_sol: evo(stats.nb_tickets_sol > 0 ? stats.ca_sol / stats.nb_tickets_sol : 0, n1?.nb_tickets_sol > 0 ? n1.ca_sol / n1.nb_tickets_sol : null),
            evo_pm_ameub: evo(stats.nb_tickets_ameub > 0 ? stats.ca_ameub / stats.nb_tickets_ameub : 0, n1?.nb_tickets_ameub > 0 ? n1.ca_ameub / n1.nb_tickets_ameub : null),
            sous_familles: (() => {
              const sf = sfMap[txCode] || {};
              const sfN1 = sfMapN1[txCode] || {};
              const result = {};
              ['Mur', 'Sol', 'Ameublement'].forEach(fam => {
                result[fam] = {};
                const cur = sf[fam] || {};
                const prev = sfN1[fam] || {};
                const allKeys = new Set([...Object.keys(cur), ...Object.keys(prev)]);
                allKeys.forEach(k => {
                  const c = cur[k] || { ca: 0, nb_tickets: 0 };
                  const p = prev[k] || null;
                  result[fam][k] = {
                    ca: c.ca, ca_n1: p?.ca ?? null, evo: p ? evo(c.ca, p.ca) : null,
                    nb_tickets: c.nb_tickets, nb_tickets_n1: p?.nb_tickets ?? null,
                    evo_tickets: p ? evo(c.nb_tickets, p.nb_tickets) : null,
                  };
                });
              });
              return result;
            })(),
          }
        };
      }).filter(Boolean);

      // ── Classement société (CA desc) ──
      const sortedByCA = [...magasins].sort((a, b) => b.stats.ca_total - a.stats.ca_total);
      sortedByCA.forEach((m, i) => { m.stats.rang_societe = i + 1; });

      // ── Classement régional (CA desc par zone) ──
      const zoneGroups = {};
      magasins.forEach(m => {
        const z = m.zone || 'Autre';
        if (!zoneGroups[z]) zoneGroups[z] = [];
        zoneGroups[z].push(m);
      });
      Object.values(zoneGroups).forEach(group => {
        group.sort((a, b) => b.stats.ca_total - a.stats.ca_total);
        group.forEach((m, i) => { m.stats.rang_regional = i + 1; });
      });

      // ── Totaux par zone ──
      const zoneTotals = {};
      Object.entries(zoneGroups).forEach(([zone, stores]) => {
        const t = stores.reduce((acc, m) => ({
          ca_total: acc.ca_total + m.stats.ca_total,
          ca_n1: m.stats.ca_n1 !== null ? (acc.ca_n1 || 0) + m.stats.ca_n1 : acc.ca_n1,
          nb_clients: acc.nb_clients + m.stats.nb_clients,
          nb_clients_n1: m.stats.nb_clients_n1 !== null ? (acc.nb_clients_n1 || 0) + m.stats.nb_clients_n1 : acc.nb_clients_n1,
          nb_factures: acc.nb_factures + m.stats.nb_factures,
          nb_factures_n1: m.stats.panier_moyen_n1 !== null ? (acc.nb_factures_n1 || 0) + (n1Map[currentMap[m.code] ? m.code : `M${m.code}`]?.nb_factures || 0) : acc.nb_factures_n1,
          nb_clients_fideles: acc.nb_clients_fideles + m.stats.nb_clients_fideles,
          ca_mur: acc.ca_mur + m.stats.ca_mur,
          ca_sol: acc.ca_sol + m.stats.ca_sol,
          ca_ameub: acc.ca_ameub + m.stats.ca_ameub,
          ca_mur_n1: m.stats.ca_mur_n1 !== null ? (acc.ca_mur_n1 || 0) + m.stats.ca_mur_n1 : acc.ca_mur_n1,
          ca_sol_n1: m.stats.ca_sol_n1 !== null ? (acc.ca_sol_n1 || 0) + m.stats.ca_sol_n1 : acc.ca_sol_n1,
          ca_ameub_n1: m.stats.ca_ameub_n1 !== null ? (acc.ca_ameub_n1 || 0) + m.stats.ca_ameub_n1 : acc.ca_ameub_n1,
        }), { ca_total: 0, ca_n1: null, nb_clients: 0, nb_clients_n1: null, nb_factures: 0, nb_factures_n1: null, nb_clients_fideles: 0, ca_mur: 0, ca_sol: 0, ca_ameub: 0, ca_mur_n1: null, ca_sol_n1: null, ca_ameub_n1: null });

        t.panier_moyen = t.nb_factures > 0 ? t.ca_total / t.nb_factures : 0;
        t.panier_moyen_n1 = t.nb_factures_n1 > 0 ? t.ca_n1 / t.nb_factures_n1 : null;
        t.evo_ca = evo(t.ca_total, t.ca_n1);
        t.evo_clients = evo(t.nb_clients, t.nb_clients_n1);
        t.evo_pm = evo(t.panier_moyen, t.panier_moyen_n1);
        t.taux_fidelite = t.nb_clients > 0 ? (t.nb_clients_fideles / t.nb_clients) * 100 : 0;
        t.evo_mur = evo(t.ca_mur, t.ca_mur_n1);
        t.evo_sol = evo(t.ca_sol, t.ca_sol_n1);
        t.evo_ameub = evo(t.ca_ameub, t.ca_ameub_n1);
        t.nb_magasins = stores.length;
        zoneTotals[zone] = t;
      });

      // ── Totaux réseau ──
      const ca_total_reseau = magasins.reduce((s, m) => s + m.stats.ca_total, 0);
      const ca_n1_reseau = n1Period ? magasins.reduce((s, m) => s + (m.stats.ca_n1 || 0), 0) : null;
      const nb_clients_total = magasins.reduce((s, m) => s + m.stats.nb_clients, 0);
      const nb_clients_n1 = n1Period ? magasins.reduce((s, m) => s + (m.stats.nb_clients_n1 || 0), 0) : null;
      const nb_factures_total = magasins.reduce((s, m) => s + m.stats.nb_factures, 0);
      const panier_moyen_reseau = nb_factures_total > 0 ? ca_total_reseau / nb_factures_total : 0;
      const taux_fidelite_reseau = nb_clients_total > 0
        ? magasins.reduce((s, m) => s + m.stats.nb_clients_fideles, 0) / nb_clients_total * 100
        : 0;

      console.log(`✅ API Stores overview: ${magasins.length} magasins, N-1: ${!!n1Period}`);

      return res.status(200).json({
        magasins,
        stats_reseau: {
          ca_total: ca_total_reseau,
          ca_n1: ca_n1_reseau,
          evo_ca: evo(ca_total_reseau, ca_n1_reseau),
          nb_magasins: magasins.length,
          nb_clients_total,
          nb_clients_n1,
          evo_clients: evo(nb_clients_total, nb_clients_n1),
          panier_moyen: panier_moyen_reseau,
          taux_fidelite: taux_fidelite_reseau,
          nb_factures_total,
        },
        zone_totals: zoneTotals,
        has_n1: !!n1Period,
      });
    } catch (error) {
      console.error('❌ Erreur API Stores overview:', error);
      return res.status(500).json({ error: 'Erreur serveur', details: error.message });
    } finally {
      await prisma.$disconnect();
    }
  }

  // ══════════════════════════════════════════════════════════════
  // action=detail — Fiche individuelle avec N-1 et univers
  // ══════════════════════════════════════════════════════════════
  if (action === 'detail') {
    if (!storeCode) return res.status(400).json({ error: 'storeCode requis' });

    try {
      const period = getPeriodDates(periodType, periodValue);
      const n1Period = getN1Period(period);
      const dateFilter = period
        ? `AND t.date >= '${period.startDate}'::date AND t.date <= '${period.endDate}'::date`
        : '';
      const n1DateFilter = n1Period
        ? `AND t.date >= '${n1Period.startDate}'::date AND t.date <= '${n1Period.endDate}'::date`
        : '';

      const sc = storeCode;
      const scM = sc.startsWith('M') ? sc : `M${sc}`;
      const scN = sc.replace(/^M/, '');
      const depotFilter = `(t.depot = '${sc}' OR t.depot = '${scM}' OR t.depot = '${scN}')`;

      console.log(`🔍 API Stores detail: ${storeCode}${period ? ` (${period.startDate} → ${period.endDate})` : ''}...`);

      // 1. Stats globales + univers du magasin (période courante)
      const [statsRows] = await prisma.$queryRawUnsafe(`
        SELECT 
          SUM(t.ca)::numeric as ca_total,
          COUNT(DISTINCT t.carte)::int as nb_clients,
          COUNT(DISTINCT CASE WHEN c.rfm_segment IN ('Ultra Champions', 'Champions', 'Loyaux') THEN t.carte END)::int as nb_clients_fideles,
          COUNT(*)::int as nb_transactions,
          COUNT(DISTINCT t.facture)::int as nb_factures,
          (SUM(t.ca) / NULLIF(COUNT(DISTINCT t.facture), 0))::numeric as panier_moyen,
          SUM(CASE WHEN p.famille = 'Mur' THEN t.ca ELSE 0 END)::numeric as ca_mur,
          SUM(CASE WHEN p.famille = 'Sol' THEN t.ca ELSE 0 END)::numeric as ca_sol,
          SUM(CASE WHEN p.famille = 'Ameublement' THEN t.ca ELSE 0 END)::numeric as ca_ameub
        FROM transactions t
        LEFT JOIN clients c ON t.carte = c.carte
        LEFT JOIN produits p ON t.produit = p.id
        WHERE t.ca > 0 AND t.carte != '0' AND ${depotFilter} ${dateFilter}
      `);

      // 2. Stats N-1
      let statsN1 = null;
      if (n1Period) {
        const [n1Row] = await prisma.$queryRawUnsafe(`
          SELECT 
            SUM(t.ca)::numeric as ca_total,
            COUNT(DISTINCT t.carte)::int as nb_clients,
            COUNT(DISTINCT t.facture)::int as nb_factures,
            (SUM(t.ca) / NULLIF(COUNT(DISTINCT t.facture), 0))::numeric as panier_moyen,
            SUM(CASE WHEN p.famille = 'Mur' THEN t.ca ELSE 0 END)::numeric as ca_mur,
            SUM(CASE WHEN p.famille = 'Sol' THEN t.ca ELSE 0 END)::numeric as ca_sol,
            SUM(CASE WHEN p.famille = 'Ameublement' THEN t.ca ELSE 0 END)::numeric as ca_ameub
          FROM transactions t
          LEFT JOIN produits p ON t.produit = p.id
          WHERE t.ca > 0 AND t.carte != '0' AND ${depotFilter} ${n1DateFilter}
        `);
        if (n1Row && n1Row.ca_total) {
          statsN1 = {
            ca_total: Number(n1Row.ca_total || 0),
            nb_clients: Number(n1Row.nb_clients || 0),
            nb_factures: Number(n1Row.nb_factures || 0),
            panier_moyen: Number(n1Row.panier_moyen || 0),
            ca_mur: Number(n1Row.ca_mur || 0),
            ca_sol: Number(n1Row.ca_sol || 0),
            ca_ameub: Number(n1Row.ca_ameub || 0),
          };
        }
      }

      const stats = {
        ca_total: Number(statsRows.ca_total || 0),
        nb_clients: Number(statsRows.nb_clients || 0),
        nb_clients_fideles: Number(statsRows.nb_clients_fideles || 0),
        nb_transactions: Number(statsRows.nb_transactions || 0),
        panier_moyen: Number(statsRows.panier_moyen || 0),
        taux_fidelite: statsRows.nb_clients > 0
          ? (Number(statsRows.nb_clients_fideles) / Number(statsRows.nb_clients)) * 100
          : 0,
        ca_mur: Number(statsRows.ca_mur || 0),
        ca_sol: Number(statsRows.ca_sol || 0),
        ca_ameub: Number(statsRows.ca_ameub || 0),
        // N-1
        ca_n1: statsN1?.ca_total ?? null,
        evo_ca: evo(Number(statsRows.ca_total || 0), statsN1?.ca_total),
        nb_clients_n1: statsN1?.nb_clients ?? null,
        evo_clients: evo(Number(statsRows.nb_clients || 0), statsN1?.nb_clients),
        panier_moyen_n1: statsN1?.panier_moyen ?? null,
        evo_pm: evo(Number(statsRows.panier_moyen || 0), statsN1?.panier_moyen),
        ca_mur_n1: statsN1?.ca_mur ?? null,
        evo_mur: evo(Number(statsRows.ca_mur || 0), statsN1?.ca_mur),
        ca_sol_n1: statsN1?.ca_sol ?? null,
        evo_sol: evo(Number(statsRows.ca_sol || 0), statsN1?.ca_sol),
        ca_ameub_n1: statsN1?.ca_ameub ?? null,
        evo_ameub: evo(Number(statsRows.ca_ameub || 0), statsN1?.ca_ameub),
      };

      // 2b. Sous-familles pour ce magasin
      const sfDetail = await prisma.$queryRawUnsafe(`
        SELECT p.famille, p.sous_famille,
          SUM(t.ca)::numeric as ca, COUNT(DISTINCT t.facture)::int as nb_tickets
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE t.ca > 0 AND t.carte != '0' AND ${depotFilter}
          AND p.famille IN ('Mur', 'Sol', 'Ameublement')
          ${dateFilter}
        GROUP BY p.famille, p.sous_famille
      `);
      let sfDetailN1 = [];
      if (n1Period) {
        sfDetailN1 = await prisma.$queryRawUnsafe(`
          SELECT p.famille, p.sous_famille,
            SUM(t.ca)::numeric as ca, COUNT(DISTINCT t.facture)::int as nb_tickets
          FROM transactions t
          JOIN produits p ON t.produit = p.id
          WHERE t.ca > 0 AND t.carte != '0' AND ${depotFilter}
            AND p.famille IN ('Mur', 'Sol', 'Ameublement')
            ${n1DateFilter}
          GROUP BY p.famille, p.sous_famille
        `);
      }
      const sfCur = {};
      sfDetail.forEach(r => {
        if (!sfCur[r.famille]) sfCur[r.famille] = {};
        sfCur[r.famille][r.sous_famille || 'Autre'] = { ca: Number(r.ca || 0), nb_tickets: Number(r.nb_tickets || 0) };
      });
      const sfPrev = {};
      sfDetailN1.forEach(r => {
        if (!sfPrev[r.famille]) sfPrev[r.famille] = {};
        sfPrev[r.famille][r.sous_famille || 'Autre'] = { ca: Number(r.ca || 0), nb_tickets: Number(r.nb_tickets || 0) };
      });
      const sousFamilles = {};
      ['Mur', 'Sol', 'Ameublement'].forEach(fam => {
        sousFamilles[fam] = {};
        const cur = sfCur[fam] || {};
        const prev = sfPrev[fam] || {};
        const allKeys = new Set([...Object.keys(cur), ...Object.keys(prev)]);
        allKeys.forEach(k => {
          const c = cur[k] || { ca: 0, nb_tickets: 0 };
          const p = prev[k] || null;
          sousFamilles[fam][k] = {
            ca: c.ca, ca_n1: p?.ca ?? null, evo: p ? evo(c.ca, p.ca) : null,
            nb_tickets: c.nb_tickets, nb_tickets_n1: p?.nb_tickets ?? null,
            evo_tickets: p ? evo(c.nb_tickets, p.nb_tickets) : null,
          };
        });
      });

      // 3. Évolution mensuelle CA
      const evolution = await prisma.$queryRawUnsafe(`
        SELECT 
          TO_CHAR(t.date, 'YYYY-MM') as mois,
          SUM(t.ca)::numeric as ca,
          COUNT(DISTINCT t.carte)::int as clients,
          COUNT(DISTINCT t.facture)::int as tickets
        FROM transactions t
        WHERE t.ca > 0 AND t.carte != '0' AND ${depotFilter} ${dateFilter}
        GROUP BY TO_CHAR(t.date, 'YYYY-MM')
        ORDER BY mois
      `);

      // 4. Répartition RFM
      const rfmDistribution = await prisma.$queryRawUnsafe(`
        SELECT 
          COALESCE(c.rfm_segment, 'Non classé') as segment,
          COUNT(DISTINCT c.carte)::int as nb_clients,
          SUM(t.ca)::numeric as ca_segment
        FROM transactions t
        INNER JOIN clients c ON t.carte = c.carte
        WHERE t.ca > 0 AND t.carte != '0' AND ${depotFilter} ${dateFilter}
        GROUP BY c.rfm_segment
        ORDER BY ca_segment DESC
      `);

      // 5. Top 10 familles produits
      const topFamilles = await prisma.$queryRawUnsafe(`
        SELECT 
          p.famille::text,
          SUM(t.ca)::numeric as ca,
          COUNT(*)::int as volume,
          COUNT(DISTINCT t.carte)::int as clients
        FROM transactions t
        INNER JOIN produits p ON t.produit = p.id
        WHERE t.ca > 0 AND t.carte != '0' AND ${depotFilter} AND p.famille IS NOT NULL ${dateFilter}
        GROUP BY p.famille
        ORDER BY ca DESC
        LIMIT 10
      `);

      // 6. Top 15 clients VIP
      const topClients = await prisma.$queryRawUnsafe(`
        SELECT 
          t.carte::text,
          c.nom, c.prenom, c.email, c.ville, c.cp, c.rfm_segment,
          SUM(t.ca)::numeric as ca_client,
          COUNT(DISTINCT t.facture)::int as nb_achats,
          MAX(t.date) as dernier_achat
        FROM transactions t
        INNER JOIN clients c ON t.carte = c.carte
        WHERE t.ca > 0 AND t.carte != '0' AND ${depotFilter} ${dateFilter}
        GROUP BY t.carte, c.nom, c.prenom, c.email, c.ville, c.cp, c.rfm_segment
        ORDER BY ca_client DESC
        LIMIT 15
      `);

      // 7. Top 10 zones chalandise
      const topZones = await prisma.$queryRawUnsafe(`
        SELECT 
          c.cp::text,
          STRING_AGG(DISTINCT c.ville, ', ') as ville,
          COUNT(DISTINCT t.carte)::int as nb_clients,
          SUM(t.ca)::numeric as ca_zone,
          COUNT(*)::int as nb_transactions
        FROM transactions t
        INNER JOIN clients c ON t.carte = c.carte
        WHERE t.ca > 0 AND t.carte != '0' AND ${depotFilter} AND c.cp IS NOT NULL AND c.cp != '' ${dateFilter}
        GROUP BY c.cp
        ORDER BY ca_zone DESC
        LIMIT 10
      `);

      // 8. Répartition jour de semaine
      const joursSemaine = await prisma.$queryRawUnsafe(`
        SELECT 
          EXTRACT(DOW FROM t.date)::int as jour_num,
          TO_CHAR(t.date, 'Day') as jour_nom,
          SUM(t.ca)::numeric as ca,
          COUNT(DISTINCT t.facture)::int as tickets
        FROM transactions t
        WHERE t.ca > 0 AND t.carte != '0' AND ${depotFilter} ${dateFilter}
        GROUP BY EXTRACT(DOW FROM t.date), TO_CHAR(t.date, 'Day')
        ORDER BY jour_num
      `);

      // 9. Stats réseau pour benchmark
      const [reseauRow] = await prisma.$queryRawUnsafe(`
        SELECT 
          SUM(t.ca)::numeric as ca_total,
          COUNT(DISTINCT t.carte)::int as nb_clients,
          COUNT(DISTINCT t.facture)::int as nb_factures,
          (SUM(t.ca) / NULLIF(COUNT(DISTINCT t.facture), 0))::numeric as panier_moyen,
          COUNT(DISTINCT t.depot)::int as nb_magasins
        FROM transactions t
        WHERE t.ca > 0 AND t.carte != '0'
          AND t.depot NOT LIKE 'D%%' AND t.depot != '41' AND t.depot != 'WEB'
          ${dateFilter}
      `);

      const statsReseau = {
        ca_total: Number(reseauRow.ca_total || 0),
        nb_clients: Number(reseauRow.nb_clients || 0),
        panier_moyen: Number(reseauRow.panier_moyen || 0),
        nb_magasins: Number(reseauRow.nb_magasins || 0),
        ca_moyen_par_mag: reseauRow.nb_magasins > 0 ? Number(reseauRow.ca_total) / Number(reseauRow.nb_magasins) : 0
      };

      // Magasin info
      const magasinInfo = await prisma.magasin.findFirst({
        where: { OR: [{ code: sc }, { code: scM }, { code: scN }] }
      });

      const JOURS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

      console.log(`✅ API Stores detail: ${storeCode} — ${stats.ca_total.toFixed(0)}€ CA${statsN1 ? ` (N-1: ${statsN1.ca_total.toFixed(0)}€)` : ''}`);

      return res.status(200).json({
        magasin: {
          code: magasinInfo?.code || storeCode,
          nom: magasinInfo?.nom || storeCode,
          ville: magasinInfo?.ville || '',
          cp: magasinInfo?.cp || '',
          zone: magasinInfo?.zone || '',
        },
        stats,
        sous_familles: sousFamilles,
        stats_reseau: statsReseau,
        has_n1: !!n1Period,
        evolution: evolution.map(r => ({ mois: r.mois, ca: Number(r.ca), clients: Number(r.clients), tickets: Number(r.tickets) })),
        rfm_distribution: rfmDistribution.map(r => ({ segment: r.segment, nb_clients: Number(r.nb_clients), ca: Number(r.ca_segment) })),
        top_familles: topFamilles.map(r => ({ famille: r.famille, ca: Number(r.ca), volume: Number(r.volume), clients: Number(r.clients) })),
        top_clients: topClients.map(r => ({
          carte: r.carte, nom: r.nom, prenom: r.prenom, email: r.email,
          ville: r.ville, cp: r.cp, rfm_segment: r.rfm_segment,
          ca: Number(r.ca_client), nb_achats: Number(r.nb_achats),
          dernier_achat: r.dernier_achat
        })),
        top_zones: topZones.map(r => ({ cp: r.cp, ville: r.ville, nb_clients: Number(r.nb_clients), ca: Number(r.ca_zone), nb_transactions: Number(r.nb_transactions) })),
        jours_semaine: joursSemaine.map(r => ({ jour: JOURS_FR[r.jour_num] || r.jour_nom?.trim(), jour_num: r.jour_num, ca: Number(r.ca), tickets: Number(r.tickets) })),
      });
    } catch (error) {
      console.error(`❌ Erreur API Stores detail (${storeCode}):`, error);
      return res.status(500).json({ error: 'Erreur serveur', details: error.message });
    } finally {
      await prisma.$disconnect();
    }
  }

  return res.status(400).json({ error: 'Action non reconnue', actions: ['list', 'overview', 'detail', 'catchment', 'allStores'] });
}
