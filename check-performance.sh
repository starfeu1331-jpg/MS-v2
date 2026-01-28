#!/bin/bash

# Script de vérification du problème de 10 minutes
# Usage: ./check-performance.sh

echo "🔍 Vérification du problème de 10 minutes de chargement"
echo "=================================================="
echo ""

# Check 1: Recharts imports synchrones
echo "📊 Check #1: Imports recharts synchrones"
echo "Looking for recharts imports that block rendering..."
echo ""

RECHARTS_IMPORTS=$(grep -r "from 'recharts'" src/ 2>/dev/null | grep -v "lazyRecharts" | wc -l)

if [ "$RECHARTS_IMPORTS" -gt 0 ]; then
  echo "⚠️  PROBLÈME TROUVÉ: $RECHARTS_IMPORTS fichiers importent recharts directement"
  echo ""
  echo "Fichiers affectés:"
  grep -r "from 'recharts'" src/ | grep -v "lazyRecharts" | awk '{print $1}' | sort | uniq
  echo ""
  echo "💡 Solution: Remplacer par les imports lazy de lazyRecharts.tsx"
else
  echo "✅ Pas d'imports recharts synchrones détectés - Bon!"
fi

echo ""
echo "=================================================="
echo ""

# Check 2: Suspense boundaries
echo "🔄 Check #2: Suspense boundaries"
echo "Cherchant les composants lazy sans Suspense..."
echo ""

LAZY_IMPORTS=$(grep -r "lazy(" src/ | wc -l)
SUSPENSE_BOUNDARIES=$(grep -r "<Suspense" src/ | wc -l)

echo "Composants lazy trouvés: $LAZY_IMPORTS"
echo "Suspense boundaries trouvés: $SUSPENSE_BOUNDARIES"
echo ""

if [ "$SUSPENSE_BOUNDARIES" -lt 3 ]; then
  echo "⚠️  ATTENTION: Peu de Suspense boundaries trouvés"
  echo "💡 Solution: Ajouter <Suspense fallback={...}> autour des composants lazy"
else
  echo "✅ Suspense boundaries correctement configurés"
fi

echo ""
echo "=================================================="
echo ""

# Check 3: LoadingFallback component
echo "🎨 Check #3: LoadingFallback component"
echo ""

if [ -f "src/components/LoadingFallback.tsx" ]; then
  echo "✅ LoadingFallback.tsx existe"
else
  echo "⚠️  LoadingFallback.tsx manquant - Le fichier doit être créé"
fi

echo ""
echo "=================================================="
echo ""

# Check 4: LazyRecharts wrapper
echo "📦 Check #4: LazyRecharts wrapper"
echo ""

if [ -f "src/utils/lazyRecharts.tsx" ]; then
  echo "✅ lazyRecharts.tsx existe"
  
  LAZY_CHART_IMPORTS=$(grep -c "LazyResponsiveContainer\|LazyLineChart\|LazyBarChart" src/utils/lazyRecharts.tsx)
  echo "   $LAZY_CHART_IMPORTS lazy chart components trouvés"
else
  echo "⚠️  lazyRecharts.tsx manquant - Le wrapper doit être créé"
fi

echo ""
echo "=================================================="
echo ""

# Check 5: Résumé
echo "📋 RÉSUMÉ"
echo ""

if [ "$RECHARTS_IMPORTS" -eq 0 ] && [ -f "src/components/LoadingFallback.tsx" ] && [ -f "src/utils/lazyRecharts.tsx" ]; then
  echo "✅ Configuration optimale! App devrait charger en <5 secondes"
  echo ""
  echo "Prochaines étapes:"
  echo "1. Lance: npm run dev"
  echo "2. Ouvre DevTools (F12)"
  echo "3. Va à Performance tab"
  echo "4. Record and reload"
  echo "5. Vérifie FCP < 2 secondes"
else
  echo "⚠️  Optimisations manquantes détectées"
  echo ""
  echo "À faire:"
  [ "$RECHARTS_IMPORTS" -gt 0 ] && echo "- Remplacer $RECHARTS_IMPORTS imports recharts synchrones par lazy"
  [ ! -f "src/components/LoadingFallback.tsx" ] && echo "- Créer LoadingFallback.tsx"
  [ ! -f "src/utils/lazyRecharts.tsx" ] && echo "- Créer lazyRecharts.tsx wrapper"
  [ "$SUSPENSE_BOUNDARIES" -lt 3 ] && echo "- Ajouter Suspense boundaries autour des charts"
fi

echo ""
echo "=================================================="
echo "🏁 Vérification terminée"
echo ""
