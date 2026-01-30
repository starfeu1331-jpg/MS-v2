# 🎯 ANALYSE COMPARATIVE - Ce qui manque VS Ce qui existe

**Analyse des CSV actuels du pôle informatique**  
**Date:** 30 janvier 2026

---

## 📊 STATISTIQUES DES FICHIERS ACTUELS

```
Points de vente.csv     →      23 lignes (22 magasins)
Produits.csv           →  55 730 lignes (55k+ produits)
client.csv             → 591 734 lignes (~590k clients)
détail transactions.csv → 407 210 lignes (~400k transactions)
```

---

## 🔴 BLOCAGES CRITIQUES IDENTIFIÉS

### 1. DISTINCTION WEB vs MAGASIN → **IMPOSSIBLE ACTUELLEMENT**

#### Ce qui existe:
```csv
N° Carte fidélité;N° Facture client;Dépôt;Date facture;N° Produit;Quantité unitaire;Prix vente net
1918523;191452141;19;08/01/2022;58564;1;7,55
```

#### Le problème:
- Le dépôt "19" = M19 qui est un magasin physique
- **MAIS** aucun moyen de savoir si d'autres sont Web
- Aucune colonne "Canal", "Type", "Origine"
- Pas de dépôt spécial "WEB" identifié

#### Test effectué sur 400k transactions:
```bash
grep -i 'web\|site\|internet' détail_transactions.csv
→ AUCUN RÉSULTAT

Codes dépôt uniques trouvés: 1, 12, 13, 14, 16, 17, 19, 22, 23, 24, 25...
→ Tous numériques, aucun "WEB"
```

#### Impact sur l'application:
```typescript
// Code actuel dans l'appli
const isWeb = transaction.depot === 'WEB'  // ❌ Ne fonctionne JAMAIS

// Résultat:
totalCAWeb = 0€        // ❌ Toujours 0
totalCAMagasin = 100%  // ✅ Mais inclut le web !
txWeb = 0%            // ❌ Faux
```

#### ✅ SOLUTION REQUISE:
```csv
N° Carte;N° Facture;Dépôt;Canal;Date facture;N° Produit;Quantité;Prix
1918523;191452141;19;MAGASIN;08/01/2022;58564;1;7.55
2045678;WEB123456;WEB;WEB;15/01/2022;45789;2;125.90
```

---

### 2. CONTACTS CLIENTS → **COMPLÈTEMENT ABSENTS**

#### Ce qui existe:
```csv
N° Carte fidélité;Date création;Statut;Date de validité;Civilité;Date de naissance;Sexe;Nom adresse;Adresse;Adresse;Adresse (4ième ligne);C.P;Ville
2;26/05/2015;;26/05/2015;;;H;;13;passage des alouettes;;69008;LYON;
10;15/06/2020;;15/06/2020;;;F;;;;;84350;COURTHEZON;
```

#### Analyse détaillée:
- ✅ N° Carte: OK
- ✅ Civilité: OK (mais souvent vide)
- ✅ Sexe: OK (mais souvent vide)
- ⚠️ Nom adresse: **VIDE** dans la majorité des cas
- ❌ Nom: **ABSENT**
- ❌ Prénom: **ABSENT**
- ❌ Email: **ABSENT**
- ❌ Téléphone: **ABSENT**
- ❌ Mobile: **ABSENT**

#### Test sur 10 clients:
```
Clients avec nom_adresse vide: 8/10 (80%)
Clients avec email: 0/10 (0%)
Clients avec téléphone: 0/10 (0%)
```

#### Impact fonctionnel:

**❌ Fonctionnalités IMPOSSIBLES:**
1. Export liste clients pour campagne email → Pas d'email
2. Campagne SMS → Pas de mobile
3. Affichage "Bonjour Sophie Martin" → Pas de nom/prénom
4. Contact client après achat → Pas de coordonnées
5. Programme fidélité personnalisé → Pas d'identité
6. Récupération panier abandonné → Pas d'email
7. Enquête satisfaction → Pas de contact

