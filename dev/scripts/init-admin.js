#!/usr/bin/env node
// Exécuter avec: node scripts/init-admin.js
// Lance le setup du premier SUPER_ADMIN

const url = process.argv[2] || 'http://localhost:3000'

const data = {
  email: 'marceau.juillet@decor-discount.com',
  password: 'Magic2026!',
  nom: 'Juillet',
  prenom: 'Marceau',
}

console.log('Création du premier SUPER_ADMIN...')
console.log('Email :', data.email)
console.log('Mot de passe temporaire :', data.password)
console.log('')

fetch(`${url}/api/auth/setup`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
  .then(r => r.json())
  .then(res => {
    if (res.ok) {
      console.log('✅ Compte créé avec succès :', res.user)
      console.log('')
      console.log('⚠️  CHANGEZ LE MOT DE PASSE dès la première connexion !')
    } else {
      console.log('❌ Erreur :', res.error)
    }
  })
  .catch(err => console.error('❌ Impossible de contacter le serveur :', err.message))
