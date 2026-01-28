import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('🚀 Marketing API - Début');

    // 1. Données mensuelles magasin (clients avec carte)
    const monthlyMagasin = await sql`
      SELECT 
        TO_CHAR(t.date, 'YYYY-MM')::text as month,
        SUM(t.ca)::numeric as ca,
        COUNT(DISTINCT t.facture)::int as volume,
        COUNT(DISTINCT t.carte)::int as clients
      FROM transactions t
      WHERE t.depot != 'WEB' AND t.carte != '0'
      GROUP BY TO_CHAR(t.date, 'YYYY-MM')
      ORDER BY month DESC
    `;

    console.log('✅ Step 1: monthlyMagasin OK', monthlyMagasin.length);

    // 2. Stats Web
    const webStats = await sql`
      SELECT 
        SUM(ca)::numeric as ca,
        COUNT(*)::int as volume
      FROM transactions
      WHERE depot = 'WEB'
    `;

    console.log('✅ Step 2: webStats OK');

    // 3. Top Produits Web
    const produitsWeb = await sql`
      SELECT 
        p.id::text as code,
        p.famille::text,
        p.sous_famille::text as sousFamille,
        SUM(t.ca)::numeric as ca,
        COUNT(*)::int as volume
      FROM transactions t
      LEFT JOIN produits p ON t.produit = p.id
      WHERE t.depot = 'WEB' AND p.id IS NOT NULL
      GROUP BY p.id, p.famille, p.sous_famille
      ORDER BY SUM(t.ca) DESC
      LIMIT 50
    `;

    console.log('✅ Step 3: produitsWeb OK', produitsWeb.length);

    // 4. Top Zones géographiques (départements)
    const topZones = await sql`
      SELECT 
        SUBSTRING(c.cp, 1, 2)::text as dept,
        SUM(t.ca)::numeric as ca,
        COUNT(DISTINCT t.carte)::int as clients
      FROM transactions t
      JOIN clients c ON t.carte = c.carte
      WHERE t.carte != '0' AND c.cp IS NOT NULL AND c.cp != '' AND c.cp != 'N/A'
      GROUP BY SUBSTRING(c.cp, 1, 2)
      ORDER BY SUM(t.ca) DESC
      LIMIT 20
    `;

    console.log('✅ Step 4: topZones OK', topZones.length);

    // 5. Nouveaux clients par mois
    const nouveauxClients = await sql`
      WITH first_purchase AS (
        SELECT carte, MIN(date) as first_date
        FROM transactions
        WHERE carte != '0'
        GROUP BY carte
      )
      SELECT 
        TO_CHAR(first_date, 'YYYY-MM')::text as month,
        COUNT(*)::int as nouveaux_clients
      FROM first_purchase
      GROUP BY TO_CHAR(first_date, 'YYYY-MM')
      ORDER BY month DESC
    `;

    console.log('✅ Step 5: nouveauxClients OK', nouveauxClients.length);

    console.log('✅ Step 5: nouveauxClients OK', nouveauxClients.length);

    // Formater les données
    const produitsWebObj = {};
    produitsWeb.forEach(p => {
      produitsWebObj[p.code] = {
        ca: parseFloat(p.ca) || 0,
        volume: p.volume || 0,
        famille: p.famille || 'Non défini',
        sousFamille: p.sousfamille || 'Non défini'
      };
    });

    // Organiser zones en objet
    const zonesObj = {};
    topZones.forEach(z => {
      zonesObj[z.dept] = {
        ca: parseFloat(z.ca) || 0,
        clients: z.clients || 0
      };
    });

    // Organiser nouveaux clients par mois
    const nouveauxClientsObj = {};
    nouveauxClients.forEach(nc => {
      nouveauxClientsObj[nc.month] = nc.nouveaux_clients;
    });

    const result = {
      monthlyStats: monthlyMagasin.map(m => ({
        month: m.month,
        ca: parseFloat(m.ca) || 0,
        volume: m.volume || 0,
        clients: m.clients || 0,
        nouveauxClients: nouveauxClientsObj[m.month] || 0
      })),
      webStats: {
        ca: parseFloat(webStats[0]?.ca) || 0,
        volume: webStats[0]?.volume || 0
      },
      produitsWeb: produitsWebObj,
      produitsMagasin: {}, // Simplifié pour l'instant
      zones: zonesObj
    };

    console.log('✅ Marketing API - Succès:', {
      months: result.monthlyStats.length,
      webCA: result.webStats.ca,
      produitsWeb: Object.keys(produitsWebObj).length,
      zones: Object.keys(zonesObj).length
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Erreur Marketing API:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
