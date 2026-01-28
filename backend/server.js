import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/dashboard/:year', async (req, res) => {
  const year = parseInt(req.params.year);
  const data = await prisma.$queryRaw`
    SELECT 
      COUNT(DISTINCT t.carte) as nb_clients,
      COUNT(t.id) as nb_transactions,
      COALESCE(SUM(t.ca), 0) as ca_total
    FROM transactions t
    WHERE EXTRACT(YEAR FROM t.date_transaction) = ${year}
  `;
  res.json({ kpis: data[0] });
});

app.listen(PORT, () => console.log(`✅ Backend sur http://localhost:${PORT}`));
