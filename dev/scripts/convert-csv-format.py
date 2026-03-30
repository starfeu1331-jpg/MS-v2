#!/usr/bin/env python3
"""
Convertir les fichiers CSV d'export Sage au format attendu par l'API
"""

import csv
import sys
from datetime import datetime
from pathlib import Path
import chardet

def detect_encoding(file_path):
    """Détecter l'encodage d'un fichier"""
    with open(file_path, 'rb') as f:
        result = chardet.detect(f.read(100000))
        return result['encoding']

def convert_transactions(input_path, output_path):
    """
    Convertir détail transactions.csv en transactions.csv
    Format attendu: facture,carte,depot,date,produit,quantite,prix,ca,is_web,ville,cp
    """
    print(f"📄 Conversion transactions: {input_path} -> {output_path}")
    
    with open(input_path, 'r', encoding='utf-8') as fin, \
         open(output_path, 'w', encoding='utf-8', newline='') as fout:
        
        reader = csv.DictReader(fin, delimiter=';')
        writer = csv.writer(fout)
        
        # Header - sans id (auto-généré)
        writer.writerow(['facture', 'carte', 'depot', 'date', 'produit', 'quantite', 'prix', 'ca', 'is_web', 'ville', 'cp'])
        
        count = 0
        for row in reader:
            try:
                # Convertir date DD/MM/YYYY -> YYYY-MM-DD
                date_str = row['Date facture']
                if date_str:
                    date_obj = datetime.strptime(date_str, '%d/%m/%Y')
                    date_formatted = date_obj.strftime('%Y-%m-%d')
                else:
                    continue  # Skip si pas de date
                
                # Convertir prix (virgule -> point)
                ca_str = row['Prix vente net en devise société'].replace(',', '.')
                ca = float(ca_str) if ca_str else 0.0
                
                # Quantité (virgule -> point aussi)
                quantite_str = row['Quantité unitaire'].replace(',', '.')
                quantite = float(quantite_str) if quantite_str else 0
                
                # Prix unitaire = ca (on n'a pas le prix séparément dans l'export)
                prix = ca
                
                writer.writerow([
                    row['N° Facture client'],
                    row['N° Carte fidélité'],
                    row['Dépôt'],
                    date_formatted,
                    row['N° Produit'],
                    quantite,
                    prix,
                    ca,
                    'f',  # is_web = false par défaut
                    '',   # ville vide (on prendra depuis clients)
                    ''    # cp vide (on prendra depuis clients)
                ])
                
                count += 1
                if count % 50000 == 0:
                    print(f"  ✅ {count:,} lignes...")
                    
            except Exception as e:
                print(f"  ⚠️ Erreur ligne {count}: {e}")
                continue
        
        print(f"✅ {count:,} transactions converties")

def convert_clients(input_path, output_path):
    """
    Convertir client.csv en clients.csv
    Format attendu: carte,date_creation,date_validite,statut,civilite,sexe,date_naissance,cp,ville,nom_adresse,adresse,adresse_2,adresse_4
    """
    print(f"📄 Conversion clients: {input_path} -> {output_path}")
    
    # Détecter l'encodage
    encoding = detect_encoding(input_path)
    print(f"  📝 Encodage détecté: {encoding}")
    
    with open(input_path, 'r', encoding=encoding, errors='ignore') as fin, \
         open(output_path, 'w', encoding='utf-8', newline='') as fout:
        
        reader = csv.DictReader(fin, delimiter=';')
        writer = csv.writer(fout)
        
        # Header - toutes les colonnes
        writer.writerow(['carte', 'date_creation', 'date_validite', 'statut', 'civilite', 'sexe', 'date_naissance', 'cp', 'ville', 'nom_adresse', 'adresse', 'adresse_2', 'adresse_4'])
        
        count = 0
        seen_cartes = set()
        
        for row in reader:
            try:
                carte = row.get('N° Carte fidélité', '').strip()
                
                # Skip si vide ou doublon
                if not carte or carte in seen_cartes:
                    continue
                
                seen_cartes.add(carte)
                
                # Convertir dates si présentes
                date_creation = row.get('Date création', '')
                date_validite = row.get('Date de validité', '')
                date_naissance = row.get('Date de naissance', '')
                
                # Convertir DD/MM/YYYY -> YYYY-MM-DD
                for date_field in [date_creation, date_validite, date_naissance]:
                    if date_field and len(date_field) == 10:
                        try:
                            date_obj = datetime.strptime(date_field, '%d/%m/%Y')
                            date_field = date_obj.strftime('%Y-%m-%d')
                        except:
                            pass
                
                writer.writerow([
                    carte,
                    date_creation,
                    date_validite,
                    row.get('Statut', '').strip(),
                    row.get('Civilité', '').strip(),
                    row.get('Sexe', '').strip(),
                    date_naissance,
                    row.get('C.P', '').strip(),
                    row.get('Ville', '').strip(),
                    row.get('Nom adresse', '').strip(),
                    row.get('Adresse', '').strip(),
                    row.get('Adresse (2ième ligne)', '').strip(),
                    row.get('Adresse (4ième ligne)', '').strip()
                ])
                
                count += 1
                if count % 100000 == 0:
                    print(f"  ✅ {count:,} lignes...")
                    
            except Exception as e:
                continue
        
        print(f"✅ {count:,} clients uniques convertis")

