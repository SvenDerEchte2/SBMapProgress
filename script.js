// ---------------------------
// Konfiguration
// ---------------------------
const ADMIN_PASSWORT = "meinpasswort"; // ändere hier
let isAdmin = false;

// Karte starten in Staufen im Breisgau
const map = L.map('map').setView([47.8846, 7.7323], 14);

// OpenStreetMap Layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

// Layer für Polygone & Marker
const builtLayer = new L.FeatureGroup();
map.addLayer(builtLayer);

const markerLayer = new L.FeatureGroup();
map.addLayer(markerLayer);

// Gesamtfläche (Beispiel-Rechteck um Staufen)
const totalArea = turf.polygon([[
    [7.72, 47.88],
    [7.74, 47.88],
    [7.74, 47.89],
    [7.72, 47.89],
    [7.72, 47.88]
]]);

// ---------------------------
// Admin Button
// ---------------------------
document.getElementById("adminButton").addEventListener("click", () => {
    const pw = prompt("Admin Passwort eingeben:");
    if (pw === ADMIN_PASSWORT) {
        isAdmin = true;
        alert("Admin aktiviert! Du kannst jetzt zeichnen.");
        enableDrawTools();
    } else {
        alert("Falsches Passwort");
    }
});

// ---------------------------
// Zeichentools aktivieren
// ---------------------------
function enableDrawTools() {
    const drawControl = new L.Control.Draw({
        edit: { featureGroup: builtLayer },
        draw: {
            polygon: true,
            rectangle: true,
            marker: true,
            circle: false,
            polyline: false
        }
    });
    map.addControl(drawControl);
}

// ---------------------------
// Farbwahl
// ---------------------------
function getColor(status) {
    if (status === "fertig") return "green";
    if (status === "bau") return "orange";
    return "red"; // geplant
}

// ---------------------------
// Polygon oder Marker erstellen
// ---------------------------
map.on(L.Draw.Event.CREATED, function (event) {
    if (!isAdmin) return;

    const layer = event.layer;

    if (event.layerType === 'marker') {
        const name = prompt("Name des geplanten Ortes?");
        layer.bindPopup("🟥 Geplant: " + name);
        markerLayer.addLayer(layer);
        saveData();
        return;
    }

    // Polygon
    const status = prompt("Status: fertig / bau / geplant", "fertig");
    layer.status = status;
    layer.setStyle({ color: getColor(status), fillOpacity: 0.5 });
    builtLayer.addLayer(layer);

    saveData();
    updateProgress();
});

// ---------------------------
// Fortschritt berechnen
// ---------------------------
function updateProgress() {
    let builtArea = 0;

    builtLayer.eachLayer(layer => {
        if (layer.status === "fertig") {
            builtArea += turf.area(layer.toGeoJSON());
        }
    });

    const percent = ((builtArea / turf.area(totalArea)) * 100).toFixed(2);
    document.getElementById("progress").innerText =
        percent + " % umgesetzt";
}

// ---------------------------
// Marker ein/ausblenden
// ---------------------------
document.getElementById("toggleMarkers").addEventListener("change", function () {
    if (this.checked) {
        map.addLayer(markerLayer);
    } else {
        map.removeLayer(markerLayer);
    }
});

// ---------------------------
// Speichern in LocalStorage
// ---------------------------
function saveData() {
    if (!isAdmin) return;

    const data = {
        areas: [],
        markers: []
    };

    builtLayer.eachLayer(layer => {
        data.areas.push({
            geo: layer.toGeoJSON(),
            status: layer.status
        });
    });

    markerLayer.eachLayer(layer => {
        data.markers.push({
            geo: layer.toGeoJSON()
        });
    });

    localStorage.setItem("mapData", JSON.stringify(data));
}

// ---------------------------
// Laden
// ---------------------------
function loadData() {
    // 1. Aus LocalStorage (Admin)
    const savedLS = JSON.parse(localStorage.getItem("mapData"));
    if (savedLS) loadFromData(savedLS);

    // 2. Aus JSON Datei (GitHub Pages)
    fetch('mapData.json')
        .then(res => res.json())
        .then(data => loadFromData(data))
        .catch(err => console.log("Keine mapData.json gefunden:", err));
}

function loadFromData(saved) {
    // Polygone
    if (saved.areas) saved.areas.forEach(item => {
        const layer = L.geoJSON(item.geo, {
            style: { color: getColor(item.status), fillOpacity: 0.5 }
        }).getLayers()[0];
        layer.status = item.status;
        builtLayer.addLayer(layer);
    });

    // Marker
    if (saved.markers) saved.markers.forEach(item => {
        const layer = L.geoJSON(item.geo).getLayers()[0];
        markerLayer.addLayer(layer);
    });

    updateProgress();
}

loadData();
