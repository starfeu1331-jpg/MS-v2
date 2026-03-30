/**
 * Product Favorites CRUD API
 * All routes require authentication token.
 *
 * GET    /api/products/favorites           → list user's groups (with items count)
 * POST   /api/products/favorites           → create a group { name }
 * DELETE /api/products/favorites/:groupId  → delete a group
 * PATCH  /api/products/favorites/:groupId  → rename { name }
 * POST   /api/products/favorites/:groupId/items   → add items { productIds: [] }
 * DELETE /api/products/favorites/:groupId/items   → remove items { productIds: [] }
 * GET    /api/products/favorites/:groupId/items   → get group items
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ log: ['error'] })

async function getUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const session = await prisma.appSession.findUnique({
    where: { token },
    include: { user: true }
  })
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null
  return session.user
}

// ─── Groups CRUD ─────────────────────────────────────────────
export async function favoritesGroupsHandler(req, res) {
  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'Non authentifié' })

  // LIST
  if (req.method === 'GET') {
    const groups = await prisma.productFavoriteGroup.findMany({
      where: { userId: user.id },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' }
    })
    return res.json({
      groups: groups.map(g => ({
        id: g.id,
        name: g.name,
        itemCount: g._count.items,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt
      }))
    })
  }

  // CREATE
  if (req.method === 'POST') {
    const { name } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'name required' })

    const group = await prisma.productFavoriteGroup.create({
      data: { userId: user.id, name: name.trim() }
    })
    return res.status(201).json({ group: { id: group.id, name: group.name, itemCount: 0, createdAt: group.createdAt } })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ─── Single Group Operations ──────────────────────────────────
export async function favoritesGroupHandler(req, res) {
  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'Non authentifié' })

  const groupId = req.params.groupId
  const group = await prisma.productFavoriteGroup.findFirst({
    where: { id: groupId, userId: user.id }
  })
  if (!group) return res.status(404).json({ error: 'Group not found' })

  // DELETE
  if (req.method === 'DELETE') {
    await prisma.productFavoriteGroup.delete({ where: { id: groupId } })
    return res.json({ ok: true })
  }

  // RENAME
  if (req.method === 'PATCH') {
    const { name } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'name required' })
    const updated = await prisma.productFavoriteGroup.update({
      where: { id: groupId },
      data: { name: name.trim() }
    })
    return res.json({ group: { id: updated.id, name: updated.name } })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ─── Group Items ──────────────────────────────────────────────
export async function favoritesItemsHandler(req, res) {
  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'Non authentifié' })

  const groupId = req.params.groupId
  const group = await prisma.productFavoriteGroup.findFirst({
    where: { id: groupId, userId: user.id }
  })
  if (!group) return res.status(404).json({ error: 'Group not found' })

  // LIST items (with product names from BDD)
  if (req.method === 'GET') {
    const items = await prisma.productFavoriteItem.findMany({
      where: { groupId },
      orderBy: { addedAt: 'desc' }
    })
    // Resolve product names from produits table
    let namesMap = {}
    if (items.length) {
      const pids = items.map(i => i.productId)
      const placeholders = pids.map((_, i) => `$${i + 1}`).join(',')
      const rows = await prisma.$queryRawUnsafe(
        `SELECT id, designation FROM produits WHERE id IN (${placeholders})`,
        ...pids
      )
      for (const r of rows) namesMap[r.id] = r.designation
    }
    return res.json({
      items: items.map(i => ({
        id: i.id,
        productId: i.productId,
        name: namesMap[i.productId] || null,
        addedAt: i.addedAt
      }))
    })
  }

  // ADD items
  if (req.method === 'POST') {
    const { productIds } = req.body
    if (!productIds?.length) return res.status(400).json({ error: 'productIds required' })

    const toInsert = productIds.slice(0, 500).map(pid => ({
      groupId,
      productId: String(pid)
    }))

    await prisma.productFavoriteItem.createMany({
      data: toInsert,
      skipDuplicates: true
    })

    const count = await prisma.productFavoriteItem.count({ where: { groupId } })
    return res.json({ ok: true, itemCount: count })
  }

  // REMOVE items  
  if (req.method === 'DELETE') {
    const { productIds } = req.body
    if (!productIds?.length) return res.status(400).json({ error: 'productIds required' })

    await prisma.productFavoriteItem.deleteMany({
      where: {
        groupId,
        productId: { in: productIds.map(String) }
      }
    })

    const count = await prisma.productFavoriteItem.count({ where: { groupId } })
    return res.json({ ok: true, itemCount: count })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
