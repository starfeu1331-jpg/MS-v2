#!/usr/bin/env python3
import subprocess, sys, os

try:
    import pdfplumber
except ImportError:
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'pdfplumber', '-q'])
    import pdfplumber

base = "/Users/marceau/Desktop/Data update/Données hebdo"
files = [
    "S09 2026 Détail.pdf",
    "Février 2026 Détail.pdf",
    "Cumul Février 2026 Détail.pdf"
]

for fname in files:
    path = os.path.join(base, fname)
    print("\n" + "=" * 80)
    print("FICHIER:", fname)
    print("=" * 80)
    with pdfplumber.open(path) as pdf:
        print("Pages:", len(pdf.pages))
        for i, page in enumerate(pdf.pages):
            print(f"\n--- PAGE {i+1} (w={page.width:.0f} x h={page.height:.0f}) ---")
            text = page.extract_text()
            if text:
                print(text[:4000])
            tables = page.extract_tables()
            if tables:
                for ti, table in enumerate(tables):
                    ncols = len(table[0]) if table else 0
                    print(f"\n  [TABLE {ti+1}] ({len(table)} rows x {ncols} cols)")
                    for row in table[:8]:
                        print(f"    {row}")
                    if len(table) > 8:
                        print(f"    ... ({len(table) - 8} more rows)")
                        for row in table[-3:]:
                            print(f"    {row}")
