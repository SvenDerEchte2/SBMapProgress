// ===========================
// Konfiguration
// ===========================
const ADMIN_PASSWORT = "meinpasswort";
let isAdmin = false;

// ===========================
// Karte
// ===========================
const map = L.map('map').setView([47.8846, 7.7323], 14);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

const builtLayer = new L.FeatureGroup().addTo(map);
const markerLayer = new L.FeatureGroup().addTo(map);

// Beispiel-Gesamtfläche
const totalArea = turf.polygon([[
    [7.72, 47.88],
    [7.74, 47.88],
    [7.74, 47.89],
    [7.72, 47.89],
    [7.72, 47.88]
]]);

// ===========================
// Admin Login
// ===========================
document.getElementById("adminButton").onclick = () => {
    const pw = prompt("Admin Passwort:");
    if (pw === ADMIN_PASSWORT) {
        isAdmin = true;
        alert("Admin aktiviert");
        document.getElementById("syncButton").style.display = "inline";
        enableDraw();
    } else {
        alert("Falsches Passwort");
    }
};

// ===========================
// Draw Tools
// ===========================
function enableDraw() {
    const draw = new L.Control.Draw({
        edit: { featureGroup: builtLayer },
        draw: {
            polygon: true,
            rectangle: true,
            marker: true,
            polyline: false,
            circle: false
        }
    });
    map.addControl(draw);
}

// ===========================
// Farben
// ===========================
function getColor(status) {
    if (status === "fertig") return "green";
    if (status === "bau") return "orange";
    return "red";
}

// ===========================
// Zeichnen
// ===========================
map.on(L.Draw.Event.CREATED, e => {
    if (!isAdmin) return;

    const layer = e.layer;

    if (e.layerType === "marker") {
        const name = prompt("Name des geplanten Ortes?");
        layer.bindPopup("🟥 Geplant: " + name);
        markerLayer.addLayer(layer);
        saveLocal();
        return;
    }

    const status = prompt("Status: fertig / bau / geplant", "fertig");
    layer.status = status;
    layer.setStyle({ color: getColor(status), fillOpacity: 0.5 });
    builtLayer.addLayer(layer);

    saveLocal();
    updateProgress();
});

// ===========================
// Fortschritt
// ===========================
function updateProgress() {
    let area = 0;
    builtLayer.eachLayer(l => {
        if (l.status === "fertig") {
            area += turf.area(l.toGeoJSON());
        }
    });
    const percent = ((area / turf.area(totalArea)) * 100).toFixed(2);
    document.getElementById("progress").innerText = percent + " % umgesetzt";
}

// ===========================
// Marker Toggle
// ===========================
document.getElementById("toggleMarkers").onchange = e => {
    e.target.checked ? map.addLayer(markerLayer) : map.removeLayer(markerLayer);
};

// ===========================
// LocalStorage
// ===========================
function saveLocal() {
    const data = collectData();
    localStorage.setItem("mapData", JSON.stringify(data));
}

// ===========================
// 🔄 SYNC BUTTON (EXPORT)
// ===========================
document.getElementById("syncButton").onclick = () => {
    const data = collectData();
    const blob = new Blob(
        [JSON.stringify(data, null, 2)],
        { type: "application/json" }
    );

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mapData.json";
    a.click();

    alert("mapData.json heruntergeladen.\nJetzt im GitHub-Repo ersetzen & committen.");
};

// ===========================
// Daten sammeln
// ===========================
function collectData() {
    const data = { areas: [], markers: [] };

    builtLayer.eachLayer(l => {
        data.areas.push({
            geo: l.toGeoJSON(),
            status: l.status
        });
    });

    markerLayer.eachLayer(l => {
        data.markers.push({ geo: l.toGeoJSON() });
    });

    return data;
}

// ===========================
// Laden
// ===========================
function loadAll() {
    const local = JSON.parse(localStorage.getItem("mapData"));
    if (local) loadFrom(local);

    fetch("mapData.json")
        .then(r => r.json())
        .then(loadFrom)
        .catch(() => {});
}

function loadFrom(data) {
    if (data.areas) data.areas.forEach(a => {
        const l = L.geoJSON(a.geo, {
            style: { color: getColor(a.status), fillOpacity: 0.5 }
        }).getLayers()[0];
        l.status = a.status;
        builtLayer.addLayer(l);
    });

    if (data.markers) data.markers.forEach(m => {
        const l = L.geoJSON(m.geo).getLayers()[0];
        markerLayer.addLayer(l);
    });

    updateProgress();
}

loadAll();
