import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import { ChevronDown, ChevronUp, Download } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import * as XLSX from 'xlsx';

// Icône personnalisée pour les magasins (pictogramme magasin)
const storeIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <!-- Ombre -->
      <ellipse cx="18" cy="32" rx="10" ry="2" fill="rgba(0,0,0,0.2)"/>
      
      <!-- Cercle principal rouge -->
      <circle cx="18" cy="16" r="13" fill="#dc2626" stroke="#fff" stroke-width="2.5"/>
      
      <!-- Icône magasin simplifié -->
      <g transform="translate(18, 16)">
        <!-- Toit -->
        <path d="M -6,-6 L 0,-9 L 6,-6 Z" fill="#fff" opacity="0.95"/>
        <!-- Façade -->
        <rect x="-6" y="-6" width="12" height="10" fill="#fff" opacity="0.95"/>
        <!-- Porte -->
        <rect x="-2" y="0" width="4" height="4" fill="#dc2626"/>
        <!-- Fenêtres -->
        <rect x="-5" y="-4" width="2" height="2" fill="#dc2626" opacity="0.6"/>
        <rect x="3" y="-4" width="2" height="2" fill="#dc2626" opacity="0.6"/>
      </g>
      
      <!-- Point lumineux -->
      <circle cx="18" cy="16" r="4" fill="#fff" opacity="0.3"/>
    </svg>
  `),
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
});

interface Store {
  code: string;
  nom: string;
  ville?: string;
  lat: number | null;
  lon: number | null;
}

interface Zone {
  cp: string;
  ville: string;
  nbClients: number;
  totalCA: number;
  nbTransactions: number;
  population?: number;
  caPerCapita?: number;
  clientsPerCapita?: number;
  txPerCapita?: number;
  rank?: number;
  percentile?: number;
  decile?: number;
  color?: string;
}

interface StoreStats {
  nbClients: number;
  totalCA: number;
  nbTransactions: number;
  panierMoyen: number;
}

export default function ZoneChalandiseV4() {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [zones, setZones] = useState<Zone[]>([]);
  const [geoData, setGeoData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [storeStats, setStoreStats] = useState<StoreStats | null>(null);
  const [visibleDeciles, setVisibleDeciles] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
  const [panelOpen, setPanelOpen] = useState(true);
  const [sortCriterion, setSortCriterion] = useState<'ca' | 'clients' | 'transactions'>('ca');
  const [perCapitaMode, setPerCapitaMode] = useState(false);

  const center: LatLngTuple = [46.603354, 1.888334]; // Centre de la France

  // Coordonnées GPS des magasins (hardcodées car non présentes en DB)
  const storeCoordinates: Record<string, { lat: number; lon: number }> = {
    '12': { lat: 44.100572, lon: 4.106784 }, // ALES
    '13': { lat: 43.358272, lon: 3.254277 }, // BEZIERS
    '14': { lat: 43.664382, lon: 4.640042 }, // ARLES
    '16': { lat: 43.572258, lon: 3.847119 }, // SAINT JEAN DE VEDAS
    '17': { lat: 44.940179, lon: 4.863465 }, // SAINT PERAY
    '19': { lat: 45.051845, lon: 5.081296 }, // ROMANS
    '22': { lat: 45.702634, lon: 5.000077 }, // ST BONNET DE MURE
    '23': { lat: 46.222808, lon: 5.203020 }, // VIRIAT
    '24': { lat: 45.943104, lon: 6.074168 }, // SILLINGY
    '25': { lat: 43.211340, lon: 2.299221 }, // CARCASSONNE
    '26': { lat: 45.218836, lon: 5.678330 }, // SAINT EGREVE
    '27': { lat: 45.984220, lon: 4.742440 }, // VILLEFRANCHE
    '28': { lat: 45.184090, lon: 5.774699 }, // ST MARTIN D'HERES
    '29': { lat: 43.677654, lon: 1.408238 }, // FENOUILLET
    '31': { lat: 44.575253, lon: 4.747757 }, // MONTELIMAR
    '32': { lat: 45.777465, lon: 3.196072 }, // LEMPDES
    '33': { lat: 43.115655, lon: 0.763458 }, // ESTANCARBON
    '34': { lat: 44.615308, lon: 4.401042 }, // AUBENAS
    '35': { lat: 43.852577, lon: 4.350875 }, // NIMES
    '36': { lat: 45.616262, lon: 5.886227 }, // VOGLANS
    '37': { lat: 43.984397, lon: 4.886017 }, // SORGUES
    '38': { lat: 44.393611, lon: 2.601307 }, // ONET LE CHATEAU
    '39': { lat: 43.157188, lon: 2.981007 }  // NARBONNE
  };

  // Palette de couleurs: Bleu (faible) → Jaune → Orange → Rouge (fort)
  const COLORS = [
    '#1e3a8a', // 0: Bleu très foncé - FAIBLE
    '#1e40af', // 1: Bleu foncé
    '#2563eb', // 2: Bleu
    '#3b82f6', // 3: Bleu clair
    '#60a5fa', // 4: Bleu très clair
    '#fbbf24', // 5: Jaune
    '#f59e0b', // 6: Orange
    '#ea580c', // 7: Orange foncé
    '#dc2626', // 8: Rouge
    '#991b1b'  // 9: Rouge très foncé - FORT
  ];

  // Charger les magasins au montage
  useEffect(() => {
    fetch('/api/stores?action=list')
      .then(res => res.json())
      .then(data => {
        const storesData = data.stores || [];
        
        // Enrichir avec coordonnées hardcodées
        const enrichedStores = storesData.map((store: Store) => ({
          ...store,
          lat: storeCoordinates[store.code]?.lat || null,
          lon: storeCoordinates[store.code]?.lon || null
        }));
        
        setStores(enrichedStores);
        
        console.log('🏪 Magasins chargés:', enrichedStores);
        console.log('📍 Magasins avec coordonnées:', enrichedStores.filter((s: Store) => s.lat && s.lon).length);
        
        enrichedStores.forEach((store: Store) => {
          if (store.lat && store.lon) {
            console.log(`  ✅ ${store.code} - ${store.nom}: lat=${store.lat}, lon=${store.lon}`);
          } else {
            console.log(`  ❌ ${store.code}: PAS de coordonnées (lat=${store.lat}, lon=${store.lon})`);
          }
        });
      })
      .catch(err => console.error('Erreur chargement magasins:', err));
  }, []);

  // Charger zones quand magasin sélectionné OU critères changent
  useEffect(() => {
    if (!selectedStore) return;

    setLoading(true);
    setGeoData([]);
    
    console.log(`🔍 Chargement zones pour magasin ${selectedStore}...`);

    fetch(`/api/stores?action=catchment&storeCode=${selectedStore}`)
      .then(res => res.json())
      .then(data => {
        const rawZones = data.data || [];
        console.log(`✅ ${rawZones.length} zones reçues`);
        
        // Afficher échantillon
        rawZones.slice(0, 5).forEach((z: Zone, i: number) => {
          console.log(`  ${i+1}. CP ${z.cp} (${z.ville}): ${z.nbClients} clients, ${z.totalCA.toFixed(0)}€`);
        });
        
        if (perCapitaMode) {
          enrichWithPopulation(rawZones);
        } else {
          processZones(rawZones);
        }
      })
      .catch(err => {
        console.error('❌ Erreur chargement zones:', err);
        setLoading(false);
      });
  }, [selectedStore, perCapitaMode, sortCriterion]);

  // Charger stats magasin
  useEffect(() => {
    if (!selectedStore) return;
    
    fetch(`/api/stores?action=performance&storeCode=${selectedStore}`)
      .then(res => res.json())
      .then(data => {
        if (data.magasin) {
          setStoreStats(data.magasin);
        }
      })
      .catch(err => console.error('Erreur stats magasin:', err));
  }, [selectedStore]);

  // Note: pas besoin de useEffects séparés, tout géré par le useEffect principal

  // Enrichir avec population
  const enrichWithPopulation = async (rawZones: Zone[]) => {
    console.log('🌍 Enrichissement avec données population...');
    
    const enrichedZones = await Promise.all(
      rawZones.map(async (zone) => {
        const pop = await fetchPopulation(zone.cp);
        
        if (pop && pop > 0) {
          return {
            ...zone,
            population: pop,
            caPerCapita: zone.totalCA / pop,
            clientsPerCapita: zone.nbClients / pop,
            txPerCapita: zone.nbTransactions / pop
          };
        }
        return zone;
      })
    );
    
    const withPop = enrichedZones.filter(z => z.population).length;
    console.log(`✅ ${withPop}/${rawZones.length} zones avec population`);
    
    processZones(enrichedZones);
  };

  // Récupérer population d'un CP
  const fetchPopulation = async (cp: string): Promise<number | null> => {
    try {
      const cleanCP = String(cp).trim().padStart(5, '0');
      const response = await fetch(
        `https://geo.api.gouv.fr/communes?codePostal=${cleanCP}&fields=nom,population`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        const totalPop = data.reduce((sum: number, commune: any) => sum + (commune.population || 0), 0);
        return totalPop;
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  // Traiter zones: trier, classer, coloriser
  const processZones = (rawZones: Zone[]) => {
    console.log(`🎯 Classement selon ${sortCriterion} ${perCapitaMode ? '(per capita)' : ''}`);
    
    // Fonction pour obtenir la valeur de tri
    const getValue = (z: Zone): number => {
      if (perCapitaMode) {
        if (sortCriterion === 'ca') return z.caPerCapita || 0;
        if (sortCriterion === 'clients') return z.clientsPerCapita || 0;
        return z.txPerCapita || 0;
      }
      if (sortCriterion === 'ca') return z.totalCA;
      if (sortCriterion === 'clients') return z.nbClients;
      return z.nbTransactions;
    };
    
    // Trier DÉCROISSANT (meilleur en premier)
    const sorted = [...rawZones].sort((a, b) => getValue(b) - getValue(a));
    
    // Calculer min/max pour info
    const values = sorted.map(getValue);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    console.log(`📊 Valeurs: min=${minVal.toFixed(2)}, max=${maxVal.toFixed(2)}`);
    
    // Assigner rang, percentile, decile et couleur
    // IMPORTANT: meilleur = rank 1 = idx 0 = MAIS on veut decile 9 (rouge)
    // Donc: decile = 9 - floor(idx / length * 10)
    const ranked = sorted.map((zone, idx) => {
      const rank = idx + 1; // 1, 2, 3...
      const percentile = idx / (sorted.length - 1 || 1); // 0 à 1
      // INVERSION: percentile 0 (meilleur) → decile 9 (rouge)
      const decile = Math.floor((1 - percentile) * 10);
      const finalDecile = Math.min(Math.max(decile, 0), 9);
      const color = COLORS[finalDecile];
      
      return {
        ...zone,
        rank,
        percentile,
        decile: finalDecile,
        color
      };
    });
    
    // Log échantillon
    console.log(`📋 Top 5:`);
    ranked.slice(0, 5).forEach(z => {
      const val = getValue(z);
      console.log(`  #${z.rank} - CP ${z.cp}: ${val.toFixed(2)} → décile ${z.decile} ${z.color}`);
    });
    
    setZones(ranked);
    loadGeometries(ranked);
  };

  // Charger géométries
  const loadGeometries = async (zonesToLoad: Zone[]) => {
    console.log(`🗺️ Chargement ${zonesToLoad.length} géométries...`);
    
    if (zonesToLoad.length === 0) {
      setGeoData([]);
      setLoading(false);
      return;
    }
    
    const features: any[] = [];
    
    for (const zone of zonesToLoad) {
      try {
        // Nettoyer CP
        const cleanCP = String(zone.cp).trim().replace(/[^0-9]/g, '');
        if (cleanCP.length === 0 || cleanCP.length > 5) {
          continue;
        }
        const normalizedCP = cleanCP.padStart(5, '0');
        
        // Vérifier que zone a tous les attributs nécessaires
        if (!zone.color || zone.decile === undefined) {
          console.error(`❌ CP ${normalizedCP}: manque color/decile!`);
          continue;
        }
        
        // Appeler API
        const response = await fetch(
          `https://geo.api.gouv.fr/communes?codePostal=${normalizedCP}&fields=contour&format=geojson&geometry=contour`
        );
        
        if (!response.ok) continue;
        
        const geojson = await response.json();
        
        if (!geojson.features || geojson.features.length === 0) {
          continue;
        }
        
        // Ajouter chaque feature avec propriétés
        geojson.features.forEach((feature: any) => {
          features.push({
            type: 'Feature',
            geometry: feature.geometry,
            properties: {
              cp: zone.cp,
              ville: zone.ville,
              nbClients: zone.nbClients,
              totalCA: zone.totalCA,
              nbTransactions: zone.nbTransactions,
              population: zone.population,
              caPerCapita: zone.caPerCapita,
              clientsPerCapita: zone.clientsPerCapita,
              txPerCapita: zone.txPerCapita,
              rank: zone.rank,
              percentile: zone.percentile,
              decile: zone.decile,
              color: zone.color
            }
          });
        });
        
        // Pause pour ne pas surcharger l'API
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (err) {
        console.error(`❌ Erreur CP ${zone.cp}:`, err);
      }
    }
    
    console.log(`✅ ${features.length} géométries chargées`);
    setGeoData(features);
    setLoading(false);
  };

  // Handler pour features GeoJSON
  const onEachFeature = (feature: any, layer: any) => {
    const props = feature.properties;
    
    layer.on({
      mouseover: (e: any) => {
        e.target.setStyle({
          weight: 3,
          fillOpacity: 0.7,
        });
      },
      mouseout: (e: any) => {
        e.target.setStyle({
          weight: 2,
          fillOpacity: 0.5,
        });
      },
    });
    
    // Popup enrichi
    layer.bindPopup(`
      <div style="min-width: 250px; font-family: system-ui;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: bold;">CP ${props.cp}</h3>
          ${props.rank ? `<span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold;">#${props.rank}</span>` : ''}
        </div>
        <p style="margin: 4px 0 8px 0; color: #666; font-size: 14px; font-weight: 500;">${props.ville}</p>
        ${props.population ? `
          <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 8px 12px; border-radius: 8px; margin-bottom: 10px; border-left: 3px solid #22c55e;">
            <p style="margin: 0; font-size: 13px; color: #166534; font-weight: 600;">
              👥 ${props.population.toLocaleString()} habitants
            </p>
          </div>
        ` : ''}
        <div style="border-top: 1px solid #e5e7eb; padding-top: 8px;">
          <p style="margin: 4px 0;"><strong>👥 Clients:</strong> ${props.nbClients.toLocaleString()}</p>
          <p style="margin: 4px 0;"><strong>💰 CA:</strong> ${props.totalCA.toFixed(0).toLocaleString()}€</p>
          <p style="margin: 4px 0;"><strong>🛒 Transactions:</strong> ${props.nbTransactions.toLocaleString()}</p>
        </div>
        ${props.caPerCapita || props.clientsPerCapita || props.txPerCapita ? `
          <div style="border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 8px; background: #fef3c7; padding: 8px; border-radius: 6px;">
            <p style="font-weight: bold; margin: 0 0 6px 0; font-size: 13px; color: #92400e;">📊 Par habitant:</p>
            ${props.caPerCapita ? `<p style="margin: 4px 0; font-size: 12px; color: #78350f;">• CA/hab: ${props.caPerCapita.toFixed(2)}€</p>` : ''}
            ${props.clientsPerCapita ? `<p style="margin: 4px 0; font-size: 12px; color: #78350f;">• Clients/hab: ${(props.clientsPerCapita * 100).toFixed(2)}%</p>` : ''}
            ${props.txPerCapita ? `<p style="margin: 4px 0; font-size: 12px; color: #78350f;">• Tx/hab: ${(props.txPerCapita * 100).toFixed(2)}%</p>` : ''}
          </div>
        ` : ''}
      </div>
    `);
  };

  // Toggle décile dans légende
  const toggleDecile = (decile: number) => {
    const newVisible = new Set(visibleDeciles);
    if (newVisible.has(decile)) {
      newVisible.delete(decile);
    } else {
      newVisible.add(decile);
    }
    setVisibleDeciles(newVisible);
  };

  // Export Excel
  const exportToExcel = () => {
    if (zones.length === 0) return;
    
    const data = zones.map(z => ({
      'Code Postal': z.cp,
      'Ville': z.ville,
      'Rang': z.rank || '',
      'Décile': z.decile !== undefined ? z.decile : '',
      'Clients': z.nbClients,
      'CA': z.totalCA.toFixed(2),
      'Transactions': z.nbTransactions,
      'Population': z.population || '',
      'CA/hab': z.caPerCapita ? z.caPerCapita.toFixed(2) : '',
      'Clients/hab': z.clientsPerCapita ? (z.clientsPerCapita * 100).toFixed(3) + '%' : '',
      'Tx/hab': z.txPerCapita ? (z.txPerCapita * 100).toFixed(3) + '%' : '',
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Zones');
    
    const storeName = stores.find(s => s.code === selectedStore)?.nom || selectedStore;
    const criterion = sortCriterion === 'ca' ? 'CA' : sortCriterion === 'clients' ? 'Clients' : 'Transactions';
    const mode = perCapitaMode ? '_PerCapita' : '';
    
    XLSX.writeFile(wb, `Zones_${storeName}_${criterion}${mode}.xlsx`);
  };

  // Bouton label dynamique
  const getPerCapitaLabel = () => {
    if (!perCapitaMode) return 'Activer ratios /hab';
    if (sortCriterion === 'ca') return 'CA / habitant';
    if (sortCriterion === 'clients') return 'Clients / habitant';
    return 'Transactions / habitant';
  };

  return (
    <>
      {/* Carte plein écran */}
      <div className="h-full w-full">
        <MapContainer
          center={center}
          zoom={6}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Zones colorées */}
          {geoData
            .filter(feature => visibleDeciles.has(feature.properties.decile))
            .map((feature, idx) => (
              <GeoJSON
                key={`zone-${idx}`}
                data={feature}
                style={{
                  fillColor: feature.properties.color,
                  fillOpacity: 0.5,
                  color: feature.properties.color,
                  weight: 2,
                  opacity: 0.8
                }}
                onEachFeature={onEachFeature}
              />
            ))}

          {/* Marqueurs magasins */}
          {stores
            .filter(store => store.lat && store.lon)
            .map(store => (
              <Marker
                key={store.code}
                position={[store.lat!, store.lon!]}
                icon={storeIcon}
                eventHandlers={{
                  click: () => {
                    console.log(`🖱️ Clic sur magasin ${store.code} - ${store.nom}`);
                  },
                  dblclick: () => {
                    console.log(`🖱️🖱️ Double-clic sur magasin ${store.code} - Chargement zones...`);
                    setSelectedStore(store.code);
                  }
                }}
              >
                <Popup>
                  <div style={{ minWidth: '200px' }}>
                    <h3 style={{ 
                      margin: '0 0 8px 0', 
                      fontSize: '14px', 
                      fontWeight: 'bold',
                      color: '#dc2626',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedStore(store.code)}
                    >
                      {store.code} - {store.nom}
                    </h3>
                    <p style={{ margin: '4px 0', fontSize: '12px', color: '#6b7280' }}>
                      📍 {store.ville || 'N/A'}
                    </p>
                    <div style={{ 
                      marginTop: '8px', 
                      padding: '6px 8px',
                      backgroundColor: '#fef2f2',
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: '#991b1b',
                      textAlign: 'center',
                      fontStyle: 'italic'
                    }}>
                      Double-cliquez pour charger les zones
                    </div>
                    {store.code === selectedStore && storeStats && (
                      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '8px', marginTop: '8px' }}>
                        <p style={{ margin: '4px 0', fontSize: '13px' }}>
                          <strong>👥 Clients:</strong> {storeStats.nbClients.toLocaleString()}
                        </p>
                        <p style={{ margin: '4px 0', fontSize: '13px' }}>
                          <strong>💰 CA:</strong> {storeStats.totalCA.toFixed(0).toLocaleString()}€
                        </p>
                        <p style={{ margin: '4px 0', fontSize: '13px' }}>
                          <strong>🛒 Transactions:</strong> {storeStats.nbTransactions.toLocaleString()}
                        </p>
                        <p style={{ margin: '4px 0', fontSize: '13px' }}>
                          <strong>🧺 Panier moyen:</strong> {storeStats.panierMoyen.toFixed(2)}€
                        </p>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </div>

      {/* Panneau de contrôle - FIXE en haut à droite */}
      <div 
        style={{
          position: 'fixed',
          top: '100px',
          right: '20px',
          zIndex: 9999,
          minWidth: panelOpen ? '340px' : 'auto',
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(75, 85, 99, 0.3)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: panelOpen ? '14px 16px' : '10px 14px',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.15) 100%)',
            cursor: 'pointer',
          }}
          onClick={() => setPanelOpen(!panelOpen)}
        >
          <h3 style={{ 
            fontWeight: '600', 
            color: '#93c5fd', 
            fontSize: panelOpen ? '15px' : '13px',
            margin: 0,
          }}>
            {panelOpen ? '📍 Zones de Chalandise' : '📍'}
          </h3>
          <button style={{ 
            color: '#60a5fa', 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer',
            display: 'flex',
            padding: 0
          }}>
            {panelOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>

        {panelOpen && (
          <div style={{ padding: '16px' }}>
            {/* Sélection magasin */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '13px', 
                fontWeight: '600', 
                color: '#d1d5db', 
                marginBottom: '8px' 
              }}>
                Magasin:
              </label>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: '1.5px solid rgba(75, 85, 99, 0.6)',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(31, 41, 55, 0.9)',
                  color: '#f3f4f6',
                  fontWeight: '500',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="">Sélectionner un magasin...</option>
                {stores
                  .filter(s => s.lat && s.lon)
                  .map(store => (
                    <option key={store.code} value={store.code}>
                      {store.code} - {store.nom}
                    </option>
                  ))}
              </select>
            </div>

            {/* Critère de tri */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '13px', 
                fontWeight: '600', 
                color: '#d1d5db', 
                marginBottom: '8px' 
              }}>
                Critère de classement:
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setSortCriterion('ca')}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    fontSize: '12px',
                    fontWeight: '600',
                    borderRadius: '8px',
                    border: sortCriterion === 'ca' ? '2px solid #3b82f6' : '1px solid rgba(75, 85, 99, 0.6)',
                    backgroundColor: sortCriterion === 'ca' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(31, 41, 55, 0.9)',
                    color: sortCriterion === 'ca' ? '#60a5fa' : '#9ca3af',
                    cursor: 'pointer',
                  }}
                >
                  💰 CA
                </button>
                <button
                  onClick={() => setSortCriterion('clients')}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    fontSize: '12px',
                    fontWeight: '600',
                    borderRadius: '8px',
                    border: sortCriterion === 'clients' ? '2px solid #3b82f6' : '1px solid rgba(75, 85, 99, 0.6)',
                    backgroundColor: sortCriterion === 'clients' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(31, 41, 55, 0.9)',
                    color: sortCriterion === 'clients' ? '#60a5fa' : '#9ca3af',
                    cursor: 'pointer',
                  }}
                >
                  👥 Clients
                </button>
                <button
                  onClick={() => setSortCriterion('transactions')}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    fontSize: '12px',
                    fontWeight: '600',
                    borderRadius: '8px',
                    border: sortCriterion === 'transactions' ? '2px solid #3b82f6' : '1px solid rgba(75, 85, 99, 0.6)',
                    backgroundColor: sortCriterion === 'transactions' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(31, 41, 55, 0.9)',
                    color: sortCriterion === 'transactions' ? '#60a5fa' : '#9ca3af',
                    cursor: 'pointer',
                  }}
                >
                  🛒 Tx
                </button>
              </div>
            </div>

            {/* Mode per capita */}
            <div style={{ marginBottom: '14px' }}>
              <button
                onClick={() => setPerCapitaMode(!perCapitaMode)}
                disabled={loading || !selectedStore}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: '10px',
                  border: perCapitaMode ? '2px solid #9333ea' : '1px solid rgba(75, 85, 99, 0.6)',
                  backgroundColor: perCapitaMode ? 'rgba(147, 51, 234, 0.2)' : 'rgba(31, 41, 55, 0.9)',
                  color: perCapitaMode ? '#c084fc' : '#9ca3af',
                  cursor: (loading || !selectedStore) ? 'not-allowed' : 'pointer',
                  opacity: (loading || !selectedStore) ? 0.5 : 1,
                }}
              >
                {getPerCapitaLabel()}
              </button>
            </div>

            {/* Légende interactive */}
            {zones.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '13px', 
                  fontWeight: '600', 
                  color: '#d1d5db', 
                  marginBottom: '8px' 
                }}>
                  Légende (cliquer pour filtrer):
                </label>
                <div style={{ 
                  maxHeight: '200px', 
                  overflowY: 'auto',
                  backgroundColor: 'rgba(31, 41, 55, 0.6)',
                  borderRadius: '10px',
                  padding: '8px'
                }}>
                  {[9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(decile => {
                    const count = zones.filter(z => z.decile === decile).length;
                    if (count === 0) return null;
                    
                    return (
                      <div
                        key={decile}
                        onClick={() => toggleDecile(decile)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          backgroundColor: visibleDeciles.has(decile) ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                          marginBottom: '4px'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={visibleDeciles.has(decile)}
                          onChange={() => toggleDecile(decile)}
                          style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                        />
                        <div
                          style={{ 
                            width: '24px', 
                            height: '16px', 
                            borderRadius: '4px',
                            backgroundColor: COLORS[decile],
                            border: '1px solid rgba(255,255,255,0.2)'
                          }}
                        />
                        <span style={{ fontSize: '12px', color: '#e5e7eb', flex: 1 }}>
                          {decile === 9 ? 'Top 10%' : 
                           decile === 8 ? 'Top 20%' :
                           decile === 7 ? 'Top 30%' :
                           decile === 6 ? 'Top 40%' :
                           decile === 5 ? 'Médian' :
                           decile === 4 ? 'Bas 50%' :
                           decile === 3 ? 'Bas 40%' :
                           decile === 2 ? 'Bas 30%' :
                           decile === 1 ? 'Bas 20%' :
                           'Bas 10%'}
                        </span>
                        <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                          ({count})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Export */}
            {zones.length > 0 && (
              <button
                onClick={exportToExcel}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  backgroundColor: 'rgba(34, 197, 94, 0.9)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  marginBottom: '14px'
                }}
              >
                <Download size={16} />
                Exporter Excel
              </button>
            )}

            {/* Stats */}
            {zones.length > 0 && (
              <div style={{ 
                fontSize: '12px', 
                color: '#9ca3af',
                backgroundColor: 'rgba(31, 41, 55, 0.6)',
                padding: '10px',
                borderRadius: '8px',
                borderTop: '1px solid rgba(75, 85, 99, 0.4)'
              }}>
                <div>{zones.length} zones chargées</div>
                <div>{geoData.filter(f => visibleDeciles.has(f.properties.decile)).length} géométries visibles</div>
                {loading && <div style={{ color: '#60a5fa', marginTop: '4px' }}>Chargement...</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
