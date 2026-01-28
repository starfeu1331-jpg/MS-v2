import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('🔍 Test connexion Prisma...');
    await prisma.$connect();
    console.log('✅ Connexion réussie');
    
    const count = await prisma.client.count();
    console.log(`✅ ${count} clients trouvés`);
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur connexion:', error);
    process.exit(1);
  }
}

testConnection();
