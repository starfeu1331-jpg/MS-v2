const express = require('express');
const cors = require('cors');

console.log('🔧 Démarrage serveur JS pur...');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  console.log('✅ Health check appelé');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅✅✅ SERVEUR LANCÉ SUR http://localhost:${PORT} ✅✅✅`);
});