**Exemple concret:**
```javascript
// Dans l'appli RFM (segmentation clients)
{
  carte: "123456",
  ville: "LYON",           // ✅ OK
  recency: 45,
  frequency: 12,
  monetary: 2458.90,
  
  // Mais pour contacter ce client VIP:
  nom: undefined,          // ❌
  prenom: undefined,       // ❌
  email: undefined,        // ❌
  → IMPOSSIBLE À CONTACTER !
}
```

#### ✅ SOLUTION REQUISE:
```csv
N° Carte;Nom;Prénom;Email;Téléphone;Mobile;Opt-in Email;Opt-in SMS;Civilité;Sexe;Date naissance;...
123456;MARTIN;Sophie;sophie.martin@email.fr;0478123456;0612345678;O;O;Mme;F;1985-03-15;...
```

---

### 3. PRODUITS SANS NOM → **CODES BRUTS UNIQUEMENT**

#### Ce qui existe:
```csv
N° Produit;Famille;Sous famille;Sous sous famille;Sous sous sous famille
5003;Sol;Moquette;;
58564;Sol;PVC;;
78901;Mur;Papier peint;Intissé;
```

#### Le problème:
- ✅ Code produit: OK
- ✅ Hiérarchie familles: OK
- ❌ Nom produit: **ABSENT**
- ❌ Prix: **ABSENT**
- ❌ Stock: **ABSENT**
- ❌ Description: **ABSENT**

#### Impact dans l'interface utilisateur:

**Affichage actuel (mauvais):**
```
Top 10 Produits:
1. 58564 - Sol/PVC - 12 450€
2. 78901 - Mur/Papier peint - 8 920€
3. 45789 - Sol/Moquette - 7 230€
```
❌ L'utilisateur ne comprend pas ce que c'est

**Affichage souhaité:**
```
Top 10 Produits:
1. Rouleau PVC imitation parquet chêne 4m - Sol/PVC - 12 450€ (89.90€/unité)
2. Papier peint intissé floral blanc/gris - Mur/Papier peint - 8 920€ (24.90€/rouleau)
3. Moquette aiguilletée anthracite 2m largeur - Sol/Moquette - 7 230€ (15.90€/m²)
```
✅ Compréhensible et professionnel

#### Cas d'usage bloqués:
- **Catalogue produits:** Impossible d'afficher un catalogue lisible
- **Recherche produit:** Recherche par code uniquement (pas par nom)
- **Recommandations:** "Clients ayant acheté 58564..." → Incompréhensible
- **Analyse ABC:** Graphiques avec codes au lieu de noms
- **Export PDF:** Rapports illisibles pour la direction

#### ✅ SOLUTION REQUISE:
```csv
N° Produit;Nom produit;Description;Famille;Sous famille;Prix vente TTC;Stock;Code EAN;Marque;Statut
58564;Rouleau PVC imitation parquet chêne 4m;Revêtement sol vinyle haute résistance, largeur 4m;Sol;PVC;89.90;145;3254123456789;QuickStep;Actif
```

---

## 📉 FONCTIONNALITÉS DE L'APPLI ACTUELLEMENT CASSÉES

### Dashboard Principal
```
❌ CA Web vs Magasin → Toujours 0€ Web / 100% Magasin
❌ Taux Web → Toujours 0%
❌ Tickets Web → Toujours 0
❌ Panier moyen Web → Incalculable
```

### Segmentation RFM
```
✅ Calcul RFM → Fonctionne
✅ Segments clients → OK
❌ Export emails segment Champions → Impossible (pas d'emails)
❌ Personnalisation → Pas de nom/prénom
❌ Contact clients à risque → Impossible
```

### Analyse Produits
```
⚠️ Top produits → Affiche codes bruts (58564, 78901...)
⚠️ ABC Analysis → Codes uniquement
⚠️ Cross-selling → Illisible
❌ Prix manquants → Pas de calcul de marge
❌ Stock → Pas de gestion rupture
```

