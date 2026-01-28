import { PrismaClient } from '@prisma/client';
import Papa from 'papaparse';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Chemins des fichiers (à adapter selon votre structure)
const DATA_DIR = path.join(process.cwd(), '..', 'data');

interface ImportProgress {
  phase: string;
  current: number;
  total: number;
  message: string;
}

function logProgress(progress: ImportProgress) {
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  console.log(`[${progress.phase}] ${pct}% - ${progress.message}`);
}

// Parser CSV
async function parseCSV(filePath: string): Promise<any[]> {
  const content = fs.readFileSync(filePath, 'utf-8');
  return new Promise((resolve, reject) => {
    Papa.parse(content, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      complete: (results) => resolve(results.data as any[]),
      error: (error) => reject(error)
    });
  });
}

// Parser Excel
async function parseExcel(filePath: string): Promise<any[]> {
  const workbook = XLSX.readFile(filePath);
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(firstSheet);
}

// Import CLIENTS
async function importClients(filePath: string) {
  console.log('\n👥 Import CLIENTS...');
  const data = await parseCSV(filePath);
  
  logProgress({ phase: 'CLIENTS', current: 0, total: data.length, message: 'Parsing...' });
  
  const clients = data.map((row: any) => {
    const keys = Object.keys(row);
    const carteKey = keys.find(k => k.includes('Carte') && k.includes('lit')) || keys[0];
    
    return {
      carte: String(row[carteKey] || '').trim(),
      dateCreation: String(row[keys[1]] || ''),
      dateValidite: String(row[keys[3]] || ''),
      statut: String(row[keys[2]] || ''),
      civilite: String(row[keys[4]] || ''),
      sexe: String(row[keys[6]] || ''),
      dateNaissance: String(row[keys[5]] || ''),
      cp: String(row[keys[11]] || '').trim(),
      ville: String(row[keys[12]] || '')
    };
  }).filter(c => c.carte && c.carte !== '0');

  // Import par batches de 1000
  const BATCH_SIZE = 1000;
  for (let i = 0; i < clients.length; i += BATCH_SIZE) {
    const batch = clients.slice(i, i + BATCH_SIZE);
    await prisma.client.createMany({
      data: batch,
      skipDuplicates: true
    });
    logProgress({ 
      phase: 'CLIENTS', 
      current: Math.min(i + BATCH_SIZE, clients.length), 
      total: clients.length, 
      message: `${Math.min(i + BATCH_SIZE, clients.length)} / ${clients.length}` 
    });
  }

  console.log(`✅ ${clients.length} clients importés`);
}

// Import PRODUITS
async function importProduits(filePath: string) {
  console.log('\n📦 Import PRODUITS...');
  const data = await parseExcel(filePath);
  
  const produits = data.map((row: any) => ({
    id: String(row['N° Produit'] || '').trim(),
    famille: String(row['Famille'] || 'Inconnu'),
    sousFamille: String(row['Sous famille'] || ''),
    sousSousFamille: String(row['Sous sous famille'] || ''),
    sousSousSousFamille: String(row['Sous sous sous famille'] || '')
  })).filter(p => p.id);

  await prisma.produit.createMany({
    data: produits,
    skipDuplicates: true
  });

  console.log(`✅ ${produits.length} produits importés`);
}

// Import MAGASINS
async function importMagasins(filePath: string) {
  console.log('\n🏪 Import MAGASINS...');
  const data = await parseExcel(filePath);
  
  const magasins = data.map((row: any) => ({
    code: String(row['N° Dépôt'] || '').trim(),
    nom: String(row['Intitulé dépôt'] || `M${row['N° Dépôt']}`),
    zone: String(row['Zones magasin'] || ''),
    ville: String(row['Ville'] || ''),
    cp: String(row['CP'] || '')
  })).filter(m => m.code);

  await prisma.magasin.createMany({
    data: magasins,
    skipDuplicates: true
  });

  console.log(`✅ ${magasins.length} magasins importés`);
}

