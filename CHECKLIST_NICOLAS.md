# ✅ CHECKLIST RAPIDE - Améliorations CSV

**Pour:** Nicolas  
**À faire:** Cocher au fur et à mesure

---

## 🔴 URGENT - Semaine 1

### CLIENT.CSV
- [ ] Ajouter colonne **"Nom"**
- [ ] Ajouter colonne **"Prénom"**
- [ ] Ajouter colonne **"Email"**
- [ ] Ajouter colonne **"Téléphone"**
- [ ] Ajouter colonne **"Mobile"**
- [ ] Ajouter colonne **"Opt-in Email"** (O/N)
- [ ] Ajouter colonne **"Opt-in SMS"** (O/N)
- [ ] Convertir dates au format **YYYY-MM-DD**

### PRODUITS.CSV
- [ ] Ajouter colonne **"Nom produit"** (libellé commercial)
- [ ] Ajouter colonne **"Prix vente TTC"**
- [ ] Ajouter colonne **"Stock"** (quantité disponible)
- [ ] Ajouter colonne **"Code EAN"**
- [ ] Ajouter colonne **"Marque"**
- [ ] Ajouter colonne **"Statut"** (Actif/Archivé)

### TRANSACTIONS.CSV (détail transactions.csv)
- [ ] Ajouter colonne **"Canal"** (valeurs: WEB ou MAGASIN) ⚠️ CRITIQUE
- [ ] Ajouter colonne **"Heure"** (format HH:MM:SS)
- [ ] Ajouter colonne **"Montant ligne TTC"**
- [ ] Ajouter colonne **"Mode paiement"** (CB/Espèces/Chèque)
- [ ] Convertir dates au format **YYYY-MM-DD**

### POINTS DE VENTE.CSV (magasins)
- [ ] Ajouter colonne **"Téléphone"**
- [ ] Ajouter colonne **"Email"**
- [ ] Ajouter colonne **"Horaires"**
- [ ] Ajouter colonne **"Latitude"** (coordonnées GPS)
- [ ] Ajouter colonne **"Longitude"** (coordonnées GPS)

---

## 🟡 IMPORTANT - Semaines 2-3

### Qualité des données
- [ ] Nettoyer les cartes fidélité "0" (clarifier leur signification)
- [ ] Compléter les champs "Nom adresse" vides
- [ ] Standardiser format code postal (5 chiffres)
- [ ] Mettre villes en MAJUSCULES

### Produits - Enrichissement
- [ ] Ajouter colonne **"Description"**
- [ ] Ajouter colonne **"Prix achat HT"** (pour calcul marges)
- [ ] Ajouter colonne **"Référence fournisseur"**
- [ ] Ajouter colonne **"URL image"** (optionnel)

### Transactions - Compléments
- [ ] Ajouter colonne **"Remise"** (montant ou %)
- [ ] Ajouter colonne **"Statut commande"** (Validée/Annulée)
- [ ] Ajouter colonne **"Code vendeur"** (optionnel)

---

## 🟢 SOUHAITABLE - Mois 1

### Nouveaux fichiers à créer
- [ ] **Objectifs.csv** (objectifs CA par mois/magasin)
- [ ] **Couts_magasins.csv** (charges par magasin)

### Magasins - Enrichissement
- [ ] Ajouter colonne **"Surface m²"**
- [ ] Ajouter colonne **"Manager"** (responsable magasin)
- [ ] Ajouter colonne **"Date ouverture"**

### Clients - Données calculées
- [ ] Ajouter colonne **"Date premier achat"**
- [ ] Ajouter colonne **"Date dernier achat"**
- [ ] Ajouter colonne **"CA total"**
- [ ] Ajouter colonne **"Nombre achats"**
- [ ] Ajouter colonne **"Canal préféré"** (Web/Magasin)
- [ ] Ajouter colonne **"Magasin préféré"**

---

