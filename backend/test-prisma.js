import { PrismaClient } from '@prisma/client';

console.log('🔧 Test Prisma...');

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

console.log('✅ PrismaClient créé');

prisma.transaction.count()
  .then(count => {
    console.log(`✅ Connexion OK: ${count} transactions`);
    return prisma.$disconnect();
  })
  .then(() => {
    console.log('✅ Déconnexion OK');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  });

setTimeout(() => {
  console.log('⏰ TIMEOUT - Le test prend trop de temps');
  process.exit(1);
}, 5000);
