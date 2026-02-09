#!/usr/bin/env python3
"""
🔄 IMPORT PROPRE : 3 MOIS DE DONNÉES (VERSION CORRIGÉE)
========================================================

Ce script ignore l'en-tête corrompu du fichier clients et utilise
un mapping fixed basé sur l'analyse des données réelles.
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch
from datetime import datetime
import os
from dotenv import load_dotenv
import sys

load_dotenv()

DATA_DIR = '/Users/marceau/Desktop/Data update/février 2026'
ENCODING = 'ISO-8859-1'
SEPARATOR = ';'

# **3 derniers mois : Novembre 2025 - Janvier 2026**
DATE_START = '2025-11-01'
DATE_END = '2026-02-01'

print("""
╔══════════════════════════════════════════════════════════════╗
║      🔄  IMPORT PROPRE : 3 MOIS DE DONNÉES (FIXED)          ║
║          (Novembre 2025 - Janvier 2026)                     ║
╚══════════════════════════════════════════════════════════════╝
""")

# ============================================================================
# ÉTAPE 1 : TRANSACTIONS
# ============================================================================

print("\n" + "="*80)
print("📊 ÉTAPE 1/8 : Lecture et filtrage des transactions")
print("="*80)

print(f"\n🔍 Lecture de lignevente.csv...")
df_transactions = pd.read_csv(
    os.path.join(DATA_DIR, 'lignevente.csv'),
    encoding=ENCODING,
    sep=SEPARATOR,
    dtype={
        'N° Carte fidélité': str,
        'N° Facture client': str,
        'Dépôt': str,
        'N° Produit': str
    }
)

print(f"✅ {len(df_transactions):,} lignes lues")

# Convertir et filtrer dates
df_transactions['Date facture'] = pd.to_datetime(
    df_transactions['Date facture'],
    format='%Y-%m-%d',
    errors='coerce'
)

df_transactions = df_transactions[
    (df_transactions['Date facture'] >= DATE_START) &
    (df_transactions['Date facture'] < DATE_END)
]

print(f"✅ {len(df_transactions):,} transactions (Nov-Jan)")

cartes_concernees = set(df_transactions['N° Carte fidélité'].dropna().astype(str).str.strip().unique())
produits_concernes = set(df_transactions['N° Produit'].dropna().astype(str).str.strip().unique())

print(f"   • {len(cartes_concernees):,} clients uniques")
print(f"   • {len(produits_concernes):,} produits uniques")

# ============================================================================
# ÉTAPE 2 : CLIENTS (AVEC MAPPING FIXE)
# ============================================================================

print("\n" + "="*80)
print("👥 ÉTAPE 2/8 : Lecture des clients (en télécharger l'en-tête corrompu)")
print("="*80)

# **Noms de colonnes corrects basés sur l'analyse des données**
CLIENTS_COLS = [
    'carte',           # [0]
    'nom',             # [1]
    'prenom',          # [2]
    'date_creation',   # [3]  
    'statut',          # [4]
    'date_validite',   # [5]
    'civilite',        # [6]
    'date_naissance',  # [7]
    'sexe',            # [8]
    'email',           # [9] ← CORRIGÉ : L'email est ICI !
    'telephone',       # [10]
    'adresse_complement', # [11]
    'adresse_num',     # [12]
    'adresse',         # [13]
    'adresse_2',       # [14]
    'cp',              # [15]
    'ville'            # [16]
]

print(f"\n🔍 Lecture avec mapping fixed (17 colonnes)...")

df_clients = pd.read_csv(
    os.path.join(DATA_DIR, 'Fichier_client_02-02-26 12.csv'),
    encoding=ENCODING,
    sep=SEPARATOR,
    dtype=str,
    names=CLIENTS_COLS,  # ✅ Ignorer l'en-tête, utiliser nos noms
    skiprows=1,  # Sauter la ligne d'en-tête corrompue
    on_bad_lines='skip'
)

print(f"✅ {len(df_clients):,} clients lus")

# Filtrer uniquement cartes concernées
df_clients['carte'] = df_clients['carte'].astype(str).str.strip()
df_clients_filtered = df_clients[df_clients['carte'].isin(cartes_concernees)]

print(f"✅ {len(df_clients_filtered):,} clients filtrés (avec transactions)")

# ============================================================================
# ÉTAPE 3 : PRODUITS (AVEC MAPPING FIXE)
# ============================================================================

print("\n" + "="*80)
print("📦 ÉTAPE 3/8 : Lecture des produits")
print("="*80)

PRODUITS_COLS = [
    'id',                       # [0] N° Produit
    'nom',                      # [1] Désignation
    'nom_alt',                  # [2] Désignation alt (souvent vide)
    'reference_interne',        # [3]
    'famille',                  # [4]
    'sous_famille',             # [5]
    'sous_sous_famille',        # [6]
    'sous_sous_sous_famille',   # [7]
    'produit_web'               # [8]
]

df_produits = pd.read_csv(
    os.path.join(DATA_DIR, 'produits.csv'),
    encoding=ENCODING,
    sep=SEPARATOR,
    dtype=str,
    names=PRODUITS_COLS,
    skiprows=1
)

print(f"✅ {len(df_produits):,} produits lus")

df_produits['id'] = df_produits['id'].astype(str).str.strip()
df_produits_filtered = df_produits[df_produits['id'].isin(produits_concernes)]

print(f"✅ {len(df_produits_filtered):,} produits filtrés (utilisés)")

# ============================================================================
# ÉTAPE 4 : CONNEXION BDD
# ============================================================================

print("\n" + "="*80)
print("🗄️  ÉTAPE 4/8 : Connexion à la BDD")
print("="*80)

try:
    conn = psycopg2.connect(os.getenv('DATABASE_URL'))
    cur = conn.cursor()
    print(f"✅ Connexion établie")
except Exception as e:
    print(f"\n❌ ERREUR : {e}")
    sys.exit(1)

# État actuel
cur.execute("SELECT COUNT(*) FROM transactions")
print(f"\n📊 État actuel BDD :")
print(f"  • Transactions : {cur.fetchone()[0]:,}")
cur.execute("SELECT COUNT(*) FROM clients")
print(f"  • Clients : {cur.fetchone()[0]:,}")
cur.execute("SELECT COUNT(*) FROM produits")
print(f"  • Produits : {cur.fetchone()[0]:,}")

print(f"\n⚠️  IMPORT : {len(df_transactions):,} transactions, "
      f"{len(df_clients_filtered):,} clients, {len(df_produits_filtered):,} produits")

# Auto-continue pour réimport (BDD déjà vide)
print("✅ Démarrage automatique de l'import...")

# ============================================================================
# ÉTAPE 5 : NETTOYAGE BDD
# ============================================================================

print("\n" + "="*80)
print("🧹 ÉTAPE 5/8 : Nettoyage de la BDD")
print("="*80)

cur.execute("DELETE FROM transactions")
print(f"✅ {cur.rowcount:,} transactions supprimées")

cur.execute("DELETE FROM clients")
print(f"✅ {cur.rowcount:,} clients supprimés")

cur.execute("DELETE FROM produits")
print(f"✅ {cur.rowcount:,} produits supprimés")

conn.commit()

# ============================================================================
# ÉTAPE 6 : IMPORT CLIENTS
# ============================================================================

print("\n" + "="*80)
print("👥 ÉTAPE 6/8 : Import des clients")
print("="*80)

clients_data = []
for _, row in df_clients_filtered.iterrows():
    client = {
        'carte': row['carte'].strip(),
        'nom': row['nom'].strip() if pd.notna(row['nom']) and row['nom'].strip() else None,
        'prenom': row['prenom'].strip() if pd.notna(row['prenom']) and row['prenom'].strip() else None,
        'email': row['email'].strip() if pd.notna(row['email']) and row['email'].strip() else None,
        'telephone': row['telephone'].strip() if pd.notna(row['telephone']) and row['telephone'].strip() and row['telephone'].strip() != 'N' else None,
        'date_creation': row['date_creation'] if pd.notna(row['date_creation']) and row['date_creation'].strip() else None,
        'statut': row['statut'].strip() if pd.notna(row['statut']) and row['statut'].strip() else None,
        'date_validite': row['date_validite'] if pd.notna(row['date_validite']) and row['date_validite'].strip() else None,
        'civilite': row['civilite'].strip() if pd.notna(row['civilite']) and row['civilite'].strip() else None,
        'date_naissance': row['date_naissance'] if pd.notna(row['date_naissance']) and row['date_naissance'].strip() else None,
        'sexe': row['sexe'].strip() if pd.notna(row['sexe']) and row['sexe'].strip() else None,
        'nom_adresse': row['adresse_complement'].strip() if pd.notna(row['adresse_complement']) and row['adresse_complement'].strip() else None,
        'adresse': row['adresse'].strip() if pd.notna(row['adresse']) and row['adresse'].strip() else None,
        'adresse_2': row['adresse_2'].strip() if pd.notna(row['adresse_2']) and row['adresse_2'].strip() else None,
        'adresse_4': None,  # Pas dans le fichier
        'cp': row['cp'].strip() if pd.notna(row['cp']) and row['cp'].strip() else None,
        'ville': row['ville'].strip() if pd.notna(row['ville']) and row['ville'].strip() else None
    }
    
    if client['carte'] and client['carte'] not in ['0', 'nan', 'None']:
        clients_data.append(client)

print(f"✅ {len(clients_data):,} clients préparés")

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
    ON CONFLICT (carte) DO NOTHING
"""

