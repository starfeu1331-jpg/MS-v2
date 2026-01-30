import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import chroma from 'chroma-js';
import { getPostcodeCoords } from '../utils/postcodeCoordsMap';
import { AlertCircle, Loader, BarChart3, Users } from 'lucide-react';

interface CatchmentData {
  cp: string;
  ville: string;
  nbClients: number;
  totalCA: number;
  nbTransactions: number;
  intensiteCA: number;
  intensiteClients: number;
}

interface CatchmentResponse {
  storeCode: string;
  storeName: string;
  storeCity: string;
  storeCP: string;
  data: CatchmentData[];
  summary: {
    totalClients: number;
    totalCA: number;
    uniquePostalCodes: number;
    nbTransactions: number;
  };
}

export default function ZoneChalandise() {
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [catchmentData, setCatchmentData] = useState<CatchmentResponse | null>(null);
  const [geoJsonData, setGeoJsonData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'ca' | 'clients'>('ca');
  const [mapCenter, setMapCenter] = useState<[number, number]>([46.5, 2.5]);
  const [mapZoom, setMapZoom] = useState(6);

  // Récupérer la liste des magasins
  useEffect(() => {
    const fetchStores = async () => {
      try {
        const response = await fetch('/api/stores?action=list');
        const data = await response.json();
        if (data && data.stores) {
          setStores(data.stores);
          // Par défaut, vue globale
          setSelectedStore('ALL');
        }
      } catch (err) {
        console.error('Erreur récupération magasins:', err);
        setError('Impossible de récupérer les magasins');
      }
    };
    fetchStores();
  }, []);

  // Récupérer les données de chalandise quand le magasin change
  useEffect(() => {
    if (!selectedStore) return;

    const fetchCatchmentArea = async () => {
      setLoading(true);
      setError(null);
      try {
        // Si "ALL", charger les vraies données agrégées
        if (selectedStore === 'ALL') {
          const response = await fetch(`/api/stores?action=all`);
          const data = await response.json();
          setCatchmentData(data);
          setMapCenter([46.5, 2.5]); // Centre de la France
          setMapZoom(6);
        } else {
          const response = await fetch(`/api/stores?action=catchment&storeCode=${selectedStore}`);
          const data = await response.json();
          setCatchmentData(data);

          // Centrer la carte sur le magasin
          if (data.storeCP) {
            const coords = getPostcodeCoords(data.storeCP);
            setMapCenter([coords[0], coords[1]]);
            setMapZoom(8);
          }
        }
      } catch (err) {
        console.error('Erreur:', err);
        setError('Impossible de charger les données de chalandise');
      } finally {
        setLoading(false);
      }
    };

    fetchCatchmentArea();
  }, [selectedStore]);

  // Charger les polygones GeoJSON pour chaque code postal
  useEffect(() => {
    if (!catchmentData || !catchmentData.data) return;

    const loadGeoJson = async () => {
      const geoJsonArray = [];
      
      // Limiter à 50 codes postaux pour éviter trop de requêtes
      const topPostalCodes = catchmentData.data.slice(0, 50);
      
      for (const item of topPostalCodes) {
        try {
          // API geo.gouv.fr pour obtenir les contours des communes par code postal
          const response = await fetch(
            `https://geo.api.gouv.fr/communes?codePostal=${item.cp}&fields=nom,code,codesPostaux,centre,contour&format=geojson&geometry=contour`
          );
          
          if (response.ok) {
            const geojson = await response.json();
            if (geojson && geojson.features && geojson.features.length > 0) {
              // Ajouter les données de chalandise aux propriétés
              geojson.features.forEach((feature: any) => {
                feature.properties = {
                  ...feature.properties,
                  ...item,
                  intensity: getIntensity(item),
                };
              });
              geoJsonArray.push(...geojson.features);
            }
          }
          
          // Petit délai pour ne pas surcharger l'API
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (err) {
          console.error(`Erreur chargement GeoJSON pour ${item.cp}:`, err);
        }
      }
      
      setGeoJsonData(geoJsonArray);
    };

    loadGeoJson();
  }, [catchmentData, viewMode]);

  const getColor = (intensity: number) => {
    // Échelle logarithmique pour mieux différencier les valeurs faibles vs fortes
    // Transforme l'intensité linéaire (0-1) en échelle log pour plus de contraste
    const logIntensity = intensity > 0 ? Math.log10(1 + intensity * 9) : 0;
    
    const colorScale = chroma.scale(['#4B5563', '#2E7D9E', '#FFEB3B', '#FF9800', '#DC3545']).domain([0, 1]);
    return colorScale(logIntensity).hex();
  };

  const getIntensity = (data: CatchmentData) => {
    return viewMode === 'ca' ? data.intensiteCA : data.intensiteClients;
  };

  // Icône rouge pour le magasin
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

  if (loading && !catchmentData) {
    return (
      <div className="h-full bg-zinc-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-zinc-400">Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-zinc-900 flex flex-col">
      {/* Controls Panel */}
      <div className="bg-zinc-800 border-b border-zinc-700 p-4 space-y-4">
        {/* Sélection du magasin */}
        <div className="flex gap-4 items-center">
          <label className="text-zinc-300 font-medium">Magasin:</label>
          <select
            value={selectedStore || ''}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="flex-1 px-4 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white font-medium hover:bg-zinc-600 transition-colors"
          >
            <option value="ALL">🗺️ Tous les magasins (Vue France)</option>
            {stores.map((store) => (
              <option key={store.code} value={store.code}>
                {store.nom} ({store.code})
              </option>
            ))}
          </select>
        </div>

        {/* View Mode Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('ca')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === 'ca'
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Par CA
          </button>
          <button
            onClick={() => setViewMode('clients')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === 'clients'
                ? 'bg-purple-600 text-white'
                : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            }`}
          >
            <Users className="w-4 h-4" />
            Par Nombre Clients
          </button>
        </div>

        {/* Stats Summary */}
        {catchmentData && catchmentData.summary && (
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-zinc-700 p-3 rounded-lg">
              <p className="text-xs text-zinc-400 uppercase tracking-wider">Total CA</p>
              <p className="text-lg font-bold text-green-400">
                {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
                  catchmentData.summary.totalCA || 0
                )}
              </p>
            </div>
            <div className="bg-zinc-700 p-3 rounded-lg">
              <p className="text-xs text-zinc-400 uppercase tracking-wider">Total Clients</p>
              <p className="text-lg font-bold text-blue-400">
                {(catchmentData.summary.totalClients || 0).toLocaleString('fr-FR')}
              </p>
            </div>
            <div className="bg-zinc-700 p-3 rounded-lg">
              <p className="text-xs text-zinc-400 uppercase tracking-wider">Codes Postaux</p>
              <p className="text-lg font-bold text-purple-400">
                {catchmentData.summary.uniquePostalCodes || 0}
              </p>
            </div>
            <div className="bg-zinc-700 p-3 rounded-lg">
              <p className="text-xs text-zinc-400 uppercase tracking-wider">Transactions</p>
              <p className="text-lg font-bold text-orange-400">
                {(catchmentData.summary.nbTransactions || 0).toLocaleString('fr-FR')}
              </p>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex gap-2 items-center text-xs">
          <span className="text-zinc-400">Intensité:</span>
          <div className="flex gap-1">
            {[0, 0.25, 0.5, 0.75, 1].map((intensity) => (
              <div
                key={intensity}
                className="w-6 h-6 rounded border border-zinc-600"
                style={{ backgroundColor: getColor(intensity) }}
                title={`${Math.round(intensity * 100)}%`}
              />
            ))}
          </div>
          <span className="text-zinc-400">Faible → Fort</span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-4 p-4 bg-red-900 border border-red-700 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative overflow-hidden" style={{ minHeight: '600px' }}>
        {catchmentData && catchmentData.data && catchmentData.data.length > 0 ? (
          <>
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ width: '100%', height: '100%', minHeight: '600px' }}
              key={`${selectedStore}-${viewMode}`}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />

              {/* Marqueur du magasin */}
              {catchmentData && catchmentData.storeCP && selectedStore !== 'ALL' && (
                <Marker 
                  position={L.latLng(getPostcodeCoords(catchmentData.storeCP))}
                  icon={storeIcon}
                >
                  <Popup>
                    <div style={{ fontFamily: 'Inter, sans-serif' }}>
                      <p style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px' }}>
                        📍 {catchmentData.storeName}
                      </p>
                      <p style={{ fontSize: '12px', color: '#666' }}>
                        {catchmentData.storeCity} ({catchmentData.storeCP})<br/>
                        Code: {catchmentData.storeCode}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Afficher les polygones GeoJSON */}
              {geoJsonData.length > 0 && geoJsonData.map((feature, idx) => {
                const intensity = feature.properties.intensity || 0;
                const color = getColor(intensity);
                
                return (
                  <GeoJSON
                    key={`geojson-${idx}`}
                    data={feature}
                    style={{
                      color: color,
                      fillColor: color,
                      fillOpacity: 0.6,
                      weight: 2,
                    }}
                    onEachFeature={(feature, layer) => {
                      const props = feature.properties;
                      layer.bindPopup(`
                        <div style="font-family: Inter, sans-serif;">
                          <p style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">
                            ${props.cp} - ${props.ville}
                          </p>
                          <div style="font-size: 12px;">
                            <p><strong>Clients:</strong> ${props.nbClients}</p>
                            <p><strong>CA:</strong> ${new Intl.NumberFormat('fr-FR', {
                              style: 'currency',
                              currency: 'EUR',
                            }).format(props.totalCA)}</p>
                            <p><strong>Transactions:</strong> ${props.nbTransactions}</p>
                            <p><strong>Intensité CA:</strong> ${Math.round(props.intensiteCA * 100)}%</p>
                            <p><strong>Intensité Clients:</strong> ${Math.round(props.intensiteClients * 100)}%</p>
                          </div>
                        </div>
                      `);
                    }}
                  />
                );
              })}
            </MapContainer>
          </>        ) : (
          <div className="flex items-center justify-center h-full text-zinc-400">
            <p>Sélectionnez un magasin pour voir sa zone de chalandise</p>
          </div>        )}
      </div>

      {/* Data Table (Bottom) */}
      {catchmentData && (
        <div className="bg-zinc-800 border-t border-zinc-700 max-h-48 overflow-y-auto">
          <div className="grid grid-cols-6 gap-4 p-4 sticky top-0 bg-zinc-900 font-semibold text-xs text-zinc-400 uppercase border-b border-zinc-700">
            <div>CP</div>
            <div>Ville</div>
            <div>Clients</div>
            <div>CA</div>
            <div>Transactions</div>
            <div>Intensité</div>
          </div>
          {catchmentData.data.map((item, idx) => (
            <div
              key={idx}
              className="grid grid-cols-6 gap-4 p-3 text-sm border-b border-zinc-700 hover:bg-zinc-700 transition-colors"
            >
              <div className="font-semibold text-blue-400">{item.cp}</div>
              <div className="text-zinc-300">{item.ville}</div>
              <div className="text-zinc-300">{item.nbClients}</div>
              <div className="text-green-400">
                {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
                  item.totalCA
                )}
              </div>
              <div className="text-orange-400">{item.nbTransactions}</div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: getColor(getIntensity(item)) }}
                />
                <span className="text-zinc-300">{Math.round(getIntensity(item) * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
