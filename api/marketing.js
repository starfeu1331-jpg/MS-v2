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

    // 1. Récupérer tous les clients avec leurs achats groupés par client
    const clientsData = await sql`
      SELECT 
        c.carte,
        c.ville,
        c.cp,
        ARRAY_AGG(
          JSON_BUILD_OBJECT(
            'date', TO_CHAR(t.date, 'DD/MM/YYYY'),
            'ca', t.ca::numeric,
            'facture', t.facture,
            'depot', t.depot,
            'produit', t.produit,
            'famille', p.famille,
            'sousFamille', p.sous_famille
          ) ORDER BY t.date
        ) as achats
      FROM clients c
      LEFT JOIN transactions t ON c.carte = t.carte
      LEFT JOIN produits p ON t.produit = p.id
      WHERE c.carte != '0'
      GROUP BY c.carte, c.ville, c.cp
    `;

    // 2. Stats Web (depot = 'WEB')
    const webStats = await sql`
      SELECT 
        SUM(ca)::numeric as ca,
        COUNT(*)::int as volume
      FROM transactions
      WHERE depot = 'WEB'
    `;

    // 3. Produits Web (top produits vendus en ligne)
    const produitsWeb = await sql`
      SELECT 
        p.id as code,
        p.famille,
        p.sous_famille as sousFamille,
        SUM(t.ca)::numeric as ca,
        COUNT(*)::int as volume
      FROM transactions t
      LEFT JOIN produits p ON t.produit = p.id
      WHERE t.depot = 'WEB'
      GROUP BY p.id, p.famille, p.sous_famille
      ORDER BY SUM(t.ca) DESC
      LIMIT 100
    `;

    // 4. Calculer firstPurchaseDate pour chaque client
    const firstPurchases = await sql`
      SELECT 
        carte,
        TO_CHAR(MIN(date), 'DD/MM/YYYY') as first_purchase
      FROM transactions
      WHERE carte != '0'
      GROUP BY carte
    `;

    const firstPurchaseMap = {};
    firstPurchases.forEach(fp => {
      firstPurchaseMap[fp.carte] = fp.first_purchase;
    });

    // Formater les données pour le module
    const allClients = clientsData.map(client => ({
      carte: client.carte,
      ville: client.ville || 'N/A',
      cp: client.cp || 'N/A',
      achats: client.achats || [],
      firstPurchaseDate: firstPurchaseMap[client.carte] || 'N/A'
    }));

    // Formater produitsWeb comme un objet indexé par code
    const produitsWebObj = {};
    produitsWeb.forEach(p => {
      produitsWebObj[p.code] = {
        ca: parseFloat(p.ca) || 0,
        volume: p.volume || 0,
        famille: p.famille || 'Non défini',
        sousFamille: p.sousfamille || 'Non défini'
      };
    });

    const result = {
      allClients,
      webStats: {
        ca: parseFloat(webStats[0]?.ca) || 0,
        volume: webStats[0]?.volume || 0
      },
      produitsWeb: produitsWebObj
    };

    console.log('✅ Marketing API - Succès:', {
      clients: allClients.length,
      webCA: result.webStats.ca,
      produitsWeb: Object.keys(produitsWebObj).length
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Erreur Marketing API:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: error.message 
    });
  }
}
