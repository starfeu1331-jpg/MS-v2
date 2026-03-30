"""
Analyse des résultats cross-selling pour comprendre pourquoi
les associations produit sont évidentes / inintéressantes
"""
import psycopg2
import os

conn = psycopg2.connect(
    host="yu4496-002.eu.clouddb.ovh.net",
    port=35847,
    database="basedecordb",
    user="decordb",
    password="OVHdecordb26",
    sslmode="require"
)
cur = conn.cursor()

print("=" * 80)
print("ANALYSE CROSS-SELLING : Pourquoi les résultats sont-ils évidents ?")
print("=" * 80)

# 1. Combien de tickets au total ?
cur.execute("""
    SELECT COUNT(DISTINCT (facture || '_' || date::text)) as total_tickets,
           COUNT(*) as total_lines
    FROM transactions 
    WHERE ca > 0 AND facture IS NOT NULL AND depot != '41'
""")
r = cur.fetchone()
print(f"\n📊 Volume: {r[0]:,} tickets, {r[1]:,} lignes")

# 2. Distribution du nombre de produits (distincts) par ticket
print("\n📦 Distribution du nombre de produits DISTINCTS par ticket:")
cur.execute("""
    WITH ticket_items AS (
        SELECT (t.facture || '_' || t.date::text) as tid,
               COUNT(DISTINCT p.id) as n_products,
               COUNT(DISTINCT p.famille) as n_families,
               COUNT(DISTINCT p.sous_famille) as n_sf
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE t.ca > 0 AND t.facture IS NOT NULL AND t.depot != '41'
        GROUP BY tid
    )
    SELECT 
        n_products,
        COUNT(*) as nb_tickets,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as pct
    FROM ticket_items
    GROUP BY n_products
    ORDER BY n_products
    LIMIT 20
""")
for row in cur.fetchall():
    bar = "█" * int(row[2])
    print(f"  {row[0]:3d} produits: {row[1]:6,} tickets ({row[2]}%) {bar}")

# 3. Top associations produit x produit actuelles (triées par lift)
print("\n" + "=" * 80)
print("🔍 TOP 30 ASSOCIATIONS PRODUIT x PRODUIT (par Lift)")
print("=" * 80)
cur.execute("""
    WITH frequent_items AS (
        SELECT p.id::text as item_id
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE t.ca > 0 AND t.facture IS NOT NULL AND t.depot != '41'
          AND p.id IS NOT NULL
        GROUP BY p.id
        ORDER BY COUNT(DISTINCT (t.facture || '_' || t.date::text)) DESC
        LIMIT 150
    ),
    baskets AS (
        SELECT 
            (t.facture || '_' || t.date::text) as ticket_id,
            p.id::text as item_id,
            MIN(p.designation::text) as item_name,
            MIN(p.famille::text) as famille,
            MIN(p.sous_famille::text) as sous_famille
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
        SELECT
            a.item_id as id_a, b.item_id as id_b,
            a.item_name as name_a, b.item_name as name_b,
            a.famille as fam_a, b.famille as fam_b,
            a.sous_famille as sf_a, b.sous_famille as sf_b,
            COUNT(*)::int as pair_count
        FROM baskets a
        JOIN baskets b ON a.ticket_id = b.ticket_id AND a.item_id < b.item_id
        JOIN ticket_items ti ON a.ticket_id = ti.ticket_id
        GROUP BY a.item_id, b.item_id, a.item_name, b.item_name, a.famille, b.famille, a.sous_famille, b.sous_famille
        HAVING COUNT(*) >= 10
    ),
    item_support AS (
        SELECT item_id, COUNT(DISTINCT ticket_id)::int as item_tickets
        FROM baskets GROUP BY item_id
    ),
    total AS (
        SELECT COUNT(DISTINCT (t.facture || '_' || t.date::text))::int as total
        FROM transactions t
        WHERE t.ca > 0 AND t.facture IS NOT NULL AND t.depot != '41'
    )
    SELECT
        p.name_a, p.name_b,
        p.fam_a, p.fam_b,
        p.sf_a, p.sf_b,
        p.pair_count,
        sa.item_tickets as tix_a,
        sb.item_tickets as tix_b,
        ROUND(p.pair_count * 100.0 / sa.item_tickets, 1) as conf_ab,
        ROUND(p.pair_count * 100.0 / sb.item_tickets, 1) as conf_ba,
        ROUND(
            (p.pair_count::numeric / (SELECT total FROM total))
            / ((sa.item_tickets::numeric / (SELECT total FROM total)) * (sb.item_tickets::numeric / (SELECT total FROM total))),
            2
        ) as lift,
        CASE WHEN p.fam_a = p.fam_b THEN 'MÊME FAMILLE' ELSE 'DIFF FAMILLE' END as same_fam,
        CASE WHEN p.sf_a = p.sf_b THEN 'MÊME SF' ELSE 'DIFF SF' END as same_sf
    FROM pairs p
    JOIN item_support sa ON sa.item_id = p.id_a
    JOIN item_support sb ON sb.item_id = p.id_b
    ORDER BY lift DESC, pair_count DESC
    LIMIT 30
""")
results = cur.fetchall()
same_fam_count = 0
same_sf_count = 0
for i, r in enumerate(results):
    name_a, name_b = r[0][:35], r[1][:35]
    fam_a, fam_b = r[2], r[3]
    sf_a, sf_b = r[4], r[5]
    pair_count = r[6]
    tix_a, tix_b = r[7], r[8]
    conf_ab, conf_ba = r[9], r[10]
    lift = r[11]
    same_fam, same_sf = r[12], r[13]
    if same_fam == 'MÊME FAMILLE': same_fam_count += 1
    if same_sf == 'MÊME SF': same_sf_count += 1
    
    flag = "⚠️" if same_fam == 'MÊME FAMILLE' else "✨"
    print(f"\n  {flag} #{i+1} Lift={lift}")
    print(f"     A: {name_a} [{fam_a} > {sf_a}]")
    print(f"     B: {name_b} [{fam_b} > {sf_b}]")
    print(f"     {pair_count} tickets ensemble | Conf A→B: {conf_ab}% | Conf B→A: {conf_ba}%")
    print(f"     {same_fam} | {same_sf}")

