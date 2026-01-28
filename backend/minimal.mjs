import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

console.log('🚀 Démarrage...');

const server = app.listen(PORT, () => {
  console.log(`✅ API sur http://localhost:${PORT}`);
});

server.on('error', (err) => {
  console.error('❌ Erreur serveur:', err);
});
