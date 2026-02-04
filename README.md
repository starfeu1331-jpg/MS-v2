# 📊 Décor Analytics v2.0

Application d'analyse retail avancée pour Décor Discount - React 19 + TypeScript + PostgreSQL

---

## 🚀 Démarrage rapide

### Pour comprendre le projet
**📖 Lire en priorité** : [INDEX.md](INDEX.md) - Guide complet du projet (35 min de lecture)

**Documents principaux** :
1. [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) - Vue d'ensemble (10 min)
2. [ISSUES_AND_SOLUTIONS.md](ISSUES_AND_SOLUTIONS.md) - Problèmes identifiés (15 min)
3. [TODO_ROADMAP.md](TODO_ROADMAP.md) - Actions à faire (10 min)

---

## ✨ Fonctionnalités

- 📈 **Dashboard complet** : KPIs, graphiques interactifs, évolution temporelle
- 👥 **Segmentation RFM** : 7 segments clients avec quintiles dynamiques (144k clients)
- 🔍 **Recherche avancée** : Par ticket, client ou produit
- 📦 **ABC Analysis** : Classification Pareto des produits
- 🔗 **Cross-Selling** : Associations de produits
- 📊 **Sous-Familles** : Analyse par catégorie de produits
- 🗺️ **Zone de chalandise** : Carte interactive avec heatmap
- 📤 **Export** : Excel/CSV de toutes les analyses
- 🎨 **Design moderne** : Interface pro avec Tailwind CSS
- ⚡ **Performance optimisée** : Cache intelligent + lazy loading

## 🚀 Installation et démarrage

```bash
# Installation
npm install

# Lancement en développement
npm run dev
# → Ouvre http://localhost:5173

# Build production
npm run build
npm run preview
```

**⚠️ Note** : Le chargement initial prend actuellement ~10 minutes (correctif prêt, 20 min d'implémentation)  
Voir [ISSUES_AND_SOLUTIONS.md](ISSUES_AND_SOLUTIONS.md) pour la solution détaillée

## 📋 Format CSV attendu

Le CSV doit contenir ces colonnes (séparateur `;`) :

- `Date`
- `Horaire`
- `F�️ Architecture

### Frontend
- **React 19.2** + TypeScript
- **Vite 7.3** - Build ultra-rapide
- **Tailwind CSS** - Styling moderne
- **Recharts** - Graphiques (lazy-loaded)
- **Leaflet** - Cartes interactives

### Backend
- **Vercel Serverless** Functions
- **Prisma 5.22** - ORM
- **PostgreSQL** (Neon) - Database

### Base de données
- 709k transactions (Q1-Q2 2025)
- 144k clients actifs
- 55k produits
- 22 magasins
- **Tailwind CSS** - Styling moderne
- **� État actuel

| Aspect | Status | Note |
|--------|--------|------|
| **Modules fonctionnels** | 9/14 (64%) | 5 modules à implémenter |
| **Performance** | 10 min ⚠️ | Correctif prêt (20 min) |
| **Données** | 52% complètes ⚠️ | 17 colonnes manquantes |
| **Production** | ✅ Déployé | https://ms-v2.vercel.app |

## 🔧 Problèmes connus & Solutions

Voir documentation complète dans :
- [ISSUES_AND_SOLUTIONS.md](ISSUES_AND_SOLUTIONS.md) - Détails des 4 problèmes majeurs
- [TODO_ROADMAP.md](TODO_ROADMAP.md) - Actions prioritaires

**Priorités immédiates** :
1. ⚡ Corriger performance (20 min) → Lazy loading Recharts
2. 📧 Obtenir colonnes CSV manquantes de Nicolas
3. 📦 Importer catalogue web (1h)

## 📞 Contact & Ressources

- **Production** : https://ms-v2.vercel.app
- **Repository** : GitHub starfeu1331-jpg/MS-v2
- **Documentation** : [INDEX.md](INDEX.md)

## 📝 Scripts disponibles

```bash
npm run dev          # Dev mode
npm run build        # Build production
npm run preview      # Preview build
npm run lint         # Lint code
```

---

**📖 Pour démarrer** : Lire [INDEX.md](INDEX.md) puis [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)