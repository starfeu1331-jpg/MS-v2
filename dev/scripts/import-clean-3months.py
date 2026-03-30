#!/usr/bin/env python3
"""
========================================
🔄 IMPORT PROPRE : 3 MOIS DE DONNÉES
========================================

Ce script :
1. ✅ Lit les transactions et filtre sur 3 derniers mois (Nov 2025 - Jan 2026)
2. ✅ Extrait uniquement les clients concernés par ces transactions
3. ✅ Extrait uniquement les produits référencés
4. ✅ Nettoie la BDD complètement
5. ✅ Importe les nouvelles données
6. ✅ Vérifie l'intégrité 2 fois

⚠️  ATTENTION : Ce script supprimera TOUTES les données actuelles !
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import sys

# Charger variables d'environnement
load_dotenv()

# Configuration
DATA_DIR = '/Users/marceau/Desktop/Data update/février 2026'
ENCODING = 'ISO-8859-1'
SEPARATOR = ';'

# Dates : 3 derniers mois (Novembre 2025 - Janvier 2026)
DATE_START = '2025-11-01'
DATE_END = '2026-02-01'  # Exclusif

print("""
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║       🔄  IMPORT PROPRE : 3 MOIS DE DONNÉES                 ║
║          (Novembre 2025 - Janvier 2026)                     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
""")

# ============================================================================
# ÉTAPE 1 : LECTURE ET FILTRAGE DES TRANSACTIONS
# ============================================================================

print("\n" + "="*80)
print("📊 ÉTAPE 1 : Lecture et filtrage des transactions")
print("="*80)

print(f"\n🔍 Lecture de lignevente.csv...")
transactions_file = os.path.join(DATA_DIR, 'lignevente.csv')

# Lire les transactions
df_transactions = pd.read_csv(
    transactions_file,
    encoding=ENCODING,
    sep=SEPARATOR,
    dtype={
        'N° Carte fidélité': str,
        'N° Facture client': str,
        'Dépôt': str,
        'N° Produit': str,
        'Quantité unitaire': str,
        'Prix vente net en devise société': str,
        'Mt T.T.C': str
    }
)

print(f"✅ {len(df_transactions):,} lignes lues")

# Afficher les colonnes
print(f"\n📝 Colonnes détectées ({len(df_transactions.columns)}):")
for i, col in enumerate(df_transactions.columns, 1):
    print(f"  {i:2d}. {col}")

# Convertir la date
print(f"\n🗓️  Conversion des dates...")
df_transactions['Date facture'] = pd.to_datetime(
    df_transactions['Date facture'],
    format='%Y-%m-%d',
    errors='coerce'
)

# Filtrer sur 3 mois
print(f"\n🔍 Filtrage : {DATE_START} → {DATE_END}...")
df_transactions = df_transactions[
    (df_transactions['Date facture'] >= DATE_START) &
    (df_transactions['Date facture'] < DATE_END)
]

print(f"✅ {len(df_transactions):,} transactions sur la période")

if len(df_transactions) == 0:
    print("\n❌ ERREUR : Aucune transaction sur la période !")
    print(f"   Vérifiez les dates dans lignevente.csv")
    sys.exit(1)

# Statistiques
print(f"\n📊 Statistiques période :")
print(f"  • Date min : {df_transactions['Date facture'].min()}")
print(f"  • Date max : {df_transactions['Date facture'].max()}")
print(f"  • Transactions : {len(df_transactions):,}")
print(f"  • Clients uniques : {df_transactions['N° Carte fidélité'].nunique():,}")
print(f"  • Produits uniques : {df_transactions['N° Produit'].nunique():,}")
print(f"  • Magasins uniques : {df_transactions['Dépôt'].nunique():,}")

# ============================================================================
# ÉTAPE 2 : EXTRACTION DES CLIENTS CONCERNÉS
# ============================================================================

print("\n" + "="*80)
print("👥 ÉTAPE 2 : Extraction des clients concernés")
print("="*80)

# Liste des cartes fidélité dans les transactions
cartes_concernees = set(df_transactions['N° Carte fidélité'].dropna().unique())
print(f"\n📋 {len(cartes_concernees):,} cartes fidélité uniques")

print(f"\n🔍 Lecture de Fichier_client_02-02-26 12.csv...")
clients_file = os.path.join(DATA_DIR, 'Fichier_client_02-02-26 12.csv')

# Lire les clients avec gestion encodage spécial + lignes mal formatées
try:
    df_clients = pd.read_csv(
        clients_file,
        encoding=ENCODING,
        sep=SEPARATOR,
        dtype=str,
        on_bad_lines='skip'  # Pandas >= 1.3
    )
except TypeError:
    # Pandas < 1.3
    df_clients = pd.read_csv(
        clients_file,
        encoding=ENCODING,
        sep=SEPARATOR,
        dtype=str,
        error_bad_lines=False,
        warn_bad_lines=True
    )

print(f"✅ {len(df_clients):,} clients lus")

# Afficher les colonnes brutes
print(f"\n📝 Colonnes brutes clients ({len(df_clients.columns)}):")
for i, col in enumerate(df_clients.columns, 1):
    print(f"  {i:2d}. '{col}'")

# Nettoyer les noms de colonnes (enlever caractèrescont de contrôle)
df_clients.columns = [col.strip() for col in df_clients.columns]

# Détecter la colonne de carte (commence par "N" et contient "carte" ou "fid")
carte_col = None
for col in df_clients.columns:
    col_lower = col.lower()
    if 'carte' in col_lower or 'fid' in col_lower:
        carte_col = col
        break

if carte_col is None:
    print("\n❌ ERREUR : Impossible de trouver la colonne 'N° Carte fidélité' !")
    print(f"   Colonnes disponibles : {df_clients.columns.tolist()}")
    sys.exit(1)

print(f"\n✅ Colonne carte identifiée : '{carte_col}'")

# Filtrer uniquement les clients concernés
df_clients['carte_clean'] = df_clients[carte_col].astype(str).str.strip()
cartes_concernees_str = {str(c).strip() for c in cartes_concernees}

df_clients_filtered = df_clients[df_clients['carte_clean'].isin(cartes_concernees_str)]

print(f"\n✅ {len(df_clients_filtered):,} clients filtrés (ayant des transactions sur la période)")

# ============================================================================
# ÉTAPE 3 : EXTRACTION DES PRODUITS CONCERNÉS
# ============================================================================

print("\n" + "="*80)
print("📦 ÉTAPE 3 : Extraction des produits concernés")
print("="*80)

# Liste des produits dans les transactions
produits_concernes = set(df_transactions['N° Produit'].dropna().unique())
print(f"\n📋 {len(produits_concernes):,} produits uniques dans les transactions")

print(f"\n🔍 Lecture de produits.csv...")
produits_file = os.path.join(DATA_DIR, 'produits.csv')

df_produits = pd.read_csv(
    produits_file,
    encoding=ENCODING,
    sep=SEPARATOR,
    dtype=str
)

print(f"✅ {len(df_produits):,} produits lus")

# Afficher les colonnes
print(f"\n📝 Colonnes produits ({len(df_produits.columns)}):")
for i, col in enumerate(df_produits.columns, 1):
    print(f"  {i:2d}. '{col}'")

# Nettoyer les noms de colonnes
df_produits.columns = [col.strip() for col in df_produits.columns]

# Détecter la colonne ID produit
produit_col = None
for col in df_produits.columns:
    col_lower = col.lower()
    if 'produit' in col_lower and ('n°' in col_lower or 'n' == col_lower[0]):
        produit_col = col
        break

if produit_col is None:
    print("\n❌ ERREUR : Impossible de trouver la colonne 'N° Produit' !")
    print(f"   Colonnes disponibles : {df_produits.columns.tolist()}")
    sys.exit(1)

print(f"\n✅ Colonne produit identifiée : '{produit_col}'")

# Filtrer uniquement les produits concernés
df_produits['id_clean'] = df_produits[produit_col].astype(str).str.strip()
produits_concernes_str = {str(p).strip() for p in produits_concernes}

df_produits_filtered = df_produits[df_produits['id_clean'].isin(produits_concernes_str)]

print(f"\n✅ {len(df_produits_filtered):,} produits filtrés (utilisés dans les transactions)")

# ============================================================================
# ÉTAPE 4 : MAPPING DES COLONNES VERS SCHÉMA BDD
# ============================================================================

print("\n" + "="*80)
print("🗺️  ÉTAPE 4 : Mapping des colonnes vers schéma BDD")
print("="*80)

print("\n" + "-"*80)
print("VÉRIFICATION 1/2 : MAPPING DES COLONNES")
print("-"*80)

# Mapping Clients CSV → BDD
CLIENT_MAPPING = {}
for idx, col in enumerate(df_clients.columns):
    col_lower = col.lower()
    
    if 'carte' in col_lower or idx == 0:
        CLIENT_MAPPING['carte'] = col
    elif 'nom' in col_lower and 'correspondant' in col_lower and 'pr' not in col_lower:
        CLIENT_MAPPING['nom'] = col
    elif 'pr' in col_lower and 'nom' in col_lower:
        CLIENT_MAPPING['prenom'] = col
    elif 'mail' in col_lower or 'ctronique' in col_lower:
        CLIENT_MAPPING['email'] = col
    elif 'phone' in col_lower or 't' in col_lower.replace('é', 'e') and 'phone' in col.lower():
        CLIENT_MAPPING['telephone'] = col
    elif 'date' in col_lower and 'cr' in col_lower:
        CLIENT_MAPPING['date_creation'] = col
    elif 'statut' in col_lower:
        CLIENT_MAPPING['statut'] = col
    elif 'validit' in col_lower:
        CLIENT_MAPPING['date_validite'] = col
    elif 'civilit' in col_lower:
        CLIENT_MAPPING['civilite'] = col
    elif 'naissance' in col_lower:
        CLIENT_MAPPING['date_naissance'] = col
    elif 'sexe' in col_lower:
        CLIENT_MAPPING['sexe'] = col
    elif 'nom' in col_lower and 'adresse' in col_lower:
        CLIENT_MAPPING['nom_adresse'] = col
    elif 'adresse' in col_lower and col.endswith('.1'):
        CLIENT_MAPPING['adresse_2'] = col
    elif 'adresse' in col_lower and '4' in col_lower:
        CLIENT_MAPPING['adresse_4'] = col
    elif 'adresse' in col_lower and 'adresse_' not in CLIENT_MAPPING.get('adresse', ''):
        CLIENT_MAPPING['adresse'] = col
    elif 'c.p' in col_lower or 'cp' in col_lower:
        CLIENT_MAPPING['cp'] = col
    elif 'ville' in col_lower:
        CLIENT_MAPPING['ville'] = col

print("\n✅ Mapping CLIENTS :")
for bdd_col, csv_col in sorted(CLIENT_MAPPING.items()):
    print(f"  • {bdd_col:20s} ← '{csv_col}'")

# Mapping Produits CSV → BDD
PRODUIT_MAPPING = {}
for idx, col in enumerate(df_produits.columns):
    col_lower = col.lower()
    
    if 'produit' in col_lower and ('n°' in col_lower or idx == 0):
        PRODUIT_MAPPING['id'] = col
    elif 'gnation' in col_lower and 'produit' in col_lower and idx == 1:
        PRODUIT_MAPPING['nom'] = col
    elif 'rence' in col_lower and 'interne' in col_lower:
        PRODUIT_MAPPING['reference_interne'] = col
    elif 'produit' in col_lower and 'web' in col_lower:
        PRODUIT_MAPPING['produit_web'] = col
    elif 'famille' in col_lower and 'sous' not in col_lower:
        PRODUIT_MAPPING['famille'] = col
    elif 'sous-famille' in col_lower and 'sous-sous' not in col_lower:
        PRODUIT_MAPPING['sous_famille'] = col
    elif 'sous-sous-famille' in col_lower and 'sous-sous-sous' not in col_lower:
        PRODUIT_MAPPING['sous_sous_famille'] = col
    elif 'ss' in col_lower and 'famille' in col_lower:
        PRODUIT_MAPPING['sous_sous_sous_famille'] = col

print("\n✅ Mapping PRODUITS :")
for bdd_col, csv_col in sorted(PRODUIT_MAPPING.items()):
    print(f"  • {bdd_col:25s} ← '{csv_col}'")

# Mapping Transactions CSV → BDD
TRANSACTION_MAPPING = {
    'facture': 'N° Facture client',
    'carte': 'N° Carte fidélité',
    'depot': 'Dépôt',
    'date': 'Date facture',
    'heure': 'Heure mouvement',
    'produit': 'N° Produit',
    'quantite': 'Quantité unitaire',
    'prix': 'Prix vente net en devise société',
    'montant_ttc': 'Mt T.T.C'
}

print("\n✅ Mapping TRANSACTIONS :")
for bdd_col, csv_col in sorted(TRANSACTION_MAPPING.items()):
    print(f"  • {bdd_col:15s} ← '{csv_col}'")

# ============================================================================
# ÉTAPE 5 : CONNEXION À LA BDD ET NETTOYAGE
# ============================================================================

print("\n" + "="*80)
print("🗄️  ÉTAPE 5 : Connexion à la BDD et nettoyage")
print("="*80)

DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print("\n❌ ERREUR : Variable DATABASE_URL non trouvée dans .env")
    sys.exit(1)

print(f"\n🔗 Connexion à la base de données...")

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    print(f"✅ Connexion établie")
except Exception as e:
    print(f"\n❌ ERREUR de connexion : {e}")
    sys.exit(1)

# Compter les données actuelles
print(f"\n📊 État actuel de la BDD :")
cur.execute("SELECT COUNT(*) FROM transactions")
trans_count = cur.fetchone()[0]
print(f"  • Transactions : {trans_count:,}")

cur.execute("SELECT COUNT(*) FROM clients")
clients_count = cur.fetchone()[0]
print(f"  • Clients : {clients_count:,}")

cur.execute("SELECT COUNT(*) FROM produits")
produits_count = cur.fetchone()[0]
print(f"  • Produits : {produits_count:,}")

# Demander confirmation
print(f"\n⚠️  ATTENTION : Vous allez supprimer TOUTES ces données !")
print(f"   Nouvelles données : {len(df_transactions):,} transactions, "
      f"{len(df_clients_filtered):,} clients, {len(df_produits_filtered):,} produits")

response = input("\n❓ Continuer ? (oui/non) : ")
if response.lower() not in ['oui', 'yes', 'o', 'y']:
    print("\n❌ Abandon")
    cur.close()
    conn.close()
    sys.exit(0)

# Nettoyage
print(f"\n🧹 Nettoyage de la BDD...")
print(f"  🗑️  Suppression des transactions...")
cur.execute("DELETE FROM transactions")
print(f"  ✅ {cur.rowcount:,} transactions supprimées")

print(f"  🗑️  Suppression des clients...")
cur.execute("DELETE FROM clients")
print(f"  ✅ {cur.rowcount:,} clients supprimés")

print(f"  🗑️  Suppression des produits...")
cur.execute("DELETE FROM produits")
print(f"  ✅ {cur.rowcount:,} produits supprimés")

# Note : on ne touche pas aux magasins car ils ne sont pas dans les nouveaux fichiers

conn.commit()
print(f"\n✅ BDD nettoyée")

# ============================================================================
# ÉTAPE 6 : IMPORT DES CLIENTS
# ============================================================================

print("\n" + "="*80)
print("👥 ÉTAPE 6 : Import des clients")
print("="*80)

print(f"\n📝 Préparation des données clients...")

# Préparer les données
clients_data = []
for _, row in df_clients_filtered.iterrows():
    client = {
        'carte': str(row.get(CLIENT_MAPPING.get('carte', ''), '')).strip(),
        'nom': str(row.get(CLIENT_MAPPING.get('nom', ''), '')).strip() or None,
        'prenom': str(row.get(CLIENT_MAPPING.get('prenom', ''), '')).strip() or None,
        'email': str(row.get(CLIENT_MAPPING.get('email', ''), '')).strip() or None,
        'telephone': str(row.get(CLIENT_MAPPING.get('telephone', ''), '')).strip() or None,
        'date_creation': str(row.get(CLIENT_MAPPING.get('date_creation', ''), '')).strip() or None,
        'statut': str(row.get(CLIENT_MAPPING.get('statut', ''), '')).strip() or None,
        'date_validite': str(row.get(CLIENT_MAPPING.get('date_validite', ''), '')).strip() or None,
        'civilite': str(row.get(CLIENT_MAPPING.get('civilite', ''), '')).strip() or None,
        'date_naissance': str(row.get(CLIENT_MAPPING.get('date_naissance', ''), '')).strip() or None,
        'sexe': str(row.get(CLIENT_MAPPING.get('sexe', ''), '')).strip() or None,
        'nom_adresse': str(row.get(CLIENT_MAPPING.get('nom_adresse', ''), '')).strip() or None,
        'adresse': str(row.get(CLIENT_MAPPING.get('adresse', ''), '')).strip() or None,
        'adresse_2': str(row.get(CLIENT_MAPPING.get('adresse_2', ''), '')).strip() or None,
        'adresse_4': str(row.get(CLIENT_MAPPING.get('adresse_4', ''), '')).strip() or None,
        'cp': str(row.get(CLIENT_MAPPING.get('cp', ''), '')).strip() or None,
        'ville': str(row.get(CLIENT_MAPPING.get('ville', ''), '')).strip() or None,
    }
    
    # Nettoyer les valeurs vides
    for key in list(client.keys()):
        if client[key] == '' or client[key] == 'nan' or client[key] == 'None':
            client[key] = None
    
    # Ne garder que si la carte est valide
    if client['carte'] and client['carte'] not in ['nan', 'None', '0']:
        clients_data.append(client)

print(f"✅ {len(clients_data):,} clients préparés")

# Insert en batch
print(f"\n💾 Insertion des clients dans la BDD...")

insert_query = """
    INSERT INTO clients (
        carte, nom, prenom, email, telephone, date_creation, statut,
        date_validite, civilite, date_naissance, sexe, nom_adresse,
        adresse, adresse_2, adresse_4, cp, ville
    ) VALUES (
        %(carte)s, %(nom)s, %(prenom)s, %(email)s, %(telephone)s,
        %(date_creation)s, %(statut)s, %(date_validite)s, %(civilite)s,
        %(date_naissance)s, %(sexe)s, %(nom_adresse)s, %(adresse)s,
        %(adresse_2)s, %(adresse_4)s, %(cp)s, %(ville)s
    )
    ON CONFLICT (carte) DO UPDATE SET
        nom = EXCLUDED.nom,
        prenom = EXCLUDED.prenom,
        email = EXCLUDED.email,
        telephone = EXCLUDED.telephone
