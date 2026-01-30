import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import chroma from 'chroma-js';
import * as turf from '@turf/turf';
import { getPostcodeCoords } from '../utils/postcodeCoordsMap';
import { getStoreCoords } from '../utils/storesCoords';
import { AlertCircle, Loader, BarChart3, Users } from 'lucide-react';

export default function ZoneChalandiseV2() {
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('ALL');
  const [allZones, setAllZones] = useState<any[]>([]);
  const [geoJsonData, setGeoJsonData] = useState<any[]>([]);
  const [storeContours, setStoreContours] = useState<any[]>([]); // Contours globaux par magasin
  const [availableColors, setAvailableColors] = useState<number[]>([]); // Couleurs présentes dans les zones actuelles
  const [loading, setLoading] = useState(false);
  const [loadingZones, setLoadingZones] = useState(false); // Loading spécifique zones
  const [loadingProgress, setLoadingProgress] = useState(0); // Progression %
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'ca' | 'clients'>('ca');
  const [mapCenter, setMapCenter] = useState<[number, number]>([46.5, 2.5]);
  const [mapZoom, setMapZoom] = useState(6);
  const [showPanel, setShowPanel] = useState(true);

  // Charger toutes les données au démarrage
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/stores?action=allStores');
        const data = await response.json();
        
        if (data && data.stores && data.zones) {
          setStores(data.stores);
          setAllZones(data.zones);
        }
      } catch (err) {
        console.error('Erreur chargement données:', err);
        setError('Impossible de charger les données');
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, []);

  // Charger les polygones GeoJSON par ZONES DE COULEUR (optimisé)
  useEffect(() => {
    if (!allZones || allZones.length === 0) return;

    const loadGeoJson = async () => {
      setLoadingZones(true);
      setLoadingProgress(0);
      setGeoJsonData([]); // VIDER les anciennes zones avant de recharger
      
      // Filtrer selon le magasin sélectionné
      let zonesToDisplay = [];
      
      if (selectedStore === 'ALL') {
        // Mode "tous les magasins" : dédupliquer par CP (garder le magasin avec le + gros CA)
        const cpMap: Record<string, any> = {};
        allZones.forEach(zone => {
          if (!cpMap[zone.cp] || cpMap[zone.cp].totalCA < zone.totalCA) {
            cpMap[zone.cp] = zone;
          }
        });
        zonesToDisplay = Object.values(cpMap);
        console.log('📍 Mode TOUS : déduplication de', allZones.length, 'zones vers', zonesToDisplay.length, 'zones uniques');
      } else {
        // Mode magasin spécifique : garder TOUTES les zones de CE magasin (pas de déduplication)
        zonesToDisplay = allZones.filter(z => {
          const zoneStore = String(z.storeCode || '').trim();
          const selected = String(selectedStore || '').trim();
          return zoneStore === selected;
        });
        console.log('📍 Mode magasin', selectedStore, ':', zonesToDisplay.length, 'zones trouvées');
        console.log('   Magasins uniques dans les zones filtrées:', [...new Set(zonesToDisplay.map(z => z.storeCode))]);
      }
      
      console.log('✅ Zones à traiter:', zonesToDisplay.length);
      
      // Charger le fichier GeoJSON complet des codes postaux
      setLoadingProgress(5);
      let codesPostauxData: any = null;
      try {
        const response = await fetch('/codes-postaux.json');
        if (response.ok) {
          const text = await response.text();
          // Vérifier si c'est vraiment du JSON et non du HTML
          if (text.startsWith('{') || text.startsWith('[')) {
            codesPostauxData = JSON.parse(text);
            console.log('✅ Fichier codes postaux chargé:', codesPostauxData.features?.length, 'CP');
          } else {
            console.warn('⚠️ Fichier JSON non disponible sur Vercel, utilisation API uniquement');
          }
        } else {
          console.warn('⚠️ codes-postaux.json non trouvé (status:', response.status, '), utilisation API');
        }
      } catch (err) {
        console.error('❌ Erreur chargement codes postaux:', err);
      }
      
      // Les intensités sont déjà correctes depuis l'API (calculées par magasin)
      // Pas besoin de recalculer ici
      console.log('📊 Utilisation des intensités depuis l\'API (déjà calculées par magasin)');
      
      // ÉTAPE 1: Grouper par magasin ET tranche d'intensité (zone de couleur)
      const colorZonesMap: Record<string, any[]> = {};
      const colorsPresent = new Set<number>();
      
      zonesToDisplay.forEach(zone => {
        const intensity = viewMode === 'ca' ? zone.intensiteCA : zone.intensiteClients;
        const colorIndex = Math.min(Math.floor(intensity * 10), 9); // 0-9
        const key = `${zone.storeCode}_${colorIndex}`;
        
        colorsPresent.add(colorIndex);
        
        if (!colorZonesMap[key]) {
          colorZonesMap[key] = [];
        }
        colorZonesMap[key].push(zone);
      });
      
      setAvailableColors(Array.from(colorsPresent).sort((a, b) => a - b));
      console.log('🎨 Zones de couleur:', Object.keys(colorZonesMap).length);
      console.log('🎨 Couleurs présentes:', Array.from(colorsPresent).sort((a, b) => a - b));
      
      // DEBUG: Distribution des intensités
      if (selectedStore !== 'ALL') {
        const intensities = zonesToDisplay.map(z => viewMode === 'ca' ? z.intensiteCA : z.intensiteClients);
        console.log('📊 DEBUG - Distribution intensités du magasin', selectedStore);
        console.log('   Min:', Math.min(...intensities).toFixed(3));
        console.log('   Max:', Math.max(...intensities).toFixed(3));
        console.log('   Moyenne:', (intensities.reduce((a, b) => a + b, 0) / intensities.length).toFixed(3));
        console.log('   Nb zones:', zonesToDisplay.length);
        console.log('   Répartition par tranche:');
        for (let i = 0; i < 10; i++) {
          // Utiliser la même formule que colorIndex pour capturer intensity=1.0 exactement
          const count = intensities.filter(int => Math.min(Math.floor(int * 10), 9) === i).length;
          if (count > 0) {
            console.log(`     ${i * 10}%-${(i + 1) * 10}%: ${count} zones`);
          }
        }
      }
      
      // ÉTAPE 2: Pour chaque zone de couleur, charger et fusionner les CP
      const colorZones: any[] = [];
      const groups = Object.entries(colorZonesMap);
      const BATCH_SIZE = 3; // Traiter 3 zones de couleur à la fois (plus stable)
      
      console.log('📦 Groupes à traiter:', groups.map(([k, zones]) => `${k} (${zones.length} CP)`));
      
      for (let i = 0; i < groups.length; i += BATCH_SIZE) {
        const batch = groups.slice(i, i + BATCH_SIZE);
        
        for (const [key, zones] of batch) {
          const [storeCode, colorIndexStr] = key.split('_');
          const colorIndex = parseInt(colorIndexStr);
          
          console.log(`🎨 Traitement zone ${key}: ${zones.length} CP, couleur ${colorIndex}`);
          
          try {
            const features: any[] = [];
            const failedCP: string[] = [];
            
            // Charger chaque CP individuellement (l'API ne supporte pas le batch)
            for (const zone of zones) {
              // IMPORTANT: Normaliser le CP à 5 chiffres (ajouter 0 devant si nécessaire)
              const normalizedCP = zone.cp.toString().padStart(5, '0');
              
              try {
                const response = await fetch(
                  `https://geo.api.gouv.fr/communes?codePostal=${normalizedCP}&fields=contour&format=geojson&geometry=contour`
                );
                if (response.ok) {
                  const geojson = await response.json();
                  if (geojson.features && geojson.features.length > 0) {
                    features.push(geojson.features[0]);
                  } else {
                    console.warn(`⚠️ CP ${normalizedCP} (DB: ${zone.cp}): API retourne 0 features`);
                    failedCP.push(normalizedCP);
                  }
                } else {
                  console.warn(`⚠️ CP ${normalizedCP} (DB: ${zone.cp}): API error ${response.status}`);
                  failedCP.push(normalizedCP);
                }
              } catch (err) {
                console.error(`❌ CP ${normalizedCP} (DB: ${zone.cp}):`, err);
                failedCP.push(normalizedCP);
              }
              await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            console.log(`  ✅ ${features.length} géométries chargées, ❌ ${failedCP.length} échecs`);
            if (failedCP.length > 0) {
              console.log(`  CP manquants: ${failedCP.join(', ')}`);
            }
            
            // Fusionner tous les polygones de cette zone de couleur
            if (features.length > 0) {
              // Si peu de features ou zone simple, afficher individuellement
              if (features.length === 1) {
                // Zone unique, pas besoin de fusion
                colorZones.push({
                  type: 'Feature',
                  geometry: features[0].geometry,
                  properties: {
                    storeCode,
                    colorIndex,
                    intensity: (colorIndex + 0.5) / 10,
                    nbCodes: zones.length,
                    nbCodesLoaded: features.length,
                    totalCA: zones.reduce((sum, z) => sum + z.totalCA, 0),
                    nbClients: zones.reduce((sum, z) => sum + z.nbClients, 0)
                  }
                });
                console.log(`  ✅ Zone simple (1 CP)`);
              } else if (features.length <= 3) {
                // Peu de features, ajouter individuellement sans fusion (plus stable)
                features.forEach((feature, idx) => {
                  colorZones.push({
                    type: 'Feature',
                    geometry: feature.geometry,
                    properties: {
                      storeCode,
                      colorIndex,
                      intensity: (colorIndex + 0.5) / 10,
                      nbCodes: 1,
                      nbCodesLoaded: 1,
                      totalCA: zones[idx]?.totalCA || 0,
                      nbClients: zones[idx]?.nbClients || 0
                    }
                  });
                });
                console.log(`  ✅ ${features.length} zones séparées (pas de fusion)`);
              } else {
                // Fusion pour les groupes plus importants
                let combined = features[0];
                let unionErrors = 0;
                
                for (let j = 1; j < features.length; j++) {
                  try {
                    const result = turf.union(turf.featureCollection([combined, features[j]]));
                    if (result) {
                      combined = result;
                    }
                  } catch (err) {
                    console.error(`  ⚠️ Erreur union feature ${j}:`, err);
                    unionErrors++;
                  }
                }
                
                console.log(`  🔗 Union de ${features.length} features (${unionErrors} erreurs)`);
                
                // Ajouter la zone fusionnée avec ses propriétés
                colorZones.push({
                  type: 'Feature',
                  geometry: combined.geometry,
                  properties: {
                    storeCode,
                    colorIndex,
                    intensity: (colorIndex + 0.5) / 10,
                    nbCodes: zones.length,
                    nbCodesLoaded: features.length,
                    totalCA: zones.reduce((sum, z) => sum + z.totalCA, 0),
                    nbClients: zones.reduce((sum, z) => sum + z.nbClients, 0)
                  }
                });
              }
            } else {
              console.warn(`  ⚠️ Aucune géométrie pour ${key}`);
            }
          } catch (err) {
            console.error(`❌ Erreur zone ${key}:`, err);
          }
        }
        
        setLoadingProgress(Math.round(((i + BATCH_SIZE) / groups.length) * 100));
        setGeoJsonData([...colorZones]); // Affichage progressif
      }
      
      setGeoJsonData(colorZones);
      setStoreContours([]); // Plus besoin de contours séparés
      setLoadingProgress(100);
      setLoadingZones(false);
      
      console.log('✅ Zones de couleur chargées:', colorZones.length);
    };

    loadGeoJson();
  }, [allZones, selectedStore, viewMode]);

  const getColor = (intensity: number) => {
    const colorScale = chroma
      .scale([
        '#1e293b', '#334155', '#475569', '#64748b', '#3b82f6',
        '#10b981', '#eab308', '#f59e0b', '#f97316', '#dc2626',
      ])
      .mode('lch')
      .domain([0, 1]);
    
    return colorScale(intensity).hex();
  };

  // Couleur de bordure unique par magasin (TOUTE la zone du magasin = 1 couleur)
  const storeBorderColors: Record<string, string> = {
    '0': '#64748b',   // Gris
    '12': '#ff0000',  // Rouge vif
    '13': '#ff8800',  // Orange
    '14': '#ffdd00',  // Jaune
    '16': '#88ff00',  // Vert clair
    '17': '#00ff00',  // Vert vif
    '19': '#00ff88',  // Vert cyan
    '22': '#00ffff',  // Cyan
    '23': '#0088ff',  // Bleu clair
    '24': '#0000ff',  // Bleu vif
    '25': '#8800ff',  // Violet
    '26': '#ff00ff',  // Magenta
    '27': '#ff0088',  // Rose vif
    '28': '#cc0066',  // Rose foncé
    '29': '#990033',  // Bordeaux
    '31': '#663300',  // Marron
    '32': '#ff6600',  // Orange foncé
    '33': '#ccff00',  // Jaune-vert
    '34': '#00cc88',  // Turquoise
    '35': '#0066cc',  // Bleu marine
    '36': '#6600cc',  // Violet foncé
    '37': '#cc0099',  // Fuchsia
    '38': '#cc6600',  // Orange brûlé
    '39': '#99cc00',  // Vert olive
    '41': '#00cccc',  // Cyan foncé
  };

  const getStoreBorderColor = (storeCode: string) => {
    return storeBorderColors[storeCode] || '#1e293b';
  };

  const storeIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#dc2626" width="32" height="32">
        <circle cx="12" cy="12" r="8" stroke="white" stroke-width="2"/>
        <circle cx="12" cy="12" r="4" fill="white"/>
      </svg>
    `),
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });

  return (
    <div className="h-screen w-full bg-zinc-900 relative overflow-hidden">
      {/* Loading initial */}
      {loading && (
        <div className="absolute inset-0 bg-zinc-900/80 z-50 flex items-center justify-center">
          <Loader className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      )}
      
      {/* Loading zones avec progression */}
      {loadingZones && (
        <div className="absolute inset-0 bg-zinc-900/90 flex flex-col items-center justify-center" style={{ zIndex: 10000 }}>
          <Loader className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <p className="text-white text-lg mb-2">Chargement des zones de chalandise...</p>
          <div className="w-64 h-2 bg-zinc-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <p className="text-zinc-400 text-sm mt-2">{loadingProgress}%</p>
        </div>
      )}

      {/* Panneau de contrôle flottant */}
      {showPanel && (
        <div className="absolute top-4 left-4 bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl p-4 max-w-sm" style={{ zIndex: 10000 }}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white font-bold">Zone de Chalandise</h2>
            <button
              onClick={() => setShowPanel(false)}
              className="text-zinc-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Sélection magasin */}
          <div className="mb-4">
            <label className="text-zinc-300 text-sm mb-2 block">Magasin:</label>
            <select
              value={selectedStore}
              onChange={(e) => {
                setSelectedStore(e.target.value);
                if (e.target.value !== 'ALL') {
                  const coords = getStoreCoords(e.target.value);
                  setMapCenter([coords[0], coords[1]]);
                  setMapZoom(9);
                } else {
                  setMapCenter([46.5, 2.5]);
                  setMapZoom(6);
                }
              }}
              className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-white text-sm"
            >
              <option value="ALL">🗺️ Tous les magasins</option>
              {stores.map((store) => (
                <option key={store.code} value={store.code}>
                  {store.nom} ({store.code})
                </option>
              ))}
            </select>
          </div>

          {/* Switch CA/Clients */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setViewMode('ca')}
              className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded text-xs font-medium transition-all ${
                viewMode === 'ca'
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-700 text-zinc-300'
              }`}
            >
              <BarChart3 className="w-3 h-3" />
              Par CA
            </button>
            <button
              onClick={() => setViewMode('clients')}
              className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded text-xs font-medium transition-all ${
                viewMode === 'clients'
                  ? 'bg-purple-600 text-white'
                  : 'bg-zinc-700 text-zinc-300'
              }`}
            >
              <Users className="w-3 h-3" />
              Par Clients
            </button>
          </div>

          {/* Légende dynamique - seulement les couleurs présentes */}
          <div className="text-xs text-zinc-400">
            <p className="mb-2 font-medium">
              Intensité ({availableColors.length} tranches présentes):
            </p>
            <div className="space-y-1">
              {availableColors.length > 0 ? (
                availableColors.map((index) => {
                  const intensity = (index + 0.5) / 10; // Milieu de la tranche
                  const minPct = index * 10;
                  const maxPct = (index + 1) * 10;
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <div
                        className="w-8 h-4 rounded border border-zinc-600 flex-shrink-0"
                        style={{ backgroundColor: getColor(intensity) }}
                      />
                      <span className="text-[10px]">{minPct}% - {maxPct}%</span>
                    </div>
                  );
                })
              ) : (
                <p className="text-[10px] text-zinc-500">Aucune zone chargée</p>
              )}
            </div>
            {selectedStore !== 'ALL' && availableColors.length < 10 && (
              <p className="text-[9px] text-zinc-500 mt-2 italic">
                Ce magasin n'a pas de zones dans toutes les tranches
              </p>
            )}
          </div>
        </div>
      )}

      {/* Bouton pour réafficher le panneau */}
      {!showPanel && (
        <button
          onClick={() => setShowPanel(true)}
          className="absolute top-4 left-4 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white hover:bg-zinc-700"
          style={{ zIndex: 10000 }}
        >
          ⚙️
        </button>
      )}

      {/* Carte plein écran */}
      <div className="w-full h-full">
        {allZones && allZones.length > 0 ? (
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ width: '100%', height: '100%' }}
            key={`${selectedStore}-${viewMode}`}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />

            {/* Marqueurs des magasins */}
            {stores.map((store) => {
              const coords = getStoreCoords(store.code);
              return (
                <Marker 
                  key={store.code}
                  position={coords as [number, number]}
                  icon={storeIcon}
                >
                  <Popup>
                    <div style={{ fontFamily: 'Inter, sans-serif' }}>
                      <p style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
                        📍 {store.nom}
                      </p>
                      <p style={{ fontSize: '11px', color: '#666' }}>
                        {store.ville} ({store.cp})<br/>
                        Code: {store.code}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Polygones fusionnés par zone de couleur */}
            {geoJsonData && geoJsonData.length > 0 && geoJsonData.map((feature, idx) => {
              const intensity = feature.properties.intensity || 0;
              const color = getColor(intensity);
              const borderColor = storeBorderColors[feature.properties.storeCode] || '#666';
              
              return (
                <GeoJSON
                  key={`zone-${feature.properties.storeCode}-${feature.properties.colorIndex}`}
                  data={feature}
                  style={{
                    color: borderColor,
                    fillColor: color,
                    fillOpacity: 0.65,
                    weight: 2,
                    opacity: 0.8,
                  }}
                  onEachFeature={(feature, layer) => {
                    const props = feature.properties;
                    const storeData = stores.find(s => String(s.code) === String(props.storeCode));
                    layer.bindPopup(`
                      <div style="font-family: Inter, sans-serif;">
                        <p style="font-weight: bold; font-size: 14px; margin-bottom: 8px; color: ${borderColor};">
                          🎨 Zone ${Math.round(props.intensity * 100)}%
                        </p>
                        <p style="font-size: 11px; color: #0066cc; margin-bottom: 6px;">
                          <strong>Magasin:</strong> ${storeData?.nom || props.storeCode}
                        </p>
                        <div style="font-size: 11px;">
                          <p><strong>Codes postaux:</strong> ${props.nbCodes}</p>
                          <p><strong>CA total:</strong> ${new Intl.NumberFormat('fr-FR', {
                            style: 'currency',
                            currency: 'EUR',
                          }).format(props.totalCA)}</p>
                          <p><strong>Clients:</strong> ${props.nbClients}</p>
                        </div>
                      </div>
                    `);
                  }}
                />
              );
            })}
          </MapContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-400">
            <p>Chargement des données...</p>
          </div>
        )}
      </div>
    </div>
  );
}
