import duckdb
import sys

conn = duckdb.connect('/Users/marceau/Desktop/test data/decor-analytics/public/duckdb.db', read_only=True)

print('📊 Analyse CA 2025:\n')

# Échantillon avec détails
sample = conn.execute('''
    SELECT facture, date, quantite, ca, (quantite * ca) as ca_calcule
    FROM transactions
    WHERE date >= '2025-01-01' AND date <= '2025-12-31'
    LIMIT 10
''').fetchall()

print('Échantillon (quantité, ca, quantité*ca):')
for row in sample:
    print(f'   Facture {row[0]} | Qté: {row[2]:.2f} | CA: {row[3]:.2f}€ | Qté×CA: {row[4]:.2f}€')

# Comparaison totaux
result = conn.execute('''
    SELECT 
        SUM(ca) as ca_colonne,
        SUM(quantite * ca) as ca_calcule
    FROM transactions
    WHERE date >= '2025-01-01' AND date <= '2025-12-31'
''').fetchone()

print(f'\n💰 TOTAUX 2025:')
print(f'   CA (colonne):         {result[0]:>15,.2f} €')
print(f'   CA (quantité × ca):   {result[1]:>15,.2f} €')

# Total toutes années
total = conn.execute('''
    SELECT 
        SUM(ca) as ca_colonne,
        SUM(quantite * ca) as ca_calcule
    FROM transactions
''').fetchone()

print(f'\n💰 TOTAL TOUTES ANNÉES:')
print(f'   CA (colonne):         {total[0]:>15,.2f} €')
print(f'   CA (quantité × ca):   {total[1]:>15,.2f} €')

conn.close()
