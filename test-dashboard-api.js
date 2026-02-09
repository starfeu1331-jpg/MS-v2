// Test rapide de l'API dashboard
const fetch = require('node-fetch');

async function testDashboard() {
  console.log('🧪 Test API Dashboard\n');
  
  const tests = [
    { name: 'Toutes périodes', url: 'http://localhost:5173/api/dashboard?year=all' },
    { name: 'Année 2025', url: 'http://localhost:5173/api/dashboard?year=2025' },
    { name: 'Période custom', url: 'http://localhost:5173/api/dashboard?startDate=2025-11-01&endDate=2026-01-31' },
    { name: '3 derniers mois', url: 'http://localhost:5173/api/dashboard?months=3' }
  ];
  
  for (const test of tests) {
    console.log(`📊 Test: ${test.name}`);
    console.log(`   URL: ${test.url}`);
    
    try {
      const response = await fetch(test.url);
      console.log(`   Status: ${response.status}`);
      
      if (!response.ok) {
        const text = await response.text();
        console.log(`   ❌ Erreur: ${text.substring(0, 200)}`);
      } else {
        const data = await response.json();
        console.log(`   ✅ CA: ${data.kpis?.totalCA?.toLocaleString('fr-FR')}€`);
        console.log(`   ✅ Transactions: ${data.kpis?.totalTransactions?.toLocaleString('fr-FR')}`);
      }
    } catch (error) {
      console.log(`   ❌ Exception: ${error.message}`);
    }
    console.log('');
  }
}

testDashboard().catch(console.error);
