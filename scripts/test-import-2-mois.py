#!/usr/bin/env python3
"""
SCRIPT DE TEST - Import seulement 2 derniers mois
Pour tester les nouvelles colonnes sans saturer Neon (limite 500MB)
"""
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import os
from datetime import datetime, timedelta

# Lire DATABASE_URL depuis .env
DATABASE_URL = None
with open('.env', 'r') as f:
    for line in f:
        if line.startswith('DATABASE_URL='):
            DATABASE_URL = line.split('=', 1)[1].strip().strip('"')
            break

if not DATABASE_URL:
    print("❌ DATABASE_URL non trouvé dans .env")
    exit(1)

DATA_DIR = '/Users/marceau/Desktop/test data/decor-analytics/data/nouveaux/fevrier2026'

def clean_string(value):
    if pd.isna(value) or value == '':
        return None
    return str(value).strip()

def clean_float(value):
    if pd.isna(value):
        return 0.0
    if isinstance(value, str):
        value = value.replace(',', '.')
    try:
        return float(value)
    except:
        return 0.0

print("="*80)
print("🧪 SCRIPT DE TEST - Import 2 derniers mois SEULEMENT")
print("="*80)
print("\n⚠️  Ce script importe UNIQUEMENT les données récentes pour:")
print("   • Tester les nouvelles colonnes")
print("   • Vérifier que ça fonctionne avec Neon")
print("   • Ne pas dépasser la limite de 500MB")
print("\n📅 Période: Décembre 2025 + Janvier 2026 (environ)")

# Date limite : 2 mois avant aujourd'hui
date_limite = datetime(2025, 12, 1)
print(f"   → Transactions depuis: {date_limite.strftime('%Y-%m-%d')}")

# input("\n⏸️  Appuyez sur Entrée pour continuer (ou Ctrl+C pour annuler)...")

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# ============================================================================
# 1. ANALYSER LA TAILLE DES DONNÉES
# ============================================================================
print("\n" + "="*80)
print("📊 ANALYSE DE LA TAILLE DES DONNÉES")
print("="*80)

# Transactions
print("\n🎫 Fichier lignevente.csv...")
df_trans_sample = pd.read_csv(
    f'{DATA_DIR}/lignevente.csv',
    sep=';',
    encoding='ISO-8859-1',
    nrows=1000
)
total_rows = sum(1 for _ in open(f'{DATA_DIR}/lignevente.csv', 'rb')) - 1
print(f"   Total lignes: {total_rows:,}")

# Filtrer par date
df_trans_all = pd.read_csv(
    f'{DATA_DIR}/lignevente.csv',
    sep=';',
    encoding='ISO-8859-1'
)
df_trans_all['date_parsed'] = pd.to_datetime(df_trans_all.iloc[:, 3], format='%Y-%m-%d', errors='coerce')
df_recent = df_trans_all[df_trans_all['date_parsed'] >= date_limite]
print(f"   Lignes après {date_limite.strftime('%Y-%m-%d')}: {len(df_recent):,}")
print(f"   → Réduction: {100 - (len(df_recent)/len(df_trans_all)*100):.1f}%")

if len(df_recent) > 100000:
    print(f"\n   ⚠️  ATTENTION: {len(df_recent):,} lignes = toujours beaucoup !")
    print("   → Import automatique avec 2 mois de données")
    # response = input("   > ")
    # if response.lower() == 'o':
    #     date_limite = datetime(2026, 1, 1)
    #     df_recent = df_trans_all[df_trans_all['date_parsed'] >= date_limite]
    #     print(f"   → Nouvelles données: {len(df_recent):,} lignes (depuis {date_limite.strftime('%Y-%m-%d')})")

# Clients concernés
cartes_recentes = set(df_recent.iloc[:, 0].dropna().astype(str))
print(f"\n👥 Clients concernés: {len(cartes_recentes):,}")

# Produits concernés
produits_recents = set(df_recent.iloc[:, 5].dropna().astype(str))
print(f"📦 Produits concernés: {len(produits_recents):,}")

# ============================================================================
# 2. IMPORT CLIENTS (seulement ceux concernés)
# ============================================================================
print("\n" + "="*80)
print("👥 IMPORT CLIENTS (seulement ceux avec transactions récentes)")
print("="*80)

