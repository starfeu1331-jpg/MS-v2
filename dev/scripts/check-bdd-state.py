#!/usr/bin/env python3
"""Vérifier l'état actuel de la BDD Neon"""

import psycopg2
import os
from pathlib import Path

# Lire le DATABASE_URL
env_path = Path(__file__).parent.parent / '.env'
DATABASE_URL = None
with open(env_path, 'r') as f:
    for line in f:
        if line.startswith('DATABASE_URL='):
            DATABASE_URL = line.split('=', 1)[1].strip().strip('"')
            break

if not DATABASE_URL:
    print("❌ DATABASE_URL non trouvé dans .env")
    exit(1)

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print('='*80)
print('📊 ÉTAT ACTUEL BDD NEON')
print('='*80)

# Vérifier les colonnes de la table clients
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'clients' 
    ORDER BY ordinal_position
""")
print('\n👤 Colonnes table CLIENTS:')
for row in cur.fetchall():
    print(f'   - {row[0]:20s} ({row[1]})')

# Vérifier les colonnes de la table produits
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'produits' 
    ORDER BY ordinal_position
""")
print('\n📦 Colonnes table PRODUITS:')
for row in cur.fetchall():
    print(f'   - {row[0]:20s} ({row[1]})')

# Vérifier les colonnes de la table transactions
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'transactions' 
    ORDER BY ordinal_position
""")
print('\n🎫 Colonnes table TRANSACTIONS:')
for row in cur.fetchall():
    print(f'   - {row[0]:20s} ({row[1]})')

# Compter les données
cur.execute('SELECT COUNT(*) FROM clients')
nb_clients = cur.fetchone()[0]

cur.execute('SELECT COUNT(*) FROM produits')
nb_produits = cur.fetchone()[0]

cur.execute('SELECT COUNT(*) FROM transactions')
nb_transactions = cur.fetchone()[0]

print(f'\n{"="*80}')
print(f'📈 NOMBRE DE LIGNES')
print(f'{"="*80}')
print(f'   Clients:      {nb_clients:>10,}')
print(f'   Produits:     {nb_produits:>10,}')
print(f'   Transactions: {nb_transactions:>10,}')

# Vérifier si les nouvelles colonnes ont des données
cur.execute('SELECT COUNT(*) FROM clients WHERE nom IS NOT NULL')
clients_avec_nom = cur.fetchone()[0]

cur.execute('SELECT COUNT(*) FROM clients WHERE prenom IS NOT NULL')
clients_avec_prenom = cur.fetchone()[0]

cur.execute('SELECT COUNT(*) FROM clients WHERE email IS NOT NULL')
clients_avec_email = cur.fetchone()[0]

cur.execute('SELECT COUNT(*) FROM clients WHERE telephone IS NOT NULL')
clients_avec_tel = cur.fetchone()[0]

cur.execute('SELECT COUNT(*) FROM transactions WHERE heure IS NOT NULL')
trans_avec_heure = cur.fetchone()[0]

cur.execute('SELECT COUNT(*) FROM transactions WHERE montant_ttc IS NOT NULL')
trans_avec_ttc = cur.fetchone()[0]

print(f'\n{"="*80}')
print(f'✅ NOUVELLES COLONNES REMPLIES (Février 2026)')
print(f'{"="*80}')
print(f'   Clients avec nom:        {clients_avec_nom:>10,} ({100*clients_avec_nom/nb_clients if nb_clients else 0:.1f}%)')
print(f'   Clients avec prénom:     {clients_avec_prenom:>10,} ({100*clients_avec_prenom/nb_clients if nb_clients else 0:.1f}%)')
print(f'   Clients avec email:      {clients_avec_email:>10,} ({100*clients_avec_email/nb_clients if nb_clients else 0:.1f}%)')
print(f'   Clients avec téléphone:  {clients_avec_tel:>10,} ({100*clients_avec_tel/nb_clients if nb_clients else 0:.1f}%)')
print(f'   Trans. avec heure:       {trans_avec_heure:>10,} ({100*trans_avec_heure/nb_transactions if nb_transactions else 0:.1f}%)')
print(f'   Trans. avec montant TTC: {trans_avec_ttc:>10,} ({100*trans_avec_ttc/nb_transactions if nb_transactions else 0:.1f}%)')

# Vérifier taille BDD
cur.execute("""
    SELECT pg_size_pretty(pg_database_size(current_database()))
""")
taille_bdd = cur.fetchone()[0]

print(f'\n{"="*80}')
print(f'💾 TAILLE BDD: {taille_bdd}')
print(f'{"="*80}')

cur.close()
conn.close()
