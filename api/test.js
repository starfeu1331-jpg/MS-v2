import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn']
})

export default async function handler(req, res) {
  try {
    // Test 1: Variables d'environnement
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      return res.status(500).json({ 
        error: 'DATABASE_URL not set',
        env: Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('POSTGRES'))
      })
    }

    // Test 2: Connexion simple
    const result = await prisma.$queryRaw`SELECT NOW() as now, COUNT(*)::int as count FROM transactions LIMIT 1`
    
    // Test 3: Requête simple
    const transactions = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM transactions`
    
    res.status(200).json({ 
      success: true,
      dbUrl: dbUrl.substring(0, 30) + '...',
      timestamp: result[0]?.now?.toString(),
      queryResult: Number(result[0]?.count || 0),
      transactionsCount: Number(transactions[0]?.count || 0)
    })
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    })
  } finally {
    await prisma.$disconnect()
  }
}
