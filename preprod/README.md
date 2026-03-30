# Décor Analytics

Application d'analyse retail pour Décor Discount.  
Stack : React 19 + TypeScript + Express + PostgreSQL OVH.

## Structure

```
decor-analytics/
├── dev/                → Développement local (toutes les features)
├── preprod/            → Pré-production (VPS OVH 91.134.137.123)
├── prod/               → Production (VPS OVH 91.134.141.37)
├── scripts/            → Scripts d'analyse réutilisables (monitoring, marketing, QA)
├── docs/               → Documentation projet (retroplanning, etc.)
├── _archive/           → Scripts one-off terminés (conservés pour référence)
├── deploy-preprod.sh   → Script de déploiement pré-prod
├── deploy-prod.sh      → Script de déploiement production
├── sync-*-from-vps.sh  → Scripts de sync inverse (VPS → local)
└── .env.example        → Template des variables d'environnement
```

## Workflow

1. **Développer en local** dans `dev/`
   ```bash
   cd dev
   npm install
   node server.js        # Backend Express (port 3000)
   npm run dev            # Frontend Vite (port 5173, proxy → 3000)
   ```

2. **Valider en pré-prod** — copier les changements dans `preprod/`, déployer :
   ```bash
   ./deploy-preprod.sh
   ```

3. **Pousser en production** — copier uniquement les modules validés dans `prod/`, déployer :
   ```bash
   ./deploy-prod.sh
   ```

## Base de données

PostgreSQL 16 hébergé chez OVH (CloudDB). Les 3 environnements partagent la même base.  
Schéma Prisma dans `*/prisma/schema.prisma`.

## Règles

- Ne jamais travailler directement sur les serveurs
- Tester en local → valider en preprod → pousser en prod
- Un module à la fois en production
- Les `.env` avec les vrais credentials ne sont **jamais** commités