print(f"\n📊 BILAN: {same_fam_count}/{len(results)} dans la MÊME famille, {same_sf_count}/{len(results)} dans la MÊME sous-famille")

# 4. Si on exclut les paires même famille, ça donne quoi ?
print("\n" + "=" * 80)
print("✨ TOP 20 ASSOCIATIONS PRODUIT INTER-FAMILLE (familles différentes, par Lift)")
print("=" * 80)
cur.execute("""
    WITH frequent_items AS (
        SELECT p.id::text as item_id
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE t.ca > 0 AND t.facture IS NOT NULL AND t.depot != '41'
          AND p.id IS NOT NULL
        GROUP BY p.id
        ORDER BY COUNT(DISTINCT (t.facture || '_' || t.date::text)) DESC
        LIMIT 150
    ),
    baskets AS (
        SELECT 
            (t.facture || '_' || t.date::text) as ticket_id,
            p.id::text as item_id,
            MIN(p.designation::text) as item_name,
            MIN(p.famille::text) as famille,
            MIN(p.sous_famille::text) as sous_famille
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
        SELECT
            a.item_id as id_a, b.item_id as id_b,
            a.item_name as name_a, b.item_name as name_b,
            a.famille as fam_a, b.famille as fam_b,
            a.sous_famille as sf_a, b.sous_famille as sf_b,
            COUNT(*)::int as pair_count
        FROM baskets a
        JOIN baskets b ON a.ticket_id = b.ticket_id AND a.item_id < b.item_id
        JOIN ticket_items ti ON a.ticket_id = ti.ticket_id
        WHERE a.famille != b.famille  -- UNIQUEMENT cross-famille
        GROUP BY a.item_id, b.item_id, a.item_name, b.item_name, a.famille, b.famille, a.sous_famille, b.sous_famille
        HAVING COUNT(*) >= 10
    ),
    item_support AS (
        SELECT item_id, COUNT(DISTINCT ticket_id)::int as item_tickets
        FROM baskets GROUP BY item_id
    ),
    total AS (
        SELECT COUNT(DISTINCT (t.facture || '_' || t.date::text))::int as total
        FROM transactions t
        WHERE t.ca > 0 AND t.facture IS NOT NULL AND t.depot != '41'
    )
    SELECT
        p.name_a, p.name_b,
        p.fam_a, p.fam_b,
        p.sf_a, p.sf_b,
        p.pair_count,
        sa.item_tickets as tix_a,
        sb.item_tickets as tix_b,
        ROUND(p.pair_count * 100.0 / sa.item_tickets, 1) as conf_ab,
        ROUND(p.pair_count * 100.0 / sb.item_tickets, 1) as conf_ba,
        ROUND(
            (p.pair_count::numeric / (SELECT total FROM total))
            / ((sa.item_tickets::numeric / (SELECT total FROM total)) * (sb.item_tickets::numeric / (SELECT total FROM total))),
            2
        ) as lift
    FROM pairs p
    JOIN item_support sa ON sa.item_id = p.id_a
    JOIN item_support sb ON sb.item_id = p.id_b
    ORDER BY lift DESC, pair_count DESC
    LIMIT 20
""")
for i, r in enumerate(cur.fetchall()):
    name_a, name_b = r[0][:40], r[1][:40]
    fam_a, fam_b = r[2], r[3]
    sf_a, sf_b = r[4], r[5]
    pair_count = r[6]
    conf_ab, conf_ba = r[9], r[10]
    lift = r[11]
    print(f"\n  ✨ #{i+1} Lift={lift}")
    print(f"     A: {name_a} [{fam_a} > {sf_a}]")
    print(f"     B: {name_b} [{fam_b} > {sf_b}]")
    print(f"     {pair_count} tickets ensemble | Conf: {conf_ab}% / {conf_ba}%")

