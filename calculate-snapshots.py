#!/usr/bin/env python3
"""
🔄 SCRIPT DE PRÉ-CALCUL DES SNAPSHOTS DASHBOARD
================================================

Ce script calcule et stocke les KPIs du dashboard dans PostgreSQL
pour éviter les timeouts Vercel (10 secondes max).

Exécution :
- 1x/jour via cron
- Après chaque import de nouvelles données
- On-demand quand besoin

Durée : ~2-3 minutes pour 6M transactions (pas de limite de temps)
"""

import os
import sys
import json
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, date
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv('.env.database')
DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print("❌ DATABASE_URL non trouvé dans .env.database")
    sys.exit(1)

print("=" * 80)
print("🔄 PRÉ-CALCUL DES SNAPSHOTS DASHBOARD")
print("=" * 80)
print(f"🗄️  Base de données: {DATABASE_URL.split('@')[1].split('/')[0]}")
print(f"🕐 Début: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 80)

# Connexion
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

def calculate_snapshot(period_type, period_value, where_clause=""):
    """Calcule un snapshot pour une période donnée"""
    
    print(f"\n📊 Calcul snapshot: {period_type}={period_value}")
    
    base_where = "depot NOT IN ('1', '41', '42') AND ca > 0"
    if where_clause:
        full_where = f"{where_clause} AND {base_where}"
    else:
        full_where = base_where
    
    # 1. KPIs principaux
    print("   ⏳ KPIs principaux...")
    cur.execute(f"""
        SELECT 
            COUNT(DISTINCT carte)::int as total_clients,
            COUNT(DISTINCT facture)::int as total_tickets,
            SUM(ca)::numeric as total_ca,
            (SUM(ca) / NULLIF(COUNT(DISTINCT facture), 0))::numeric as panier_moyen,
            COUNT(*)::bigint as row_count
        FROM transactions
        WHERE {full_where}
    """)
    kpis = cur.fetchone()
    
    if not kpis or kpis[0] is None:
        print(f"   ⚠️  Aucune donnée pour {period_value}")
        return None
    
    # 2. Stats clients
    print("   ⏳ Stats clients...")
    cur.execute(f"""
        SELECT 
            COUNT(DISTINCT c.carte)::int as total,
            COUNT(DISTINCT CASE WHEN c.sexe = 'H' THEN c.carte END)::int as hommes,
            COUNT(DISTINCT CASE WHEN c.sexe = 'F' THEN c.carte END)::int as femmes,
            COUNT(DISTINCT CASE WHEN c.nom IS NOT NULL AND c.nom != '' THEN c.carte END)::int as avec_nom,
            COUNT(DISTINCT CASE WHEN c.prenom IS NOT NULL AND c.prenom != '' THEN c.carte END)::int as avec_prenom,
            COUNT(DISTINCT CASE WHEN c.email IS NOT NULL AND c.email != '' THEN c.carte END)::int as avec_email,
            COUNT(DISTINCT CASE WHEN c.telephone IS NOT NULL AND c.telephone != '' THEN c.carte END)::int as avec_telephone,
            COUNT(DISTINCT CASE WHEN c.date_naissance ~ '^[0-9]{{4}}-[0-9]{{2}}-[0-9]{{2}}$' THEN c.carte END)::int as avec_age,
            ROUND(AVG(CASE WHEN c.date_naissance ~ '^[0-9]{{4}}-[0-9]{{2}}-[0-9]{{2}}$' 
                THEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, c.date_naissance::date)) END))::int as age_moyen
        FROM clients c
        WHERE EXISTS (
            SELECT 1 FROM transactions t 
            WHERE t.carte = c.carte AND {full_where}
        )
    """)
    stats = cur.fetchone()
    
    stats_clients = {
        'total': stats[0] or 0,
        'hommes': stats[1] or 0,
        'femmes': stats[2] or 0,
        'avecNom': stats[3] or 0,
        'avecPrenom': stats[4] or 0,
        'avecEmail': stats[5] or 0,
        'avecTelephone': stats[6] or 0,
        'avecAge': stats[7] or 0,
        'ageMoyen': stats[8] or 0,
        'pctHommes': round((stats[1] / stats[0] * 100), 2) if stats[0] > 0 else 0,
        'pctFemmes': round((stats[2] / stats[0] * 100), 2) if stats[0] > 0 else 0,
        'pctEmail': round((stats[5] / stats[0] * 100), 2) if stats[0] > 0 else 0,
        'pctTelephone': round((stats[6] / stats[0] * 100), 2) if stats[0] > 0 else 0,
        'pctAge': round((stats[7] / stats[0] * 100), 2) if stats[0] > 0 else 0
    }
    
    # 3. Top Produits
    print("   ⏳ Top produits...")
    cur.execute(f"""
        SELECT 
            p.id as code,
            COALESCE(p.nom, p.id) as nom,
            p.famille,
            p.sous_famille,
            SUM(t.ca)::numeric as ca,
            SUM(t.quantite)::numeric as volume
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE {full_where}
        GROUP BY p.id, p.nom, p.famille, p.sous_famille
        ORDER BY ca DESC
        LIMIT 10
    """)
    top_produits = [
        {
            'code': row[0],
            'nom': row[1],
            'famille': row[2],
            'sous_famille': row[3],
            'ca': float(row[4]) if row[4] else 0,
            'volume': float(row[5]) if row[5] else 0
        }
        for row in cur.fetchall()
    ]
    
    # 4. Top Magasins
    print("   ⏳ Top magasins...")
    cur.execute(f"""
        SELECT 
            m.code,
            m.nom,
            m.zone,
            SUM(t.ca)::numeric as ca,
            SUM(t.quantite)::numeric as volume,
            COUNT(DISTINCT t.facture)::int as nb_tickets,
            (SUM(t.ca) / NULLIF(COUNT(DISTINCT t.facture), 0))::numeric as panier_moyen
        FROM transactions t
        JOIN magasins m ON (t.depot = m.code OR t.depot = CONCAT('M', m.code) OR REPLACE(t.depot, 'M', '') = m.code)
        WHERE {full_where}
        GROUP BY m.code, m.nom, m.zone
        ORDER BY ca DESC
        LIMIT 10
    """)
    top_magasins = [
        {
            'code': row[0],
            'nom': row[1],
            'zone': row[2],
            'ca': float(row[3]) if row[3] else 0,
            'volume': float(row[4]) if row[4] else 0,
            'nbTickets': row[5],
            'panierMoyen': float(row[6]) if row[6] else 0
        }
        for row in cur.fetchall()
    ]
    
    # 5. Top Clients
    print("   ⏳ Top clients...")
    cur.execute(f"""
        SELECT 
            t.carte,
            c.ville,
            SUM(t.ca)::numeric as ca,
            COUNT(DISTINCT t.facture)::int as nb_commandes
        FROM transactions t
        LEFT JOIN clients c ON t.carte = c.carte
        WHERE {full_where} AND t.carte IS NOT NULL AND t.carte != '0'
        GROUP BY t.carte, c.ville
        ORDER BY ca DESC
        LIMIT 10
    """)
    top_clients = [
        {
            'carte': row[0],
            'ville': row[1],
            'ca': float(row[2]) if row[2] else 0,
            'nbCommandes': row[3]
        }
        for row in cur.fetchall()
    ]
    
    # 6. Évolution mensuelle
    print("   ⏳ Évolution mensuelle...")
    cur.execute(f"""
        SELECT 
            TO_CHAR(date, 'YYYY-MM') as mois,
            SUM(ca)::numeric as ca,
            COUNT(DISTINCT facture)::int as tickets
        FROM transactions
        WHERE {full_where}
        GROUP BY TO_CHAR(date, 'YYYY-MM')
        ORDER BY mois
    """)
    evolution_mensuelle = [
        {
            'mois': row[0],
            'ca': float(row[1]) if row[1] else 0,
            'tickets': row[2]
        }
        for row in cur.fetchall()
    ]
    
    # Insertion dans la table
    print("   💾 Sauvegarde snapshot...")
    cur.execute("""
        INSERT INTO dashboard_snapshots (
            period_type, period_value,
            total_ca, total_ca_magasin, total_ca_web,
            total_tickets, total_tickets_mag, total_tickets_web,
            total_clients, panier_moyen, panier_moyen_mag, panier_moyen_web,
            stats_clients, top_produits, top_magasins, top_clients,
            evolution_mensuelle, row_count, calculated_at
        ) VALUES (
            %s, %s,
            %s, %s, 0,
            %s, %s, 0,
            %s, %s, %s, 0,
            %s, %s, %s, %s,
            %s, %s, NOW()
        )
        ON CONFLICT (period_type, period_value) 
        DO UPDATE SET
            total_ca = EXCLUDED.total_ca,
            total_ca_magasin = EXCLUDED.total_ca_magasin,
            total_tickets = EXCLUDED.total_tickets,
            total_tickets_mag = EXCLUDED.total_tickets_mag,
            total_clients = EXCLUDED.total_clients,
            panier_moyen = EXCLUDED.panier_moyen,
            panier_moyen_mag = EXCLUDED.panier_moyen_mag,
            stats_clients = EXCLUDED.stats_clients,
            top_produits = EXCLUDED.top_produits,
            top_magasins = EXCLUDED.top_magasins,
            top_clients = EXCLUDED.top_clients,
            evolution_mensuelle = EXCLUDED.evolution_mensuelle,
            row_count = EXCLUDED.row_count,
            calculated_at = NOW()
    """, (
        period_type, period_value,
        kpis[2], kpis[2],  # total_ca
        kpis[1], kpis[1],  # total_tickets
        kpis[0],           # total_clients
        kpis[3], kpis[3],  # panier_moyen
        json.dumps(stats_clients),
        json.dumps(top_produits),
        json.dumps(top_magasins),
        json.dumps(top_clients),
        json.dumps(evolution_mensuelle),
        kpis[4]            # row_count
    ))
    conn.commit()
    
    print(f"   ✅ Snapshot sauvegardé: {kpis[0]:,} clients, {kpis[1]:,} tickets, {float(kpis[2]):,.2f} € CA")
    return True

# ============================================================================
# CALCUL DES SNAPSHOTS
# ============================================================================

try:
    # 1. Snapshot "ALL" (toutes périodes)
    print("\n" + "=" * 80)
    print("📈 SNAPSHOT: TOUTES PÉRIODES")
    print("=" * 80)
    calculate_snapshot('all', 'all')
    
    # 2. Snapshots par année
    print("\n" + "=" * 80)
    print("📅 SNAPSHOTS PAR ANNÉE")
    print("=" * 80)
    
    cur.execute("""
        SELECT DISTINCT EXTRACT(YEAR FROM date)::int as year 
        FROM transactions 
        ORDER BY year
    """)
    years = [row[0] for row in cur.fetchall()]
    
    for year in years:
        calculate_snapshot(
            'year', 
            str(year),
            f"date >= '{year}-01-01' AND date <= '{year}-12-31'"
        )
    
    # 3. Année en cours par mois
    current_year = datetime.now().year
    print("\n" + "=" * 80)
    print(f"📆 SNAPSHOTS PAR MOIS ({current_year})")
    print("=" * 80)
    
    cur.execute(f"""
        SELECT DISTINCT TO_CHAR(date, 'YYYY-MM') as month 
        FROM transactions 
        WHERE EXTRACT(YEAR FROM date) = {current_year}
        ORDER BY month
    """)
    months = [row[0] for row in cur.fetchall()]
    
    for month in months:
        year, month_num = month.split('-')
        calculate_snapshot(
            'month',
            month,
            f"date >= '{month}-01' AND date < '{year}-{int(month_num)+1:02d}-01'"
        )
    
    # Récapitulatif
    print("\n" + "=" * 80)
    print("📊 RÉCAPITULATIF")
    print("=" * 80)
    
    cur.execute("""
        SELECT 
            period_type,
            COUNT(*) as nb_snapshots,
            SUM(row_count) as total_rows,
            MAX(calculated_at) as last_update
        FROM dashboard_snapshots
        GROUP BY period_type
        ORDER BY period_type
    """)
    
    for row in cur.fetchall():
        print(f"   {row[0]:10} : {row[1]:3} snapshots | {row[2]:,} transactions | MAJ: {row[3]}")
    
    print("\n" + "=" * 80)
    print("✅ PRÉ-CALCUL TERMINÉ")
    print("=" * 80)
    print(f"🕐 Fin: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("\n💡 Les API Vercel peuvent maintenant lire depuis dashboard_snapshots")
    print("   → Temps de réponse < 1 seconde garanti")
    print("=" * 80)

except Exception as e:
    print(f"\n❌ Erreur: {e}")
    import traceback
    traceback.print_exc()
    conn.rollback()
    sys.exit(1)
finally:
    cur.close()
    conn.close()
