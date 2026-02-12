#!/usr/bin/env python3
"""
Vérification de la carte 1632601 : 
- Nombre de transactions (lignes de produits)
- Nombre de tickets (factures uniques)
"""

import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

# Connexion à la base de données
DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_engine(DATABASE_URL)

carte = '1632601'

print(f"\n🔍 Vérification de la carte {carte}")
print("="*60)

with engine.connect() as conn:
    # Nombre total de transactions (lignes)
    result = conn.execute(text("""
        SELECT COUNT(*) as nb_transactions 
        FROM transactions 
        WHERE carte = :carte
    """), {"carte": carte})
    nb_transactions = result.fetchone()[0]
    
    # Nombre de tickets uniques (factures distinctes)
    result = conn.execute(text("""
        SELECT COUNT(DISTINCT facture) as nb_tickets 
        FROM transactions 
        WHERE carte = :carte
    """), {"carte": carte})
    nb_tickets = result.fetchone()[0]
    
    # CA total
    result = conn.execute(text("""
        SELECT SUM(ca) as ca_total 
        FROM transactions 
        WHERE carte = :carte
    """), {"carte": carte})
    ca_total = result.fetchone()[0]
    
    # Quelques exemples de factures avec compte de lignes
    result = conn.execute(text("""
        SELECT 
            facture,
            COUNT(*) as nb_lignes,
            SUM(ca) as ca_ticket,
            date::text as date_ticket
        FROM transactions 
        WHERE carte = :carte
        GROUP BY facture, date
        ORDER BY date DESC
        LIMIT 10
    """), {"carte": carte})
    
    print(f"\n📊 RÉSULTATS :")
    print(f"  • Nombre de TRANSACTIONS (lignes) : {nb_transactions}")
    print(f"  • Nombre de TICKETS (factures)    : {nb_tickets}")
    print(f"  • CA Total                         : {ca_total:.2f}€")
    print(f"  • Panier moyen (CA/tickets)        : {ca_total/nb_tickets if nb_tickets > 0 else 0:.2f}€")
    
    print(f"\n📝 Exemples de tickets (10 derniers) :")
    print(f"{'Facture':<20} {'Nb lignes':<12} {'CA':<12} {'Date'}")
    print("-"*60)
    
    for row in result:
        print(f"{row[0]:<20} {row[1]:<12} {row[2]:<12.2f} {row[3]}")
    
    print("\n" + "="*60)
    print(f"❌ PROBLÈME IDENTIFIÉ :")
    print(f"   La 'fréquence' dans l'app = {nb_transactions} (transactions/lignes)")
    print(f"   Mais elle devrait être   = {nb_tickets} (tickets/factures)")
    print("="*60 + "\n")
