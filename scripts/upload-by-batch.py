#!/usr/bin/env python3
"""
Découper un gros CSV en petits paquets et les envoyer à l'API Vercel
"""

import csv
import sys
import requests
from pathlib import Path
from math import ceil

API_URL = "https://ms-v2.vercel.app/api/update-db"
BATCH_SIZE = 10000  # Nombre de lignes par paquet (~500 KB)

def split_csv(input_file, output_dir, batch_size=BATCH_SIZE):
    """Découper un CSV en plusieurs fichiers"""
    print(f"📄 Lecture de {input_file}...")
    
    with open(input_file, 'r') as f:
        reader = csv.reader(f)
        header = next(reader)
        rows = list(reader)
    
    total_rows = len(rows)
    num_batches = ceil(total_rows / batch_size)
    
    print(f"✂️  Découpage en {num_batches} paquets de {batch_size} lignes max...")
    
    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True)
    
    batch_files = []
    
    for i in range(num_batches):
        start_idx = i * batch_size
        end_idx = min((i + 1) * batch_size, total_rows)
        batch = rows[start_idx:end_idx]
        
        # Créer le fichier du paquet
        batch_file = output_dir / f"transactions-part{i+1}.csv"
        
        with open(batch_file, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(header)
            writer.writerows(batch)
        
        batch_files.append(batch_file)
        
        size_kb = batch_file.stat().st_size / 1024
        print(f"  ✅ Part {i+1}/{num_batches}: {len(batch):,} lignes ({size_kb:.1f} KB)")
    
    return batch_files

def upload_batch(batch_file, part_num, total_parts):
    """Envoyer un paquet à l'API Vercel"""
    print(f"\n📤 Envoi du paquet {part_num}/{total_parts}...")
    
    with open(batch_file, 'rb') as f:
        files = {'transactions': (batch_file.name, f, 'text/csv')}
        data = {'mode': 'daily'}
        
        response = requests.post(API_URL, files=files, data=data, timeout=60)
    
    if response.status_code == 200:
        result = response.json()
        print(f"  ✅ {result.get('inserted', 0):,} transactions ajoutées")
        return True
    else:
        print(f"  ❌ Erreur: {response.status_code}")
        print(f"  {response.text}")
        return False

def main():
    if len(sys.argv) < 2:
        print("Usage: python upload-by-batch.py <csv_transactions>")
        print("Exemple: python upload-by-batch.py converted-data-apres/transactions.csv")
        sys.exit(1)
    
    input_file = Path(sys.argv[1])
    
    if not input_file.exists():
        print(f"❌ Fichier introuvable: {input_file}")
        sys.exit(1)
    
    # 1. Découper en paquets
    print("═══════════════════════════════════════════════════════════")
    print("  📦 UPLOAD PAR PAQUETS VERS VERCEL")
    print("═══════════════════════════════════════════════════════════")
    print()
    
    temp_dir = Path("/tmp/decor-batches")
    batch_files = split_csv(input_file, temp_dir)
    
    print()
    print("═══════════════════════════════════════════════════════════")
    print(f"  📤 ENVOI DE {len(batch_files)} PAQUETS À L'API")
    print("═══════════════════════════════════════════════════════════")
    
    # 2. Envoyer chaque paquet
    success_count = 0
    total_inserted = 0
    
    for i, batch_file in enumerate(batch_files, 1):
        if upload_batch(batch_file, i, len(batch_files)):
            success_count += 1
        else:
            print(f"\n⚠️  Erreur sur le paquet {i}, arrêt.")
            break
    
    # 3. Nettoyage
    print()
    print("🧹 Nettoyage des fichiers temporaires...")
    for batch_file in batch_files:
        batch_file.unlink()
    temp_dir.rmdir()
    
    # 4. Résumé
    print()
    print("═══════════════════════════════════════════════════════════")
    if success_count == len(batch_files):
        print("  ✅ TOUS LES PAQUETS ENVOYÉS AVEC SUCCÈS !")
    else:
        print(f"  ⚠️  {success_count}/{len(batch_files)} paquets envoyés")
    print("═══════════════════════════════════════════════════════════")
    print()
    print("📊 Vérifie le dashboard: https://ms-v2.vercel.app")

if __name__ == '__main__':
    main()
