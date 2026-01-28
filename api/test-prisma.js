import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req, res) {
  try {
    // Test simple Prisma
    const count = await prisma.transactions.count()
    
    res.status(200).json({ 
      success: true, 
      message: 'Prisma fonctionne !',
      transactions: count
    })
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack
    })
  }
}
