# 🚀 Lancer l'application

## Démarrage rapide

```bash
./start.sh
```

Ou manuellement :

### 1. Backend (port 3000)
```bash
cd backend
npx tsx src/server.ts
```

### 2. Frontend (port 5173)
```bash
npm run dev
```

## URLs
- 📊 **Frontend** : http://localhost:5173
- 🔌 **Backend API** : http://localhost:3000
- ✅ **Health check** : http://localhost:3000/api/health

## ⚠️ Important

**Le chargement initial du dashboard prend 6-8 secondes** car il agrège 1.3M transactions.
C'est normal, patience! Le spinner tourne pendant le chargement.

## Arrêter tout

```bash
killall -9 node
```

## Logs

Les logs sont dans :
- `backend.log` - Backend API
- `frontend.log` - Frontend Vite

## Problèmes courants

### "ERR_CONNECTION_REFUSED"
→ Les serveurs ne sont pas lancés. Relancer `./start.sh`

### "Écran blanc"
→ Attendre 10 secondes, le dashboard charge les données

### "Page ne se charge pas"
→ Vérifier que les ports 3000 et 5173 sont libres :
```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

## Vérification

Backend OK si :
```bash
curl http://localhost:3000/api/health
# Retourne: {"status":"ok","timestamp":"..."}
```

Frontend OK si :
```bash
curl http://localhost:5173
# Retourne: du HTML avec <title>Magic Système</title>
```

## Performances

- Premier appel API : **~7 secondes** (agrégation de 1.3M transactions)
- Appels suivants : **immédiat** (cache navigateur)
- Requêtes optimisées avec agrégations SQL côté PostgreSQL