df_clients = pd.read_csv(
    f'{DATA_DIR}/Fichier_client_02-02-26 12.csv',
    sep=';',
    encoding='ISO-8859-1',
    header=None,  # Header cassé, on l'ignore
    skiprows=1,   # Skip le header
    low_memory=False,
    on_bad_lines='skip'
)

values = []
imported = 0
for _, row in df_clients.iterrows():
    carte = clean_string(row.iloc[0])
    if not carte or carte == '0' or carte not in cartes_recentes:
        continue
    
    # ORDRE TABLE: carte, date_creation, date_validite, statut, civilite, sexe, date_naissance,
    #              cp, ville, nom_adresse, adresse, adresse_2, adresse_4,
    #              nom, prenom, email, telephone
    
    values.append((
        carte,                      # carte
        clean_string(row.iloc[3]),  # date_creation
        clean_string(row.iloc[5]),  # date_validite
        clean_string(row.iloc[4]),  # statut
        clean_string(row.iloc[6]),  # civilite
        clean_string(row.iloc[8]),  # sexe
        clean_string(row.iloc[7]),  # date_naissance
        clean_string(row.iloc[15]), # cp
        clean_string(row.iloc[16]), # ville
        clean_string(row.iloc[11]), # nom_adresse
        clean_string(row.iloc[12]), # adresse
        clean_string(row.iloc[13]), # adresse_2
        clean_string(row.iloc[14]), # adresse_4
        clean_string(row.iloc[1]),  # nom ⭐
        clean_string(row.iloc[2]),  # prenom ⭐
        clean_string(row.iloc[9]),  # email ⭐
        clean_string(row.iloc[10]), # telephone ⭐
    ))
    
    if len(values) >= 1000:
        execute_values(
            cur,
            """
            INSERT INTO clients (
                carte, date_creation, date_validite, statut, civilite, sexe, date_naissance,
                cp, ville, nom_adresse, adresse, adresse_2, adresse_4,
                nom, prenom, email, telephone
            )
            VALUES %s
            ON CONFLICT (carte) DO UPDATE SET
                nom = EXCLUDED.nom,
                prenom = EXCLUDED.prenom,
                email = EXCLUDED.email,
                telephone = EXCLUDED.telephone,
                cp = EXCLUDED.cp,
                ville = EXCLUDED.ville
            """,
            values
        )
        conn.commit()
        imported += len(values)
        values = []
        print(f"   Importé: {imported:,} clients...")

if values:
    execute_values(
        cur,
        """
        INSERT INTO clients (
            carte, date_creation, date_validite, statut, civilite, sexe, date_naissance,
            cp, ville, nom_adresse, adresse, adresse_2, adresse_4,
            nom, prenom, email, telephone
        )
        VALUES %s
        ON CONFLICT (carte) DO UPDATE SET
            nom = EXCLUDED.nom,
            prenom = EXCLUDED.prenom,
            email = EXCLUDED.email,
            telephone = EXCLUDED.telephone,
            cp = EXCLUDED.cp,
            ville = EXCLUDED.ville
        """,
        values
    )
    conn.commit()
    imported += len(values)

print(f"✅ {imported:,} clients importés")

# ============================================================================
# 3. IMPORT PRODUITS (seulement ceux concernés)
# ============================================================================
print("\n" + "="*80)
print("📦 IMPORT PRODUITS (seulement ceux avec transactions récentes)")
print("="*80)

df_produits = pd.read_csv(
    f'{DATA_DIR}/produits.csv',
    sep=';',
    encoding='ISO-8859-1',
    low_memory=False
)

values = []
imported = 0
for _, row in df_produits.iterrows():
    prod_id = clean_string(row.iloc[0])
    if not prod_id or prod_id == '0' or prod_id not in produits_recents:
        continue
    
    # Famille est obligatoire (NOT NULL dans schema)
    famille = clean_string(row.iloc[4]) if len(row) > 4 and clean_string(row.iloc[4]) else 'Autre'
    
    values.append((
        prod_id,
        clean_string(row.iloc[1]) if len(row) > 1 else None,  # nom
        clean_string(row.iloc[3]) if len(row) > 3 else None,  # ref_interne
        clean_string(row.iloc[8]) if len(row) > 8 else None,  # produit_web
        famille,  # famille (obligatoire)
        clean_string(row.iloc[5]) if len(row) > 5 else None,  # sous_famille
        clean_string(row.iloc[6]) if len(row) > 6 else None,  # sous_sous_famille
        clean_string(row.iloc[7]) if len(row) > 7 else None,  # sous_sous_sous_famille
    ))

