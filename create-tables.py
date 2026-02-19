#!/usr/bin/env python3
"""Créer les tables snapshots dans PostgreSQL"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.database')
DATABASE_URL = os.getenv('DATABASE_URL')

print("🔌 Connexion à PostgreSQL OVH...")
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("📊 Création table dashboard_snapshots...")
with open('create-snapshots-tables.sql', 'r') as f:
    cur.execute(f.read())

conn.commit()
print("✅ Tables créées avec succès !")

cur.close()
conn.close()
