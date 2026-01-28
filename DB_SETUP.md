# Système de Base de Données Locale - Decor Analytics

## ✅ Ce qui a été créé

### 1. Service Base de Données (`src/db/duckdb.ts`)
- Initialisation de DuckDB-WASM avec persistance OPFS
- Schéma optimisé avec 4 tables principales:
  - `clients` : Informations clients fidèles
  - `produits` : Catalogue produits avec hiérarchie familles
  - `magasins` : Liste des magasins
  - `transactions` : Toutes les transactions (6M lignes)
- Tables métier:
  - `dashboard_snapshot` : Snapshots pré-calculés par année
  - `metadata` : Métadonnées (date dernier import, etc.)
- Index pour performances maximales

### 2. Pipeline d'Ingestion (`src/db/ingest.ts`)
- Import des 4 fichiers CSV/Excel
- Transformation et normalisation des données
- Insertion par batch (10k lignes) pour performances
- Génération automatique du snapshot 2025
- Suivi de progression en temps réel

### 3. Composant Settings (`src/components/Settings.tsx`)
- Interface UI complète pour réimporter les données
- Upload des 4 fichiers (drag & drop)
- Barre de progression détaillée
- Affichage statut base + date dernier import
- Callback pour recharger l'app après import

### 4. Hook useDatabase (`src/hooks/useDatabase.ts`)
- Initialisation automatique de la DB au démarrage
- Chargement du snapshot 2025 (01/01/2025 - 31/12/2025)
- Transformation format DB → format React compatible
- Gestion des erreurs et états de chargement

## 📋 Installation des dépendances

Exécutez dans le terminal :

```bash
npm install @duckdb/duckdb-wasm apache-arrow@14
```

## 🔧 Prochaines étapes (à faire manuellement)

### 1. Modifier `App.tsx`

Ajouter les imports en haut du fichier :

```typescript
import SettingsComponent from './components/Settings'
import { useDatabase } from './hooks/useDatabase'
```

Dans le composant `App()`, remplacer les lignes 29-31 par :

```typescript
// Charger depuis la base de données
const { dbReady, hasData, initialData, loading: dbLoading, reloadData } = useDatabase()
const [data, setData] = useState<any>(null)
```

Après la ligne 64 (après le useEffect de displayData), ajouter :

```typescript
// Charger les données depuis la DB au démarrage
useEffect(() => {
  if (initialData && !data) {
    console.log('🔵 INITIAL DATA depuis DB:', {
      tickets: initialData.allTickets?.length,
      clients: initialData.allClients?.size,
      fromDatabase: initialData.fromDatabase
    })
    setData(initialData)
  }
}, [initialData, data])
```

Dans le `return`, ajouter le cas 'settings' après les autres tabs (après la ligne 565) :

```typescript
{activeTab === 'settings' && <SettingsComponent onDataReloaded={() => {
  reloadData().then(() => {
    setData(null) // Force le rechargement
    setActiveTab('dashboard')
  })
}} />}
```

Ajouter le bouton Settings dans la sidebar (rechercher les autres boutons et ajouter après "exports") :

```typescript
<button
  onClick={() => setActiveTab('settings')}
  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
    activeTab === 'settings'
      ? 'bg-blue-500 text-white'
      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
  }`}
>
  <Settings className="w-5 h-5" />
  {sidebarOpen && <span>Paramètres</span>}
</button>
```

### 2. Ajouter le type 'settings' dans TabType (ligne 18) :

```typescript
type TabType = 'dashboard' | 'search' | 'rfm' | 'subFamilies' | 'crossSelling' | 'cohortes' | 'abc' | 'kingquentin' | 'stores' | 'forecast' | 'social' | 'exports' | 'settings'
```

### 3. Gérer l'état initial

Modifier la condition d'affichage de FileUploader (ligne ~560) :

```typescript
{!hasData && !dbLoading && <FileUploader onDataLoaded={(loadedData) => {
  setData(loadedData)
  // Optionnel : importer aussi dans la DB
}} />}
```

## 🚀 Fonctionnement

1. **Premier lancement** :
   - L'app initialise DuckDB en arrière-plan
   - Aucune donnée → Affichage de FileUploader OU redirection vers Settings
   - L'utilisateur importe ses 4 fichiers via Settings
   - Les données sont insérées dans la DB + snapshot 2025 créé
   - Redirect vers Dashboard avec les données 2025 préchargées

2. **Lancements suivants** :
   - DuckDB charge instantanément le snapshot 2025 depuis OPFS
   - Dashboard s'affiche directement avec les données (pas de recalcul)
   - Les filtres continuent de fonctionner en mémoire React

3. **Mise à jour des données** :
   - Clic sur "Paramètres"
   - Upload des nouveaux fichiers
   - La DB est écrasée et reconstruite
   - L'app reload automatiquement

## ⚡ Avantages

- **Performance** : Chargement instantané (snapshot pré-calculé)
- **Persistance** : Pas besoin de réimporter à chaque session
- **Évolutivité** : Facile d'ajouter de nouvelles années (2026, 2027...)
- **100% local** : Tout dans le navigateur, pas de serveur
- **Optimisé** : Index DB + requêtes SQL rapides

## 📊 Structure des données

Les données de la DB sont transformées pour être compatibles avec l'ancien format React :

```typescript
{
  allTickets: Array,     // Toutes les transactions
  allClients: Map,       // Map des clients par carte
  familles: {},          // Agrégations par famille
  geo: {                 // Données géographiques
    magasins: {},
    cp: {}
  },
  dateRange: {
    min: '2025-01-01',
    max: '2025-12-31'
  },
  fromDatabase: true     // Flag pour identifier la source
}
```

## ⚠️ Points d'attention

1. DuckDB-WASM nécessite un environnement moderne (Chrome/Edge/Firefox récents)
2. OPFS nécessite HTTPS en production (OK en local)
3. La première ingestion peut prendre 1-2 minutes pour 6M lignes
4. Les snapshots sont limités à une année (éviter de tout charger en RAM)

## 🔮 Évolutions futures possibles

- Ajouter des snapshots pour chaque mois
- Implémenter le filtrage directement en SQL (plus rapide)
- Créer des vues matérialisées pour RFM, ABC, etc.
- Ajouter un système de cache pour les requêtes fréquentes
- Export des données vers Parquet pour backup