execute_values(
    cur,
    """
    INSERT INTO produits (
        id, nom, reference_interne, produit_web,
        famille, sous_famille, sous_sous_famille, sous_sous_sous_famille
    )
    VALUES %s
    ON CONFLICT (id) DO UPDATE SET
        nom = EXCLUDED.nom,
        reference_interne = EXCLUDED.reference_interne,
        produit_web = EXCLUDED.produit_web
    """,
    values
)
conn.commit()
imported = len(values)

print(f"✅ {imported:,} produits importés")

# ============================================================================
# 4. IMPORT TRANSACTIONS (2 derniers mois)
# ============================================================================
print("\n" + "="*80)
print("🎫 IMPORT TRANSACTIONS (période récente uniquement)")
print("="*80)

buffer = []
imported = 0

for _, row in df_recent.iterrows():
    facture = clean_string(row.iloc[1])
    if not facture:
        continue
    
    carte = clean_string(row.iloc[0]) or '0'
    depot = clean_string(row.iloc[2]) or '0'
    date_val = row['date_parsed'].strftime('%Y-%m-%d %H:%M:%S')
    produit = clean_string(row.iloc[5]) or '0'
    heure = int(clean_float(row.iloc[4])) if len(row) > 4 else 0
    quantite = clean_float(row.iloc[6]) if len(row) > 6 else 0
    prix = clean_float(row.iloc[7]) if len(row) > 7 else 0
    montant_ttc = clean_float(row.iloc[8]) if len(row) > 8 else (quantite * prix)
    ca = quantite * prix
    
    buffer.append((
        facture, carte, depot, date_val, heure, produit,
        quantite, prix, montant_ttc, ca, False, None, None
    ))
    
    if len(buffer) >= 1000:
        execute_values(
            cur,
            """
            INSERT INTO transactions (
                facture, carte, depot, date, heure, produit,
                quantite, prix, montant_ttc, ca, is_web, ville, cp
            )
            VALUES %s
            ON CONFLICT DO NOTHING
            """,
            buffer
        )
        conn.commit()
        imported += len(buffer)
        buffer = []
        print(f"   Importé: {imported:,} transactions...")

if buffer:
    execute_values(
        cur,
        """
        INSERT INTO transactions (
            facture, carte, depot, date, heure, produit,
            quantite, prix, montant_ttc, ca, is_web, ville, cp
        )
        VALUES %s
        ON CONFLICT DO NOTHING
        """,
        buffer
    )
    conn.commit()
    imported += len(buffer)

print(f"✅ {imported:,} transactions importées")

# ============================================================================
# 5. VÉRIFICATION FINALE
# ============================================================================
print("\n" + "="*80)
print("✅ IMPORT DE TEST TERMINÉ")
print("="*80)

cur.execute("SELECT COUNT(*), COUNT(email) FROM clients WHERE email IS NOT NULL")
clients_total, clients_email = cur.fetchone()
print(f"\n👥 Clients avec email: {clients_email:,}")

cur.execute("SELECT COUNT(*), COUNT(nom) FROM produits WHERE nom IS NOT NULL")
produits_total, produits_nom = cur.fetchone()
print(f"📦 Produits avec nom: {produits_nom:,}")

cur.execute("SELECT COUNT(*), COUNT(heure), COUNT(montant_ttc) FROM transactions WHERE heure IS NOT NULL")
trans_total, trans_heure, trans_ttc = cur.fetchone()
print(f"🎫 Transactions avec heure: {trans_heure:,}")
print(f"🎫 Transactions avec TTC: {trans_ttc:,}")

# Taille de la base
cur.execute("SELECT pg_size_pretty(pg_database_size(current_database()))")
db_size = cur.fetchone()[0]
print(f"\n💾 Taille BDD Neon: {db_size}")

cur.close()
conn.close()

print("\n" + "="*80)
print("🎯 PROCHAINES ÉTAPES")
print("="*80)
print("\n1. Vérifier que les nouvelles colonnes sont bien remplies")
print("2. Tester l'application avec ces données")
print("3. Si tout fonctionne, décider si on importe plus de données")
print("4. Surveiller la limite de 500MB de Neon")
