import { PrismaClient } from '@prisma/client'
import { verifyPassword, generateToken, sessionExpiry, logAction } from './utils.js'

const prisma = new PrismaClient()

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' })
  }

  try {
    const user = await prisma.appUser.findUnique({ where: { email: email.toLowerCase().trim() } })

    if (!user || !user.isActive) {
      await logAction(prisma, { userEmail: email.toLowerCase().trim(), action: 'LOGIN_FAILED', details: { reason: !user ? 'user_not_found' : 'account_inactive' }, ip: req.ip })
      return res.status(401).json({ error: 'Identifiants incorrects' })
    }

    const valid = await verifyPassword(password, user.password)
    if (!valid) {
      await logAction(prisma, { userId: user.id, userEmail: user.email, userName: `${user.prenom} ${user.nom}`, action: 'LOGIN_FAILED', details: { reason: 'wrong_password' }, ip: req.ip })
      return res.status(401).json({ error: 'Identifiants incorrects' })
    }

    await prisma.appSession.deleteMany({
      where: { expiresAt: { lt: new Date() } }
    })

    const token = generateToken()
    await prisma.appSession.create({
      data: {
        userId: user.id,
        token,
        expiresAt: sessionExpiry()
      }
    })

    await logAction(prisma, { userId: user.id, userEmail: user.email, userName: `${user.prenom} ${user.nom}`, action: 'LOGIN', ip: req.ip })

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({ error: 'Erreur serveur' })
  }
}
