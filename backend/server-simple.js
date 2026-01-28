import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/dashboard/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const count = await prisma.transaction.count({ where: { annee: year } });
    res.json({ year, count, status: 'ok' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅✅✅ API LANCÉE SUR http://localhost:${PORT} ✅✅✅`);
});