"""

execute_batch(cur, insert_query, clients_data, page_size=1000)
conn.commit()

print(f"✅ {len(clients_data):,} clients importés")

# ============================================================================
# ÉTAPE 7 : IMPORT DES PRODUITS
# ============================================================================

print("\n" + "="*80)
print("📦 ÉTAPE 7 : Import des produits")
print("="*80)

print(f"\n📝 Préparation des données produits...")

# Préparer les données
produits_data = []
for _, row in df_produits_filtered.iterrows():
    produit = {
        'id': str(row.get(PRODUIT_MAPPING.get('id', ''), '')).strip(),
        'nom': str(row.get(PRODUIT_MAPPING.get('nom', ''), '')).strip() or None,
        'reference_interne': str(row.get(PRODUIT_MAPPING.get('reference_interne', ''), '')).strip() or None,
        'produit_web': str(row.get(PRODUIT_MAPPING.get('produit_web', ''), '')).strip() or None,
        'famille': str(row.get(PRODUIT_MAPPING.get('famille', ''), '')).strip() or 'Inconnu',
        'sous_famille': str(row.get(PRODUIT_MAPPING.get('sous_famille', ''), '')).strip() or None,
        'sous_sous_famille': str(row.get(PRODUIT_MAPPING.get('sous_sous_famille', ''), '')).strip() or None,
        'sous_sous_sous_famille': str(row.get(PRODUIT_MAPPING.get('sous_sous_sous_famille', ''), '')).strip() or None,
    }
    
    # Nettoyer les valeurs vides
    for key in list(produit.keys()):
        if produit[key] == '' or produit[key] == 'nan' or produit[key] == 'None':
            if key == 'famille':
                produit[key] = 'Inconnu'
            else:
                produit[key] = None
    
    # Ne garder que si l'ID est valide
    if produit['id'] and produit['id'] not in ['nan', 'None', '0']:
        produits_data.append(produit)

print(f"✅ {len(produits_data):,} produits préparés")

# Insert en batch
print(f"\n💾 Insertion des produits dans la BDD...")

insert_query = """
    INSERT INTO produits (
        id, nom, reference_interne, produit_web, famille,
        sous_famille, sous_sous_famille, sous_sous_sous_famille
    ) VALUES (
        %(id)s, %(nom)s, %(reference_interne)s, %(produit_web)s,
        %(famille)s, %(sous_famille)s, %(sous_sous_famille)s,
        %(sous_sous_sous_famille)s
    )
    ON CONFLICT (id) DO UPDATE SET
        nom = EXCLUDED.nom,
        reference_interne = EXCLUDED.reference_interne,
        produit_web = EXCLUDED.produit_web
