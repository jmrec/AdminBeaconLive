//@flow

// ==========================
// MAP PAGE SCRIPT 
// ==========================
// Loaded LAST only on map.html

// --- Custom Material Icons using L.DivIcon ---
function createMaterialIconHTML(iconName: string, color: string) {
    return `<span class="material-icons" style="color: ${color}; font-size: 36px;">${iconName}</span>`;
}

const redMaterialIcon = L.divIcon({
    html: createMaterialIconHTML('place', 'red'),
    className: 'leaflet-div-icon-material',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38]
});

const yellowMaterialIcon = L.divIcon({
    html: createMaterialIconHTML('place', 'orange'),
    className: 'leaflet-div-icon-material',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38]
});

const greenMaterialIcon = L.divIcon({
    html: createMaterialIconHTML('place', 'green'),
    className: 'leaflet-div-icon-material',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38]
});

const grayMaterialIcon = L.divIcon({
    html: createMaterialIconHTML('place', 'gray'),
    className: 'leaflet-div-icon-material',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38]
});

const blackMaterialIcon = L.divIcon({
    html: createMaterialIconHTML('place', 'black'),
    className: 'leaflet-div-icon-material',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38]
});

// Helper function to choose the DivIcon based on status
function getIconForStatus(status: string) {
    switch (status) {
        case 'No Problem':
            return greenMaterialIcon;
        case 'Confirmed Outage':
            return redMaterialIcon;
        case 'Reported':
            return redMaterialIcon; // Changed to Red based on your legend request
        case 'Emergency':
            return blackMaterialIcon;
        case 'Ongoing':
        case 'Ongoing Restoration':
            return yellowMaterialIcon;
        default:
            return grayMaterialIcon;
    }
}