execute_batch(cur, insert_query, clients_data, page_size=1000)
conn.commit()
print(f"✅ {len(clients_data):,} clients importés")

# ============================================================================
# ÉTAPE 7 : IMPORT PRODUITS
# ============================================================================

print("\n" + "="*80)
print("📦 ÉTAPE 7/8 : Import des produits")
print("="*80)

produits_data = []
for _, row in df_produits_filtered.iterrows():
    produit = {
        'id': row['id'].strip(),
        'nom': row['nom'].strip() if pd.notna(row['nom']) and row['nom'].strip() else None,
        'reference_interne': row['reference_interne'].strip() if pd.notna(row['reference_interne']) and row['reference_interne'].strip() else None,
        'produit_web': row['produit_web'].strip() if pd.notna(row['produit_web']) and row['produit_web'].strip() else None,
        'famille': row['famille'].strip() if pd.notna(row['famille']) and row['famille'].strip() else 'Inconnu',
        'sous_famille': row['sous_famille'].strip() if pd.notna(row['sous_famille']) and row['sous_famille'].strip() else None,
        'sous_sous_famille': row['sous_sous_famille'].strip() if pd.notna(row['sous_sous_famille']) and row['sous_sous_famille'].strip() else None,
        'sous_sous_sous_famille': row['sous_sous_sous_famille'].strip() if pd.notna(row['sous_sous_sous_famille']) and row['sous_sous_sous_famille'].strip() else None
    }
    
    if produit['id'] and produit['id'] not in ['0', 'nan', 'None']:
        produits_data.append(produit)

