import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  console.log('Health check reçu');
  res.json({ status: 'ok', message: 'Serveur ultra minimal qui marche!' });
});

app.listen(3000, '0.0.0.0', () => {
  console.log('========== SERVEUR DÉMARRÉ SUR PORT 3000 ==========');
});

setInterval(() => {
  console.log('Je tourne encore... ' + new Date().toLocaleTimeString());
}, 5000);
