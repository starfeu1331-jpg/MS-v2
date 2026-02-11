import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import { ChevronDown, ChevronUp, Download } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import * as XLSX from 'xlsx';

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
  population?: number;
  caPerCapita?: number;
  clientsPerCapita?: number;
  txPerCapita?: number;
  rank?: number;
}

interface StoreWithZones extends Store {
  zones: Zone[];
}

export default function ZoneChalandiseV3() {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [allZones, setAllZones] = useState<Zone[]>([]); // Toutes les zones brutes
  const [zones, setZones] = useState<Zone[]>([]); // Zones filtrées selon critère
  const [geoData, setGeoData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [sortCriterion, setSortCriterion] = useState<'ca' | 'clients' | 'transactions'>('ca');
  const [perCapitaMode, setPerCapitaMode] = useState(false);
  const [loadingPopulation, setLoadingPopulation] = useState(false);
  const [maxZonesToDisplay] = useState(50); // Nombre max de zones à afficher
  const [visibleDeciles, setVisibleDeciles] = useState<Set<number>>(new Set([0,1,2,3,4,5,6,7,8,9]));
  const [storeStats, setStoreStats] = useState<any>(null);

  // Fonction pour filtrer et afficher les zones selon le critère actif
  const rankAndFilterZones = (zonesToRank: Zone[]) => {
    const criterionLabel = perCapitaMode ? 
      (sortCriterion === 'ca' ? 'CA/Habitant' : 
       sortCriterion === 'clients' ? 'Clients/Habitant' : 
       'Transactions/Habitant') : 
      (sortCriterion === 'ca' ? 'CA' : 
       sortCriterion === 'clients' ? 'Clients' : 
       'Transactions');
    
    console.log(`🎯 Classement des zones selon critère: ${criterionLabel}`);
    
    // Trier selon le critère actif (décroissant pour afficher les meilleures d'abord)
    const sorted = [...zonesToRank].sort((a, b) => {
      if (perCapitaMode) {
        if (sortCriterion === 'ca') return (b.caPerCapita || 0) - (a.caPerCapita || 0);
        if (sortCriterion === 'clients') return (b.clientsPerCapita || 0) - (a.clientsPerCapita || 0);
        return (b.txPerCapita || 0) - (a.txPerCapita || 0);
      }
      if (sortCriterion === 'ca') return b.totalCA - a.totalCA;
      if (sortCriterion === 'clients') return b.nbClients - a.nbClients;
      return b.nbTransactions - a.nbTransactions;
    });
    
    // Ajouter le classement à TOUTES les zones
    const rankedZones = sorted.map((zone, idx) => ({
      ...zone,
      rank: idx + 1
    }));
    
    console.log(`📊 ${rankedZones.length} zones classées:`);
    rankedZones.slice(0, 5).forEach((z) => {
      const value = perCapitaMode && sortCriterion === 'ca' ? `${z.caPerCapita?.toFixed(2)}€/hab` :
                    perCapitaMode && sortCriterion === 'clients' ? `${z.clientsPerCapita?.toFixed(3)} clients/hab` :
                    perCapitaMode && sortCriterion === 'transactions' ? `${z.txPerCapita?.toFixed(3)} tx/hab` :
                    sortCriterion === 'ca' ? `${z.totalCA.toFixed(0)}€` :
                    sortCriterion === 'clients' ? `${z.nbClients} clients` :
                    `${z.nbTransactions} tx`;
      console.log(`  ${z.rank}. ${z.cp} (${z.ville}): ${value}`);
    });
    
    // Stocker TOUTES les zones classées (pas seulement le top)
    setZones(rankedZones);
  };

  // Fonction pour récupérer la population d'un code postal
  const fetchPopulation = async (cp: string): Promise<number | null> => {
    try {
      const cleanCP = String(cp).trim().padStart(5, '0');
      const response = await fetch(
        `https://geo.api.gouv.fr/communes?codePostal=${cleanCP}&fields=nom,population`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        // Si plusieurs communes ont ce CP, prendre la somme des populations
        const totalPop = data.reduce((sum: number, commune: any) => sum + (commune.population || 0), 0);
        return totalPop;
      }
      return null;
    } catch (error) {
      console.warn(`⚠️ Erreur récupération population pour CP ${cp}:`, error);
      return null;
    }
  };

  // Fonction pour enrichir les zones avec les populations
  const enrichZonesWithPopulation = async (zonesToEnrich: Zone[]) => {
    setLoadingPopulation(true);
    console.log('👥 Récupération des populations pour', zonesToEnrich.length, 'zones...');
    
    const enrichedZones = await Promise.all(
      zonesToEnrich.map(async (zone) => {
        if (zone.population !== undefined) {
          return zone; // Déjà enrichie
        }
        
        const population = await fetchPopulation(zone.cp);
        const caPerCapita = population && population > 0 ? zone.totalCA / population : 0;
        const clientsPerCapita = population && population > 0 ? zone.nbClients / population : 0;
        const txPerCapita = population && population > 0 ? zone.nbTransactions / population : 0;
        
        return {
          ...zone,
          population: population || 0,
          caPerCapita: caPerCapita,
          clientsPerCapita: clientsPerCapita,
          txPerCapita: txPerCapita
        };
      })
    );
    
    console.log('✅ Populations récupérées, exemples:');
    enrichedZones.slice(0, 5).forEach(z => {
      console.log(`  📍 ${z.cp} (${z.ville}): ${z.population?.toLocaleString()} hab, CA/hab: ${z.caPerCapita?.toFixed(2)}€`);
    });
    
    setAllZones(enrichedZones);
    setLoadingPopulation(false);
    
    // Classer les zones et charger les géométries
    rankAndFilterZones(enrichedZones);
    loadGeometries(enrichedZones);
  };

  // Fonction d'export Excel
  const exportToExcel = () => {
    if (zones.length === 0) {
      alert('Aucune donnée à exporter');
      return;
    }

    const storeName = stores.find(s => s.code === selectedStore)?.nom || 'Magasin';
    
    // Préparer les données avec formatage
    const excelData = zones.map((zone) => ({
      'Rang': zone.rank || '',
      'Code Postal': zone.cp,
      'Ville': zone.ville,
      'Nb Clients': zone.nbClients,
      'CA Total (€)': Math.round(zone.totalCA),
      'CA Moyen (€)': Math.round(zone.totalCA / zone.nbClients),
      'Nb Transactions': zone.nbTransactions,
      'Tx/Client': (zone.nbTransactions / zone.nbClients).toFixed(1),
      'Population': zone.population || 'N/A',
      'CA/Habitant (€)': zone.caPerCapita ? zone.caPerCapita.toFixed(2) : 'N/A',
      'Clients/Habitant': zone.clientsPerCapita ? zone.clientsPerCapita.toFixed(4) : 'N/A',
      'Tx/Habitant': zone.txPerCapita ? zone.txPerCapita.toFixed(4) : 'N/A'
    }));

    // Créer le workbook et la feuille
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Largeurs de colonnes
    ws['!cols'] = [
      { wch: 6 },   // Rang
      { wch: 12 },  // CP
      { wch: 25 },  // Ville
      { wch: 12 },  // Nb Clients
      { wch: 15 },  // CA Total
      { wch: 15 },  // CA Moyen
      { wch: 16 },  // Nb Transactions
      { wch: 10 },  // Tx/Client
      { wch: 14 },  // Population
      { wch: 16 },  // CA/Habitant
      { wch: 18 },  // Clients/Habitant
      { wch: 14 }   // Tx/Habitant
    ];

    // Ajouter des styles aux en-têtes (A1 à H1)
    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '1e3a8a' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };

    // Appliquer le style aux cellules d'en-tête
    ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1', 'J1', 'K1', 'L1'].forEach(cell => {
      if (ws[cell]) {
        ws[cell].s = headerStyle;
      }
    });

    // Ligne de titre au-dessus
    XLSX.utils.sheet_add_aoa(ws, [[`Zones de Chalandise - ${storeName}`]], { origin: 'A1' });
    XLSX.utils.sheet_add_aoa(ws, [['Date d\'export:', new Date().toLocaleDateString('fr-FR')]], { origin: 'A2' });
    XLSX.utils.sheet_add_aoa(ws, [['']], { origin: 'A3' });
    
    // Réinsérer les données après les 3 lignes de titre
    XLSX.utils.sheet_add_json(ws, excelData, { origin: 'A4', skipHeader: false });

    // Fusionner la cellule du titre
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } } // Fusionner A1:L1
    ];

    // Ajouter la feuille au workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Zones de Chalandise');

    // Télécharger le fichier
    const fileName = `ZonesChalandise_${storeName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Coordonnées EXACTES des 23 magasins (géocodées depuis vos adresses précises)
  const storeCoordinates: Record<string, { lat: number; lon: number }> = {
    '12': { lat: 44.100572, lon: 4.106784 }, // ALES - Lotissement Plaine de Larnac
    '13': { lat: 43.358272, lon: 3.254277 }, // BEZIERS - La Giniesse
    '14': { lat: 43.664382, lon: 4.640042 }, // ARLES - Zone commerciale L'Aurélienne
    '16': { lat: 43.572258, lon: 3.847119 }, // SAINT JEAN DE VEDAS - ZAC Deves de la Condamine
    '17': { lat: 44.940179, lon: 4.863465 }, // SAINT PERAY - Zone Pôle 2000
    '19': { lat: 45.051845, lon: 5.081296 }, // ROMANS - Avenue des Allobroges
    '22': { lat: 45.702634, lon: 5.000077 }, // ST BONNET DE MURE - Avenue Charles de Gaulle
    '23': { lat: 46.222808, lon: 5.203020 }, // VIRIAT - Parc de la Chambière
    '24': { lat: 45.943104, lon: 6.074168 }, // SILLINGY - Route des Pres Rollier
    '25': { lat: 43.211340, lon: 2.299221 }, // CARCASSONNE - ZA La Ferraudière
    '26': { lat: 45.218836, lon: 5.678330 }, // SAINT EGREVE - Rue des Glairaux
    '27': { lat: 45.984220, lon: 4.742440 }, // VILLEFRANCHE - Route de Frans
    '28': { lat: 45.184090, lon: 5.774699 }, // ST MARTIN D'HERES - Rue du Champ Roman
    '29': { lat: 43.677654, lon: 1.408238 }, // FENOUILLET - Route de Paris
    '31': { lat: 44.575253, lon: 4.747757 }, // MONTELIMAR - Zone industrielle le Meyrol
    '32': { lat: 45.777465, lon: 3.196072 }, // LEMPDES - Rue Pontel
    '33': { lat: 43.115655, lon: 0.763458 }, // ESTANCARBON - ZAC des Landes
    '34': { lat: 44.615308, lon: 4.401042 }, // AUBENAS - Avenue de Bellande
    '35': { lat: 43.816678, lon: 4.350875 }, // NIMES - Rue des Lauriers Ville Active
    '36': { lat: 45.616262, lon: 5.886227 }, // VOGLANS - Rue de la Françon
    '37': { lat: 43.984397, lon: 4.886017 }, // SORGUES - Zone commerciale Avignon Nord
    '38': { lat: 44.393611, lon: 2.601307 }, // ONET LE CHATEAU - ZAC de L'Etreniol
    '39': { lat: 43.157188, lon: 2.981007 }  // NARBONNE - Rue Blaise Pascal
  };

  // Charger la liste des magasins
  useEffect(() => {
    fetch('/api/stores?action=list')
      .then(res => res.json())
      .then(data => {
        // Enrichir les magasins avec les coordonnées hardcodées
        const enrichedStores = (data.stores || []).map((store: Store) => {
          const coords = storeCoordinates[store.code];
          return {
            ...store,
            lat: coords?.lat ?? store.lat,
            lon: coords?.lon ?? store.lon
          };
        });
        
        console.log('🏪 Magasins chargés:', enrichedStores);
        console.log('📍 Magasins avec coordonnées:', enrichedStores.filter((s: Store) => s.lat && s.lon).length);
        enrichedStores.forEach((s: Store) => {
          if (s.lat && s.lon) {
            console.log(`  ✅ ${s.nom}: lat=${s.lat}, lon=${s.lon}`);
          } else {
            console.log(`  ❌ ${s.nom}: PAS de coordonnées (lat=${s.lat}, lon=${s.lon})`);
          }
        });
        
        setStores(enrichedStores);
        
        // Sélectionner le premier VRAI magasin (pas Inconnu ni Ventes Web)
        const firstRealStore = enrichedStores.find((s: Store) => 
          s.code !== '0' && !s.nom.toLowerCase().includes('web') && !s.nom.toLowerCase().includes('inconnu')
        );
        
        if (firstRealStore) {
          setSelectedStore(firstRealStore.code);
        } else if (enrichedStores.length > 0) {
          setSelectedStore(enrichedStores[0].code);
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

        setAllZones(storeZones);
        
        // Si le mode per capita est activé, enrichir avec les populations
        if (perCapitaMode) {
          enrichZonesWithPopulation(storeZones);
        } else {
          // Classer les zones et charger toutes les géométries
          rankAndFilterZones(storeZones);
          loadGeometries(storeZones);
        }
      })
      .catch(err => {
        console.error('❌ Erreur chargement zones:', err);
        setLoading(false);
      });
  }, [selectedStore]);

  // Charger les stats globales du magasin
  useEffect(() => {
    if (!selectedStore) return;
    
    fetch(`/api/stores?action=performance&storeCode=${selectedStore}`)
      .then(res => res.json())
      .then(data => {
        if (data.magasin) {
          setStoreStats(data.magasin);
          console.log('📊 Stats magasin:', data.magasin);
        }
      })
      .catch(err => console.error('Erreur chargement stats magasin:', err));
  }, [selectedStore]);

  // Recharger et refiltrer quand le critère change
  useEffect(() => {
    if (allZones.length > 0) {
      console.log('🔄 Critère changé, reclassement des zones...');
      rankAndFilterZones(allZones);
    }
  }, [sortCriterion]);

  // Gérer le changement de mode per capita
  useEffect(() => {
    if (allZones.length > 0 && perCapitaMode && !allZones[0].population) {
      enrichZonesWithPopulation(allZones);
    } else if (allZones.length > 0) {
      rankAndFilterZones(allZones);
    }
  }, [perCapitaMode]);

  const loadGeometries = async (zonesToLoad: Zone[]) => {
    console.log(`🗺️ Chargement géométries pour ${zonesToLoad.length} zones...`);
    
    // Si pas de zones, arrêter ici
    if (zonesToLoad.length === 0) {
      console.log('ℹ️ Aucune zone à charger (magasin sans données ou < 10 clients par CP)');
      setGeoData([]);
      setLoading(false);
      return;
    }
    
    const geoFeatures: any[] = [];
    
    // Trier les zones selon le critère choisi pour calculer les déciles (10 tranches de 10%)
    const sortedZones = [...zonesToLoad].sort((a, b) => {
      if (perCapitaMode && sortCriterion === 'ca') {
        return (a.caPerCapita || 0) - (b.caPerCapita || 0);
      }
      if (sortCriterion === 'ca') return a.totalCA - b.totalCA;
      if (sortCriterion === 'clients') return a.nbClients - b.nbClients;
      return a.nbTransactions - b.nbTransactions;
    });
    
    const minValue = perCapitaMode && sortCriterion === 'ca' ? (sortedZones[0].caPerCapita || 0) :
                     sortCriterion === 'ca' ? sortedZones[0].totalCA : 
                     sortCriterion === 'clients' ? sortedZones[0].nbClients : 
                     sortedZones[0].nbTransactions;
    const maxValue = perCapitaMode && sortCriterion === 'ca' ? (sortedZones[sortedZones.length - 1].caPerCapita || 0) :
                     sortCriterion === 'ca' ? sortedZones[sortedZones.length - 1].totalCA : 
                     sortCriterion === 'clients' ? sortedZones[sortedZones.length - 1].nbClients : 
                     sortedZones[sortedZones.length - 1].nbTransactions;
    
    console.log(`📊 ${sortCriterion === 'ca' ? 'CA' : sortCriterion === 'clients' ? 'Clients' : 'Transactions'} min: ${minValue.toFixed(0)} → max: ${maxValue.toFixed(0)}`);

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
              population: zone.population,
              caPerCapita: zone.caPerCapita,
              clientsPerCapita: zone.clientsPerCapita,
              txPerCapita: zone.txPerCapita,
              rank: zone.rank,
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
    const rank = props.rank ? `#${props.rank}` : '';
    layer.bindPopup(`
      <div style="min-width: 220px; padding: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
          <h3 style="font-weight: bold; font-size: 16px; margin: 0;">${props.cp} - ${props.ville}</h3>
          ${rank ? `<span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">${rank}</span>` : ''}
        </div>
        <div style="border-top: 1px solid #e5e7eb; padding-top: 8px;">
          <p style="margin: 4px 0;"><strong>👥 Clients:</strong> ${props.nbClients.toLocaleString()}</p>
          <p style="margin: 4px 0;"><strong>💰 CA:</strong> ${props.totalCA.toFixed(0)}€</p>
          <p style="margin: 4px 0;"><strong>🛒 Transactions:</strong> ${props.nbTransactions.toLocaleString()}</p>
          ${props.population ? `<p style="margin: 4px 0;"><strong>🏘️ Population:</strong> ${props.population.toLocaleString()} hab</p>` : ''}
        </div>
        ${props.caPerCapita || props.clientsPerCapita || props.txPerCapita ? `
          <div style="border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 8px;">
            <p style="font-weight: bold; margin: 4px 0; font-size: 13px;">📊 Ratios par habitant:</p>
            ${props.caPerCapita ? `<p style="margin: 4px 0; font-size: 12px;">• CA/hab: ${props.caPerCapita.toFixed(2)}€</p>` : ''}
            ${props.clientsPerCapita ? `<p style="margin: 4px 0; font-size: 12px;">• Clients/hab: ${(props.clientsPerCapita * 100).toFixed(2)}%</p>` : ''}
            ${props.txPerCapita ? `<p style="margin: 4px 0; font-size: 12px;">• Tx/hab: ${(props.txPerCapita * 100).toFixed(2)}%</p>` : ''}
          </div>
        ` : ''}
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
                  eventHandlers={{
                    dblclick: () => {
                      console.log(`🎯 Double-clic sur magasin ${store.nom} (${store.code})`);
                      setSelectedStore(store.code);
                    }
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: '240px', padding: '8px' }}>
                      <strong 
                        style={{ 
                          fontSize: '16px', 
                          color: '#dc2626',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          display: 'block',
                          marginBottom: '4px'
                        }}
                        onClick={() => {
                          console.log(`🎯 Clic sur nom du magasin ${store.nom} (${store.code})`);
                          setSelectedStore(store.code);
                        }}
                      >
                        🏪 {store.nom}
                      </strong>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                        📍 {store.ville}
                      </div>
                      {store.code === selectedStore && storeStats ? (
                        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '8px', fontSize: '12px' }}>
                          <p style={{ margin: '4px 0' }}><strong>👥 Clients:</strong> {storeStats.nb_clients?.toLocaleString() || 'N/A'}</p>
                          <p style={{ margin: '4px 0' }}><strong>💰 CA:</strong> {storeStats.ca_total ? `${Math.round(storeStats.ca_total).toLocaleString()}€` : 'N/A'}</p>
                          <p style={{ margin: '4px 0' }}><strong>🛒 Transactions:</strong> {storeStats.nb_transactions?.toLocaleString() || 'N/A'}</p>
                          <p style={{ margin: '4px 0' }}><strong>📊 Panier moyen:</strong> {storeStats.panier_moyen ? `${Math.round(storeStats.panier_moyen)}€` : 'N/A'}</p>
                        </div>
                      ) : (
                        <div style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>
                          Cliquez pour voir les stats
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            });
          })()}
        </MapContainer>
      </div>

      {/* Panneau de contrôle - Responsive positioning */}
      <div 
        className="zone-control-panel"
        style={{ 
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          maxWidth: panelOpen ? '360px' : 'auto',
          width: panelOpen ? 'calc(100vw - 40px)' : 'auto',
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(75, 85, 99, 0.3)',
          overflow: panelOpen ? 'auto' : 'hidden',
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
            {/* Critère de tri */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '13px', 
                fontWeight: '600', 
                color: '#d1d5db', 
                marginBottom: '8px' 
              }}>
                Critère de coloration:
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
                    transition: 'all 0.2s ease'
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
                    transition: 'all 0.2s ease'
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
                    transition: 'all 0.2s ease'
                  }}
                >
                  🛒 Tx
                </button>
              </div>
            </div>

            {/* Toggle CA par habitant */}
            <div style={{ marginBottom: '14px' }}>
              <button
                onClick={() => setPerCapitaMode(!perCapitaMode)}
                disabled={loadingPopulation}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: '10px',
                  border: perCapitaMode ? '2px solid #10b981' : '1px solid rgba(75, 85, 99, 0.6)',
                  backgroundColor: perCapitaMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(31, 41, 55, 0.9)',
                  color: perCapitaMode ? '#34d399' : '#9ca3af',
                  cursor: loadingPopulation ? 'wait' : 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {loadingPopulation ? (
                  <>
                    <div style={{ 
                      width: '14px', 
                      height: '14px', 
                      border: '2px solid #10b981',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite'
                    }}></div>
                    Chargement populations...
                  </>
                ) : (
                  <>
                    👥 {perCapitaMode ? 
                      `${sortCriterion === 'ca' ? 'CA' : sortCriterion === 'clients' ? 'Clients' : 'Transactions'}/Habitant activé` : 
                      'Activer Ratio par Habitant'}
                  </>
                )}
              </button>
              {perCapitaMode && !loadingPopulation && zones.length > 0 && zones[0].population && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#6ee7b7',
                  textAlign: 'center'
                }}>
                  💡 Affichage {sortCriterion === 'ca' ? 'du CA' : sortCriterion === 'clients' ? 'des clients' : 'des transactions'} par habitant
                </div>
              )}
            </div>

            {/* Sélection magasin + Bouton Export */}
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  style={{
                    flex: 1,
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
                <button
                  onClick={exportToExcel}
                  disabled={zones.length === 0}
                  style={{
                    padding: '10px 14px',
                    backgroundColor: zones.length > 0 ? 'rgba(34, 197, 94, 0.9)' : 'rgba(75, 85, 99, 0.5)',
                    color: zones.length > 0 ? '#ffffff' : '#9ca3af',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: zones.length > 0 ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                    boxShadow: zones.length > 0 ? '0 2px 8px rgba(34, 197, 94, 0.3)' : 'none'
                  }}
                  title="Exporter en Excel"
                >
                  <Download size={16} />
                  Excel
                </button>
              </div>
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
                🎨 Légende ({perCapitaMode ? 
                  (sortCriterion === 'ca' ? 'CA/Habitant' : 
                   sortCriterion === 'clients' ? 'Clients/Habitant' : 
                   'Transactions/Habitant') : 
                  (sortCriterion === 'ca' ? 'CA' : 
                   sortCriterion === 'clients' ? 'Clients' : 
                   'Transactions')} par décile)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {[
                  { color: '#1e3a8a', label: '0-10%', decile: 0 },
                  { color: '#1e40af', label: '10-20%', decile: 1 },
                  { color: '#2563eb', label: '20-30%', decile: 2 },
                  { color: '#3b82f6', label: '30-40%', decile: 3 },
                  { color: '#60a5fa', label: '40-50%', decile: 4 },
                  { color: '#fbbf24', label: '50-60%', decile: 5 },
                  { color: '#f59e0b', label: '60-70%', decile: 6 },
                  { color: '#ea580c', label: '70-80%', decile: 7 },
                  { color: '#dc2626', label: '80-90%', decile: 8 },
                  { color: '#991b1b', label: '90-100%', decile: 9 }
                ].map(({ color, label, decile }) => {
                  const isVisible = visibleDeciles.has(decile);
                  return (
                    <button 
                      key={label} 
                      onClick={() => {
                        const newVisible = new Set(visibleDeciles);
                        if (isVisible) {
                          newVisible.delete(decile);
                        } else {
                          newVisible.add(decile);
                        }
                        setVisibleDeciles(newVisible);
                      }}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: isVisible ? 1 : 0.4,
                        transition: 'opacity 0.2s',
                        padding: '4px'
                      }}
                    >
                      <div style={{ 
                        width: '16px', 
                        height: '16px', 
                        backgroundColor: color,
                        borderRadius: '4px',
                        border: isVisible ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                        flexShrink: 0
                      }}></div>
                      <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '500' }}>
                        {label}
                      </span>
                    </button>
                  );
                })}
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
                ✓ {zones.length} zone{zones.length > 1 ? 's' : ''} affichée{zones.length > 1 ? 's' : ''}
                {allZones.length > zones.length && (
                  <span style={{ color: '#9ca3af', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                    (sur {allZones.length} total{allZones.length > 1 ? 'es' : ''})
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Animation CSS pour le spinner + Responsive styles */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        @media (min-width: 1024px) {
          .zone-control-panel {
            max-width: 380px !important;
            width: auto !important;
          }
        }
        
        @media (max-width: 768px) {
          .zone-control-panel {
            top: 10px !important;
            right: 10px !important;
            left: 10px !important;
            max-width: none !important;
            width: calc(100vw - 20px) !important;
          }
        }
      `}</style>
    </>
  );
}
