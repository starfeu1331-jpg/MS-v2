import psycopg2
conn = psycopg2.connect(host='yu4496-002.eu.clouddb.ovh.net', port=35847, database='basedecordb', user='decordb', password='OVHdecordb26', sslmode='require')
cur = conn.cursor()
cur.execute("""
    WITH top_products AS (
        SELECT p.id, MIN(p.famille) as famille, MIN(p.sous_famille) as sf,
               COUNT(DISTINCT (t.facture || '_' || t.date::text)) as n_tickets
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE t.ca > 0 AND t.facture IS NOT NULL AND t.depot != '41'
        GROUP BY p.id
        ORDER BY n_tickets DESC
        LIMIT 150
    )
    SELECT famille, COUNT(*) as nb, SUM(n_tickets) as tix
    FROM top_products GROUP BY famille ORDER BY nb DESC LIMIT 15
""")
print('TOP 150 PRODUITS par famille:')
for r in cur.fetchall():
    print(f'  {r[0]:25s}: {r[1]:3d} produits ({r[2]:,} tickets)')

cur.execute("""
    SELECT p.id, p.designation, p.famille, p.sous_famille,
           COUNT(DISTINCT (t.facture || '_' || t.date::text)) as n_tickets
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    WHERE t.ca > 0 AND t.facture IS NOT NULL AND t.depot != '41'
    GROUP BY p.id, p.designation, p.famille, p.sous_famille
    ORDER BY n_tickets DESC LIMIT 20
""")
print()
print('TOP 20 PRODUITS les plus frequents:')
for i, r in enumerate(cur.fetchall()):
    d = (r[1] or '')[:40]
    print(f'  #{i+1:2d} {d:40s} [{r[2]} > {r[3]}] - {r[4]:,} tickets')

# Analyse: sous-familles des top produits
print()
print('TOP 150 PRODUITS par SOUS-FAMILLE:')
cur.execute("""
    WITH top_products AS (
        SELECT p.id, MIN(p.sous_famille) as sf, MIN(p.sous_sous_famille) as ssf,
               COUNT(DISTINCT (t.facture || '_' || t.date::text)) as n_tickets
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE t.ca > 0 AND t.facture IS NOT NULL AND t.depot != '41'
        GROUP BY p.id
        ORDER BY n_tickets DESC
        LIMIT 150
    )
    SELECT sf, COUNT(*) as nb, SUM(n_tickets) as tix
    FROM top_products GROUP BY sf ORDER BY nb DESC LIMIT 15
""")
for r in cur.fetchall():
    print(f'  {(r[0] or "NULL"):30s}: {r[1]:3d} produits ({r[2]:,} tickets)')

# Check: combien de paires même sous-famille dans le top?
print()
print('DIAGNOSTIC: % de paires meme sous-famille dans top 50 par lift')
cur.execute("""
    WITH frequent_items AS (
        SELECT p.id::text as item_id
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE t.ca > 0 AND t.facture IS NOT NULL AND t.depot != '41' AND p.id IS NOT NULL
        GROUP BY p.id
        ORDER BY COUNT(DISTINCT (t.facture || '_' || t.date::text)) DESC
        LIMIT 150
    ),
    baskets AS (
        SELECT (t.facture || '_' || t.date::text) as ticket_id,
               p.id::text as item_id, MIN(p.sous_famille::text) as sf
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE t.ca > 0 AND t.facture IS NOT NULL AND t.depot != '41'
          AND p.id::text IN (SELECT item_id FROM frequent_items)
        GROUP BY ticket_id, p.id
    ),
    ticket_items AS (
        SELECT ticket_id FROM baskets GROUP BY ticket_id HAVING COUNT(*) >= 2 AND COUNT(*) <= 15
    ),
    pairs AS (
        SELECT a.sf as sf_a, b.sf as sf_b, COUNT(*) as cnt
        FROM baskets a
        JOIN baskets b ON a.ticket_id = b.ticket_id AND a.item_id < b.item_id
        JOIN ticket_items ti ON a.ticket_id = ti.ticket_id
        GROUP BY a.sf, b.sf
        HAVING COUNT(*) >= 10
    )
    SELECT 
        SUM(CASE WHEN sf_a = sf_b THEN cnt ELSE 0 END) as same_sf,
        SUM(CASE WHEN sf_a != sf_b THEN cnt ELSE 0 END) as diff_sf,
        SUM(cnt) as total
    FROM pairs
""")
r = cur.fetchone()
print(f'  Meme sous-famille: {r[0]:,} paires ({r[0]*100//r[2]}%)')
print(f'  Diff sous-famille: {r[1]:,} paires ({r[1]*100//r[2]}%)')

conn.close()