"""

execute_batch(cur, insert_query, produits_data, page_size=1000)
conn.commit()

print(f"✅ {len(produits_data):,} produits importés")

# ============================================================================
# ÉTAPE 8 : IMPORT DES TRANSACTIONS
# ============================================================================

print("\n" + "="*80)
print("💰 ÉTAPE 8 : Import des transactions")
print("="*80)

print(f"\n📝 Préparation des données transactions...")

# Préparer les données
transactions_data = []
for _, row in df_transactions.iterrows():
    # Nettoyer les valeurs numériques
    try:
        quantite = float(str(row['Quantité unitaire']).replace(',', '.'))
    except:
        quantite = 1.0
    
    try:
        prix = float(str(row['Prix vente net en devise société']).replace(',', '.'))
    except:
        prix = 0.0
    
    try:
        montant_ttc = float(str(row['Mt T.T.C']).replace(',', '.'))
    except:
        montant_ttc = None
    
    # CA = prix * quantité (ou montant TTC si disponible)
    ca = montant_ttc if montant_ttc else (prix * quantite)
    
    transaction = {
        'facture': str(row['N° Facture client']),
        'carte': str(row['N° Carte fidélité']),
        'depot': str(row['Dépôt']),
        'date': row['Date facture'].strftime('%Y-%m-%d'),
        'heure': int(row.get('Heure mouvement', 0)) if pd.notna(row.get('Heure mouvement')) else None,
        'produit': str(row['N° Produit']),
        'quantite': quantite,
        'prix': prix,
        'montant_ttc': montant_ttc,
        'ca': ca,
        'is_web': False,  # Par défaut magasin, sera mis à jour si besoin
        'ville': None,
        'cp': None
    }
    
    transactions_data.append(transaction)

print(f"✅ {len(transactions_data):,} transactions préparées")

# Insert en batch
print(f"\n💾 Insertion des transactions dans la BDD (cela peut prendre quelques minutes)...")

insert_query = """
    INSERT INTO transactions (
        facture, carte, depot, date, heure, produit, quantite,
        prix, montant_ttc, ca, is_web, ville, cp
    ) VALUES (
        %(facture)s, %(carte)s, %(depot)s, %(date)s, %(heure)s,
        %(produit)s, %(quantite)s, %(prix)s, %(montant_ttc)s,
        %(ca)s, %(is_web)s, %(ville)s, %(cp)s
    )
