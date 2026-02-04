#!/usr/bin/env python3
"""
Applique la migration pour ajouter les nouvelles colonnes
"""
import psycopg2
import os

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

print("🔗 Connexion à la base de données...")
print(f"   Host: {DATABASE_URL.split('@')[1].split('/')[0]}")

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("\n" + "="*80)
print("📝 MIGRATION : Ajout des nouvelles colonnes (février 2026)")
print("="*80)

# CLIENTS
print("\n👥 Table CLIENTS...")
print("   - Ajout colonne 'nom'")
cur.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS nom VARCHAR(255)")
print("   - Ajout colonne 'prenom'")
cur.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS prenom VARCHAR(255)")
print("   - Ajout colonne 'email'")
cur.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS email VARCHAR(255)")
print("   - Ajout colonne 'telephone'")
cur.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS telephone VARCHAR(50)")
print("   - Création index sur email")
cur.execute("CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email) WHERE email IS NOT NULL")
conn.commit()
print("   ✅ Colonnes clients ajoutées")

# PRODUITS
print("\n📦 Table PRODUITS...")
print("   - Ajout colonne 'nom'")
cur.execute("ALTER TABLE produits ADD COLUMN IF NOT EXISTS nom TEXT")
print("   - Ajout colonne 'reference_interne'")
cur.execute("ALTER TABLE produits ADD COLUMN IF NOT EXISTS reference_interne VARCHAR(100)")
print("   - Ajout colonne 'produit_web'")
cur.execute("ALTER TABLE produits ADD COLUMN IF NOT EXISTS produit_web VARCHAR(10)")
print("   - Création index sur produit_web")
cur.execute("CREATE INDEX IF NOT EXISTS idx_produits_web ON produits(produit_web) WHERE produit_web = 'yes'")
conn.commit()
print("   ✅ Colonnes produits ajoutées")

# TRANSACTIONS
print("\n🎫 Table TRANSACTIONS...")
print("   - Ajout colonne 'heure'")
cur.execute("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS heure INTEGER")
print("   - Ajout colonne 'montant_ttc'")
cur.execute("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS montant_ttc DECIMAL(12, 2)")
print("   - Création index sur heure")
cur.execute("CREATE INDEX IF NOT EXISTS idx_transactions_heure ON transactions(heure) WHERE heure IS NOT NULL")
conn.commit()
print("   ✅ Colonnes transactions ajoutées")

# Vérifications
print("\n" + "="*80)
print("📊 VÉRIFICATION DES TABLES")
print("="*80)

print("\n👥 Table CLIENTS:")
cur.execute("""
    SELECT 
        column_name, 
        data_type,
        CASE WHEN is_nullable = 'YES' THEN '(nullable)' ELSE '(not null)' END as nullable
    FROM information_schema.columns 
    WHERE table_name = 'clients' 
    AND column_name IN ('nom', 'prenom', 'email', 'telephone')
    ORDER BY column_name
""")
for row in cur.fetchall():
    print(f"   ✅ {row[0]:20s} {row[1]:20s} {row[2]}")

print("\n📦 Table PRODUITS:")
cur.execute("""
    SELECT 
        column_name, 
        data_type,
        CASE WHEN is_nullable = 'YES' THEN '(nullable)' ELSE '(not null)' END as nullable
    FROM information_schema.columns 
    WHERE table_name = 'produits' 
    AND column_name IN ('nom', 'reference_interne', 'produit_web')
    ORDER BY column_name
""")
for row in cur.fetchall():
    print(f"   ✅ {row[0]:20s} {row[1]:20s} {row[2]}")

print("\n🎫 Table TRANSACTIONS:")
cur.execute("""
    SELECT 
        column_name, 
        data_type,
        CASE WHEN is_nullable = 'YES' THEN '(nullable)' ELSE '(not null)' END as nullable
    FROM information_schema.columns 
    WHERE table_name = 'transactions' 
    AND column_name IN ('heure', 'montant_ttc')
    ORDER BY column_name
""")
for row in cur.fetchall():
    print(f"   ✅ {row[0]:20s} {row[1]:20s} {row[2]}")

cur.close()
conn.close()

print("\n" + "="*80)
print("✅ MIGRATION TERMINÉE AVEC SUCCÈS")
print("="*80)
print("\nVous pouvez maintenant exécuter le script d'import:")
print("   python3 scripts/import-new-data-feb2026.py")