document.addEventListener("DOMContentLoaded", () => {
    const mapContainer = document.getElementById("map");
    if (!mapContainer) return; // Exit if not on Map page

    // --- GLOBAL VARS ---
    let map;
    let allMarkers = []; // To store marker references for filtering

    // --- ELEMENT REFS ---
    const feederPopup = document.getElementById("feederPopup");
    const searchInput = document.getElementById("locationSearch");

    // ===================================
    // 1. MAP INITIALIZATION
    // ===================================

    // Para di overlap markers with same coordinates
    function jitterCoordinate(value: number): number {
        const offset = (Math.random() - 0.5) * 0.0005;
        // adjust 0.0005 if too near/far (0.0003 = closer, 0.001 = farther)
        return value + offset;
    }

    function initMap() {
        map = L.map('map').setView([16.4142, 120.5950], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        // ======================
        // LOAD BARANGAY BOUNDARIES (GeoJSON)
        // ======================
        fetch("baguio_barangays.geojson")
            .then(res => res.json())
            .then(data => {
                const barangayLayer = L.geoJSON(data, {
                    style: (feature) => {
                        const status = feature.properties?.status || "Unknown";

                        function getColorForStatus(status: string): string {
                            switch (status) {
                                case "No Problem":
                                    return "green";
                                case "Confirmed Outage":
                                    return "red";
                                case "Reported":
                                    return "gray";
                                case "Emergency":
                                    return "black";
                                case "Ongoing Restoration":
                                    return "orange";
                                default:
                                    return "#4287f5"; // fallback blue
                            }
                        }

                        return {
                            color: "#0050c7",
                            weight: 1,
                            fillColor: getColorForStatus(status),
                            // ✅ LIGHTER OPACITY (Was 0.45)
                            fillOpacity: 0.2
                        };
                    },
                    onEachFeature: (feature, layer) => {
                        const name = feature.properties?.ADM4_EN ?? "Unknown Barangay";
                        const status = feature.properties?.status || "Unknown";

                        // Popup (click)
                        layer.bindPopup(`
                            <div class="w-64 font-display">
                                <div class="p-2 border-b dark:border-gray-600">
                                    <h3 class="text-lg font-semibold" style="color: black;">
                                        ${name}
                                    </h3>
                                    <p class="text-sm" style="color: black;">
                                        ${feature.properties.ADM3_EN}, ${feature.properties.ADM2_EN}
                                    </p>
                                </div>

                                <div class="p-2 space-y-2" >
                                    <div>
                                        <label class="text-xs font-medium" style="color: black;">Barangay Code</label>
                                        <p class="text-sm" style="color: black;">${feature.properties.ADM4_PCODE}</p>
                                    </div>

                                    <div>
                                        <label class="text-xs font-medium" style="color: black;">Area</label>
                                        <p class="text-sm" style="color: black;">${feature.properties.AREA_SQKM.toFixed(2)} sq km</p>
                                    </div>

                                    <div>
                                        <label class="text-xs font-medium" style="color: black;">Outage Status</label>
                                        <p class="text-sm" style="color: black;">${status}</p>
                                    </div>
                                </div>
                            </div>
                        `);

                        // Tooltip (hover)
                        layer.bindTooltip(name, {
                            sticky: true,
                            direction: "top",
                            offset: [0, -10],
                            className: "",
                            opacity: 1
                        });

                        // Hover highlight
                        layer.on({
                            mouseover: (e) => {
                                const l = e.target;
                                l.setStyle({
                                    weight: 3,
                                    color: "#000",
                                    // ✅ LIGHTER HOVER OPACITY (Was 0.6)
                                    fillOpacity: 0.4
                                });
                            },
                            mouseout: (e) => {
                                barangayLayer.resetStyle(e.target);
                            }
                        });
                    }
                });

                barangayLayer.addTo(map);

                const legend = L.control({ position: "topright" });

                // ✅ UPDATED LEGEND: Only Red (Reported) and Yellow/Orange (Ongoing)
                legend.onAdd = function () {
                    const div = L.DomUtil.create("div", "map-legend");
                    div.style.background = "white";
                    div.style.padding = "10px";
                    div.style.border = "1px solid #ccc";
                    div.style.color = "black";
                    div.innerHTML = `
                        <strong>Outage Status</strong><br>
                        <span style="color: red;">●</span> Reported<br>
                        <span style="color: orange;">●</span> Ongoing<br>
                    `;
                    return div;
                };

                legend.addTo(map);

                map.fitBounds(barangayLayer.getBounds());
            })
            .catch(err => console.error("GeoJSON load error:", err));

        window.filterMarkers = loadOutageMarkers;
        window.applyFilters = applyMapFilters;

        setupMapSearchEnterKey();

        // Listener for popup button -> update modal
        mapContainer.addEventListener('click', (e) => {
            const updateBtn = e.target.closest('.update-from-map-btn');
            if (updateBtn) {
                const id = parseInt(updateBtn.dataset.id);
                if (!isNaN(id)) {
                    map.closePopup();
                    window.showUpdateModal([id], 'outages');
                }
            }
        });

        populateFeederFilters();
        loadOutageMarkers();
    }

    function getRandomColor() {
        const hue = Math.floor(Math.random() * 360);
        return `hsl(${hue}, 70%, 75%)`;
    }

    // ===================================
    // 2. DATA LOADING & MARKERS
    // ===================================

    async function populateFeederFilters() {
        const container = document.getElementById("feederButtonContainer");
        if (!container) return;

        container.innerHTML = `<span class="col-span-3 text-xs text-gray-500">Loading...</span>`;

        if (!window.supabase) {
            container.innerHTML = `<span class="col-span-3 text-xs text-red-500">Supabase error.</span>`;
            return;
        }

        try {
            const { data: feeders, error } = await supabase
                .from('feeders')
                .select('id, name')
                .order('id', { ascending: true });

            if (error) throw error;

            if (feeders.length === 0) {
                container.innerHTML = `<span class="col-span-3 text-xs text-gray-500">No feeders.</span>`;
                return;
            }

            container.innerHTML = feeders.map(feeder => {
                const feederName = feeder.name || `FD-${feeder.id}`;
                return `
                    <button class="feeder-toggle px-2 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium" 
                            data-feeder="${feeder.id}">
                        ${feederName}
                    </button>
                `;
            }).join('');

        } catch (error) {
            console.error("Error fetching feeders:", error.message);
            container.innerHTML = `<span class="col-span-3 text-xs text-red-500">Load error.</span>`;
        }
    }

    /**
     * ✅ UPDATED: Fetch announcements instead of outages
     */
    async function loadOutageMarkers() {
        if (!window.supabase) {
            console.error("Supabase client not found.");
            return;
        }

        // --- Date Filter ---
        const dateInput = document.getElementById("calendarInput");
        const selectedDate = dateInput?.value;

        let todayISO, tomorrowISO;
        if (selectedDate) {
            const selectedDay = new Date(selectedDate);
            selectedDay.setHours(0, 0, 0, 0);
            const nextDay = new Date(selectedDay);
            nextDay.setDate(selectedDay.getDate() + 1);
            todayISO = selectedDay.toISOString();
            tomorrowISO = nextDay.toISOString();
        } else {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            todayISO = today.toISOString();
            tomorrowISO = tomorrow.toISOString();
        }

        // DATA filtered from announcement table sa DB
        const { data: outages, error } = await supabase
            .from('announcements')
            .select('*')
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .in('status', ['Reported', 'Ongoing'])
            .gte('updated_at', todayISO)
            .lt('updated_at', tomorrowISO);

        if (error) {
            console.error("Error fetching announcement markers:", error);
            return;
        }

        // Clear previous markers
        allMarkers.forEach(markerData => markerData.marker.remove());
        allMarkers = [];

        // ✅ CHANGED FIELD REFERENCES TO MATCH `announcements`
        outages.forEach(outage => {
            const chosenIcon = getIconForStatus(outage.status);
            const jitteredLat = jitterCoordinate(outage.latitude);
            const jitteredLng = jitterCoordinate(outage.longitude);

            const marker = L.marker([jitteredLat, jitteredLng], { icon: chosenIcon });

            const popupHTML = createPopupHTML(outage);
            marker.bindPopup(popupHTML);

            allMarkers.push({
                marker: marker,
                searchableText:
                    (outage.location || '').toLowerCase() + ' ' +
                    (outage.areas_affected || []).join(' ').toLowerCase(),
                feeder: outage.feeder_id,
                status: outage.status
            });
        });

        applyMapFilters();
    }

    /**
     * ✅ UPDATED: Popup now uses announcement fields
     */
    function createPopupHTML(outage) {
        const eta = outage.estimated_restoration_at
            ? new Date(outage.estimated_restoration_at).toLocaleString()
            : "To be determined";

        const statusClass = outage.status === 'Ongoing' ? 'bg-blue-100 text-blue-800'
                        : outage.status === 'Reported' ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800';

        return `
            <div class="w-64 font-display">
                <div class="p-2 border-b dark:border-gray-600">
                    <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}">
                        ${outage.status}
                    </span>
                    <h3 class="font-semibold mt-1" style="color: black;">${outage.location || 'Outage Announcement'}</h3>
                </div>
                <div class="p-2 space-y-2">
                    <div>
                        <label class="text-xs font-medium" style="color: black;">Affected Areas</label>
                        <p class="text-sm" style="color: black;">${(outage.areas_affected || []).join(", ")}</p>
                    </div>
                    <div>
                        <label class="text-xs font-medium" style="color: black;">ETA</label>
                        <p class="text-sm" style="color: black;">${eta}</p>
                    </div>
                </div>
                <div class="p-2 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <button type="button" class="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700 transition w-full update-from-map-btn" data-id="${outage.id}">
                        Update Announcement
                    </button>
                </div>
            </div>
        `;
    }

    // ===================================
    // 3. FILTERING & SEARCH LOGIC (Map-Specific)
    // ===================================
    function applyMapFilters() {
        if (!feederPopup || !searchInput) return;
        
        const allFeederToggles = feederPopup.querySelectorAll(".feeder-toggle");
        const selectedFeederToggles = feederPopup.querySelectorAll(".feeder-toggle.bg-blue-500");
        const selectedFeeders = Array.from(selectedFeederToggles).map(btn => btn.dataset.feeder);
        const showAllFeeders = selectedFeeders.length === 0 || (allFeederToggles.length > 0 && selectedFeeders.length === allFeederToggles.length);
        const searchTerm = searchInput.value.toLowerCase();

        allMarkers.forEach(markerData => {
            const feederIdString = String(markerData.feeder);
            const isFeederVisible = showAllFeeders || selectedFeeders.includes(feederIdString);
            const isSearchMatch = searchTerm === '' || markerData.searchableText.includes(searchTerm);
            const isVisible = isFeederVisible && isSearchMatch;

            if (isVisible) {
                if (!map.hasLayer(markerData.marker)) markerData.marker.addTo(map);
            } else {
                if (map.hasLayer(markerData.marker)) markerData.marker.remove();
            }
        });
    }

    function setupMapSearchEnterKey() {
        searchInput.addEventListener("keypress", (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); 
                const searchTerm = searchInput.value.toLowerCase();

                const matchingMarker = allMarkers.find(markerData => 
                    markerData.searchableText.includes(searchTerm) && map.hasLayer(markerData.marker)
                );
                
                if (matchingMarker) {
                    map.flyTo(matchingMarker.marker.getLatLng(), 15);
                    matchingMarker.marker.openPopup();
                } else if (window.showSuccessPopup) {
                    window.showSuccessPopup("No matching outage found in current view.");
                }
            }
        });
    }

    // --- START THE MAP ---
    initMap();
});