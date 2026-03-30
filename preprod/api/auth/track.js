import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function getSessionUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const session = await prisma.appSession.findUnique({
    where: { token },
    include: { user: true }
  })
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null
  return session.user
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })

  const user = await getSessionUser(req)
  if (!user) return res.status(401).json({ error: 'Non authentifié' })

  const { action, resource, details } = req.body

  if (!action) return res.status(400).json({ error: 'Action requise' })

  try {
    const detailsJson = details ? JSON.stringify(details) : null
    await prisma.$executeRawUnsafe(
      `INSERT INTO app_logs (id, user_id, user_email, user_name, action, resource, details, ip, created_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6::jsonb, $7, NOW())`,
      user.id,
      user.email,
      `${user.prenom} ${user.nom}`,
      action,
      resource || null,
      detailsJson,
      req.ip || req.headers['x-forwarded-for'] || null
    )

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Track API error:', error)
    return res.status(500).json({ error: 'Erreur serveur' })
  }
}
