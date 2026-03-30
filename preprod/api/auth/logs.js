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
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' })

  const user = await getSessionUser(req)
  if (!user) return res.status(401).json({ error: 'Non authentifié' })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return res.status(403).json({ error: 'Accès refusé' })

  const { userId, action, dateStart, dateEnd, search, page = '1', limit = '50' } = req.query

  const conditions = []
  const params = []
  let pi = 1

  if (userId) { conditions.push(`user_id = $${pi++}`); params.push(userId) }
  if (action && action !== 'all') { conditions.push(`action = $${pi++}`); params.push(action) }
  if (dateStart) { conditions.push(`created_at >= $${pi++}`); params.push(new Date(dateStart)) }
  if (dateEnd) { conditions.push(`created_at <= $${pi++}`); params.push(new Date(dateEnd + 'T23:59:59')) }
  if (search) {
    conditions.push(`(user_email ILIKE $${pi++} OR user_name ILIKE $${pi++})`)
    params.push('%' + search + '%', '%' + search + '%')
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
  const countParams = [...params]

  const limitNum = Math.min(parseInt(limit) || 50, 200)
  const offsetVal = (Math.max(parseInt(page) || 1, 1) - 1) * limitNum
  const limitIdx = pi++
  const offsetIdx = pi++
  params.push(limitNum, offsetVal)

  try {
    const [rows, countResult] = await Promise.all([
      prisma.$queryRawUnsafe(
        `SELECT id, user_id, user_email, user_name, action, resource, details, ip, created_at
         FROM app_logs ${where} ORDER BY created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        ...params
      ),
      prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::integer as count FROM app_logs ${where}`,
        ...countParams
      )
    ])

    const total = Number(countResult[0]?.count || 0)
    return res.status(200).json({ logs: rows, total })
  } catch (error) {
    console.error('Logs API error:', error)
    return res.status(500).json({ error: 'Erreur serveur' })
  }
}
