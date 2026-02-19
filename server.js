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
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Servir les fichiers statiques du build Vite
app.use(express.static(join(__dirname, 'dist')));

// Helper pour wrapper les handlers Vercel en Express
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
    const dashboardApi = (await import('./api/dashboard.js')).default;
    const rfmApi = (await import('./api/rfm.js')).default;
    const cohortesApi = (await import('./api/cohortes.js')).default;
    const storesApi = (await import('./api/stores.js')).default;
    const crossSellingApi = (await import('./api/cross-selling.js')).default;
    const abcAnalysisApi = (await import('./api/abc-analysis.js')).default;
    const subFamiliesApi = (await import('./api/sub-families.js')).default;
    const marketingApi = (await import('./api/marketing.js')).default;
    const forecastApi = (await import('./api/forecast.js')).default;
    // const exportApi = (await import('./api/export.js')).default; // Temporaire: désactivé à cause erreur ESM/CommonJS
    const searchApi = (await import('./api/search.js')).default;

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
    // app.all('/api/export', wrapHandler(exportApi)); // POST et GET - Temporaire: désactivé
    app.get('/api/search', wrapHandler(searchApi));

    console.log('✅ API routes loaded');
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
    console.log('   POST /api/export');
    console.log('   GET  /api/search');
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
