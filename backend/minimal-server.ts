import express from 'express';

const app = express();
const PORT = 3000;

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

console.log('Démarrage minimal...');
app.listen(PORT, () => {
  console.log(`✅ Serveur minimal sur http://localhost:${PORT}`);
});
