// =====================
// Konfiguration
// =====================
const ADMIN_PASSWORT = "meinpasswort";
let isAdmin = false;

// =====================
// Karte
// =====================
const map = L.map('map').setView([47.8846, 7.7323], 14);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

const builtLayer = new L.FeatureGroup().addTo(map);
const markerLayer = new L.FeatureGroup().addTo(map);

// Gesamtfläche (Beispiel)
const totalArea = turf.polygon([[
    [7.72, 47.88],
    [7.74, 47.88],
    [7.74, 47.89],
    [7.72, 47.89],
    [7.72, 47.88]
]]);

// =====================
// Admin Login
// =====================
document.getElementById("adminButton").onclick = () => {
    const pw = prompt("Admin Passwort:");
    if (pw === ADMIN_PASSWORT) {
        isAdmin = true;
        document.getElementById("syncButton").style.display = "inline";
        enableDraw();
        alert("Admin aktiviert");
    } else {
        alert("Falsches Passwort");
    }
};

// =====================
// Draw Tools
// =====================
function enableDraw() {
    map.addControl(new L.Control.Draw({
        edit: { featureGroup: builtLayer },
        draw: {
            polygon: true,
            rectangle: true,
            marker: true,
            polyline: false,
            circle: false
        }
    }));
}

// =====================
// Farben
// =====================
function getColor(status) {
    if (status === "fertig") return "green";
    if (status === "bau") return "orange";
    return "red";
}

// =====================
// Zeichnen
// =====================
map.on(L.Draw.Event.CREATED, e => {
    if (!isAdmin) return;

    const layer = e.layer;

    // MARKER
    if (e.layerType === "marker") {
        const name = prompt("Name des geplanten Ortes?");
        const priority = prompt("Priorität (hoch / mittel / niedrig)", "mittel");

        layer.data = { name, priority };
        layer.bindPopup(`🟥 ${name}<br>Priorität: ${priority}`);
        markerLayer.addLayer(layer);
        saveLocal();
        updateUI();
        return;
    }

    // POLYGON
    const name = prompt("Name des Gebiets?");
    const status = prompt("Status: fertig / bau / geplant", "fertig");
    const note = prompt("Notiz (optional):", "");

    layer.data = { name, status, note };
    layer.status = status;

    layer.setStyle({ color: getColor(status), fillOpacity: 0.5 });
    layer.bindPopup(`
        <b>${name}</b><br>
        Status: ${status}<br>
        ${note}
    `);

    builtLayer.addLayer(layer);
    saveLocal();
    updateUI();
});

// =====================
// UI Updates
// =====================
function updateUI() {
    updateProgress();
    updateStats();
    updateNextList();
}

// Fortschritt
function updateProgress() {
    let area = 0;
    builtLayer.eachLayer(l => {
        if (l.status === "fertig") {
            area += turf.area(l.toGeoJSON());
        }
    });

    document.getElementById("progress").innerText =
        ((area / turf.area(totalArea)) * 100).toFixed(2) + " % umgesetzt";
}

// Statistik
function updateStats() {
    let fertig = 0, bau = 0, geplant = 0;

    builtLayer.eachLayer(l => {
        if (l.status === "fertig") fertig++;
        else if (l.status === "bau") bau++;
        else geplant++;
    });

    document.getElementById("stat-fertig").innerText = fertig;
    document.getElementById("stat-bau").innerText = bau;
    document.getElementById("stat-geplant").innerText = geplant;
    document.getElementById("stat-marker").innerText = markerLayer.getLayers().length;
}

// Nächste Marker
function updateNextList() {
    const list = document.getElementById("nextList");
    list.innerHTML = "";
    markerLayer.eachLayer(m => {
        const li = document.createElement("li");
        li.innerText = `${m.data.name} (${m.data.priority})`;
        list.appendChild(li);
    });
}

// =====================
// Marker Toggle
// =====================
document.getElementById("toggleMarkers").onchange = e => {
    e.target.checked ? map.addLayer(markerLayer) : map.removeLayer(markerLayer);
};

// =====================
// LocalStorage
// =====================
function saveLocal() {
    localStorage.setItem("mapData", JSON.stringify(collectData()));
}

// =====================
// Sync (Export JSON)
// =====================
document.getElementById("syncButton").onclick = () => {
    const data = collectData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json"
    });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mapData.json";
    a.click();

    alert("mapData.json heruntergeladen → im GitHub-Repo ersetzen & committen");
};

// =====================
// Daten sammeln
// =====================
function collectData() {
    const data = { areas: [], markers: [] };

    builtLayer.eachLayer(l => {
        data.areas.push({
            geo: l.toGeoJSON(),
            status: l.status,
            data: l.data
        });
    });

    markerLayer.eachLayer(l => {
        data.markers.push({
            geo: l.toGeoJSON(),
            data: l.data
        });
    });

    return data;
}

// =====================
// Laden
// =====================
function loadFrom(data) {
    builtLayer.clearLayers();
    markerLayer.clearLayers();

    if (data.areas) data.areas.forEach(a => {
        const l = L.geoJSON(a.geo, {
            style: { color: getColor(a.status), fillOpacity: 0.5 }
        }).getLayers()[0];

        l.status = a.status;
        l.data = a.data || { name: "Unbenannt", note: "" };

        l.bindPopup(`
            <b>${l.data.name}</b><br>
            Status: ${a.status}<br>
            ${l.data.note || ""}
        `);

        builtLayer.addLayer(l);
    });

    if (data.markers) data.markers.forEach(m => {
        const l = L.geoJSON(m.geo).getLayers()[0];
        l.data = m.data;
        l.bindPopup(`🟥 ${m.data.name}<br>Priorität: ${m.data.priority}`);
        markerLayer.addLayer(l);
    });

    updateUI();
}

// =====================
// INITIAL LOAD (GitHub → LocalStorage)
// =====================
(function init() {
    const local = localStorage.getItem("mapData");

    if (local) {
        console.log("Loaded from localStorage");
        loadFrom(JSON.parse(local));
        return;
    }

    console.log("Loaded from GitHub mapData.json");
    fetch("./mapData.json")
        .then(r => r.json())
        .then(data => {
            loadFrom(data);
            localStorage.setItem("mapData", JSON.stringify(data));
        })
        .catch(err => console.error("Load failed", err));
})();