// Import TRANSACTIONS (le plus gros)
async function importTransactions(filePath: string) {
  console.log('\n🎫 Import TRANSACTIONS...');
  
  return new Promise<void>((resolve, reject) => {
    let buffer: any[] = [];
    let totalProcessed = 0;
    const BATCH_SIZE = 5000;

    const stream = fs.createReadStream(filePath);

    Papa.parse(stream, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      chunk: async (results: any, parser: any) => {
        parser.pause();

        buffer.push(...results.data);

        if (buffer.length >= BATCH_SIZE) {
          const batch = buffer.splice(0, BATCH_SIZE);
          
          const transactions = batch.map((row: any, idx: number) => {
            const keys = Object.keys(row);
            const dateStr = row[keys[3]] || '';
            
            return {
              facture: String(row[keys[1]] || '').trim(),
              carte: String(row[keys[0]] || '0').trim(),
              depot: String(row[keys[2]] || '').trim(),
              date: dateStr ? new Date(dateStr) : new Date(),
              produit: String(row[keys[4]] || '').trim(),
              quantite: parseFloat(String(row[keys[5]] || '0').replace(',', '.')) || 0,
              prix: parseFloat(String(row[keys[6]] || '0').replace(',', '.')) || 0,
              ca: (parseFloat(String(row[keys[5]] || '0').replace(',', '.')) || 0) * (parseFloat(String(row[keys[6]] || '0').replace(',', '.')) || 0),
              isWeb: false,
              ville: '',
              cp: ''
            };
          }).filter(t => t.facture && t.date);

          try {
            await prisma.transaction.createMany({
              data: transactions,
              skipDuplicates: true
            });

            totalProcessed += transactions.length;
            logProgress({ 
              phase: 'TRANSACTIONS', 
              current: totalProcessed, 
              total: totalProcessed, 
              message: `${(totalProcessed / 1000).toFixed(0)}k lignes` 
            });
          } catch (err) {
            console.error('Erreur batch:', err);
          }
        }

        parser.resume();
      },
      complete: async () => {
        // Dernier batch
        if (buffer.length > 0) {
          const transactions = buffer.map((row: any) => {
            const keys = Object.keys(row);
            const dateStr = row[keys[3]] || '';
            
            return {
              facture: String(row[keys[1]] || '').trim(),
              carte: String(row[keys[0]] || '0').trim(),
              depot: String(row[keys[2]] || '').trim(),
              date: dateStr ? new Date(dateStr) : new Date(),
              produit: String(row[keys[4]] || '').trim(),
              quantite: parseFloat(String(row[keys[5]] || '0').replace(',', '.')) || 0,
              prix: parseFloat(String(row[keys[6]] || '0').replace(',', '.')) || 0,
              ca: (parseFloat(String(row[keys[5]] || '0').replace(',', '.')) || 0) * (parseFloat(String(row[keys[6]] || '0').replace(',', '.')) || 0),
              isWeb: false,
              ville: '',
              cp: ''
            };
          }).filter(t => t.facture && t.date);

          await prisma.transaction.createMany({
            data: transactions,
            skipDuplicates: true
          });

          totalProcessed += transactions.length;
        }

        console.log(`✅ ${totalProcessed.toLocaleString()} transactions importées`);
        resolve();
      },
      error: (error: any) => reject(error)
    });
  });
}

// Fonction principale
async function main() {
  console.log('🚀 Début import des données...\n');
  console.log(`📂 Dossier: ${DATA_DIR}\n`);

  try {
    // Nettoyage
    console.log('🧹 Nettoyage tables...');
    await prisma.transaction.deleteMany();
    await prisma.client.deleteMany();
    await prisma.produit.deleteMany();
    await prisma.magasin.deleteMany();

    // Import séquentiel
    await importClients(path.join(DATA_DIR, 'client.csv'));
    await importProduits(path.join(DATA_DIR, 'Produits.xlsx'));
    await importMagasins(path.join(DATA_DIR, 'Magasins.xlsx'));
    await importTransactions(path.join(DATA_DIR, 'Détail transactions.csv'));

    console.log('\n✅ Import terminé!');
  } catch (error) {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
