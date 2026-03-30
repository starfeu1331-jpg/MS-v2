import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    return res.status(401).json({ error: 'Non authentifié' })
  }

  try {
    const session = await prisma.appSession.findUnique({
      where: { token },
      include: { user: true }
    })

    if (!session || session.expiresAt < new Date()) {
      if (session) await prisma.appSession.delete({ where: { token } })
      return res.status(401).json({ error: 'Session expirée' })
    }

    if (!session.user.isActive) {
      return res.status(401).json({ error: 'Compte désactivé' })
    }

    await prisma.appSession.update({
      where: { token },
      data: {
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000)
      }
    })

    return res.status(200).json({
      id: session.user.id,
      email: session.user.email,
      nom: session.user.nom,
      prenom: session.user.prenom,
      role: session.user.role
    })
  } catch (error) {
    console.error('Me error:', error)
    return res.status(500).json({ error: 'Erreur serveur' })
  }
}
