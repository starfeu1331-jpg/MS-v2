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
  const [loading, setLoading] = useState(false);
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

  // Charger les polygones GeoJSON
  useEffect(() => {
    if (!allZones || allZones.length === 0) return;

    const loadGeoJson = async () => {
      const geoJsonArray = [];
      
      // Filtrer selon le magasin sélectionné
      console.log('🔍 selectedStore:', selectedStore);
      console.log('🔍 allZones sample:', allZones.slice(0, 3).map(z => ({ code: z.storeCode, name: z.storeName })));
      
      const zonesToDisplay = selectedStore === 'ALL' 
        ? allZones 
        : allZones.filter(z => String(z.storeCode).trim() === String(selectedStore).trim());
      
      console.log('✅ Zones filtrées:', zonesToDisplay.length, 'sur', allZones.length);
      
      // Utiliser toutes les zones (pas de limite)
      const topZones = zonesToDisplay;
      
      for (const zone of topZones) {
        try {
          const response = await fetch(
            `https://geo.api.gouv.fr/communes?codePostal=${zone.cp}&fields=nom,code,codesPostaux,centre,contour&format=geojson&geometry=contour`
          );
          
          if (response.ok) {
            const geojson = await response.json();
            if (geojson && geojson.features && geojson.features.length > 0) {
              geojson.features.forEach((feature: any) => {
                const intensity = viewMode === 'ca' ? zone.intensiteCA : zone.intensiteClients;
                feature.properties = {
                  ...feature.properties,
                  ...zone,
                  intensity,
                };
              });
              geoJsonArray.push(...geojson.features);
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (err) {
          console.error(`Erreur GeoJSON pour ${zone.cp}:`, err);
        }
      }
      
      setGeoJsonData(geoJsonArray);
      
      // Créer contours globaux par magasin
      const contoursMap: Record<string, any[]> = {};
      geoJsonArray.forEach((feature: any) => {
        const storeCode = feature.properties.storeCode;
        if (!contoursMap[storeCode]) {
          contoursMap[storeCode] = [];
        }
        contoursMap[storeCode].push(feature);
      });
      
      const contours = [];
      for (const [storeCode, features] of Object.entries(contoursMap)) {
        try {
          // Union de tous les polygones d'un magasin
          let combined = features[0];
          for (let i = 1; i < features.length; i++) {
            try {
              combined = turf.union(turf.featureCollection([combined, features[i]]));
            } catch (e) {
              // Ignore les erreurs d'union
            }
          }
          
          if (combined) {
            contours.push({
              storeCode,
              geometry: combined.geometry,
            });
          }
        } catch (err) {
          console.error(`Erreur contour pour ${storeCode}:`, err);
        }
      }
      
      setStoreContours(contours);
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
      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 bg-zinc-900/80 z-50 flex items-center justify-center">
          <Loader className="w-8 h-8 text-blue-500 animate-spin" />
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

          {/* Légende */}
          <div className="text-xs text-zinc-400">
            <p className="mb-1">Légende:</p>
            <div className="flex gap-1">
              {[0, 0.25, 0.5, 0.75, 1].map((intensity) => (
                <div
                  key={intensity}
                  className="w-5 h-5 rounded border border-zinc-600"
                  style={{ backgroundColor: getColor(intensity) }}
                  title={`${Math.round(intensity * 100)}%`}
                />
              ))}
            </div>
            <p className="mt-1">0% → 100%</p>
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

            {/* Polygones GeoJSON des CP (sans bordure) */}
            {geoJsonData && geoJsonData.length > 0 && geoJsonData.map((feature, idx) => {
              const intensity = feature.properties.intensity || 0;
              const color = getColor(intensity);
              
              return (
                <GeoJSON
                  key={`geojson-${idx}`}
                  data={feature}
                  style={{
                    color: '#333',
                    fillColor: color,
                    fillOpacity: 0.6,
                    weight: 0.5,
                    opacity: 0.3,
                  }}
                  onEachFeature={(feature, layer) => {
                    const props = feature.properties;
                    layer.bindPopup(`
                      <div style="font-family: Inter, sans-serif;">
                        <p style="font-weight: bold; font-size: 14px; margin-bottom: 8px;">
                          ${props.cp} - ${props.ville}
                        </p>
                        <p style="font-size: 11px; color: #0066cc; margin-bottom: 6px;">
                          <strong>Magasin:</strong> ${props.storeName} (${props.storeCode})
                        </p>
                        <div style="font-size: 11px;">
                          <p><strong>CA:</strong> ${new Intl.NumberFormat('fr-FR', {
                            style: 'currency',
                            currency: 'EUR',
                          }).format(props.totalCA)}</p>
                          <p><strong>Clients:</strong> ${props.nbClients}</p>
                          <p><strong>Transactions:</strong> ${props.nbTransactions}</p>
                        </div>
                      </div>
                    `);
                  }}
                />
              );
            })}
            
            {/* Contours globaux par magasin (bordures colorées épaisses) */}
            {storeContours && storeContours.length > 0 && storeContours.map((contour, idx) => {
              const borderColor = getStoreBorderColor(contour.storeCode);
              
              return (
                <GeoJSON
                  key={`contour-${idx}`}
                  data={{
                    type: 'Feature',
                    geometry: contour.geometry,
                    properties: { storeCode: contour.storeCode },
                  } as any}
                  style={{
                    color: borderColor,
                    fillColor: 'transparent',
                    fillOpacity: 0,
                    weight: 3,
                    opacity: 1,
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
