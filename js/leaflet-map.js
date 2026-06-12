(function () {
    const CARTO_TILES = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
    const CARTO_ATTRIBUTION =
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
        'contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

    const TYPE_ICONS = {
        bar: "local_bar",
        cafe: "restaurant",
        nonprofit: "menu_book",
        hotel: "bed",
        misc: "star"
    };

    let map = null;
    let markerLayer = null;
    let lastLocations = [];

    function coordKey(lat, lng) {
        return lat.toFixed(6) + "," + lng.toFixed(6);
    }

    function spreadPosition(lat, lng, index, total) {
        if (total <= 1) {
            return [lat, lng];
        }

        const radius = 0.00014;
        const angle = (2 * Math.PI * index) / total;
        return [
            lat + radius * Math.cos(angle),
            lng + radius * Math.sin(angle)
        ];
    }

    function markerPositions(locations) {
        const groups = {};
        const positions = {};

        locations.forEach(function (loc) {
            const key = coordKey(loc.lat, loc.lng);
            if (!groups[key]) groups[key] = [];
            groups[key].push(loc);
        });

        Object.keys(groups).forEach(function (key) {
            const group = groups[key].slice().sort(function (a, b) {
                return a.name.localeCompare(b.name);
            });
            group.forEach(function (loc, index) {
                positions[loc.id] = spreadPosition(loc.lat, loc.lng, index, group.length);
            });
        });

        return positions;
    }

    function createMarkerIcon(type) {
        const symbol = TYPE_ICONS[type] || "location_on";
        return L.divIcon({
            className: "route66-marker-wrap",
            html:
                '<div class="route66-marker" aria-hidden="true">' +
                '<span class="material-symbols-outlined">' + symbol + "</span></div>",
            iconSize: [32, 40],
            iconAnchor: [16, 40]
        });
    }

    function addTileLayer() {
        return L.tileLayer(CARTO_TILES, {
            attribution: CARTO_ATTRIBUTION,
            subdomains: "abcd",
            maxZoom: 20
        }).addTo(map);
    }

    function fitAllLocations(locations) {
        if (!locations.length) return;

        const bounds = L.latLngBounds(locations.map(function (loc) {
            return [loc.lat, loc.lng];
        }));
        map.fitBounds(bounds.pad(0.08), {
            padding: [40, 40],
            maxZoom: 15
        });
    }

    function init(locations) {
        const container = document.getElementById("leaflet-map");
        if (!container || typeof L === "undefined") {
            return false;
        }

        if (map) {
            map.remove();
            map = null;
            markerLayer = null;
        }

        map = L.map(container, {
            scrollWheelZoom: true,
            zoomControl: false
        });

        addTileLayer();
        markerLayer = L.layerGroup().addTo(map);
        fitAllLocations(locations);

        window.requestAnimationFrame(function () {
            if (map) map.invalidateSize();
        });

        if (!window.__route66LeafletResizeBound) {
            window.__route66LeafletResizeBound = true;
            window.addEventListener("resize", function () {
                if (map) map.invalidateSize();
            });
        }

        return true;
    }

    function refreshSize() {
        if (map) map.invalidateSize();
    }

    function updateMarkers(locations, onMarkerClick) {
        if (!markerLayer) return;

        lastLocations = locations.slice();
        const positions = markerPositions(locations);
        markerLayer.clearLayers();

        locations.forEach(function (loc) {
            const position = positions[loc.id] || [loc.lat, loc.lng];
            const marker = L.marker(position, {
                icon: createMarkerIcon(loc.type)
            });
            marker.on("click", function () {
                onMarkerClick(loc);
            });
            marker.addTo(markerLayer);
        });
    }

    function flyToLocation(loc, zoom) {
        if (!map || !loc) return;

        const positions = markerPositions(lastLocations.length ? lastLocations : [loc]);
        const position = positions[loc.id] || [loc.lat, loc.lng];
        map.flyTo(position, zoom || 16, { duration: 0.8 });
    }

    function zoomIn() {
        if (map) map.zoomIn();
    }

    function zoomOut() {
        if (map) map.zoomOut();
    }

    window.Route66LeafletMap = {
        init: init,
        refreshSize: refreshSize,
        updateMarkers: updateMarkers,
        flyToLocation: flyToLocation,
        zoomIn: zoomIn,
        zoomOut: zoomOut
    };
})();
