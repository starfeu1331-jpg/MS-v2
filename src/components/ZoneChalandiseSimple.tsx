import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Store {
  code: string;
  nom: string;
  lat: number | null;
  lon: number | null;
}

interface Zone {
  cp: string;
  ville: string;
  nbClients: number;
  totalCA: number;
  nbTransactions: number;
}

interface StoreWithZones extends Store {
  zones: Zone[];
}

export default function ZoneChalandiseSimple() {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [zones, setZones] = useState<Zone[]>([]);
  const [geoData, setGeoData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Charger la liste des magasins
  useEffect(() => {
    fetch('/api/stores?action=list')
      .then(res => res.json())
      .then(data => {
        setStores(data.stores || []);
        if (data.stores && data.stores.length > 0) {
          setSelectedStore(data.stores[0].code);
        }
      })
      .catch(err => console.error('Erreur chargement magasins:', err));
  }, []);

  // Charger les zones quand un magasin est sélectionné
  useEffect(() => {
    if (!selectedStore) return;

    setLoading(true);
    setGeoData([]);
    
    console.log(`🔍 Chargement zones pour magasin ${selectedStore}...`);

    fetch(`/api/stores?action=catchment&storeCode=${selectedStore}`)
      .then(res => res.json())
      .then(data => {
        const storeZones = data.data || [];
        console.log(`✅ ${storeZones.length} zones reçues pour magasin ${selectedStore}`);
        
        // Afficher les détails des zones
        storeZones.forEach((zone: Zone, idx: number) => {
          if (idx < 10) {
            console.log(`  📍 CP ${zone.cp} (${zone.ville}): ${zone.nbClients} clients, ${zone.totalCA.toFixed(0)}€`);
          }
        });
        if (storeZones.length > 10) {
          console.log(`  ... et ${storeZones.length - 10} autres zones`);
        }

        setZones(storeZones);
        
        // Charger les géométries
        loadGeometries(storeZones);
      })
      .catch(err => {
        console.error('❌ Erreur chargement zones:', err);
        setLoading(false);
      });
  }, [selectedStore]);

  const loadGeometries = async (zonesToLoad: Zone[]) => {
    console.log(`🗺️ Chargement géométries pour ${zonesToLoad.length} zones...`);
    
    const geoFeatures: any[] = [];
    
    // Trouver le CA max pour la normalisation des couleurs
    const maxCA = Math.max(...zonesToLoad.map(z => z.totalCA));
    console.log(`💰 CA maximum: ${maxCA.toFixed(0)}€`);

    for (const zone of zonesToLoad) {
      try {
        // Nettoyer le CP
        let cleanCP = String(zone.cp).trim().replace(/\./g, '').replace(/,/g, '').replace(/\s/g, '');
        
        if (cleanCP.includes('E') || cleanCP.includes('e') || cleanCP.length > 5 || cleanCP.length === 0) {
          console.warn(`⚠️ CP invalide ignoré: "${zone.cp}"`);
          continue;
        }

        const normalizedCP = cleanCP.padStart(5, '0');

        // Appeler l'API geo.gouv.fr
        const response = await fetch(
          `https://geo.api.gouv.fr/communes?codePostal=${normalizedCP}&fields=contour&format=geojson&geometry=contour`
        );

        if (!response.ok) {
          console.warn(`⚠️ CP ${normalizedCP}: API error ${response.status}`);
          continue;
        }

        const geojson = await response.json();
        
        if (!geojson.features || geojson.features.length === 0) {
          console.warn(`⚠️ CP ${normalizedCP}: Aucune géométrie trouvée`);
          continue;
        }

        // Calculer l'intensité (0 à 1) basée sur le CA
        const intensity = zone.totalCA / maxCA;
        
        // Couleur du rouge (fort CA) au jaune (faible CA)
        const color = intensity > 0.7 ? '#dc2626' : // Rouge foncé
                     intensity > 0.5 ? '#ea580c' : // Orange
                     intensity > 0.3 ? '#f59e0b' : // Jaune-orange
                     intensity > 0.1 ? '#fbbf24' : // Jaune
                                       '#fde047';  // Jaune clair

        // Ajouter chaque commune séparément (pas de fusion)
        geojson.features.forEach((feature: any) => {
          geoFeatures.push({
            type: 'Feature',
            geometry: feature.geometry,
            properties: {
              cp: zone.cp,
              ville: zone.ville,
              nbClients: zone.nbClients,
              totalCA: zone.totalCA,
              nbTransactions: zone.nbTransactions,
              intensity,
              color
            }
          });
        });

        console.log(`  ✅ CP ${normalizedCP} (${zone.ville}): ${zone.nbClients} clients → couleur ${color}`);

      } catch (err) {
        console.error(`❌ Erreur CP ${zone.cp}:`, err);
      }

      // Petite pause pour ne pas surcharger l'API
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`✅ ${geoFeatures.length} zones géographiques chargées`);
    setGeoData(geoFeatures);
    setLoading(false);
  };

  const onEachFeature = (feature: any, layer: any) => {
    const props = feature.properties;
    layer.bindPopup(`
      <div class="p-2">
        <h3 class="font-bold text-lg">${props.cp} - ${props.ville}</h3>
        <p class="mt-1"><strong>Clients:</strong> ${props.nbClients}</p>
        <p><strong>CA:</strong> ${props.totalCA.toFixed(0)}€</p>
        <p><strong>Transactions:</strong> ${props.nbTransactions}</p>
      </div>
    `);
  };

  const center: LatLngTuple = [46.603354, 1.888334]; // Centre de la France

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Zones de Chalandise</h1>
            <p className="text-sm text-gray-600 mt-1">Version simplifiée - Affichage direct par CP</p>
          </div>
          
          <div className="flex items-center gap-4">
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {stores.map(store => (
                <option key={store.code} value={store.code}>
                  {store.nom}
                </option>
              ))}
            </select>

            {loading && (
              <div className="text-sm text-gray-600 flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                Chargement...
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        {zones.length > 0 && (
          <div className="mt-4 grid grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-600">Zones</div>
              <div className="text-xl font-bold text-gray-900">{zones.length}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-600">Clients total</div>
              <div className="text-xl font-bold text-gray-900">
                {zones.reduce((sum, z) => sum + z.nbClients, 0)}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-600">CA total</div>
              <div className="text-xl font-bold text-gray-900">
                {zones.reduce((sum, z) => sum + z.totalCA, 0).toFixed(0)}€
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-600">Zones affichées</div>
              <div className="text-xl font-bold text-gray-900">{geoData.length}</div>
            </div>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
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
          {geoData.map((feature, idx) => (
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

          {/* Marqueur magasin */}
          {stores
            .filter(s => s.code === selectedStore && s.lat && s.lon)
            .map(store => (
              <Marker key={store.code} position={[store.lat!, store.lon!]}>
                <Popup>
                  <div className="text-center">
                    <strong>{store.nom}</strong>
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </div>
    </div>
  );
}
