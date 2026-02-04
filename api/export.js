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
