#!/bin/bash

echo "🔴 Arrêt des processus existants..."
killall -9 node 2>/dev/null

echo ""
echo "🚀 Démarrage Backend (port 3000)..."
cd backend && npx tsx src/server.ts > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

sleep 2

echo ""
echo "🚀 Démarrage Frontend (port 5173)..."
cd ..
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

sleep 3

echo ""
echo "✅ Vérification des serveurs..."
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "   ✅ Backend OK sur http://localhost:3000"
else
    echo "   ❌ Backend ne répond pas"
fi

if curl -s http://localhost:5173 > /dev/null; then
    echo "   ✅ Frontend OK sur http://localhost:5173"
else
    echo "   ❌ Frontend ne répond pas"
fi

echo ""
echo "📊 Application prête!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:3000"
echo ""
echo "Pour arrêter: killall -9 node"
