# Fichiers CSV pour mise à jour de la base de données
# Ne PAS committer ces fichiers !

# Format attendu pour chaque fichier :

## transactions.csv
# facture,date,carte,depot,produit,ca,quantite
# FAC001,2025-01-28,CL123,MAG01,PROD456,150.50,2

## clients.csv  
# carte,ville,cp
# CL123,PARIS,75001

## produits.csv
# id,famille,sous_famille,sous_sous_famille,sous_sous_sous_famille
# PROD456,Décoration,Vases,Vases grands,Vases modernes

## depots.csv (optionnel)
# code,nom
# MAG01,Magasin Paris Centre

# ⚠️ IMPORTANT :
# - Placer vos CSV ici avant d'exécuter les scripts
# - update-daily.py : fichiers du jour uniquement
# - update-weekly.py : fichiers complets (toutes les données)