# 5. Au niveau famille x famille, même question
print("\n" + "=" * 80)
print("🏠 TOP 20 ASSOCIATIONS FAMILLE x FAMILLE (par Lift)")
print("=" * 80)
cur.execute("""
    WITH baskets AS (
        SELECT 
            (t.facture || '_' || t.date::text) as ticket_id,
            p.famille::text as item_id,
            MIN(p.famille::text) as item_name
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE t.ca > 0 AND t.facture IS NOT NULL AND t.depot != '41'
          AND p.famille IS NOT NULL AND p.famille != ''
        GROUP BY ticket_id, p.famille
    ),
    ticket_items AS (
        SELECT ticket_id FROM baskets GROUP BY ticket_id HAVING COUNT(*) >= 2 AND COUNT(*) <= 15
    ),
    pairs AS (
        SELECT
            LEAST(a.item_id, b.item_id) as item_a,
            GREATEST(a.item_id, b.item_id) as item_b,
            COUNT(*)::int as pair_count
        FROM baskets a
        JOIN baskets b ON a.ticket_id = b.ticket_id AND a.item_id < b.item_id
        JOIN ticket_items ti ON a.ticket_id = ti.ticket_id
        GROUP BY LEAST(a.item_id, b.item_id), GREATEST(a.item_id, b.item_id)
        HAVING COUNT(*) >= 5
    ),
    item_support AS (
        SELECT item_id, COUNT(DISTINCT ticket_id)::int as item_tickets
        FROM baskets GROUP BY item_id
    ),
    total AS (
        SELECT COUNT(DISTINCT (t.facture || '_' || t.date::text))::int as total
        FROM transactions t
        WHERE t.ca > 0 AND t.facture IS NOT NULL AND t.depot != '41'
    )
    SELECT
        p.item_a, p.item_b,
        p.pair_count,
        sa.item_tickets, sb.item_tickets,
        ROUND(p.pair_count * 100.0 / sa.item_tickets, 1) as conf_ab,
        ROUND(p.pair_count * 100.0 / sb.item_tickets, 1) as conf_ba,
        ROUND(
            (p.pair_count::numeric / (SELECT total FROM total))
            / ((sa.item_tickets::numeric / (SELECT total FROM total)) * (sb.item_tickets::numeric / (SELECT total FROM total))),
            2
        ) as lift
    FROM pairs p
    JOIN item_support sa ON sa.item_id = p.item_a
    JOIN item_support sb ON sb.item_id = p.item_b
    ORDER BY lift DESC, pair_count DESC
    LIMIT 20
""")
for i, r in enumerate(cur.fetchall()):
    print(f"  #{i+1:2d} {r[0]:25s} + {r[1]:25s} | Lift={r[7]} | {r[2]:,} tickets | Conf: {r[5]}%/{r[6]}%")

# 6. Comprendre la structure: combien de familles, sous-familles, etc
print("\n" + "=" * 80)
print("📊 STRUCTURE DU CATALOGUE")
print("=" * 80)
for level in ['famille', 'sous_famille', 'sous_sous_famille', 'sous_sous_sous_famille']:
    cur.execute(f"""
        SELECT COUNT(DISTINCT {level}) 
        FROM produits 
        WHERE {level} IS NOT NULL AND {level} != ''
    """)
    count = cur.fetchone()[0]
    print(f"  {level:30s}: {count:,} valeurs distinctes")

cur.execute("SELECT COUNT(DISTINCT id) FROM produits WHERE id IS NOT NULL")
print(f"  {'produit (id)':30s}: {cur.fetchone()[0]:,} valeurs distinctes")

# 7. Analyse: les top 150 produits, ils appartiennent à combien de familles ?
print("\n📊 TOP 150 PRODUITS - Répartition par famille:")
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
    SELECT famille, COUNT(*) as nb_products, SUM(n_tickets) as total_tix
    FROM top_products
    GROUP BY famille
    ORDER BY nb_products DESC
    LIMIT 15
""")
for r in cur.fetchall():
    print(f"  {r[0]:25s}: {r[1]:3d} produits (total {r[2]:,} tickets)")

# 8. Quels sont les produits top 10 les plus fréquents ?
print("\n📊 TOP 20 PRODUITS les plus fréquents:")
cur.execute("""
    SELECT p.id, p.designation, p.famille, p.sous_famille,
           COUNT(DISTINCT (t.facture || '_' || t.date::text)) as n_tickets
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    WHERE t.ca > 0 AND t.facture IS NOT NULL AND t.depot != '41'
    GROUP BY p.id, p.designation, p.famille, p.sous_famille
    ORDER BY n_tickets DESC
    LIMIT 20
""")
for i, r in enumerate(cur.fetchall()):
    print(f"  #{i+1:2d} {r[1][:40]:40s} [{r[2]} > {r[3]}] — {r[4]:,} tickets")

cur.close()
conn.close()
print("\n✅ Analyse terminée")
