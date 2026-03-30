#!/usr/bin/env python3
"""
Script d'import des nouvelles données CSV de Nicolas (février 2026)
Adapté pour les nouveaux formats avec:
- Nom, Prénom, Email, Téléphone pour les clients
- Nom produit, Référence interne, Produit web pour les produits
- Heure mouvement et Montant TTC pour les transactions
"""
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import os
from datetime import datetime

# Configuration de la base de données - Lire depuis .env
DATABASE_URL = None
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
with open(env_path, 'r') as f:
    for line in f:
        if line.startswith('DATABASE_URL='):
            DATABASE_URL = line.split('=', 1)[1].strip().strip('"')
            break

if not DATABASE_URL:
    print("❌ DATABASE_URL non trouvé dans .env")
    exit(1)

# Chemins des nouveaux fichiers
DATA_DIR = '/Users/marceau/Desktop/test data/decor-analytics/data/nouveaux/fevrier2026'

def log_progress(phase, current, total):
    """Affiche la progression"""
    pct = int((current / total) * 100) if total > 0 else 0
    print(f"[{phase}] {pct}% - {current:,} / {total:,}")

def clean_string(value):
    """Nettoie une valeur string"""
    if pd.isna(value) or value == '':
        return None
    return str(value).strip()

def clean_float(value):
    """Nettoie une valeur float"""
    if pd.isna(value):
        return 0.0
    if isinstance(value, str):
        value = value.replace(',', '.')
    try:
        return float(value)
    except:
        return 0.0

