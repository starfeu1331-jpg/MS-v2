#!/usr/bin/env python3
"""Créer les fonctions SQL dans PostgreSQL"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.database')
DATABASE_URL = os.getenv('DATABASE_URL')

print("🔌 Connexion à PostgreSQL OVH...")
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("📊 Création des fonctions SQL...")
with open('sql-functions.sql', 'r') as f:
    cur.execute(f.read())

conn.commit()
print("✅ Fonctions SQL créées avec succès !")

# Test
print("\n🧪 Test de la fonction get_dashboard...")
cur.execute("SELECT get_dashboard('year', '2025')")
result = cur.fetchone()[0]
print(f"✅ Résultat: {len(str(result))} caractères")

cur.close()
conn.close()
