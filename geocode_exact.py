#!/usr/bin/env python3
import requests
import time

stores = {
    '12': '10 Lotissement de Larnac Rocade Est 30100 ALES',
    '13': '1 Rue Zenobie Gramme Zone de la Giniesse 34500 BEZIERS',
    '14': 'Quartier du Fourchon ZAC Aurelienne 13200 ARLES',
    '16': 'ZAC Deves de la Condamine 34430 SAINT JEAN DE VEDAS',
    '17': '7 rue du Levant Zone Pole 2000 07130 SAINT PERAY',
    '19': '7 avenue des Allobroges 26100 ROMANS',
    '22': '231 Avenue Charles de Gaulle 69720 SAINT BONNET DE MURE',
    '23': '905 Rue des Vareys 01440 VIRIAT',
    '24': '39 Route des Pres Rollier 74330 SILLINGY',
    '25': '415 av Paul Henri Mouton 11000 CARCASSONNE',
    '26': '2 Rue des Glairaux 38120 SAINT EGREVE',
    '27': '1605 Route de Frans 69400 VILLEFRANCHE',
    '28': '25 Rue du Champ Roman 38400 SAINT MARTIN HERES',
    '29': '54 Route de Paris 31150 FENOUILLET',
    '31': '22 Avenue du Meyrol 26200 MONTELIMAR',
    '32': 'Rue Pontel 63370 LEMPDES',
    '33': 'Avenue du Pic du Gar 31800 ESTANCARBON',
    '34': '2 Avenue de Bellande 07200 AUBENAS',
    '35': 'Rue des Lauriers 30900 NIMES',
    '36': '524 rue de la Francon 73420 VOGLANS',
    '37': '49 Avenue Francois Mauriac 84700 SORGUES',
    '38': 'Avenue Joel Pilon 12850 ONET LE CHATEAU',
    '39': 'Rue Blaise Pascal ZAC de la Coupe 11100 NARBONNE'
}

coords = {}

print("Geocodage en cours...")

for code, addr in stores.items():
    try:
        r = requests.get("https://nominatim.openstreetmap.org/search", 
                        params={'q': addr, 'format': 'json', 'limit': 1, 'countrycodes': 'fr'},
                        headers={'User-Agent': 'DecorAnalytics/1.0'})
        data = r.json()
        if data:
            coords[code] = {'lat': float(data[0]['lat']), 'lon': float(data[0]['lon'])}
            print(f"M{code}: OK")
        else:
            print(f"M{code}: NOT FOUND")
        time.sleep(1.1)
    except Exception as e:
        print(f"M{code}: ERROR - {e}")

print("\n--- TypeScript Code ---\n")
print("const storeCoordinates: Record<string, { lat: number; lon: number }> = {")
for c in sorted(coords.keys()):
    print(f"  '{c}': {{ lat: {coords[c]['lat']:.6f}, lon: {coords[c]['lon']:.6f} }},")
print("};")
print(f"\nTotal: {len(coords)}/{len(stores)}")
