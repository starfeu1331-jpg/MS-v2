// Coordonnées GPS réelles des magasins
export const storesCoordinates: Record<string, [number, number]> = {
  '0': [46.5, 2.5],         // Dépôt/Autre
  '12': [44.1340, 4.0944],  // ALES
  '13': [43.3529, 3.2152],  // BEZIERS
  '14': [43.6766, 4.6279],  // ARLES
  '16': [43.5768, 3.9183],  // SAINT JEAN DE VEDAS (Montpellier)
  '17': [44.9237, 4.8497],  // SAINT PERAY
  '19': [45.0453, 5.0512],  // ROMANS
  '22': [45.7003, 5.0503],  // SAINT BONNET DE MURE (Lyon)
  '23': [46.2547, 5.2268],  // VIRIAT (Bourg-en-Bresse)
  '24': [45.9292, 6.0742],  // SILLINGY (Annecy)
  '25': [43.2167, 2.3522],  // CARCASSONNE
  '26': [45.2307, 5.6833],  // SAINT EGREVE (Grenoble)
  '27': [45.9917, 4.7242],  // VILLEFRANCHE
  '28': [45.1833, 5.7644],  // SAINT MARTIN D'HERES (Grenoble)
  '29': [43.6897, 1.3878],  // FENOUILLET (Toulouse)
  '31': [44.5586, 4.7517],  // MONTELIMAR
  '32': [45.7719, 3.1689],  // LEMPDES (Clermont-Ferrand)
  '33': [43.1281, 0.9478],  // ESTANCARBON
  '34': [44.6203, 4.3869],  // AUBENAS
  '35': [43.8472, 4.3528],  // NIMES
  '36': [45.6308, 5.8664],  // VOGLANS (Chambery)
  '37': [43.9100, 4.8756],  // SORGUES (Avignon)
  '38': [44.3714, 2.5719],  // ONET-LE-CHÂTEAU (Rodez)
  '39': [43.1828, 3.0278],  // NARBONNE
  '41': [45.0453, 5.0512],  // ROMANS (dépôt)
};

export function getStoreCoords(storeCode: string): [number, number] {
  return storesCoordinates[storeCode] || [46.5, 2.5]; // Centre France par défaut
}