## 🔧 TECHNIQUE

### Format fichiers
- [ ] Encodage **UTF-8 avec BOM**
- [ ] Séparateur `;` ✅ (OK actuel)
- [ ] Guillemets doubles `"` autour de tous les champs texte
- [ ] Pas de lignes vides
- [ ] Header toujours en ligne 1

### Nommage
- [ ] Renommer **"client.csv"** → **"clients.csv"** (pluriel)
- [ ] Renommer **"détail transactions.csv"** → **"transactions.csv"** (sans accents)
- [ ] Renommer **"Points de vente.csv"** → **"magasins.csv"**
- [ ] Renommer **"Produits.csv"** → **"produits.csv"** (minuscule)

### Livraison
- [ ] Structure dossier avec date: `Data_export_YYYY-MM-DD/`
- [ ] Fichiers de test fournis (échantillons 100-1000 lignes)
- [ ] Documentation README.txt avec changements
- [ ] Planning export quotidien automatisé

---

## ❓ QUESTIONS À CLARIFIER

### Identification ventes WEB
- [ ] Comment distinguez-vous actuellement Web vs Magasin?
  - Option A: Dépôt spécial "WEB"
  - Option B: Colonne canal_vente dans ERP
  - Option C: Préfixe facture (ex: WEB123456)
  - Option D: Table séparée commandes_web
  - **Réponse:** _____________________

### Contacts clients
- [ ] Les emails sont-ils dans une table séparée?
  - **Réponse:** _____________________
- [ ] Y a-t-il un flag "contact principal"?
  - **Réponse:** _____________________
- [ ] Base clients avec opt-in marketing tracé?
  - **Réponse:** _____________________

### Stock produits
- [ ] Stock agrégé tous magasins ou par magasin?
  - **Réponse:** _____________________
- [ ] Stock réel ou disponible (réel - réservé)?
  - **Réponse:** _____________________

### Export
- [ ] Taille totale fichiers OK pour export complet?
  - **Réponse:** _____________________
- [ ] Préférence export complet ou incrémental?
  - **Réponse:** _____________________
- [ ] Fréquence possible: Quotidien / Hebdo / Mensuel?
  - **Réponse:** _____________________

### GPS Magasins
- [ ] Coordonnées GPS déjà en base?
  - **Réponse:** _____________________
- [ ] Sinon, besoin géocodage externe?
  - **Réponse:** _____________________

---

## 📅 PLANNING

| Date | Étape | Responsable | Statut |
|------|-------|-------------|--------|
| J+2 | Réunion validation faisabilité | Nicolas + Équipe | ⏳ |
| J+7 | Livraison fichiers test | Nicolas | ⏳ |
| J+14 | Validation données test | Marceau | ⏳ |
| J+14 | Livraison colonnes critiques (Canal, Email, Nom produit) | Nicolas | ⏳ |
| J+21 | Livraison complète | Nicolas | ⏳ |
| J+30 | Automatisation export quotidien | Nicolas | ⏳ |

---

## 📊 PROGRESSION

```
Phase 1 - Colonnes critiques:  [ 0/13 ]  0%
Phase 2 - Enrichissement:      [ 0/15 ]  0%
Phase 3 - Optimisations:       [ 0/12 ]  0%

TOTAL:                         [ 0/40 ]  0%
```

---

## 📞 CONTACT

**Questions urgentes:**
- Marceau: [email/téléphone]
- Documentation détaillée: Voir fichiers `.md` dans le projet

---

## ✅ VALIDATION FINALE

Une fois tous les points cochés:
- [ ] Test import sur environnement de dev
- [ ] Validation échantillons par équipe analytics
- [ ] Mise en production
- [ ] Monitoring première semaine
- [ ] Rétrospective et ajustements

---

**Checklist créée le 30 janvier 2026**  
**Dernière mise à jour:** ___________  
**Statut global:** ⏳ En attente
