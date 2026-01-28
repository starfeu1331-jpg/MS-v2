#!/usr/bin/env python3
"""
Simuler une mise à jour quotidienne :
1. Récupérer la date max actuelle dans la BDD
2. Filtrer les transactions > date max
3. Les charger via PostgreSQL
"""

import sys
import csv
import subprocess
from datetime import datetime
from pathlib import Path

PSQL_CMD = "/opt/homebrew/opt/postgresql@16/bin/psql"
DB_URL = "postgresql://neondb_owner:npg_mdwPX1ovpWh7@ep-red-meadow-ah5j6nt7-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def get_max_date():
    """Récupérer la date max dans la BDD"""
    cmd = [
        PSQL_CMD, DB_URL,
        "-t", "-c",
        "SELECT MAX(date) FROM transactions;"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    max_date_str = result.stdout.strip()
    
    if max_date_str and max_date_str != '':
        max_date = datetime.strptime(max_date_str.split()[0], '%Y-%m-%d')
        return max_date
    return None

def filter_new_transactions(input_csv, output_csv, max_date):
    """Filtrer les transactions > max_date"""
    with open(input_csv, 'r') as fin, open(output_csv, 'w', newline='') as fout:
        reader = csv.reader(fin)
        writer = csv.writer(fout)
        
        # Copier header
        header = next(reader)
        writer.writerow(header)
        
        # Trouver l'index de la colonne date
        date_idx = header.index('date')
        
        count_total = 0
        count_new = 0
        
        for row in reader:
            count_total += 1
            
            # Parser la date
            row_date = datetime.strptime(row[date_idx], '%Y-%m-%d')
            
            # Ne garder que si > max_date
            if max_date is None or row_date > max_date:
                writer.writerow(row)
                count_new += 1
        
        return count_total, count_new

def load_csv_to_postgres(csv_file, table, columns):
    """Charger un CSV dans PostgreSQL"""
    cmd = [
        PSQL_CMD, DB_URL,
        "-c", f"\\COPY {table}({columns}) FROM '{csv_file}' CSV HEADER"
    ]
    subprocess.run(cmd, check=True)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python test-daily-update.py <csv_transactions_nouveaux>")
        sys.exit(1)
    
    input_csv = Path(sys.argv[1])
    
    if not input_csv.exists():
        print(f"❌ Fichier introuvable: {input_csv}")
        sys.exit(1)
    
    print("🔍 Récupération de la date max actuelle...")
    max_date = get_max_date()
    
    if max_date:
        print(f"📅 Date max dans la BDD: {max_date.strftime('%Y-%m-%d')}")
    else:
        print("⚠️  Aucune date trouvée, chargement complet")
    
    print(f"\n📄 Filtrage de {input_csv}...")
    temp_csv = Path("/tmp/filtered-transactions.csv")
    count_total, count_new = filter_new_transactions(input_csv, temp_csv, max_date)
    
    print(f"  ✅ {count_total:,} transactions dans le fichier")
    print(f"  ✅ {count_new:,} nouvelles transactions (> {max_date.strftime('%Y-%m-%d') if max_date else 'N/A'})")
    
    if count_new == 0:
        print("\n✅ Aucune nouvelle transaction à ajouter")
        sys.exit(0)
    
    print(f"\n📥 Chargement de {count_new:,} transactions dans PostgreSQL...")
    load_csv_to_postgres(
        str(temp_csv.absolute()),
        'transactions',
        'facture,carte,depot,date,produit,quantite,prix,ca,is_web,ville,cp'
    )
    
    print("\n✅ Mise à jour terminée!")
    
    # Vérifier la nouvelle date max
    new_max_date = get_max_date()
    if new_max_date:
        print(f"📅 Nouvelle date max: {new_max_date.strftime('%Y-%m-%d')}")
    
    # Stats finales
    cmd = [PSQL_CMD, DB_URL, "-c", "SELECT COUNT(*) as total_transactions FROM transactions;"]
    subprocess.run(cmd)
