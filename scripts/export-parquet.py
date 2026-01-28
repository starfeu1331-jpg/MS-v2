#!/usr/bin/env python3
"""Export des données en Parquet pour le navigateur"""

import duckdb
from pathlib import Path
import json

SCRIPT_DIR = Path(__file__).parent
DB_FILE = SCRIPT_DIR.parent / "public" / "duckdb.db"
EXPORT_DIR = SCRIPT_DIR.parent / "public" / "data"

# Créer le dossier d'export
EXPORT_DIR.mkdir(exist_ok=True)

print("📤 Export des données en Parquet...")
print("="*60)

conn = duckdb.connect(str(DB_FILE), read_only=True)

# Exporter chaque table en Parquet
tables = ['clients', 'produits', 'magasins', 'transactions']

for table in tables:
    print(f"\n📦 Export {table}...")
    output_file = EXPORT_DIR / f"{table}.parquet"
    
    conn.execute(f"""
        COPY {table} TO '{output_file}' (FORMAT PARQUET, COMPRESSION ZSTD)
    """)
    
    size = output_file.stat().st_size / 1024 / 1024
    count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    print(f"   ✅ {count:,} lignes → {size:.2f} MB")

# Générer un fichier de métadonnées
print(f"\n📋 Génération métadonnées...")
metadata = {
    "tables": {},
    "export_date": "2026-01-26",
    "version": "1.0"
}

for table in tables:
    count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    metadata["tables"][table] = {
        "rows": count,
        "file": f"{table}.parquet"
    }

# Stats globales
stats = conn.execute("""
    SELECT 
        COUNT(*) as nb_trans,
        SUM(ca) as ca_total,
        MIN(date) as date_min,
        MAX(date) as date_max,
        COUNT(DISTINCT carte) as nb_clients_actifs,
        COUNT(DISTINCT produit) as nb_produits_vendus
    FROM transactions
""").fetchone()

metadata["stats"] = {
    "transactions": stats[0],
    "ca_total": float(stats[1]),
    "date_min": str(stats[2]),
    "date_max": str(stats[3]),
    "clients_actifs": stats[4],
    "produits_vendus": stats[5]
}

metadata_file = EXPORT_DIR / "metadata.json"
with open(metadata_file, 'w', encoding='utf-8') as f:
    json.dump(metadata, f, indent=2, ensure_ascii=False)

print(f"   ✅ Métadonnées exportées")

conn.close()

print("\n" + "="*60)
print("✅ Export terminé!")
print(f"\n📁 Fichiers dans: {EXPORT_DIR}")
print("\nVous pouvez maintenant charger ces fichiers dans le navigateur.")