### Marketing
```
❌ Campagnes email → Impossible (pas d'emails)
❌ SMS promotionnels → Impossible (pas de mobiles)
❌ Export ciblé → Pas de coordonnées
❌ Programme fidélité → Pas de personnalisation
```

### Analyses Magasins
```
⚠️ Performance par magasin → OK mais sans détails contact
❌ Horaires magasins → Absents
❌ Carte interactive → Pas de coordonnées GPS
❌ Contact magasin → Pas de téléphone/email
```

---

## 💰 IMPACT BUSINESS ESTIMÉ

### Perte opportunités marketing
```
590 000 clients en base
Si 50% ont email valide → 295 000 emails potentiels
Campagne email mensuelle:
  - Taux ouverture: 20% → 59 000 lectures
  - Taux conversion: 2% → 1 180 commandes
  - Panier moyen: 85€ → 100 300€ CA/mois
  
→ 1.2M€ CA annuel potentiel NON EXPLOITÉ
```

### Perte efficacité commerciale
```
Temps perdu à rechercher contacts: ~30min/jour
× 5 utilisateurs
× 250 jours/an
= 625h/an perdues

→ Équivalent 1/3 ETP gaspillé
```

### Risque réglementaire (RGPD)
```
⚠️ Données clients sans opt-in tracé
⚠️ Impossible de répondre à demande d'accès/suppression
   (pas d'email pour contacter le client)
```

---

## ✅ PRIORISATION DES CORRECTIONS

### 🔴 CRITIQUE (Semaine 1)
```
1. Colonne "Canal" dans transactions    → Débloquer 50% des stats
2. Email dans clients                   → Activer marketing
3. Nom produit dans produits            → Rendre l'appli lisible
```

### 🟡 IMPORTANT (Semaine 2-3)
```
4. Nom + Prénom séparés dans clients
5. Téléphone + Mobile dans clients
6. Prix vente TTC dans produits
7. Opt-in Email/SMS dans clients
```

### 🟢 SOUHAITABLE (Mois 1)
```
8. Stock produits
9. Horaires + GPS magasins
10. Mode paiement transactions
11. Description produits
12. Marque + Code EAN produits
```

---

## 📋 RÉCAPITULATIF CHIFFRÉ

| Fichier | Lignes | Colonnes actuelles | Colonnes demandées | Taux complétude |
|---------|--------|-------------------|-------------------|-----------------|
| **clients.csv** | 591 734 | 14 | +8 | 50% → 85% |
| **Produits.csv** | 55 730 | 5 | +9 | 35% → 90% |
| **transactions.csv** | 407 210 | 7 | +6 | 60% → 95% |
| **magasins.csv** | 22 | 8 | +7 | 70% → 95% |

---

## 🎯 OBJECTIF FINAL

### Avant (actuellement)
```
Application analytics partiellement fonctionnelle:
- 50% des statistiques sont fausses (Web/Magasin)
- Pas de marketing actionnable
- Interface avec codes produits bruts
- Aucune personnalisation possible
```

### Après (avec corrections)
```
Application analytics 100% opérationnelle:
✅ Statistiques précises Web + Magasin
✅ Export listes clients avec contacts
✅ Interface professionnelle avec noms produits
✅ Campagnes marketing automatisées
✅ Gestion stock et alertes rupture
✅ Analyse marges détaillée
✅ Conformité RGPD
✅ ROI mesurable
```

---

## 📞 PROCHAINES ÉTAPES

1. **J+2:** Réunion technique avec Nicolas pour clarifier faisabilité
2. **J+7:** Livraison fichiers de test avec nouvelles colonnes
3. **J+14:** Intégration et validation données
4. **J+21:** Mise en production exports corrigés
5. **J+30:** Automatisation export quotidien

---

**Voir documents complémentaires:**
- `DEMANDES_CSV_NICOLAS.md` → Liste détaillée
- `RESUME_DEMANDES_NICOLAS.md` → Résumé exécutif
- `MAPPING_TECHNIQUE_NICOLAS.md` → Correspondances SQL/CSV

---

*Analyse réalisée le 30 janvier 2026*  
*Base: Fichiers CSV du 28 janvier 2026*