def convert_produits(input_path, output_path):
    """
    Convertir Produits.csv en produits.csv
    Format attendu: id,famille,sous_famille,sous_sous_famille,sous_sous_sous_famille
    """
    print(f"📄 Conversion produits: {input_path} -> {output_path}")
    
    # Détecter l'encodage
    encoding = detect_encoding(input_path)
    print(f"  📝 Encodage détecté: {encoding}")
    
    with open(input_path, 'r', encoding=encoding, errors='ignore') as fin, \
         open(output_path, 'w', encoding='utf-8', newline='') as fout:
        
        reader = csv.DictReader(fin, delimiter=';')
        writer = csv.writer(fout)
        
        # Header
        writer.writerow(['id', 'famille', 'sous_famille', 'sous_sous_famille', 'sous_sous_sous_famille'])
        
        count = 0
        for row in reader:
            try:
                # Nettoyer les clés (strip spaces)
                cleaned_row = {k.strip(): v for k, v in row.items()}
                
                writer.writerow([
                    cleaned_row.get('N° Produit', ''),
                    cleaned_row.get('Famille', ''),
                    cleaned_row.get('Sous famille', ''),
                    cleaned_row.get('Sous sous famille', ''),
                    cleaned_row.get('Sous sous sous famille', '')
                ])
                count += 1
            except Exception as e:
                print(f"  ⚠️ Erreur: {e}")
                continue
        
        print(f"✅ {count:,} produits convertis")

def convert_depots(input_path, output_path):
    """
    Convertir Points de vente.csv en depots.csv
    Format attendu: code,nom
    """
    print(f"📄 Conversion dépôts: {input_path} -> {output_path}")
    
    with open(input_path, 'r', encoding='utf-8') as fin, \
         open(output_path, 'w', encoding='utf-8', newline='') as fout:
        
        reader = csv.DictReader(fin, delimiter=';')
        writer = csv.writer(fout)
        
        # Header
        writer.writerow(['code', 'nom'])
        
        count = 0
        for row in reader:
            try:
                # Essayer de trouver les bonnes colonnes
                code = ''
                nom = ''
                
                # Chercher la colonne code
                for key in row.keys():
                    if 'point' in key.lower() or 'code' in key.lower() or 'dépôt' in key.lower():
                        code = row[key]
                        break
                
                # Chercher la colonne nom
                for key in row.keys():
                    if 'nom' in key.lower() or 'libellé' in key.lower():
                        nom = row[key]
                        break
                
                if code:
                    writer.writerow([code, nom])
                    count += 1
            except Exception as e:
                continue
        
        print(f"✅ {count:,} dépôts convertis")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python convert-csv-format.py <dossier_source>")
        print("Exemple: python convert-csv-format.py '/Users/marceau/Desktop/Data update/Data avant'")
        sys.exit(1)
    
    source_dir = Path(sys.argv[1])
    output_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path.cwd()
    
    if not source_dir.exists():
        print(f"❌ Dossier introuvable: {source_dir}")
        sys.exit(1)
    
    print(f"📂 Dossier source: {source_dir}")
    print(f"📂 Dossier sortie: {output_dir}")
    print()
    
    # Convertir chaque fichier
    files_map = {
        'détail transactions.csv': ('transactions.csv', convert_transactions),
        'client.csv': ('clients.csv', convert_clients),
        'Produits.csv': ('produits.csv', convert_produits),
        'Points de vente.csv': ('depots.csv', convert_depots)
    }
    
    for input_name, (output_name, converter) in files_map.items():
        input_path = source_dir / input_name
        output_path = output_dir / output_name
        
        if input_path.exists():
            converter(str(input_path), str(output_path))
        else:
            print(f"⚠️ Fichier non trouvé: {input_path}")
    
    print()
    print("✅ Conversion terminée!")
    print(f"📁 Fichiers disponibles dans: {output_dir}")