"""

# Insérer par lots de 1000
batch_size = 1000
for i in range(0, len(transactions_data), batch_size):
    batch = transactions_data[i:i+batch_size]
    execute_batch(cur, insert_query, batch, page_size=batch_size)
    conn.commit()
    print(f"  ✅ {min(i+batch_size, len(transactions_data)):,} / {len(transactions_data):,} transactions importées")

print(f"✅ {len(transactions_data):,} transactions importées")

# ============================================================================
# ÉTAPE 9 : VÉRIFICATION INTÉGRITÉ (1/2)
# ============================================================================

print("\n" + "="*80)
print("🔍 ÉTAPE 9 : Vérification intégrité (1/2)")
print("="*80)

print(f"\n📊 Comptage BDD après import :")

cur.execute("SELECT COUNT(*) FROM transactions")
trans_count_after = cur.fetchone()[0]
print(f"  • Transactions : {trans_count_after:,}")

cur.execute("SELECT COUNT(*) FROM clients")
clients_count_after = cur.fetchone()[0]
print(f"  • Clients : {clients_count_after:,}")

cur.execute("SELECT COUNT(*) FROM produits")
produits_count_after = cur.fetchone()[0]
print(f"  • Produits : {produits_count_after:,}")

# Vérifications
print(f"\n✅ Vérification 1/2 - Comptages :")
assert trans_count_after == len(transactions_data), f"❌ Transactions : {trans_count_after} ≠ {len(transactions_data)}"
print(f"  ✅ Transactions : {trans_count_after:,} = {len(transactions_data):,}")

assert clients_count_after == len(clients_data), f"❌ Clients : {clients_count_after} ≠ {len(clients_data)}"
print(f"  ✅ Clients : {clients_count_after:,} = {len(clients_data):,}")

assert produits_count_after == len(produits_data), f"❌ Produits : {produits_count_after} ≠ {len(produits_data)}"
print(f"  ✅ Produits : {produits_count_after:,} = {len(produits_data):,}")

# ============================================================================
# ÉTAPE 10 : VÉRIFICATION INTÉGRITÉ (2/2)
# ============================================================================

print("\n" + "="*80)
print("🔍 ÉTAPE 10 : Vérification intégrité (2/2)")
print("="*80)

print(f"\n🔗 Vérification des relations :")

# Clients manquants
cur.execute("""
    SELECT COUNT(DISTINCT t.carte)
    FROM transactions t
    LEFT JOIN clients c ON t.carte = c.carte
    WHERE c.carte IS NULL
