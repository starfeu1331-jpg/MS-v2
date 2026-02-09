#!/usr/bin/env python3
"""
Script pour ajouter le filtre depot NOT IN ('1', '41', '42') 
dans toutes les requêtes de l'API dashboard
"""
import re

# Lire le fichier
with open('api/dashboard.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern pour trouver WHERE date >= et ajouter le filtre depot
# Pattern 1: WHERE date >= '...' AND date <= '...'
pattern1 = r"(WHERE date >= '[^']+' AND date <= '[^']+')"
replacement1 = r"\1 AND depot NOT IN ('1', '41', '42')"

# Pattern 2: WHERE t.date >= '...' AND t.date <= '...'
pattern2 = r"(WHERE t\.date >= '[^']+' AND t\.date <= '[^']+')"
replacement2 = r"\1 AND t.depot NOT IN ('1', '41', '42')"

# Appliquer les remplacements
content = re.sub(pattern1, replacement1, content)
content = re.sub(pattern2, replacement2, content)

# Cas spéciaux sans WHERE (requêtes sur toutes les données)
# FROM transactions\n      `) sans WHERE
content = re.sub(
    r'(FROM transactions)\s*(\n\s*\))',
    r'\1\n        WHERE depot NOT IN (\'1\', \'41\', \'42\')\2',
    content
)

content = re.sub(
    r'(FROM transactions)\s*(\n\s*GROUP BY)',
    r'\1\n        WHERE depot NOT IN (\'1\', \'41\', \'42\')\2',
    content
)

# Écrire le résultat
with open('api/dashboard.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Filtrage des dépôts 1, 41, 42 ajouté avec succès")
print("📝 Vérifiez le fichier api/dashboard.js")
