import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  try {
    // GET /api/catchment-area?storeCode=LILLE
    const { storeCode } = req.query;

    if (!storeCode) {
      return res.status(400).json({ error: 'storeCode required' });
    }

    // Récupérer toutes les transactions du magasin avec les infos clients
    const transactions = await prisma.transaction.findMany({
      where: {
        depot: storeCode,
      },
      include: {
        client: true,
      },
    });

    if (transactions.length === 0) {
      return res.json({
        storeCode,
        data: [],
        summary: {
          totalClients: 0,
          totalCA: 0,
          uniquePostalCodes: 0,
        },
      });
    }

    // Grouper par CP + Ville avec agrégation
    const groupedData = {};

    transactions.forEach((transaction) => {
      const client = transaction.client;
      if (!client) return;

      const cp = client.cp || 'UNKNOWN';
      const ville = client.ville || 'N/A';
      const key = `${cp}|${ville}`;

      if (!groupedData[key]) {
        groupedData[key] = {
          cp,
          ville,
          nbClients: new Set(),
          totalCA: 0,
          nbTransactions: 0,
        };
      }

      groupedData[key].nbClients.add(client.carte);
      groupedData[key].totalCA += transaction.ca || 0;
      groupedData[key].nbTransactions += 1;
    });

    // Convertir en array et calculer intensités
    const data = Object.values(groupedData)
      .map((item) => ({
        cp: item.cp,
        ville: item.ville,
        nbClients: item.nbClients.size,
        totalCA: Math.round(item.totalCA * 100) / 100,
        nbTransactions: item.nbTransactions,
        intensiteCA: 0, // Sera calculé après
        intensiteClients: 0,
      }))
      .sort((a, b) => b.totalCA - a.totalCA);

    // Calculer les intensités (0-1) basées sur max
    if (data.length > 0) {
      const maxCA = Math.max(...data.map((d) => d.totalCA));
      const maxClients = Math.max(...data.map((d) => d.nbClients));

      data.forEach((item) => {
        item.intensiteCA = maxCA > 0 ? item.totalCA / maxCA : 0;
        item.intensiteClients = maxClients > 0 ? item.nbClients / maxClients : 0;
      });
    }

    // Récupérer info magasin
    const store = await prisma.magasin.findUnique({
      where: { code: storeCode },
    });

    res.json({
      storeCode,
      storeName: store?.nom || storeCode,
      storeCity: store?.ville || '',
      storeCP: store?.cp || '',
      data,
      summary: {
        totalClients: data.reduce((sum, d) => sum + d.nbClients, 0),
        totalCA: data.reduce((sum, d) => sum + d.totalCA, 0),
        uniquePostalCodes: data.length,
        nbTransactions: data.reduce((sum, d) => sum + d.nbTransactions, 0),
      },
    });
  } catch (error) {
    console.error('Error in catchment-area:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