# ============================================================================
# IMPORT CLIENTS avec Nom, Prénom, Email, Téléphone
# ============================================================================
def import_clients():
    print("\n" + "="*80)
    print("👥 IMPORT CLIENTS (Nouveau format avec contacts)")
    print("="*80)
    
    df = pd.read_csv(
        f'{DATA_DIR}/Fichier_client_02-02-26 12.csv',
        sep=';',
        encoding='ISO-8859-1',
        low_memory=False,
        on_bad_lines='skip'
    )
    
    print(f"   📊 Lignes lues: {len(df):,}")
    print(f"   📋 Colonnes disponibles: {len(df.columns)}")
    
    # Les colonnes selon l'analyse (avec encodage cassé, on utilise les indices)
    # 0: N° Carte fidélité
    # 1: Nom correspondant ⭐
    # 2: Prénom correspondant ⭐
    # 3: Date création
    # 4: Statut
    # 5: Date validité + Civilité + Date naissance (fusionnées)
    # 6: Sexe
    # 7: Adresse électronique ⭐
    # 8: N° Téléphone ⭐
    # 9: Nom adresse
    # 10-13: Adresses, CP, Ville
    
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Client anonyme "0"
    cur.execute("""
        INSERT INTO clients (carte, nom, ville) 
        VALUES ('0', 'Anonyme', 'Inconnu') 
        ON CONFLICT (carte) DO NOTHING
    """)
    conn.commit()
    
    BATCH_SIZE = 5000
    total_imported = 0
    
    for i in range(0, len(df), BATCH_SIZE):
        batch = df.iloc[i:i+BATCH_SIZE]
        values = []
        seen_cartes = set()  # Pour éviter les doublons dans le batch
        
        for _, row in batch.iterrows():
            # N° Carte (colonne 0)
            carte = clean_string(row.iloc[0])
            if not carte or carte == '0' or carte in seen_cartes:
                continue
            seen_cartes.add(carte)
            
            # ⭐ Nouvelles colonnes (ATTENTION : colonne 1 = NOM, colonne 2 = PRÉNOM)
            nom = clean_string(row.iloc[1]) if len(row) > 1 else None
            prenom = clean_string(row.iloc[2]) if len(row) > 2 else None
            email = clean_string(row.iloc[7]) if len(row) > 7 else None
            telephone = clean_string(row.iloc[8]) if len(row) > 8 else None
            
            # Anciennes colonnes
            date_creation = clean_string(row.iloc[3]) if len(row) > 3 else None
            statut = clean_string(row.iloc[4]) if len(row) > 4 else None
            # Colonne 5 semble fusionner plusieurs infos, on va extraire civilité si possible
            civilite = None
            date_validite = None
            date_naissance = None
            sexe = clean_string(row.iloc[6]) if len(row) > 6 else None
            nom_adresse = clean_string(row.iloc[9]) if len(row) > 9 else None
            adresse = clean_string(row.iloc[10]) if len(row) > 10 else None
            adresse2 = clean_string(row.iloc[11]) if len(row) > 11 else None
            adresse4 = clean_string(row.iloc[12]) if len(row) > 12 else None
            cp = clean_string(row.iloc[13]) if len(row) > 13 else None
            ville = clean_string(row.iloc[14]) if len(row) > 14 else None
            
            values.append((
                carte,
                nom,
                prenom,
                email,
                telephone,
                date_creation,
                statut,
                date_validite,
                civilite,
                date_naissance,
                sexe,
                nom_adresse,
                adresse,
                adresse2,
                adresse4,
                cp,
                ville
            ))
        
        if values:
            execute_values(
                cur,
                """
                INSERT INTO clients (
                    carte, nom, prenom, email, telephone,
                    date_creation, statut, date_validite, civilite, date_naissance, sexe,
                    nom_adresse, adresse, adresse_2, adresse_4, cp, ville
                )
                VALUES %s
                ON CONFLICT (carte) DO UPDATE SET
                    nom = EXCLUDED.nom,
                    prenom = EXCLUDED.prenom,
                    email = EXCLUDED.email,
                    telephone = EXCLUDED.telephone,
                    date_creation = EXCLUDED.date_creation,
                    statut = EXCLUDED.statut,
                    civilite = EXCLUDED.civilite,
                    sexe = EXCLUDED.sexe,
                    cp = EXCLUDED.cp,
                    ville = EXCLUDED.ville
                """,
                values
            )
            conn.commit()
            total_imported += len(values)
        
        if (i // BATCH_SIZE) % 10 == 0:
            log_progress('CLIENTS', min(i + BATCH_SIZE, len(df)), len(df))
    
    cur.close()
    conn.close()
    
    print(f"✅ {total_imported:,} clients importés/mis à jour")
    
    # Stats sur les nouvelles colonnes
    print(f"\n   📊 Statistiques des nouvelles colonnes:")
    print(f"      - Noms renseignés: {df.iloc[:, 1].notna().sum():,} ({df.iloc[:, 1].notna().sum()/len(df)*100:.1f}%)")
    print(f"      - Prénoms renseignés: {df.iloc[:, 2].notna().sum():,} ({df.iloc[:, 2].notna().sum()/len(df)*100:.1f}%)")
    if len(df.columns) > 7:
        print(f"      - Emails renseignés: {df.iloc[:, 7].notna().sum():,} ({df.iloc[:, 7].notna().sum()/len(df)*100:.1f}%)")
    if len(df.columns) > 8:
        print(f"      - Téléphones renseignés: {df.iloc[:, 8].notna().sum():,} ({df.iloc[:, 8].notna().sum()/len(df)*100:.1f}%)")

# ============================================================================
# IMPORT PRODUITS avec Nom, Référence interne, Produit web
# ============================================================================
def import_produits():
    print("\n" + "="*80)
    print("📦 IMPORT PRODUITS (Nouveau format avec noms)")
    print("="*80)
    
    df = pd.read_csv(
        f'{DATA_DIR}/produits.csv',
        sep=';',
        encoding='ISO-8859-1',
        low_memory=False
    )
    
    print(f"   📊 Lignes lues: {len(df):,}")
    print(f"   📋 Colonnes disponibles: {len(df.columns)}")
    
    # Colonnes selon l'analyse:
    # 0: N° Produit
    # 1: Désignation produit ⭐
    # 2: Désignation produit.1 (doublon)
    # 3: Référence interne ⭐
    # 4: Libellé Famille
    # 5: Libellé Sous-famille
    # 6: Libellé Sous-sous-famille
    # 7: Libellé SSS/Famille
    # 8: Produit web ⭐ (yes/no)
    
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Produit "0"
    cur.execute("""
        INSERT INTO produits (id, nom, famille) 
        VALUES ('0', 'Inconnu', 'Inconnu') 
        ON CONFLICT (id) DO NOTHING
    """)
    conn.commit()
    
    values = []
    for _, row in df.iterrows():
        prod_id = clean_string(row.iloc[0])
        if not prod_id or prod_id == '0':
            continue
        
        # ⭐ Nouvelles colonnes
        nom = clean_string(row.iloc[1]) if len(row) > 1 else None
        ref_interne = clean_string(row.iloc[3]) if len(row) > 3 else None
        produit_web = clean_string(row.iloc[8]) if len(row) > 8 else None
        
        # Anciennes colonnes
        famille = clean_string(row.iloc[4]) if len(row) > 4 else 'Inconnu'
        sous_famille = clean_string(row.iloc[5]) if len(row) > 5 else None
        sous_sous_famille = clean_string(row.iloc[6]) if len(row) > 6 else None
        sous_sous_sous_famille = clean_string(row.iloc[7]) if len(row) > 7 else None
        
        values.append((
            prod_id,
            nom,
            ref_interne,
            produit_web,
            famille,
            sous_famille,
            sous_sous_famille,
            sous_sous_sous_famille
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
            produit_web = EXCLUDED.produit_web,
            famille = EXCLUDED.famille,
            sous_famille = EXCLUDED.sous_famille
        """,
        values
    )
    conn.commit()
    
    cur.close()
    conn.close()
    
    print(f"✅ {len(values):,} produits importés/mis à jour")
    
    # Stats
    print(f"\n   📊 Statistiques des nouvelles colonnes:")
    print(f"      - Noms renseignés: {df.iloc[:, 1].notna().sum():,} ({df.iloc[:, 1].notna().sum()/len(df)*100:.1f}%)")
    if len(df.columns) > 3:
        print(f"      - Références internes: {df.iloc[:, 3].notna().sum():,} ({df.iloc[:, 3].notna().sum()/len(df)*100:.1f}%)")
    if len(df.columns) > 8:
        produits_web = df.iloc[:, 8].str.lower().str.strip() == 'yes'
        print(f"      - Produits web (yes): {produits_web.sum():,} ({produits_web.sum()/len(df)*100:.1f}%)")

# ============================================================================
# IMPORT MAGASINS (inchangé)
# ============================================================================
def import_magasins():
    print("\n" + "="*80)
    print("🏪 IMPORT MAGASINS (format inchangé)")
    print("="*80)
    
    # On utilise les anciens fichiers pour les magasins
    old_data_dir = '/Users/marceau/Desktop/test data/data/nouveaux'
    
    try:
        df = pd.read_csv(
            f'{old_data_dir}/Points de vente.csv',
            sep=';',
            encoding='utf-8'
        )
    except:
        print("   ⚠️  Fichier 'Points de vente.csv' non trouvé, skip")
        return
    
    print(f"   📊 Lignes lues: {len(df):,}")
    
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Magasin "0"
    cur.execute("""
        INSERT INTO magasins (code, nom) 
        VALUES ('0', 'Inconnu') 
        ON CONFLICT (code) DO NOTHING
    """)
    conn.commit()
    
    cols = list(df.columns)
    values = []
    
    for _, row in df.iterrows():
        code = clean_string(row[cols[1]] if len(cols) > 1 else None)
        if not code:
            continue
        
        values.append((
            code,
            clean_string(row[cols[2]] if len(cols) > 2 else f'M{code}'),
            clean_string(row[cols[0]] if len(cols) > 0 else None),
            clean_string(row[cols[7]] if len(cols) > 7 else None),
            clean_string(row[cols[6]] if len(cols) > 6 else None)
        ))
    
    execute_values(
        cur,
        """
        INSERT INTO magasins (code, nom, zone, ville, cp)
        VALUES %s
        ON CONFLICT (code) DO NOTHING
        """,
        values
    )
    conn.commit()
    
    cur.close()
    conn.close()
    
    print(f"✅ {len(values):,} magasins importés")

# ============================================================================
# IMPORT TRANSACTIONS avec Heure et Montant TTC
# ============================================================================
def import_transactions():
    print("\n" + "="*80)
    print("🎫 IMPORT TRANSACTIONS (Nouveau format avec heure et TTC)")
    print("="*80)
    
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Désactiver temporairement les contraintes FK
    print("   🔒 Désactivation contraintes FK...")
    cur.execute("ALTER TABLE transactions DISABLE TRIGGER ALL")
    conn.commit()
    
    print("   📖 Lecture du fichier par chunks...")
    
    CHUNK_SIZE = 10000
    BATCH_SIZE = 2000
    total_imported = 0
    buffer = []
    
    # Colonnes du nouveau fichier lignevente.csv:
    # 0: N° Carte fidélité
    # 1: N° Facture client
    # 2: Dépôt
    # 3: Date facture
    # 4: Heure mouvement ⭐
    # 5: N° Produit
    # 6: Quantité unitaire
    # 7: Prix vente net
    # 8: Mt T.T.C ⭐
    
    for chunk_num, chunk in enumerate(pd.read_csv(
        f'{DATA_DIR}/lignevente.csv',
        sep=';',
        encoding='ISO-8859-1',
        chunksize=CHUNK_SIZE,
        low_memory=False,
        on_bad_lines='skip'
    )):
        for _, row in chunk.iterrows():
            # Colonnes obligatoires
            facture = clean_string(row.iloc[1])
            if not facture:
                continue
            
            carte = clean_string(row.iloc[0]) or '0'
            depot = clean_string(row.iloc[2]) or '0'
            date_str = clean_string(row.iloc[3])
            produit = clean_string(row.iloc[5]) or '0'
            
            # ⭐ Nouvelle colonne heure
            heure = int(clean_float(row.iloc[4])) if len(row) > 4 else 0
            
            # Parse date
            try:
                date_val = pd.to_datetime(date_str, format='%Y-%m-%d').strftime('%Y-%m-%d %H:%M:%S')
            except:
                try:
                    # Essayer avec le format français
                    date_val = pd.to_datetime(date_str, format='%d/%m/%Y').strftime('%Y-%m-%d %H:%M:%S')
                except:
                    continue
            
            quantite = clean_float(row.iloc[6]) if len(row) > 6 else 0
            prix = clean_float(row.iloc[7]) if len(row) > 7 else 0
            
            # ⭐ Nouvelle colonne montant TTC
            montant_ttc = clean_float(row.iloc[8]) if len(row) > 8 else (quantite * prix)
            
            # CA = montant TTC (et non quantite * prix)
            ca = montant_ttc
            
            # Déterminer si c'est du web (basé sur le dépôt ou si produit_web = yes)
            # Pour l'instant on garde la logique actuelle
            is_web = False
            
            buffer.append((
                facture, carte, depot, date_val, heure, produit,
                quantite, prix, montant_ttc, ca, is_web, None, None
            ))
            
            if len(buffer) >= BATCH_SIZE:
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
                total_imported += len(buffer)
                buffer = []
        
        if chunk_num % 10 == 0:
            print(f"   📊 Traité: {total_imported:,} lignes...")
    
    # Dernier batch
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
        total_imported += len(buffer)
    
    # Réactiver les contraintes
    print("   🔓 Réactivation contraintes FK...")
    cur.execute("ALTER TABLE transactions ENABLE TRIGGER ALL")
    conn.commit()
    
    cur.close()
    conn.close()
    
    print(f"✅ {total_imported:,} transactions importées")

# ============================================================================
# MAIN
# ============================================================================
def main():
    print("\n" + "="*80)
    print("🚀 IMPORT NOUVELLES DONNÉES FÉVRIER 2026")
    print("="*80)
    print("\n📁 Source:", DATA_DIR)
    print("\n⭐ Nouvelles colonnes importées:")
    print("   • Clients: Nom, Prénom, Email, Téléphone")
    print("   • Produits: Nom, Référence interne, Produit web")
    print("   • Transactions: Heure mouvement, Montant TTC")
    
    input("\n⏸️  Appuyez sur Entrée pour continuer (ou Ctrl+C pour annuler)...")
    
    try:
        # Pas de nettoyage complet, on fait des UPSERT pour mettre à jour
        print("\n📝 Mode: UPSERT (mise à jour des données existantes)")
        
        import_magasins()  # D'abord les magasins (dépendance)
        import_clients()   # Ensuite les clients
        import_produits()  # Puis les produits
        import_transactions()  # Enfin les transactions
        
        # Stats finales
        print("\n" + "="*80)
        print("📊 STATISTIQUES FINALES")
        print("="*80)
        
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        cur.execute('SELECT COUNT(*) FROM clients')
        clients_count = cur.fetchone()[0]
        cur.execute('SELECT COUNT(*) FROM clients WHERE email IS NOT NULL')
        clients_email = cur.fetchone()[0]
        print(f"\n👥 Clients: {clients_count:,}")
        print(f"   └─ avec email: {clients_email:,} ({clients_email/clients_count*100:.1f}%)")
        
        cur.execute('SELECT COUNT(*) FROM produits')
        produits_count = cur.fetchone()[0]
        cur.execute('SELECT COUNT(*) FROM produits WHERE nom IS NOT NULL')
        produits_nom = cur.fetchone()[0]
        print(f"\n📦 Produits: {produits_count:,}")
        print(f"   └─ avec nom: {produits_nom:,} ({produits_nom/produits_count*100:.1f}%)")
        
        cur.execute('SELECT COUNT(*) FROM magasins')
        print(f"\n🏪 Magasins: {cur.fetchone()[0]:,}")
        
        cur.execute('SELECT COUNT(*) FROM transactions')
        trans_count = cur.fetchone()[0]
        cur.execute('SELECT COUNT(*) FROM transactions WHERE heure IS NOT NULL AND heure > 0')
        trans_heure = cur.fetchone()[0]
        print(f"\n🎫 Transactions: {trans_count:,}")
        print(f"   └─ avec heure: {trans_heure:,} ({trans_heure/trans_count*100:.1f}%)")
        
        cur.close()
        conn.close()
        
        print("\n" + "="*80)
        print("✅ IMPORT TERMINÉ AVEC SUCCÈS !")
        print("="*80)
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Import annulé par l'utilisateur")
    except Exception as e:
        print(f"\n\n❌ ERREUR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
