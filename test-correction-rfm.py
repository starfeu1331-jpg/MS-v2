#!/usr/bin/env python3
"""
Test de la correction RFM : vérifie que la fréquence = nombre de tickets
"""

import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_engine(DATABASE_URL)

carte = '1632601'

print(f"\n🔍 Test de la correction RFM pour la carte {carte}")
print("="*60)

with engine.connect() as conn:
    # Simulation de la nouvelle requête RFM (web + magasin)
    result = conn.execute(text("""
        WITH client_metrics AS (
          SELECT 
            c.carte::text,
            c.nom::text,
            c.prenom::text,
            COUNT(DISTINCT t.facture)::int as frequency,
            SUM(t.ca)::numeric as monetary,
            EXTRACT(DAY FROM (CURRENT_DATE - MAX(t.date)))::int as recency
          FROM clients c
          INNER JOIN transactions t ON c.carte = t.carte
          WHERE c.carte = :carte
          GROUP BY c.carte, c.nom, c.prenom
          HAVING SUM(t.ca) > 0
        )
        SELECT * FROM client_metrics
    """), {"carte": carte})
    
    client = result.fetchone()
    
    if client:
        print(f"\n✅ Résultat de la requête RFM corrigée :")
        print(f"  • Carte      : {client[0]}")
        print(f"  • Nom        : {client[1]} {client[2]}")
        print(f"  • Fréquence  : {client[3]} tickets")
        print(f"  • CA Total   : {float(client[4]):.2f}€")
        print(f"  • Récence    : {client[5]} jours")
        
        # Vérification
        expected_frequency = 10
        actual_frequency = client[3]
        
        if actual_frequency == expected_frequency:
            print(f"\n🎉 SUCCÈS ! La fréquence est correcte : {actual_frequency} tickets")
        else:
            print(f"\n⚠️  ATTENTION : fréquence = {actual_frequency}, attendu = {expected_frequency}")
    else:
        print(f"\n❌ Aucun résultat trouvé pour la carte {carte}")

print("="*60 + "\n")
