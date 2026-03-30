import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import { ChevronDown, ChevronUp, Download } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import * as XLSX from 'xlsx';

// Icône personnalisée pour les magasins
const storeIcon = L.divIcon({
  html: `
    <div style="position: relative; width: 28px; height: 28px;">
      <div style="
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
        width: 24px; height: 24px; background: #dc2626; border-radius: 50%;
        border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      </div>
    </div>
  `,
  className: 'custom-store-marker',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
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

// Coordonnées GPS des magasins — source unique
const STORE_COORDINATES: Record<string, { lat: number; lon: number }> = {
  '12': { lat: 44.100572, lon: 4.106784 },
  '13': { lat: 43.358272, lon: 3.254277 },
  '14': { lat: 43.664382, lon: 4.640042 },
  '16': { lat: 43.572258, lon: 3.847119 },
  '17': { lat: 44.940179, lon: 4.863465 },
  '19': { lat: 45.051845, lon: 5.081296 },
  '22': { lat: 45.702634, lon: 5.000077 },
  '23': { lat: 46.222808, lon: 5.203020 },
  '24': { lat: 45.943104, lon: 6.074168 },
  '25': { lat: 43.211340, lon: 2.299221 },
  '26': { lat: 45.218836, lon: 5.678330 },
  '27': { lat: 45.984220, lon: 4.742440 },
  '28': { lat: 45.184090, lon: 5.774699 },
  '29': { lat: 43.677654, lon: 1.408238 },
  '31': { lat: 44.575253, lon: 4.747757 },
  '32': { lat: 45.777465, lon: 3.196072 },
  '33': { lat: 43.115655, lon: 0.763458 },
  '34': { lat: 44.615308, lon: 4.401042 },
  '35': { lat: 43.852577, lon: 4.350875 },
  '36': { lat: 45.616262, lon: 5.886227 },
  '37': { lat: 43.984397, lon: 4.886017 },
  '38': { lat: 44.393611, lon: 2.601307 },
  '39': { lat: 43.157188, lon: 2.981007 },
};

// Palette: Bleu (faible) → Jaune → Orange → Rouge (fort)
const COLORS = [
  '#1e3a8a', '#1e40af', '#2563eb', '#3b82f6', '#60a5fa',
  '#fbbf24', '#f59e0b', '#ea580c', '#dc2626', '#991b1b',
];

export default function ZoneChalandiseV4() {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [rawZones, setRawZones] = useState<Zone[]>([]); // Données brutes API (ne change qu'au changement de magasin)
  const [zones, setZones] = useState<Zone[]>([]); // Zones traitées (top N, triées, colorées)
  const [geoData, setGeoData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [storeStats, setStoreStats] = useState<StoreStats | null>(null);
  const [visibleDeciles, setVisibleDeciles] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
  const [panelOpen, setPanelOpen] = useState(true);
  const [sortCriterion, setSortCriterion] = useState<'ca' | 'clients' | 'transactions'>('ca');
  const [perCapitaMode, setPerCapitaMode] = useState(false);
  const [topN, setTopN] = useState(50);

  // Population locale (chargée une seule fois depuis codes-postaux.json)
  const populationMap = useRef<Map<string, number>>(new Map());
  const populationLoaded = useRef(false);

  // Cache des géométries GeoJSON déjà chargées
  const geoCache = useRef<Map<string, any[]>>(new Map());

  const center: LatLngTuple = [46.603354, 1.888334];

  // ── Charger la base population locale au montage ──
  useEffect(() => {
    if (populationLoaded.current) return;
    populationLoaded.current = true;

    fetch('/codes-postaux.json')
      .then(res => res.text())
      .then(text => {
        // Le fichier est un JSON array
        const communes = JSON.parse(text);
        const map = new Map<string, number>();

        for (const commune of communes) {
          if (!commune.codesPostaux || !commune.population) continue;
          for (const cp of commune.codesPostaux) {
            map.set(cp, (map.get(cp) || 0) + commune.population);
          }
        }

        populationMap.current = map;
        console.log(`📊 Population locale chargée: ${map.size} codes postaux`);
      })
      .catch(err => console.error('Erreur chargement codes-postaux.json:', err));
  }, []);

  // ── Charger la liste des magasins au montage ──
  useEffect(() => {
    fetch('/api/stores?action=list')
      .then(res => res.json())
      .then(data => {
        const storesData = data.stores || [];
        const enrichedStores = storesData
          .map((store: Store) => ({
            ...store,
            lat: STORE_COORDINATES[store.code]?.lat || null,
            lon: STORE_COORDINATES[store.code]?.lon || null,
          }))
          .sort((a: Store, b: Store) => parseInt(a.code) - parseInt(b.code));

        setStores(enrichedStores);
        console.log(`🏪 ${enrichedStores.length} magasins chargés (${enrichedStores.filter((s: Store) => s.lat && s.lon).length} géolocalisés)`);
      })
      .catch(err => console.error('Erreur chargement magasins:', err));
  }, []);

  // ── Charger les zones brutes UNIQUEMENT quand le magasin change ──
  useEffect(() => {
    if (!selectedStore) return;

    setLoading(true);
    setGeoData([]);
    setZones([]);
    setRawZones([]);

    fetch(`/api/stores?action=catchment&storeCode=${encodeURIComponent(selectedStore)}`)
      .then(res => res.json())
      .then(data => {
        const fetched: Zone[] = data.data || [];
        console.log(`✅ ${fetched.length} zones brutes reçues pour magasin ${selectedStore}`);

        // Enrichir TOUTES les zones avec population locale immédiatement
        const enriched = fetched.map(zone => {
          const cleanCP = String(zone.cp).trim().padStart(5, '0');
          const pop = populationMap.current.get(cleanCP) || 0;
          return {
            ...zone,
            population: pop > 0 ? pop : undefined,
            caPerCapita: pop > 0 ? zone.totalCA / pop : undefined,
            clientsPerCapita: pop > 0 ? zone.nbClients / pop : undefined,
            txPerCapita: pop > 0 ? zone.nbTransactions / pop : undefined,
          };
        });

        const withPop = enriched.filter(z => z.population).length;
        console.log(`👥 ${withPop}/${enriched.length} zones avec population`);

        setRawZones(enriched);
      })
      .catch(err => {
        console.error('❌ Erreur chargement zones:', err);
        setLoading(false);
      });
  }, [selectedStore]);

  // ── Charger stats magasin ──
  useEffect(() => {
    if (!selectedStore) return;
    fetch(`/api/stores?action=performance&storeCode=${encodeURIComponent(selectedStore)}`)
      .then(res => res.json())
      .then(data => { if (data.magasin) setStoreStats(data.magasin); })
      .catch(err => console.error('Erreur stats magasin:', err));
  }, [selectedStore]);

  // ── Fonction de valeur selon critère actif ──
  const getValue = useCallback((z: Zone): number => {
    if (perCapitaMode) {
      if (sortCriterion === 'ca') return z.caPerCapita || 0;
      if (sortCriterion === 'clients') return z.clientsPerCapita || 0;
      return z.txPerCapita || 0;
    }
    if (sortCriterion === 'ca') return z.totalCA;
    if (sortCriterion === 'clients') return z.nbClients;
    return z.nbTransactions;
  }, [perCapitaMode, sortCriterion]);

  // ── Recalculer le TOP N quand critères/mode/données changent ──
  // C'est ici que le vrai recalcul se fait : le top N est différent selon le mode
  useEffect(() => {
    if (rawZones.length === 0) return;

    setLoading(true);

    // En mode per capita, on filtre les zones sans population
    const eligible = perCapitaMode
      ? rawZones.filter(z => z.population && z.population > 0)
      : rawZones;

    // Trier décroissant selon le critère actif
    const sorted = [...eligible].sort((a, b) => getValue(b) - getValue(a));

    // Prendre le TOP N
    const top = sorted.slice(0, topN);

    console.log(`🎯 Top ${top.length}/${eligible.length} zones (${sortCriterion}${perCapitaMode ? '/hab' : ''})`);
    if (top.length > 0) {
      const best = top[0];
      const worst = top[top.length - 1];
      console.log(`  Meilleur: CP ${best.cp} = ${getValue(best).toFixed(4)} | Dernier: CP ${worst.cp} = ${getValue(worst).toFixed(4)}`);
    }

    // Assigner rang, percentile, décile, couleur
    const ranked = top.map((zone, idx) => {
      const rank = idx + 1;
      const percentile = idx / (top.length - 1 || 1);
      const decile = Math.min(Math.max(Math.floor((1 - percentile) * 10), 0), 9);
      return { ...zone, rank, percentile, decile, color: COLORS[decile] };
    });

    setZones(ranked);
    loadGeometries(ranked);
  }, [rawZones, sortCriterion, perCapitaMode, topN, getValue]);

  // ── Charger géométries avec cache ──
  const loadGeometries = async (zonesToLoad: Zone[]) => {
    if (zonesToLoad.length === 0) {
      setGeoData([]);
      setLoading(false);
      return;
    }

    const features: any[] = [];
    const toFetch: Zone[] = [];

    // Séparer les zones déjà en cache de celles à fetcher
    for (const zone of zonesToLoad) {
      const cleanCP = String(zone.cp).trim().replace(/[^0-9]/g, '');
      if (cleanCP.length === 0 || cleanCP.length > 5) continue;
      const normalizedCP = cleanCP.padStart(5, '0');

      const cached = geoCache.current.get(normalizedCP);
      if (cached) {
        // Réutiliser la géométrie en cache, mettre à jour les propriétés
        for (const geom of cached) {
          features.push({
            type: 'Feature',
            geometry: geom,
            properties: {
              cp: zone.cp, ville: zone.ville,
              nbClients: zone.nbClients, totalCA: zone.totalCA, nbTransactions: zone.nbTransactions,
              population: zone.population, caPerCapita: zone.caPerCapita,
              clientsPerCapita: zone.clientsPerCapita, txPerCapita: zone.txPerCapita,
              rank: zone.rank, percentile: zone.percentile, decile: zone.decile, color: zone.color,
            },
          });
        }
      } else {
        toFetch.push(zone);
      }
    }

    console.log(`🗺️ ${features.length} géométries en cache, ${toFetch.length} à charger`);

    // Batch fetch les manquantes (par lots de 10 en parallèle)
    const BATCH_SIZE = 10;
    for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
      const batch = toFetch.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (zone) => {
          const normalizedCP = String(zone.cp).trim().replace(/[^0-9]/g, '').padStart(5, '0');
          const response = await fetch(
            `https://geo.api.gouv.fr/communes?codePostal=${normalizedCP}&fields=contour&format=geojson&geometry=contour`
          );
          if (!response.ok) return null;
          const geojson = await response.json();
          if (!geojson.features?.length) return null;

          // Stocker en cache (juste les géométries)
          const geometries = geojson.features.map((f: any) => f.geometry);
          geoCache.current.set(normalizedCP, geometries);

          return { zone, geometries };
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          const { zone, geometries } = result.value;
          for (const geom of geometries) {
            features.push({
              type: 'Feature',
              geometry: geom,
              properties: {
                cp: zone.cp, ville: zone.ville,
                nbClients: zone.nbClients, totalCA: zone.totalCA, nbTransactions: zone.nbTransactions,
                population: zone.population, caPerCapita: zone.caPerCapita,
                clientsPerCapita: zone.clientsPerCapita, txPerCapita: zone.txPerCapita,
                rank: zone.rank, percentile: zone.percentile, decile: zone.decile, color: zone.color,
              },
            });
          }
        }
      }
    }

    console.log(`✅ ${features.length} géométries totales`);
    setGeoData(features);
    setLoading(false);
  };

  // ── Popup enrichi ──
  const onEachFeature = (feature: any, layer: any) => {
    const props = feature.properties;

    layer.on({
      mouseover: (e: any) => e.target.setStyle({ weight: 3, fillOpacity: 0.7 }),
      mouseout: (e: any) => e.target.setStyle({ weight: 2, fillOpacity: 0.5 }),
    });

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

  const toggleDecile = (decile: number) => {
    const newVisible = new Set(visibleDeciles);
    if (newVisible.has(decile)) newVisible.delete(decile);
    else newVisible.add(decile);
    setVisibleDeciles(newVisible);
  };

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

  const getPerCapitaLabel = () => {
    if (!perCapitaMode) return 'Activer ratios /hab';
    if (sortCriterion === 'ca') return 'CA / habitant';
    if (sortCriterion === 'clients') return 'Clients / habitant';
    return 'Transactions / habitant';
  };

  // Nombre total de zones disponibles (pour info)
  const totalZonesAvailable = perCapitaMode
    ? rawZones.filter(z => z.population && z.population > 0).length
    : rawZones.length;

  return (
    <>
      <div className="h-full w-full">
        <MapContainer center={center} zoom={6} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {geoData
            .filter(feature => visibleDeciles.has(feature.properties.decile))
            .map((feature, idx) => (
              <GeoJSON
                key={`zone-${feature.properties.cp}-${feature.properties.decile}-${idx}`}
                data={feature}
                style={{
                  fillColor: feature.properties.color,
                  fillOpacity: 0.5,
                  color: feature.properties.color,
                  weight: 2,
                  opacity: 0.8,
                }}
                onEachFeature={onEachFeature}
              />
            ))}

          {stores
            .filter(store => store.lat && store.lon)
            .map(store => (
              <Marker
                key={store.code}
                position={[store.lat!, store.lon!]}
                icon={storeIcon}
                eventHandlers={{
                  click: () => setSelectedStore(store.code),
                  dblclick: () => setSelectedStore(store.code),
                }}
              >
                <Popup>
                  <div style={{ minWidth: '200px' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold', color: '#dc2626', cursor: 'pointer' }}
                      onClick={() => setSelectedStore(store.code)}>
                      {store.code} - {store.nom}
                    </h3>
                    <p style={{ margin: '4px 0', fontSize: '12px', color: '#6b7280' }}>
                      📍 {store.ville || 'N/A'}
                    </p>
                    <div style={{ marginTop: '8px', padding: '6px 8px', backgroundColor: '#fef2f2', borderRadius: '6px', fontSize: '11px', color: '#991b1b', textAlign: 'center', fontStyle: 'italic' }}>
                      Cliquez pour charger les zones
                    </div>
                    {store.code === selectedStore && storeStats && (
                      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '8px', marginTop: '8px' }}>
                        <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>👥 Clients:</strong> {storeStats.nbClients.toLocaleString()}</p>
                        <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>💰 CA:</strong> {storeStats.totalCA.toFixed(0).toLocaleString()}€</p>
                        <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>🛒 Transactions:</strong> {storeStats.nbTransactions.toLocaleString()}</p>
                        <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>🧺 Panier moyen:</strong> {storeStats.panierMoyen.toFixed(2)}€</p>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </div>

      {/* Panneau de contrôle */}
      <div style={{
        position: 'fixed', top: '100px', right: '20px', zIndex: 9999,
        minWidth: panelOpen ? '340px' : 'auto',
        backgroundColor: 'rgba(17, 24, 39, 0.95)', backdropFilter: 'blur(20px)',
        borderRadius: '16px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        border: '1px solid rgba(75, 85, 99, 0.3)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: panelOpen ? '14px 16px' : '10px 14px',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.15) 100%)',
          cursor: 'pointer',
        }} onClick={() => setPanelOpen(!panelOpen)}>
          <h3 style={{ fontWeight: '600', color: '#93c5fd', fontSize: panelOpen ? '15px' : '13px', margin: 0 }}>
            {panelOpen ? '📍 Zones de Chalandise' : '📍'}
          </h3>
          <button style={{ color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}>
            {panelOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>

        {panelOpen && (
          <div style={{ padding: '16px' }}>
            {/* Sélection magasin — triée par numéro */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#d1d5db', marginBottom: '8px' }}>
                Magasin:
              </label>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', fontSize: '14px',
                  border: '1.5px solid rgba(75, 85, 99, 0.6)', borderRadius: '10px',
                  backgroundColor: 'rgba(31, 41, 55, 0.9)', color: '#f3f4f6',
                  fontWeight: '500', cursor: 'pointer', outline: 'none',
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
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#d1d5db', marginBottom: '8px' }}>
                Critère de classement:
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['ca', 'clients', 'transactions'] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => setSortCriterion(c)}
                    style={{
                      flex: 1, padding: '8px 10px', fontSize: '12px', fontWeight: '600', borderRadius: '8px',
                      border: sortCriterion === c ? '2px solid #3b82f6' : '1px solid rgba(75, 85, 99, 0.6)',
                      backgroundColor: sortCriterion === c ? 'rgba(59, 130, 246, 0.2)' : 'rgba(31, 41, 55, 0.9)',
                      color: sortCriterion === c ? '#60a5fa' : '#9ca3af', cursor: 'pointer',
                    }}
                  >
                    {c === 'ca' ? '💰 CA' : c === 'clients' ? '👥 Clients' : '🛒 Tx'}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode per capita */}
            <div style={{ marginBottom: '14px' }}>
              <button
                onClick={() => setPerCapitaMode(!perCapitaMode)}
                disabled={loading || !selectedStore}
                style={{
                  width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: '600', borderRadius: '10px',
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

            {/* Slider Top N */}
            {rawZones.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#d1d5db', marginBottom: '8px' }}>
                  Nombre de zones: <span style={{ color: '#60a5fa' }}>{topN}</span>
                  <span style={{ color: '#6b7280', fontWeight: '400' }}> / {totalZonesAvailable}</span>
                </label>
                <input
                  type="range"
                  min={10}
                  max={Math.max(totalZonesAvailable, 10)}
                  value={topN}
                  onChange={(e) => setTopN(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: '#3b82f6' }}
                />
              </div>
            )}

            {/* Légende interactive */}
            {zones.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#d1d5db', marginBottom: '8px' }}>
                  Légende (cliquer pour filtrer):
                </label>
                <div style={{
                  maxHeight: '200px', overflowY: 'auto',
                  backgroundColor: 'rgba(31, 41, 55, 0.6)', borderRadius: '10px', padding: '8px',
                }}>
                  {[9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(decile => {
                    const count = zones.filter(z => z.decile === decile).length;
                    if (count === 0) return null;

                    return (
                      <div key={decile} onClick={() => toggleDecile(decile)} style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px',
                        borderRadius: '6px', cursor: 'pointer',
                        backgroundColor: visibleDeciles.has(decile) ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                        marginBottom: '4px',
                      }}>
                        <input type="checkbox" checked={visibleDeciles.has(decile)}
                          onChange={() => toggleDecile(decile)}
                          style={{ width: '14px', height: '14px', cursor: 'pointer' }} />
                        <div style={{
                          width: '24px', height: '16px', borderRadius: '4px',
                          backgroundColor: COLORS[decile], border: '1px solid rgba(255,255,255,0.2)',
                        }} />
                        <span style={{ fontSize: '12px', color: '#e5e7eb', flex: 1 }}>
                          {decile === 9 ? 'Top 10%' : decile === 8 ? 'Top 20%' : decile === 7 ? 'Top 30%' :
                           decile === 6 ? 'Top 40%' : decile === 5 ? 'Médian' : decile === 4 ? 'Bas 50%' :
                           decile === 3 ? 'Bas 40%' : decile === 2 ? 'Bas 30%' : decile === 1 ? 'Bas 20%' : 'Bas 10%'}
                        </span>
                        <span style={{ fontSize: '11px', color: '#9ca3af' }}>({count})</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Export */}
            {zones.length > 0 && (
              <button onClick={exportToExcel} style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '10px 12px', backgroundColor: 'rgba(34, 197, 94, 0.9)', color: '#ffffff',
                border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '13px',
                fontWeight: '600', marginBottom: '14px',
              }}>
                <Download size={16} />
                Exporter Excel
              </button>
            )}

            {/* Stats */}
            {zones.length > 0 && (
              <div style={{
                fontSize: '12px', color: '#9ca3af',
                backgroundColor: 'rgba(31, 41, 55, 0.6)', padding: '10px',
                borderRadius: '8px', borderTop: '1px solid rgba(75, 85, 99, 0.4)',
              }}>
                <div>Top {zones.length} / {totalZonesAvailable} zones{perCapitaMode ? ' (avec population)' : ''}</div>
                <div>{geoData.filter(f => visibleDeciles.has(f.properties.decile)).length} géométries visibles</div>
                <div>{geoCache.current.size} CP en cache</div>
                {loading && <div style={{ color: '#60a5fa', marginTop: '4px' }}>Chargement...</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
