# 🚀 Déploiement sur Vercel

## Étape rapide

1. **Va sur https://vercel.com et connecte-toi avec GitHub**

2. **Importe le projet**
   - Clique "Add New" → "Project"
   - Sélectionne `starfeu1331-jpg/MS-v2`

3. **Configure les variables d'environnement**
   - Ajoute `DATABASE_URL` :
   ```
   postgresql://neondb_owner:npg_mdwPX1ovpWh7@ep-red-meadow-ah5j6nt7-pooler.c-3.us-east-1.aws.neon.tech/neondb?connect_timeout=15&sslmode=require
   ```

4. **Deploy!**
   - Vercel détecte automatiquement Vite
   - Clique "Deploy"
   - Attends 2-3 minutes

## ⚠️ Note importante

Le backend API n'est PAS inclus dans ce déploiement (seulement le frontend).

Pour que le backend fonctionne en production, tu as 2 options:

### Option A: Déployer backend séparément sur Railway (gratuit)
1. Va sur https://railway.app
2. Connecte GitHub
3. Sélectionne le repo MS-v2
4. Root directory: `backend`
5. Start command: `npx tsx src/server.ts`
6. Ajoute DATABASE_URL dans les variables
7. Note l'URL du backend (ex: `https://ms-v2-backend.railway.app`)

Puis dans Vercel, ajoute la variable:
```
VITE_API_URL=https://ms-v2-backend.railway.app
```

### Option B: Convertir en Vercel Serverless Functions
Créer `/api` folder avec des fonctions serverless (plus complexe).

## 📊 Données actuelles

La base Neon contient:
- 1M clients
- 25 magasins  
- 55k produits
- ~700k transactions (Q1-Q2 2025)

Le dashboard affichera les données 2025 uniquement.

## 🔗 URLs après déploiement

- Frontend: `https://ms-v2.vercel.app` (ou ton domaine custom)
- Backend: À déployer séparément (voir Option A)

Bon déploiement! 🚀
