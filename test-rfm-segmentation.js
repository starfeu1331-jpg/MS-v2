// TEST SEGMENTATION RFM - Simulation exacte du Dashboard

const mockData = {
  allClients: new Map([
    ['C001', {
      achats: [
        { magasin: 'M01', date: '20/01/2026', ca_total: 100 },
        { magasin: 'M01', date: '18/01/2026', ca_total: 200 },
        { magasin: 'M01', date: '15/01/2026', ca_total: 150 }
      ]
    }],
    ['C002', {
      achats: [
        { magasin: 'M02', date: '19/01/2026', ca_total: 500 },
        { magasin: 'M02', date: '10/01/2026', ca_total: 300 }
      ]
    }],
    ['C003', {
      achats: [
        { magasin: 'WEB', date: '21/01/2026', ca_total: 250 }
      ]
    }],
    ['C004', {
      achats: [
        { magasin: 'M03', date: '05/01/2026', ca_total: 50 }
      ]
    }]
  ])
};

const showWebData = false; // Mode MAGASIN

console.log('=== TEST SEGMENTATION RFM ===');
console.log(`Mode: ${showWebData ? 'WEB' : 'MAGASIN'}\n`);

const calculateQuickRFM = () => {
  const segments = {
    ultraChampions: 0,
    champions: 0,
    loyaux: 0,
    nouveaux: 0,
    occasionnels: 0,
    risque: 0,
    perdus: 0
  };
  
  if (!mockData.allClients || mockData.allClients.size === 0) {
    console.log('❌ Pas de clients');
    return segments;
  }
  
  const today = new Date();
  const clients = [];
  
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const [day, month, year] = dateStr.split('/');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  };
  
  console.log('📊 Filtrage des clients:');
  
  // Collecter tous les clients avec données brutes - FILTRER PAR CANAL
  mockData.allClients.forEach((client, carte) => {
    if (!client.achats || client.achats.length === 0) {
      console.log(`  ⚠️ ${carte}: Pas d'achats`);
      return;
    }
    
    // Filtrer les achats selon le toggle Web/Magasin
    const achatsFiltered = client.achats.filter((achat) => {
      if (showWebData === true) {
        return achat.magasin === 'WEB';
      } else {
        return achat.magasin !== 'WEB';
      }
    });
    
    console.log(`  ${carte}: ${client.achats.length} achats total → ${achatsFiltered.length} après filtre`);
    
    if (achatsFiltered.length === 0) {
      console.log(`    ⚠️ Exclu (pas d'achats dans le canal)`);
      return;
    }
    
    let lastDate = null;
    let caTotal = 0;
    
    for (const achat of achatsFiltered) {
      const d = parseDate(achat.date);
      if (d && (!lastDate || d > lastDate)) lastDate = d;
      caTotal += achat.ca_total || 0;
    }
    
    const recency = lastDate ? Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)) : 9999;
    const frequency = achatsFiltered.length;
    const monetary = caTotal;
    
    console.log(`    → R=${recency} jours, F=${frequency}, M=${monetary}€`);
    
    if (monetary <= 0) {
      console.log(`    ⚠️ Exclu (CA <= 0)`);
      return;
    }
    
    clients.push({ recency, frequency, monetary });
  });
  
  console.log(`\n✅ ${clients.length} clients retenus pour RFM\n`);
  
  if (clients.length === 0) {
    console.log('❌ PROBLÈME: Aucun client retenu!');
    return segments;
  }
  
  // Calculer les quintiles
  const recencyValues = clients.map(c => c.recency).sort((a, b) => a - b);
  const frequencyValues = clients.map(c => c.frequency).sort((a, b) => b - a);
  const monetaryValues = clients.map(c => c.monetary).sort((a, b) => b - a);
  
  const getQuintileThresholds = (sortedValues) => {
    const len = sortedValues.length;
    return [
      sortedValues[Math.floor(len * 0.2)],
      sortedValues[Math.floor(len * 0.4)],
      sortedValues[Math.floor(len * 0.6)],
      sortedValues[Math.floor(len * 0.8)]
    ];
  };
  
  const recencyThresholds = getQuintileThresholds(recencyValues);
  const frequencyThresholds = getQuintileThresholds(frequencyValues);
  const monetaryThresholds = getQuintileThresholds(monetaryValues);
  
  console.log('🎯 Seuils calculés:');
  console.log('  Recency:', recencyThresholds);
  console.log('  Frequency:', frequencyThresholds);
  console.log('  Monetary:', monetaryThresholds, '\n');
  
  const getQuintile = (value, thresholds, reverse = false) => {
    if (!reverse) {
      if (value >= thresholds[0]) return 5;
      if (value >= thresholds[1]) return 4;
      if (value >= thresholds[2]) return 3;
      if (value >= thresholds[3]) return 2;
      return 1;
    } else {
      if (value <= thresholds[0]) return 5;
      if (value <= thresholds[1]) return 4;
      if (value <= thresholds[2]) return 3;
      if (value <= thresholds[3]) return 2;
      return 1;
    }
  };
  
  // Assigner scores et segments (basés sur les critères stricts définis)
  console.log('📋 Segmentation:');
  clients.forEach((client, idx) => {
    const R = getQuintile(client.recency, recencyThresholds, true);
    const F = getQuintile(client.frequency, frequencyThresholds);
    const M = getQuintile(client.monetary, monetaryThresholds);
    
    let segment = '';
    if (R === 5 && F === 5 && M === 5) {
      segments.ultraChampions++;
      segment = 'Ultra Champions';
    } else if (R >= 4 && F >= 4 && M >= 4) {
      segments.champions++;
      segment = 'Champions';
    } else if (F >= 4) {
      // Tous les clients avec haute fréquence (F>=4)
      if (R <= 2) {
        segments.risque++;
        segment = 'Risque';
      } else {
        segments.loyaux++;
        segment = 'Loyaux';
      }
    } else if (F <= 2 && R >= 4) {
      segments.nouveaux++;
      segment = 'Nouveaux';
    } else if (R <= 2) {
      segments.perdus++;
      segment = 'Perdus';
    } else {
      segments.occasionnels++;
      segment = 'Occasionnels';
    }
    
    console.log(`  Client ${idx+1}: R=${R}, F=${F}, M=${M} → ${segment}`);
  });
  
  return segments;
};

const rfmSegments = calculateQuickRFM();

console.log('\n🎯 RÉSULTATS:');
console.log('  Ultra Champions:', rfmSegments.ultraChampions);
console.log('  Champions:', rfmSegments.champions);
console.log('  Loyaux:', rfmSegments.loyaux);
console.log('  Nouveaux:', rfmSegments.nouveaux);
console.log('  Occasionnels:', rfmSegments.occasionnels);
console.log('  Risque:', rfmSegments.risque);
console.log('  Perdus:', rfmSegments.perdus);

const total = Object.values(rfmSegments).reduce((a, b) => a + b, 0);
console.log(`\n✅ Total segmentés: ${total} clients`);

if (total === 0) {
  console.log('\n❌ ERREUR: Aucun client segmenté!');
} else {
  console.log('\n✅ Segmentation OK');
}
