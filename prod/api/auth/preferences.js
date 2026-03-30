import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Allowed preference keys + validators
const VALID_KEYS = {
  defaultPage: v => typeof v === 'string' && v.length < 30,
  defaultPeriod: v => typeof v === 'object' && v !== null,
  sidebarOpen: v => typeof v === 'boolean',
  storeView: v => ['essentiel', 'complet', 'pdf'].includes(v),
  scrollToTop: v => typeof v === 'boolean',
}

async function getUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const session = await prisma.appSession.findUnique({
    where: { token },
    include: { user: true }
  })
  if (!session || session.expiresAt < new Date()) return null
  if (!session.user.isActive) return null
  return session.user
}

export default async function handler(req, res) {
  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'Non authentifié' })

  // GET — return preferences
  if (req.method === 'GET') {
    return res.status(200).json(user.preferences || {})
  }

  // PATCH — merge preferences
  if (req.method === 'PATCH') {
    const body = req.body
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Body invalide' })
    }

    // Validate keys
    const cleaned = {}
    for (const [k, v] of Object.entries(body)) {
      if (VALID_KEYS[k] && VALID_KEYS[k](v)) {
        cleaned[k] = v
      }
    }

    const current = (user.preferences && typeof user.preferences === 'object') ? user.preferences : {}
    const merged = { ...current, ...cleaned }

    await prisma.appUser.update({
      where: { id: user.id },
      data: { preferences: merged }
    })

    return res.status(200).json(merged)
  }

  return res.status(405).json({ error: 'Méthode non supportée' })
}
