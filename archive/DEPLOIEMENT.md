# 🚀 Guide de déploiement Vercel + Neon

## Étapes à suivre

### 1️⃣ Créer la base de données Neon

1. Va sur https://neon.tech
2. Clique sur "Sign Up" (gratuit)
3. Crée un nouveau projet "MS-v2" ou "decor-analytics"
4. Sélectionne la région la plus proche (Europe West)
5. Une fois créé, copie la **Connection String** qui ressemble à:
   ```
   postgresql://username:password@ep-xxx-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

### 2️⃣ Migrer les données vers Neon

Deux options:

#### Option A: Via pg_dump/pg_restore (recommandé pour grosses données)
```bash
# Export depuis ta base locale
pg_dump -h localhost -U marceau decor_analytics > dump.sql

# Import vers Neon (remplace avec ta connection string)
psql "postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require" < dump.sql
```

#### Option B: Via Prisma (plus simple mais plus lent)
```bash
cd backend

# Mise à jour de .env avec la connection string Neon
echo 'DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"' > .env

# Créer le schéma
npx prisma db push

# Importer les données (tu devras créer un script seed)
# npm run seed
```

### 3️⃣ Déployer sur Vercel

1. Va sur https://vercel.com
2. Connecte ton compte GitHub
3. Clique sur "New Project"
4. Sélectionne le repo `MS-v2`
5. Configure les variables d'environnement:
   - `DATABASE_URL`: Ta connection string Neon (de l'étape 1)
   
6. Build settings (Vercel les détecte normalement automatiquement):
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

7. Clique sur "Deploy"

### 4️⃣ Configuration du Backend API

Le backend doit être déployé séparément ou utiliser Vercel Serverless Functions.

#### Option 1: Serverless Functions (Recommandé)
Convertir `backend/src/server.ts` en Vercel Functions:
```
/api/
  health.ts
  dashboard/
    [year].ts
    all.ts
  clients/
    [carte].ts
  tickets/
    [facture].ts
```

#### Option 2: Backend séparé (Railway, Render, Fly.io)
Déployer le backend Express sur une autre plateforme:
- Railway: https://railway.app (gratuit, simple)
- Render: https://render.com (gratuit)
- Fly.io: https://fly.io (gratuit)

Puis mettre à jour les URLs d'API dans le frontend:
```typescript
// src/services/decorAPI.ts ou dans les composants
const API_URL = import.meta.env.VITE_API_URL || 'https://ton-backend.railway.app'
```

### 5️⃣ Variables d'environnement Vercel

Dans les settings de ton projet Vercel, ajoute:
- `DATABASE_URL`: Connection string Neon
- `VITE_API_URL`: URL de ton backend (si déployé séparément)

### 6️⃣ Test de production

Une fois déployé, teste:
- Frontend: `https://ms-v2.vercel.app`
- API health: `https://ms-v2.vercel.app/api/health`
- Dashboard: Vérifie que les données s'affichent

## 🎯 Checklist finale

- [ ] Base Neon créée et connection string copiée
- [ ] Données migrées vers Neon
- [ ] Repo GitHub à jour (`git push`)
- [ ] Projet Vercel créé et lié au repo
- [ ] Variables d'environnement configurées
- [ ] Premier déploiement réussi
- [ ] Backend API accessible
- [ ] Dashboard charge les données
- [ ] Toutes les features fonctionnent

## 🔧 Troubleshooting

**Erreur "Cannot connect to database"**
- Vérifie que `?sslmode=require` est dans la connection string
- Vérifie que la variable `DATABASE_URL` est bien configurée dans Vercel

**Build failed**
- Vérifie que toutes les dépendances sont dans `package.json`
- Check les logs de build Vercel

**API endpoints 404**
- Vérifie que le backend est déployé et accessible
- Met à jour `VITE_API_URL` dans les variables d'environnement

## 📞 Support

Si tu as des questions, regarde la doc:
- Neon: https://neon.tech/docs
- Vercel: https://vercel.com/docs
- Prisma: https://www.prisma.io/docs

Bon déploiement! 🚀
