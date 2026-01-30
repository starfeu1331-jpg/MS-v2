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
        console.log('🏪 Magasins chargés:', data.stores);
        console.log('📍 Magasins avec coordonnées:', data.stores?.filter((s: Store) => s.lat && s.lon).length);
        data.stores?.forEach((s: Store) => {
          if (s.lat && s.lon) {
            console.log(`  ✅ ${s.nom}: lat=${s.lat}, lon=${s.lon}`);
          } else {
            console.log(`  ❌ ${s.nom}: PAS de coordonnées (lat=${s.lat}, lon=${s.lon})`);
          }
        });
        setStores(data.stores || []);
        if (data.stores && data.stores.length > 0) {
          setSelectedStore(data.stores[0].code);
        }
      })
      .catch(err => console.error('Erreur chargement magasins:', err));
  }, []);

  // Icône personnalisée pour les magasins
  const storeIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
      <svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
        <circle cx="6" cy="6" r="5" fill="#dc2626" stroke="#ffffff" stroke-width="1.5"/>
      </svg>
    `),
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -6]
  });

  // Icône plus visible pour les magasins (point rouge plus gros)
  const storeIconBig = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
      <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="8" fill="#dc2626" stroke="#ffffff" stroke-width="2"/>
        <circle cx="10" cy="10" r="4" fill="#ffffff" opacity="0.5"/>
      </svg>
    `),
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
  });

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

          {/* Marqueurs pour TOUS les magasins */}
          {(() => {
            const storesWithCoords = stores.filter(s => s.lat && s.lon);
            console.log('🎯 Rendu des marqueurs:', storesWithCoords.length, 'magasins avec coordonnées');
            return storesWithCoords.map(store => {
              console.log(`  🔴 Marqueur rendu pour ${store.nom} à [${store.lat}, ${store.lon}]`);
              return (
                <Marker 
                  key={store.code} 
                  position={[store.lat!, store.lon!]}
                  icon={storeIconBig}
                  zIndexOffset={9999}
                >
                  <Popup>
                    <div style={{ textAlign: 'center', minWidth: '120px' }}>
                      <strong style={{ fontSize: '14px', color: '#dc2626' }}>{store.nom}</strong>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                        {store.ville}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            });
          })()}
        </MapContainer>
      </div>

      {/* Panneau de contrôle - HAUT GAUCHE avec effet glassmorphism DARK */}
      <div 
        style={{ 
          position: 'fixed',
          top: '100px', // Baissé pour ne pas chevaucher le titre
          left: '280px', // Décalé pour ne pas chevaucher le menu
          zIndex: 9999, // Au-dessus de tout sauf interactions map
          minWidth: panelOpen ? '340px' : 'auto',
          backgroundColor: 'rgba(17, 24, 39, 0.85)', // Dark
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(75, 85, 99, 0.3)',
          overflow: 'hidden',
          transition: 'all 0.3s ease'
        }}
      >
        {/* En-tête */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: panelOpen ? '14px 16px' : '10px 14px',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.15) 100%)',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onClick={() => setPanelOpen(!panelOpen)}
        >
          <h3 style={{ 
            fontWeight: '600', 
            color: '#93c5fd', 
            fontSize: panelOpen ? '15px' : '13px',
            margin: 0,
            transition: 'font-size 0.3s ease'
          }}>
            {panelOpen ? '📍 Zones de Chalandise' : '📍'}
          </h3>
          <button style={{ 
            color: '#60a5fa', 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: 0
          }}>
            {panelOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>

        {/* Contenu */}
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
                  transition: 'all 0.2s ease'
                }}
              >
                {stores.map(store => (
                  <option key={store.code} value={store.code}>
                    {store.nom}
                  </option>
                ))}
              </select>
            </div>

            {/* Légende des couleurs */}
            <div style={{ 
              marginBottom: '14px',
              padding: '12px',
              backgroundColor: 'rgba(31, 41, 55, 0.6)',
              borderRadius: '10px',
              border: '1px solid rgba(75, 85, 99, 0.4)'
            }}>
              <div style={{ 
                fontSize: '12px', 
                fontWeight: '600', 
                color: '#d1d5db',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                🎨 Légende (CA par décile)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {[
                  { color: '#1e3a8a', label: '0-10%' },
                  { color: '#1e40af', label: '10-20%' },
                  { color: '#2563eb', label: '20-30%' },
                  { color: '#3b82f6', label: '30-40%' },
                  { color: '#60a5fa', label: '40-50%' },
                  { color: '#fbbf24', label: '50-60%' },
                  { color: '#f59e0b', label: '60-70%' },
                  { color: '#ea580c', label: '70-80%' },
                  { color: '#dc2626', label: '80-90%' },
                  { color: '#991b1b', label: '90-100%' }
                ].map(({ color, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ 
                      width: '16px', 
                      height: '16px', 
                      backgroundColor: color,
                      borderRadius: '4px',
                      border: '1px solid rgba(255,255,255,0.2)',
                      flexShrink: 0
                    }}></div>
                    <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '500' }}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Indicateur de chargement */}
            {loading && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                fontSize: '13px', 
                color: '#60a5fa',
                fontWeight: '500',
                backgroundColor: 'rgba(37, 99, 235, 0.2)',
                padding: '10px 12px',
                borderRadius: '10px'
              }}>
                <div style={{ 
                  width: '14px', 
                  height: '14px', 
                  border: '2px solid #3b82f6',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }}></div>
                Chargement...
              </div>
            )}

            {/* Info zones */}
            {!loading && geoData.length > 0 && (
              <div style={{ 
                fontSize: '13px', 
                color: '#6ee7b7',
                fontWeight: '500',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                padding: '10px 12px',
                borderRadius: '10px',
                textAlign: 'center'
              }}>
                ✓ {geoData.length} zone{geoData.length > 1 ? 's' : ''} affichée{geoData.length > 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Animation CSS pour le spinner */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
