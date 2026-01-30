import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

console.log('🔧 Démarrage du serveur...');
dotenv.config();
console.log('✅ Variables d\'environnement chargées');

const app = express();
console.log('✅ Express initialisé');

const prisma = new PrismaClient();
console.log('✅ PrismaClient créé');

const PORT = process.env.PORT || 3000;
console.log(`✅ Port configuré: ${PORT}`);

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Stats globales
app.get('/api/stats', async (req, res) => {
  try {
    const [totalTransactions, totalClients, caTotal] = await Promise.all([
      prisma.transaction.count(),
      prisma.client.count(),
      prisma.transaction.aggregate({ _sum: { ca: true } })
    ]);

    res.json({
      totalTransactions,
      totalClients,
      caTotal: caTotal._sum.ca || 0
    });
  } catch (error) {
    console.error('Erreur stats:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// IMPORTANT: Routes spécifiques AVANT routes paramétriques
// Dashboard toutes périodes
app.get('/api/dashboard/all', async (req, res) => {
  try {
    console.log(`📊 Chargement Dashboard ALL...`);
    const apiStart = Date.now();

    const [kpis, topProduits, topMagasins, topClients, evolutionMensuelle] = await Promise.all([
      prisma.$queryRaw`
        SELECT 
          COUNT(*) as total_transactions,
          COUNT(DISTINCT facture) as total_factures,
          COUNT(DISTINCT carte) as total_clients,
          SUM(ca) as ca_total,
          SUM(CASE WHEN depot != 'WEB' THEN ca ELSE 0 END) as ca_magasin,
          SUM(CASE WHEN depot = 'WEB' THEN ca ELSE 0 END) as ca_web,
          COUNT(CASE WHEN depot != 'WEB' THEN 1 END) as tx_magasin,
          COUNT(CASE WHEN depot = 'WEB' THEN 1 END) as tx_web,
          COUNT(DISTINCT CASE WHEN depot != 'WEB' THEN facture END) as factures_magasin,
          COUNT(DISTINCT CASE WHEN depot = 'WEB' THEN facture END) as factures_web
        FROM transactions
      `,
      prisma.$queryRaw`
        SELECT 
          p.id as code,
          p.id as nom,
          p.famille,
          p.sous_famille,
          SUM(t.ca) as ca,
          SUM(t.quantite) as volume
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        GROUP BY p.id, p.famille, p.sous_famille
        ORDER BY ca DESC
        LIMIT 10
      `,
      prisma.$queryRaw`
        SELECT 
          m.code,
          m.nom,
          m.zone,
          SUM(t.ca) as ca,
          SUM(t.quantite) as volume,
          COUNT(DISTINCT t.facture) as nb_tickets
        FROM transactions t
        JOIN magasins m ON t.depot = m.code
        WHERE t.depot != 'WEB'
        GROUP BY m.code, m.nom, m.zone
        ORDER BY ca DESC
        LIMIT 5
      `,
      prisma.$queryRaw`
        SELECT 
          c.carte,
          c.ville,
          SUM(t.ca) as ca,
          COUNT(DISTINCT t.facture) as nb_tickets
        FROM transactions t
        JOIN clients c ON t.carte = c.carte
        GROUP BY c.carte, c.ville
        ORDER BY ca DESC
        LIMIT 10
      `,
      prisma.$queryRaw`
        SELECT 
          TO_CHAR(date, 'YYYY-MM') as mois,
          SUM(ca) as ca,
          COUNT(DISTINCT facture) as tickets
        FROM transactions
        GROUP BY TO_CHAR(date, 'YYYY-MM')
        ORDER BY mois
      `
    ]);

    const elapsed = Date.now() - apiStart;
    console.log(`✅ Dashboard ALL chargé en ${elapsed}ms`);

    const kpi = kpis[0] as any;
    const panierMoyen = kpi.total_factures > 0 ? Number(kpi.ca_total) / Number(kpi.total_factures) : 0;
    const panierMoyenMag = kpi.factures_magasin > 0 ? Number(kpi.ca_magasin) / Number(kpi.factures_magasin) : 0;
    const panierMoyenWeb = kpi.factures_web > 0 ? Number(kpi.ca_web) / Number(kpi.factures_web) : 0;

    res.json({
      period: 'all',
      kpis: {
        totalCA: Number(kpi.ca_total),
        totalCAMagasin: Number(kpi.ca_magasin),
        totalCAWeb: Number(kpi.ca_web),
        totalTransactions: Number(kpi.total_transactions),
        totalTransactionsMag: Number(kpi.tx_magasin),
        totalTransactionsWeb: Number(kpi.tx_web),
        totalClients: Number(kpi.total_clients),
        panierMoyen,
        panierMoyenMag,
        panierMoyenWeb
      },
      topProduits: topProduits.map((p: any) => ({
        code: p.code,
        nom: p.nom || p.code,
        famille: p.famille,
        sous_famille: p.sous_famille,
        ca: Number(p.ca),
        volume: Number(p.volume)
      })),
      topMagasins: topMagasins.map((m: any) => ({
        code: m.code,
        nom: m.nom,
        zone: m.zone,
        ca: Number(m.ca),
        volume: Number(m.volume),
        nbTickets: Number(m.nb_tickets)
      })),
      topClients: topClients.map((c: any) => ({
        carte: c.carte,
        ville: c.ville,
        ca: Number(c.ca),
        nbTickets: Number(c.nb_tickets)
      })),
      evolutionMensuelle: evolutionMensuelle.map((e: any) => ({
        mois: e.mois,
        ca: Number(e.ca),
        tickets: Number(e.tickets)
      }))
    });
  } catch (error) {
    console.error('Erreur dashboard all:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Dashboard période personnalisée
app.get('/api/dashboard/custom', async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ error: 'start et end requis' });
    }

    const startDate = new Date(start as string);
    const endDate = new Date(end as string);

    console.log(`📊 Chargement Dashboard personnalisé ${start} - ${end}...`);
    const apiStart = Date.now();

    // Même logique que dashboard/:year mais avec dates custom
    const [kpis, topProduits, topMagasins, topClients, evolutionMensuelle] = await Promise.all([
      prisma.$queryRaw`
        SELECT 
          COUNT(*) as total_transactions,
          COUNT(DISTINCT facture) as total_factures,
          COUNT(DISTINCT carte) as total_clients,
          SUM(ca) as ca_total,
          SUM(CASE WHEN depot != 'WEB' THEN ca ELSE 0 END) as ca_magasin,
          SUM(CASE WHEN depot = 'WEB' THEN ca ELSE 0 END) as ca_web,
          COUNT(CASE WHEN depot != 'WEB' THEN 1 END) as tx_magasin,
          COUNT(CASE WHEN depot = 'WEB' THEN 1 END) as tx_web,
          COUNT(DISTINCT CASE WHEN depot != 'WEB' THEN facture END) as factures_magasin,
          COUNT(DISTINCT CASE WHEN depot = 'WEB' THEN facture END) as factures_web
        FROM transactions
        WHERE date >= ${startDate} AND date <= ${endDate}
      `,
      prisma.$queryRaw`
        SELECT 
          p.id as code,
          p.id as nom,
          p.famille,
          p.sous_famille,
          SUM(t.ca) as ca,
          SUM(t.quantite) as volume
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE t.date >= ${startDate} AND t.date <= ${endDate}
        GROUP BY p.id, p.famille, p.sous_famille
        ORDER BY ca DESC
        LIMIT 10
      `,
      prisma.$queryRaw`
        SELECT 
          m.code,
          m.nom,
          m.zone,
          SUM(t.ca) as ca,
          SUM(t.quantite) as volume,
          COUNT(DISTINCT t.facture) as nb_tickets
        FROM transactions t
        JOIN magasins m ON t.depot = m.code
        WHERE t.date >= ${startDate} AND t.date <= ${endDate}
          AND t.depot != 'WEB'
        GROUP BY m.code, m.nom, m.zone
        ORDER BY ca DESC
        LIMIT 5
      `,
      prisma.$queryRaw`
        SELECT 
          c.carte,
          c.ville,
          SUM(t.ca) as ca,
          COUNT(DISTINCT t.facture) as nb_tickets
        FROM transactions t
        JOIN clients c ON t.carte = c.carte
        WHERE t.date >= ${startDate} AND t.date <= ${endDate}
        GROUP BY c.carte, c.ville
        ORDER BY ca DESC
        LIMIT 10
      `,
      prisma.$queryRaw`
        SELECT 
          TO_CHAR(date, 'YYYY-MM') as mois,
          SUM(ca) as ca,
          COUNT(DISTINCT facture) as tickets
        FROM transactions
        WHERE date >= ${startDate} AND date <= ${endDate}
        GROUP BY TO_CHAR(date, 'YYYY-MM')
        ORDER BY mois
      `
    ]);

    const elapsed = Date.now() - apiStart;
    console.log(`✅ Dashboard personnalisé chargé en ${elapsed}ms`);

    const kpi = kpis[0] as any;
    const panierMoyen = kpi.total_factures > 0 ? Number(kpi.ca_total) / Number(kpi.total_factures) : 0;
    const panierMoyenMag = kpi.factures_magasin > 0 ? Number(kpi.ca_magasin) / Number(kpi.factures_magasin) : 0;
    const panierMoyenWeb = kpi.factures_web > 0 ? Number(kpi.ca_web) / Number(kpi.factures_web) : 0;

    res.json({
      period: { start, end },
      kpis: {
        totalCA: Number(kpi.ca_total),
        totalCAMagasin: Number(kpi.ca_magasin),
        totalCAWeb: Number(kpi.ca_web),
        totalTransactions: Number(kpi.total_transactions),
        totalTransactionsMag: Number(kpi.tx_magasin),
        totalTransactionsWeb: Number(kpi.tx_web),
        totalClients: Number(kpi.total_clients),
        panierMoyen,
        panierMoyenMag,
        panierMoyenWeb
      },
      topProduits: topProduits.map((p: any) => ({
        code: p.code,
        nom: p.nom || p.code,
        famille: p.famille,
        sous_famille: p.sous_famille,
        ca: Number(p.ca),
        volume: Number(p.volume)
      })),
      topMagasins: topMagasins.map((m: any) => ({
        code: m.code,
        nom: m.nom,
        zone: m.zone,
        ca: Number(m.ca),
        volume: Number(m.volume),
        nbTickets: Number(m.nb_tickets)
      })),
      topClients: topClients.map((c: any) => ({
        carte: c.carte,
        ville: c.ville,
        ca: Number(c.ca),
        nbTickets: Number(c.nb_tickets)
      })),
      evolutionMensuelle: evolutionMensuelle.map((e: any) => ({
        mois: e.mois,
        ca: Number(e.ca),
        tickets: Number(e.tickets)
      }))
    });
  } catch (error) {
    console.error('Erreur dashboard custom:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Données Dashboard (année spécifique) - OPTIMISÉ avec agrégations SQL
app.get('/api/dashboard/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year}-12-31T23:59:59`);

    console.log(`📊 Chargement Dashboard ${year}...`);
    const start = Date.now();

    // Agrégations parallèles (beaucoup plus rapide que charger tout)
    const [kpis, topProduits, topMagasins, topClients, evolutionMensuelle] = await Promise.all([
      // KPIs globaux
      prisma.$queryRaw`
        SELECT 
          COUNT(*) as total_transactions,
          COUNT(DISTINCT facture) as total_factures,
          COUNT(DISTINCT carte) as total_clients,
          SUM(ca) as ca_total,
          SUM(CASE WHEN depot != 'WEB' THEN ca ELSE 0 END) as ca_magasin,
          SUM(CASE WHEN depot = 'WEB' THEN ca ELSE 0 END) as ca_web,
          COUNT(CASE WHEN depot != 'WEB' THEN 1 END) as tx_magasin,
          COUNT(CASE WHEN depot = 'WEB' THEN 1 END) as tx_web,
          COUNT(DISTINCT CASE WHEN depot != 'WEB' THEN facture END) as factures_magasin,
          COUNT(DISTINCT CASE WHEN depot = 'WEB' THEN facture END) as factures_web
        FROM transactions
        WHERE date >= ${startDate} AND date <= ${endDate}
      `,

      // Top 10 produits
      prisma.$queryRaw`
        SELECT 
          p.id as code,
          p.id as nom,
          p.famille,
          p.sous_famille,
          SUM(t.ca) as ca,
          SUM(t.quantite) as volume
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE t.date >= ${startDate} AND t.date <= ${endDate}
        GROUP BY p.id, p.famille, p.sous_famille
        ORDER BY ca DESC
        LIMIT 10
      `,

      // Top 5 magasins
      prisma.$queryRaw`
        SELECT 
          m.code,
          m.nom,
          m.zone,
          SUM(t.ca) as ca,
          SUM(t.quantite) as volume,
          COUNT(DISTINCT t.facture) as nb_tickets
        FROM transactions t
        JOIN magasins m ON t.depot = m.code
        WHERE t.date >= ${startDate} AND t.date <= ${endDate}
          AND t.depot != 'WEB'
        GROUP BY m.code, m.nom, m.zone
        ORDER BY ca DESC
        LIMIT 5
      `,

      // Top 10 clients
      prisma.$queryRaw`
        SELECT 
          c.carte,
          c.ville,
          SUM(t.ca) as ca,
          COUNT(DISTINCT t.facture) as nb_commandes
        FROM transactions t
        JOIN clients c ON t.carte = c.carte
        WHERE t.date >= ${startDate} AND t.date <= ${endDate}
          AND c.carte != '0'
        GROUP BY c.carte, c.ville
        ORDER BY ca DESC
        LIMIT 10
      `,

      // Évolution mensuelle
      prisma.$queryRaw`
        SELECT 
          TO_CHAR(date, 'YYYY-MM') as mois,
          SUM(ca) as ca,
          COUNT(DISTINCT facture) as tickets
        FROM transactions
        WHERE date >= ${startDate} AND date <= ${endDate}
        GROUP BY TO_CHAR(date, 'YYYY-MM')
        ORDER BY mois
      `
    ]);

    const elapsed = Date.now() - start;
    console.log(`✅ Dashboard ${year} chargé en ${elapsed}ms`);

    // Calcul panier moyen
    const kpi = kpis[0] as any;
    const panierMoyen = kpi.total_factures > 0 ? Number(kpi.ca_total) / Number(kpi.total_factures) : 0;
    const panierMoyenMag = kpi.factures_magasin > 0 ? Number(kpi.ca_magasin) / Number(kpi.factures_magasin) : 0;
    const panierMoyenWeb = kpi.factures_web > 0 ? Number(kpi.ca_web) / Number(kpi.factures_web) : 0;

    res.json({
      year,
      kpis: {
        totalCA: Number(kpi.ca_total),
        totalCAMagasin: Number(kpi.ca_magasin),
        totalCAWeb: Number(kpi.ca_web),
        totalTransactions: Number(kpi.total_transactions),
        totalTransactionsMag: Number(kpi.tx_magasin),
        totalTransactionsWeb: Number(kpi.tx_web),
        totalClients: Number(kpi.total_clients),
        panierMoyen,
        panierMoyenMag,
        panierMoyenWeb
      },
      topProduits: topProduits.map((p: any) => ({
        code: p.code,
        nom: p.nom || p.code,
        famille: p.famille,
        sous_famille: p.sous_famille,
        ca: Number(p.ca),
        volume: Number(p.volume)
      })),
      topMagasins: topMagasins.map((m: any) => ({
        code: m.code,
        nom: m.nom,
        zone: m.zone,
        ca: Number(m.ca),
        volume: Number(m.volume),
        nbTickets: Number(m.nb_tickets),
        panierMoyen: Number(m.nb_tickets) > 0 ? Number(m.ca) / Number(m.nb_tickets) : 0
      })),
      topClients: topClients.map((c: any) => ({
        carte: c.carte,
        ville: c.ville,
        ca: Number(c.ca),
        nbCommandes: Number(c.nb_commandes)
      })),
      evolutionMensuelle: evolutionMensuelle.map((e: any) => ({
        mois: e.mois,
        ca: Number(e.ca),
        tickets: Number(e.tickets)
      }))
    });
  } catch (error) {
    console.error('Erreur dashboard:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route de recherche unifiée (utilisée par SearchPanel)
app.get('/api/search', async (req, res) => {
  try {
    const { type, query } = req.query;

    if (!type || !query) {
      return res.status(400).json({ error: 'Missing type or query parameter' });
    }

    console.log(`🔍 API Search: ${type} - "${query}"`);

    let results = [];

    if (type === 'ticket') {
      // Recherche par facture
      results = await prisma.$queryRawUnsafe(`
        SELECT 
          t.facture::text,
          t.date::text,
          t.carte::text,
          c.ville::text,
          t.depot::text,
          t.produit::text,
          p.famille::text,
          p.sous_famille::text,
          t.ca::numeric,
          t.quantite::numeric
        FROM transactions t
        LEFT JOIN clients c ON t.carte = c.carte
        LEFT JOIN produits p ON t.produit = p.id
        WHERE t.facture ILIKE $1
        ORDER BY t.date DESC
        LIMIT 100
      `, `%${query}%`);
    } else if (type === 'client') {
      // Recherche par carte client
      results = await prisma.$queryRawUnsafe(`
        SELECT 
          t.facture::text,
          t.date::text,
          t.carte::text,
          c.ville::text,
          t.depot::text,
          t.produit::text,
          p.famille::text,
          p.sous_famille::text,
          t.ca::numeric,
          t.quantite::numeric
        FROM transactions t
        LEFT JOIN clients c ON t.carte = c.carte
        LEFT JOIN produits p ON t.produit = p.id
        WHERE t.carte = $1
        ORDER BY t.date DESC
        LIMIT 100
      `, query);
    } else if (type === 'produit') {
      // Recherche par produit
      results = await prisma.$queryRawUnsafe(`
        SELECT 
          t.facture::text,
          t.date::text,
          t.carte::text,
          c.ville::text,
          t.depot::text,
          t.produit::text,
          p.famille::text,
          p.sous_famille::text,
          t.ca::numeric,
          t.quantite::numeric
        FROM transactions t
        LEFT JOIN clients c ON t.carte = c.carte
        LEFT JOIN produits p ON t.produit = p.id
        WHERE t.produit ILIKE $1
        ORDER BY t.date DESC
        LIMIT 100
      `, `%${query}%`);
    } else {
      return res.status(400).json({ error: 'Invalid type. Use: ticket, client, or produit' });
    }

    console.log(`✅ API Search: ${results.length} résultats`);

    res.status(200).json({
      results: results.map((r: any) => ({
        facture: r.facture,
        date: r.date,
        carte: r.carte,
        ville: r.ville,
        depot: r.depot,
        produit: r.produit,
        famille: r.famille,
        sous_famille: r.sous_famille,
        ca: Number(r.ca),
        quantite: Number(r.quantite)
      }))
    });

  } catch (error: any) {
    console.error('❌ Erreur API Search:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      details: error.message 
    });
  }
});

// Recherche client
app.get('/api/clients/:carte', async (req, res) => {
  try {
    const client = await prisma.client.findUnique({
      where: { carte: req.params.carte },
      include: {
        transactions: {
          include: {
            produitRef: true,
            magasin: true
          },
          orderBy: { date: 'desc' }
        }
      }
    });

    if (!client) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }

    res.json(client);
  } catch (error) {
    console.error('Erreur recherche client:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Recherche ticket
app.get('/api/tickets/:facture', async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { facture: req.params.facture },
      include: {
        client: true,
        produitRef: true,
        magasin: true
      }
    });

    res.json(transactions);
  } catch (error) {
    console.error('Erreur recherche ticket:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Top produits
app.get('/api/produits/top/:limit', async (req, res) => {
  try {
    const limit = parseInt(req.params.limit) || 10;
    
    const topProduits = await prisma.$queryRaw`
      SELECT 
        p.id,
        p.famille,
        p.sous_famille,
        SUM(t.ca) as ca_total,
        SUM(t.quantite) as volume
      FROM transactions t
      JOIN produits p ON t.produit = p.id
      GROUP BY p.id, p.famille, p.sous_famille
      ORDER BY ca_total DESC
      LIMIT ${limit}
    `;

    res.json(topProduits);
  } catch (error) {
    console.error('Erreur top produits:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Démarrage serveur
console.log('🚀 Lancement du serveur Express...');
app.listen(PORT, () => {
  console.log(`🚀 API démarrée sur http://localhost:${PORT}`);
  console.log(`📊 Prisma Studio: npx prisma studio`);
});

// Cleanup Prisma à la fermeture
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