print(f"✅ {len(produits_data):,} produits préparés")

insert_query = """
    INSERT INTO produits (
        id, nom, reference_interne, produit_web, famille,
        sous_famille, sous_sous_famille, sous_sous_sous_famille
    ) VALUES (
        %(id)s, %(nom)s, %(reference_interne)s, %(produit_web)s,
        %(famille)s, %(sous_famille)s, %(sous_sous_famille)s,
        %(sous_sous_sous_famille)s
    )
    ON CONFLICT (id) DO NOTHING
"""

execute_batch(cur, insert_query, produits_data, page_size=1000)
conn.commit()
print(f"✅ {len(produits_data):,} produits importés")

# ============================================================================
# ÉTAPE 8 : IMPORT TRANSACTIONS
# ============================================================================

print("\n" + "="*80)
print("💰 ÉTAPE 8/8 : Import des transactions")
print("="*80)

transactions_data = []
for _, row in df_transactions.iterrows():
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
    
    ca = montant_ttc if montant_ttc else (prix * quantite)
    
    transactions_data.append({
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
        'is_web': False,
        'ville': None,
        'cp': None
    })

print(f"✅ {len(transactions_data):,} transactions préparées")

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

print(f"\n💾 Insertion par lots de 2000...")
batch_size = 2000
for i in range(0, len(transactions_data), batch_size):
    batch = transactions_data[i:i+batch_size]
    execute_batch(cur, insert_query, batch, page_size=batch_size)
    conn.commit()
    pct = (i+len(batch))/len(transactions_data)*100
    print(f"  ✅ {i+len(batch):,} / {len(transactions_data):,} ({pct:.1f}%)")

