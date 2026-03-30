import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

// Charger les variables d'environnement
config({ path: '.env.production' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS pour développement (optionnel en production)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Servir les fichiers statiques du build Vite
app.use(express.static(join(__dirname, 'dist')));

// Helper pour wrapper les handlers API en Express middleware
const wrapHandler = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error('API Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
};

// Routes API - Import dynamique
const setupRoutes = async () => {
  try {
    // Dashboard
    const dashboardApi = (await import('./api/dashboard/dashboard.js')).default;
    const { prewarmCache } = await import('./api/dashboard/dashboard.js');

    // RFM
    const rfmApi = (await import('./api/rfm/rfm.js')).default;
    const { prewarmRFM } = await import('./api/rfm/rfm.js');

    // Analyses
    const cohortesApi = (await import('./api/analysis/cohortes.js')).default;
    const crossSellingApi = (await import('./api/analysis/cross-selling.js')).default;
    const abcAnalysisApi = (await import('./api/analysis/abc-analysis.js')).default;
    const subFamiliesApi = (await import('./api/analysis/sub-families.js')).default;
    const productFamiliesApi = (await import('./api/analysis/product-families.js')).default;

    // Marketing
    const marketingApi = (await import('./api/marketing/marketing.js')).default;
    const forecastApi = (await import('./api/marketing/forecast.js')).default;
    const surveysApi = (await import('./api/marketing/surveys.js')).default;
    const { exportHandler: surveysExportApi } = await import('./api/marketing/surveys.js');

    // Géo
    const storesApi = (await import('./api/geo/stores.js')).default;

    // Export
    const exportApi = (await import('./api/export/export.js')).default;
    const exportPenetrationApi = (await import('./api/export/export-penetration.js')).default;

    // Recherche
    const searchApi = (await import('./api/search/search.js')).default;

    // Clients & Tickets
    const clientTicketsApi = (await import('./api/clients/[carte]/tickets.js')).default;
    const ticketTransactionsApi = (await import('./api/tickets/[facture]/transactions.js')).default;

    // Auth
    const authLoginApi = (await import('./api/auth/login.js')).default;
    const authLogoutApi = (await import('./api/auth/logout.js')).default;
    const authMeApi = (await import('./api/auth/me.js')).default;
    const authUsersApi = (await import('./api/auth/users.js')).default;
    const authSetupApi = (await import('./api/auth/setup.js')).default;
    const authLogsApi = (await import('./api/auth/logs.js')).default;
    const authTrackApi = (await import('./api/auth/track.js')).default;

    // Products (PIM proxy + stats + favorites)
    const { categoriesHandler, productListHandler, productDetailHandler } = await import('./api/products/pim-proxy.js');
    const { productStatsHandler, productDetailStatsHandler, categoryStatsHandler, categoryAvgEvolutionHandler } = await import('./api/products/stats.js');
    const { favoritesGroupsHandler, favoritesGroupHandler, favoritesItemsHandler } = await import('./api/products/favorites.js');

    // Monter les routes
    app.get('/api/dashboard', wrapHandler(dashboardApi));
    app.get('/api/rfm', wrapHandler(rfmApi));
    app.get('/api/cohortes', wrapHandler(cohortesApi));
    app.get('/api/stores', wrapHandler(storesApi));
    app.get('/api/cross-selling', wrapHandler(crossSellingApi));
    app.get('/api/abc-analysis', wrapHandler(abcAnalysisApi));
    app.get('/api/sub-families', wrapHandler(subFamiliesApi));
    app.get('/api/marketing', wrapHandler(marketingApi));
    app.get('/api/forecast', wrapHandler(forecastApi));
    app.all('/api/export', wrapHandler(exportApi));
    app.get('/api/export-penetration', wrapHandler(exportPenetrationApi));
    app.get('/api/search', wrapHandler(searchApi));
    app.get('/api/product-families', wrapHandler(productFamiliesApi));
    app.get('/api/clients/:carte/tickets', wrapHandler(clientTicketsApi));
    app.get('/api/tickets/:facture/transactions', wrapHandler(ticketTransactionsApi));
    app.post('/api/auth/login', wrapHandler(authLoginApi));
    app.post('/api/auth/logout', wrapHandler(authLogoutApi));
    app.get('/api/auth/me', wrapHandler(authMeApi));
    app.post('/api/auth/setup', wrapHandler(authSetupApi));
    app.get('/api/auth/users', wrapHandler(authUsersApi));
    app.post('/api/auth/users', wrapHandler(authUsersApi));
    app.patch('/api/auth/users/:id', wrapHandler(authUsersApi));
    app.delete('/api/auth/users/:id', wrapHandler(authUsersApi));
    app.get('/api/auth/logs', wrapHandler(authLogsApi));
    app.post('/api/auth/track', wrapHandler(authTrackApi));

    // Preferences
    const authPreferencesApi = (await import('./api/auth/preferences.js')).default;
    app.get('/api/auth/preferences', wrapHandler(authPreferencesApi));
    app.patch('/api/auth/preferences', wrapHandler(authPreferencesApi));
    app.get('/api/surveys', wrapHandler(surveysApi));
    app.post('/api/surveys', wrapHandler(surveysApi));
    app.delete('/api/surveys', wrapHandler(surveysApi));
    app.get('/api/surveys/export', wrapHandler(surveysExportApi));

    // Products module routes
    app.get('/api/products/categories', wrapHandler(categoriesHandler));
    app.post('/api/products/list', wrapHandler(productListHandler));
    app.get('/api/products/detail/:productId', wrapHandler(productDetailHandler));
    app.get('/api/products/stats', wrapHandler(productStatsHandler));
    app.get('/api/products/stats/:productId', wrapHandler(productDetailStatsHandler));
    app.get('/api/products/stats/:productId/category-avg', wrapHandler(categoryAvgEvolutionHandler));
    app.post('/api/products/stats/category', wrapHandler(categoryStatsHandler));
    app.get('/api/products/favorites', wrapHandler(favoritesGroupsHandler));
    app.post('/api/products/favorites', wrapHandler(favoritesGroupsHandler));
    app.delete('/api/products/favorites/:groupId', wrapHandler(favoritesGroupHandler));
    app.patch('/api/products/favorites/:groupId', wrapHandler(favoritesGroupHandler));
    app.get('/api/products/favorites/:groupId/items', wrapHandler(favoritesItemsHandler));
    app.post('/api/products/favorites/:groupId/items', wrapHandler(favoritesItemsHandler));
    app.delete('/api/products/favorites/:groupId/items', wrapHandler(favoritesItemsHandler));

    console.log('✅ API routes loaded');
    
    // Préchauffer le cache dashboard + RFM en arrière-plan (ne bloque pas le démarrage)
    setTimeout(async () => {
      console.log('🔥 Préchauffage du cache dashboard...')
      prewarmCache().catch(err => console.error('❌ Prewarm dashboard failed:', err.message))

      // Prewarm RFM complet (overview + 7 segments + top products)
      prewarmRFM().catch(err => console.error('❌ Prewarm RFM failed:', err.message))
    }, 2000)

    // Rafraîchir les caches toutes les 5h (avant expiration des TTL de 6-12h)
    setInterval(async () => {
      console.log('🔄 Rafraîchissement périodique des caches...')
      try { await prewarmCache(true) } catch (err) { console.error('❌ Periodic dashboard prewarm failed:', err.message) }
      try { await prewarmRFM(true) } catch (err) { console.error('❌ Periodic RFM prewarm failed:', err.message) }
    }, 5 * 60 * 60 * 1000)
  } catch (error) {
    console.error('❌ Error loading API routes:', error);
  }
};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Démarrer le serveur
const startServer = async () => {
  await setupRoutes();
  
  // ⚠️ IMPORTANT: Cette route catch-all DOIT être après setupRoutes()
  // Toutes les autres routes = frontend React (SPA)
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🚀 ═══════════════════════════════════════════');
    console.log(`   Server running on http://0.0.0.0:${PORT}`);
    console.log('🚀 ═══════════════════════════════════════════');
    console.log('');
    console.log(`📊 Database: ${process.env.DATABASE_URL ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('');
    console.log('📡 API Endpoints:');
    console.log('   GET  /api/dashboard');
    console.log('   GET  /api/rfm');
    console.log('   GET  /api/cohortes');
    console.log('   GET  /api/stores');
    console.log('   GET  /api/cross-selling');
    console.log('   GET  /api/abc-analysis');
    console.log('   GET  /api/sub-families');
    console.log('   GET  /api/marketing');
    console.log('   GET  /api/forecast');
    console.log('   GET  /api/search');
    console.log('   POST /api/auth/login');
    console.log('   GET  /health');
    console.log('');
  });
};

// Gestion des erreurs non catchées
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Démarrer
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
