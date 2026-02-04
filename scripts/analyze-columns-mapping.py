#!/usr/bin/env python3
"""
Mapping détaillé des nouvelles colonnes vs anciennes
"""
import pandas as pd

print("=" * 80)
print("MAPPING DES NOUVELLES DONNÉES vs ANCIENNES")
print("=" * 80)

# CLIENTS
print("\n" + "=" * 80)
print("1. FICHIER CLIENTS")
print("=" * 80)
print("\n✅ COLONNES AJOUTÉES PAR NICOLAS:")
print("  - Colonne 1: N° Carte fidélité (était déjà là)")
print("  - Colonne 2: Nom correspondant ⭐ NOUVEAU")
print("  - Colonne 3: Prénom correspondant ⭐ NOUVEAU")
print("  - Colonne 4: Date création")
print("  - Colonne 5: Statut")
print("  - Colonne 6: Date validité + Civilité + Date naissance (fusionnées?)")
print("  - Colonne 7: Sexe")
print("  - Colonne 8: Adresse électronique ⭐ NOUVEAU (Email)")
print("  - Colonne 9: N° Téléphone ⭐ NOUVEAU")
print("  - Colonnes 10-14: Adresses, CP, Ville")

# Vérifions avec pandas
df_clients = pd.read_csv('data/nouveaux/fevrier2026/Fichier_client_02-02-26 12.csv', 
                         sep=';', encoding='ISO-8859-1', nrows=100)

print(f"\n📊 Statistiques (100 premières lignes):")
for i, col in enumerate(df_clients.columns):
    non_null = df_clients[col].notna().sum()
    pct = (non_null / len(df_clients)) * 100
    print(f"  Colonne {i+1:2d}: {non_null:3d}/100 remplies ({pct:5.1f}%) - {col[:40]}")

# PRODUITS
print("\n" + "=" * 80)
print("2. FICHIER PRODUITS")
print("=" * 80)
print("\n✅ COLONNES AJOUTÉES PAR NICOLAS:")
print("  - Colonne 1: N° Produit")
print("  - Colonne 2: Désignation produit ⭐ NOUVEAU (Nom)")
print("  - Colonne 3: Désignation produit.1 (doublon?)")
print("  - Colonne 4: Référence interne ⭐ NOUVEAU")
print("  - Colonne 5: Libellé Famille")
print("  - Colonne 6: Libellé Sous-famille")
print("  - Colonne 7: Libellé Sous-sous-famille")
print("  - Colonne 8: Libellé SSS/Famille")
print("  - Colonne 9: Produit web ⭐ NOUVEAU (yes/no)")

df_produits = pd.read_csv('data/nouveaux/fevrier2026/produits.csv',
                          sep=';', encoding='ISO-8859-1', nrows=100)

print(f"\n📊 Statistiques (100 premières lignes):")
for i, col in enumerate(df_produits.columns):
    non_null = df_produits[col].notna().sum()
    pct = (non_null / len(df_produits)) * 100
    print(f"  Colonne {i+1:2d}: {non_null:3d}/100 remplies ({pct:5.1f}%) - {col[:40]}")

# TRANSACTIONS
print("\n" + "=" * 80)
print("3. FICHIER LIGNEVENTE (Transactions)")
print("=" * 80)
print("\n✅ COLONNES AJOUTÉES PAR NICOLAS:")
print("  - Colonne 1: N° Carte fidélité")
print("  - Colonne 2: N° Facture client")
print("  - Colonne 3: Dépôt")
print("  - Colonne 4: Date facture")
print("  - Colonne 5: Heure mouvement ⭐ NOUVEAU")
print("  - Colonne 6: N° Produit")
print("  - Colonne 7: Quantité unitaire")
print("  - Colonne 8: Prix vente net (était déjà là)")
print("  - Colonne 9: Mt T.T.C ⭐ NOUVEAU (Montant TTC)")

df_ventes = pd.read_csv('data/nouveaux/fevrier2026/lignevente.csv',
                        sep=';', encoding='ISO-8859-1', nrows=100)

print(f"\n📊 Statistiques (100 premières lignes):")
for i, col in enumerate(df_ventes.columns):
    non_null = df_ventes[col].notna().sum()
    pct = (non_null / len(df_ventes)) * 100
    print(f"  Colonne {i+1}: {non_null:3d}/100 remplies ({pct:5.1f}%) - {col[:40]}")

print("\n" + "=" * 80)
print("🎯 RÉSUMÉ DES AJOUTS")
print("=" * 80)
print("\n📧 CLIENTS:")
print("  ✅ Nom")
print("  ✅ Prénom")
print("  ✅ Email (adresse électronique)")
print("  ✅ Téléphone")

print("\n🛍️ PRODUITS:")
print("  ✅ Nom produit (désignation)")
print("  ✅ Référence interne")
print("  ✅ Produit web (yes/no)")

print("\n💰 TRANSACTIONS:")
print("  ✅ Heure mouvement")
print("  ✅ Montant TTC")

print("\n❌ CE QUI MANQUE ENCORE:")
print("  - Canal WEB vs MAGASIN (pas de colonne explicite)")
print("  - Prix achat produit")
print("  - Stock produit")
print("  - Statut transaction (validée/annulée)")