print(f"✅ {len(transactions_data):,} transactions importées")

# ============================================================================
# VÉRIFICATION FINALE
# ============================================================================

print("\n" + "="*80)
print("🔍 VÉRIFICATION FINALE")
print("="*80)

cur.execute("SELECT COUNT(*) FROM transactions")
trans_final = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM clients")
clients_final = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM produits")
produits_final = cur.fetchone()[0]

print(f"\n📊 BDD FINALE :")
print(f"  • Transactions : {trans_final:,}")
print(f"  • Clients : {clients_final:,}")
print(f"  • Produits : {produits_final:,}")

# Complétude clients
cur.execute("""
    SELECT
        COUNT(CASE WHEN nom IS NOT NULL AND nom != '' THEN 1 END)::int,
        COUNT(CASE WHEN prenom IS NOT NULL AND prenom != '' THEN 1 END)::int,
        COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END)::int,
        COUNT(CASE WHEN telephone IS NOT NULL AND telephone != '' THEN 1 END)::int
    FROM clients
""")
avec_nom, avec_prenom, avec_email, avec_tel = cur.fetchone()

print(f"\n📊 Complétude clients :")
print(f"  • Avec nom : {avec_nom:,} ({avec_nom/clients_final*100:.1f}%)")
print(f"  • Avec prénom : {avec_prenom:,} ({avec_prenom/clients_final*100:.1f}%)")
print(f"  • Avec email : {avec_email:,} ({avec_email/clients_final*100:.1f}%)")
print(f"  • Avec téléphone : {avec_tel:,} ({avec_tel/clients_final*100:.1f}%)")

# Stats par mois
print(f"\n📊 Répartition mensuelle :")
cur.execute("""
    SELECT
        TO_CHAR(date, 'YYYY-MM') as mois,
        COUNT(*) as nb_trans,
        SUM(ca) as ca_total,
        COUNT(DISTINCT carte) as nb_clients
    FROM transactions
    GROUP BY TO_CHAR(date, 'YYYY-MM')
    ORDER BY mois
""")

for mois, nb_trans, ca, nb_clients in cur.fetchall():
    print(f"  • {mois} : {nb_trans:, 10} trans, {ca:15,.2f}€, {nb_clients:6,} clients")

cur.close()
conn.close()

print(f"\n" + "="*80)
print(f"✅ IMPORT TERMINÉ AVEC SUCCÈS !")
print(f"="*80)

print(f"""
🎉 Magic Système est prêt avec des données propres !

📊 Résumé final :
  • {trans_final:,} transactions (Nov-Jan 2026)
  • {clients_final:,} clients actifs
  • {produits_final:,} produits utilisés
  • {avec_nom:,} clients avec nom/prénom
  • {avec_email:,} clients avec email
  • {avec_tel:,} clients avec téléphone

🚀 Vous pouvez maintenant utiliser l'application !
""")
