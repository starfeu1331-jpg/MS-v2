import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
  const [panelOpen, setPanelOpen] = useState(true);

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
    
    // Trier les zones par CA pour calculer les déciles (10 tranches de 10%)
    const sortedZones = [...zonesToLoad].sort((a, b) => a.totalCA - b.totalCA);
    console.log(`💰 CA min: ${sortedZones[0].totalCA.toFixed(0)}€ → max: ${sortedZones[sortedZones.length - 1].totalCA.toFixed(0)}€`);

    for (let i = 0; i < zonesToLoad.length; i++) {
      const zone = zonesToLoad[i];
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

        // Calculer le rang percentile de cette zone (0 à 1)
        const rank = sortedZones.findIndex(z => z.cp === zone.cp);
        const percentile = rank / (sortedZones.length - 1 || 1);
        
        // Attribuer une couleur basée sur le décile (10 tranches de 10%)
        const decile = Math.floor(percentile * 10);
        const colors = [
          '#1e3a8a', // Bleu très foncé - 0-10%
          '#1e40af', // Bleu foncé - 10-20%
          '#2563eb', // Bleu - 20-30%
          '#3b82f6', // Bleu clair - 30-40%
          '#60a5fa', // Bleu très clair - 40-50%
          '#fbbf24', // Jaune - 50-60%
          '#f59e0b', // Orange - 60-70%
          '#ea580c', // Orange foncé - 70-80%
          '#dc2626', // Rouge - 80-90%
          '#991b1b'  // Rouge très foncé - 90-100%
        ];
        const color = colors[Math.min(decile, 9)];

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
              percentile,
              decile,
              color
            }
          });
        });

        console.log(`  ✅ CP ${normalizedCP} (${zone.ville}): décile ${decile}/10 (${zone.nbClients} clients) → ${color}`);

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
    <>
      {/* Map plein écran */}
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

      {/* Panneau de contrôle flottant - HORS de la div map */}
      <div 
        style={{ 
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          minWidth: '340px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
          border: '3px solid #3b82f6'
        }}
      >
        {/* En-tête avec bouton replier */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            backgroundColor: '#dbeafe',
            borderTopLeftRadius: '10px',
            borderTopRightRadius: '10px',
            borderBottom: '2px solid #93c5fd',
            cursor: 'pointer'
          }}
          onClick={() => setPanelOpen(!panelOpen)}
        >
          <h3 style={{ fontWeight: 'bold', color: '#1e3a8a', fontSize: '18px', margin: 0 }}>
            📍 Sélection Magasin
          </h3>
          <button style={{ color: '#1e40af', background: 'none', border: 'none', cursor: 'pointer' }}>
            {panelOpen ? <ChevronDown size={22} /> : <ChevronUp size={22} />}
          </button>
        </div>

        {/* Contenu du panneau */}
        {panelOpen && (
          <div style={{ padding: '16px' }}>
            {/* Sélection magasin */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
                Choisir un magasin:
              </label>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '16px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                {stores.map(store => (
                  <option key={store.code} value={store.code}>
                    {store.nom}
                  </option>
                ))}
              </select>
            </div>

            {/* Indicateur de chargement */}
            {loading && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                fontSize: '14px', 
                color: '#1d4ed8',
                fontWeight: '500',
                backgroundColor: '#dbeafe',
                padding: '10px 12px',
                borderRadius: '8px'
              }}>
                <div style={{ 
                  width: '16px', 
                  height: '16px', 
                  border: '2px solid #2563eb',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                Chargement des zones...
              </div>
            )}

            {/* Info zones */}
            {!loading && geoData.length > 0 && (
              <div style={{ 
                fontSize: '14px', 
                color: '#4b5563',
                backgroundColor: '#f3f4f6',
                padding: '10px 12px',
                borderRadius: '8px'
              }}>
                ✅ <strong>{geoData.length}</strong> zones affichées
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
