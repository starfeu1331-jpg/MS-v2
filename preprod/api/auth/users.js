import { PrismaClient } from '@prisma/client'
import { hashPassword, generateToken, sessionExpiry, logAction } from './utils.js'

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
  const user = await getSessionUser(req)
  if (!user) return res.status(401).json({ error: 'Non authentifié' })

  const method = req.method
  const id = req.params?.id

  if (['SUPER_ADMIN', 'ADMIN'].indexOf(user.role) === -1) {
    return res.status(403).json({ error: 'Accès refusé' })
  }

  try {
    if (method === 'GET' && !id) {
      const users = await prisma.appUser.findMany({
        select: { id: true, email: true, nom: true, prenom: true, role: true, isActive: true, createdAt: true, modules: true },
        orderBy: { createdAt: 'asc' }
      })
      const parsed = users.map(u => ({
        ...u,
        modules: u.modules ? JSON.parse(u.modules) : null
      }))
      return res.status(200).json(parsed)
    }

    if (method === 'POST' && !id) {
      const { email, nom, prenom, role, password, modules } = req.body
      if (!email || !nom || !prenom || !role || !password) {
        return res.status(400).json({ error: 'Tous les champs sont requis' })
      }
      if (role === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Seul un SUPER_ADMIN peut créer un autre SUPER_ADMIN' })
      }
      const existing = await prisma.appUser.findUnique({ where: { email: email.toLowerCase().trim() } })
      if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' })

      const hashed = await hashPassword(password)
      const modulesJson = modules === null ? null : (Array.isArray(modules) ? JSON.stringify(modules) : null)
      const newUser = await prisma.appUser.create({
        data: { email: email.toLowerCase().trim(), password: hashed, nom, prenom, role, modules: modulesJson },
        select: { id: true, email: true, nom: true, prenom: true, role: true, isActive: true, createdAt: true, modules: true }
      })
      await logAction(prisma, { userId: user.id, userEmail: user.email, userName: `${user.prenom} ${user.nom}`, action: 'USER_CREATE', resource: newUser.email, details: { role, modules: modules ?? 'all' }, ip: req.ip })
      return res.status(201).json({ ...newUser, modules: newUser.modules ? JSON.parse(newUser.modules) : null })
    }

    if (method === 'PATCH' && id) {
      const { nom, prenom, role, isActive, password, modules } = req.body
      if (role === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Seul un SUPER_ADMIN peut attribuer ce rôle' })
      }
      const target = await prisma.appUser.findUnique({ where: { id } })
      if (!target) return res.status(404).json({ error: 'Utilisateur non trouvé' })
      if (target.role === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Vous ne pouvez pas modifier un SUPER_ADMIN' })
      }

      const updateData = {}
      if (nom !== undefined) updateData.nom = nom
      if (prenom !== undefined) updateData.prenom = prenom
      if (role !== undefined) updateData.role = role
      if (isActive !== undefined) updateData.isActive = isActive
      if (password) updateData.password = await hashPassword(password)
      if (modules !== undefined) updateData.modules = modules === null ? null : (Array.isArray(modules) ? JSON.stringify(modules) : null)

      const updated = await prisma.appUser.update({
        where: { id },
        data: updateData,
        select: { id: true, email: true, nom: true, prenom: true, role: true, isActive: true, createdAt: true, modules: true }
      })
      const actionType = isActive !== undefined ? 'USER_TOGGLE' : 'USER_UPDATE'
      await logAction(prisma, { userId: user.id, userEmail: user.email, userName: `${user.prenom} ${user.nom}`, action: actionType, resource: target.email, details: updateData.password ? { ...updateData.password !== undefined && { password: '[changed]' } } : updateData, ip: req.ip })
      return res.status(200).json({ ...updated, modules: updated.modules ? JSON.parse(updated.modules) : null })
    }

    if (method === 'DELETE' && id) {
      if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Accès refusé' })
      if (id === user.id) return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' })
      await prisma.appSession.deleteMany({ where: { userId: id } })
      const toDelete = await prisma.appUser.findUnique({ where: { id }, select: { email: true } })
      await prisma.appUser.delete({ where: { id } })
      await logAction(prisma, { userId: user.id, userEmail: user.email, userName: `${user.prenom} ${user.nom}`, action: 'USER_DELETE', resource: toDelete?.email, ip: req.ip })
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Méthode non autorisée' })
  } catch (error) {
    console.error('Users API error:', error)
    return res.status(500).json({ error: 'Erreur serveur' })
  }
}
