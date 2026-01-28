import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = 3000;

console.log('Démarrage...');
app.listen(PORT, () => {
  console.log(`API sur port ${PORT}`);
}).on('listening', () => {
  console.log('ECOUTE ACTIVE');
}).on('error', (err) => {
  console.error('ERREUR:', err);
  process.exit(1);
});

process.stdout.write('SCRIPT LANCE\n');