""")
missing_clients = cur.fetchone()[0]
print(f"  • Clients manquants : {missing_clients}")
if missing_clients > 0:
    print(f"    ⚠️  {missing_clients} cartes dans transactions mais pas dans clients")

# Produits manquants
cur.execute("""
    SELECT COUNT(DISTINCT t.produit)
    FROM transactions t
    LEFT JOIN produits p ON t.produit = p.id
    WHERE p.id IS NULL
""")
missing_produits = cur.fetchone()[0]
print(f"  • Produits manquants : {missing_produits}")
if missing_produits > 0:
    print(f"    ⚠️  {missing_produits} produits dans transactions mais pas dans produits")

# Statistiques finales
print(f"\n📊 Statistiques finales :")

cur.execute("""
    SELECT
        DATE_TRUNC('month', date) as mois,
        COUNT(*) as nb_transactions,
        SUM(ca) as ca_total,
        COUNT(DISTINCT carte) as nb_clients
    FROM transactions
    GROUP BY DATE_TRUNC('month', date)
    ORDER BY mois
""")

for row in cur.fetchall():
    mois, nb_trans, ca, nb_clients = row
    print(f"  • {mois.strftime('%Y-%m')} : {nb_trans:,} trans, {ca:,.2f}€, {nb_clients:,} clients")

# Vérifier colonnes clients avec données
print(f"\n📊 Complétude des données clients :")

cur.execute("""
    SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN nom IS NOT NULL AND nom != '' THEN 1 END) as avec_nom,
        COUNT(CASE WHEN prenom IS NOT NULL AND prenom != '' THEN 1 END) as avec_prenom,
        COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as avec_email,
        COUNT(CASE WHEN telephone IS NOT NULL AND telephone != '' THEN 1 END) as avec_telephone
    FROM clients
""")

total, avec_nom, avec_prenom, avec_email, avec_telephone = cur.fetchone()
print(f"  • Total clients : {total:,}")
print(f"  • Avec nom : {avec_nom:,} ({avec_nom/total*100:.1f}%)")
print(f"  • Avec prénom : {avec_prenom:,} ({avec_prenom/total*100:.1f}%)")
print(f"  • Avec email : {avec_email:,} ({avec_email/total*100:.1f}%)")
print(f"  • Avec téléphone : {avec_telephone:,} ({avec_telephone/total*100:.1f}%)")

# ============================================================================
# FIN
# ============================================================================

cur.close()
conn.close()

print(f"\n" + "="*80)
print(f"✅ IMPORT TERMINÉ AVEC SUCCÈS !")
print(f"="*80)

print(f"""
📊 Résumé :
  • {trans_count_after:,} transactions importées
  • {clients_count_after:,} clients importés
  • {produits_count_after:,} produits importés
  • Période : {DATE_START} → {DATE_END}
  • Clients manquants : {missing_clients}
  • Produits manquants : {missing_produits}

🚀 Votre application Magic Système est prête avec des données propres !
""")
