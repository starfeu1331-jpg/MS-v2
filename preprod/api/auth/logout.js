import { PrismaClient } from '@prisma/client'
import { logAction } from './utils.js'

const prisma = new PrismaClient()

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (token) {
    try {
      const session = await prisma.appSession.findUnique({ where: { token }, include: { user: true } })
      if (session?.user) {
        await logAction(prisma, { userId: session.user.id, userEmail: session.user.email, userName: `${session.user.prenom} ${session.user.nom}`, action: 'LOGOUT', ip: req.ip })
      }
      await prisma.appSession.deleteMany({ where: { token } })
    } catch {}
  }

  return res.status(200).json({ ok: true })
}
