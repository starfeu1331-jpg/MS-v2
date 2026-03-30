import { PrismaClient } from '@prisma/client'
import { hashPassword } from './utils.js'

const prisma = new PrismaClient()

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  try {
    const count = await prisma.appUser.count()
    if (count > 0) {
      return res.status(403).json({ error: 'Setup déjà effectué' })
    }

    const { email, password, nom, prenom } = req.body
    if (!email || !password || !nom || !prenom) {
      return res.status(400).json({ error: 'email, password, nom et prenom requis' })
    }

    const hashed = await hashPassword(password)
    const user = await prisma.appUser.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashed,
        nom,
        prenom,
        role: 'SUPER_ADMIN'
      },
      select: { id: true, email: true, nom: true, prenom: true, role: true }
    })

    return res.status(201).json({ ok: true, user })
  } catch (error) {
    console.error('Setup error:', error)
    return res.status(500).json({ error: 'Erreur serveur', details: error.message })
  }
}
