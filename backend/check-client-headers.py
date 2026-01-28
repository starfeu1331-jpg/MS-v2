#!/usr/bin/env python3
import csv

csv_path = '/Users/marceau/Desktop/test data/data/nouveaux/client.csv'

with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.reader(f, delimiter=';')
    headers = next(reader)
    
    print("📋 EN-TÊTES DU FICHIER CLIENT.CSV:\n")
    for i, header in enumerate(headers):
        print(f"   {i}: {header}")
    
    print("\n📊 EXEMPLE DE DONNÉES (première ligne):\n")
    first_row = next(reader)
    for i, val in enumerate(first_row):
        if i < len(headers):
            print(f"   {headers[i]}: {val}")
