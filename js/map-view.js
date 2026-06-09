(function () {
    const locations = window.ROUTE66_LOCATIONS || [];

    const icons = {
        bar: "local_bar",
        cafe: "restaurant",
        nonprofit: "menu_book",
        hotel: "bed",
        misc: "star"
    };

    const container = document.getElementById("map-pins-container");
    const slider = document.getElementById("year-slider");
    const display = document.getElementById("year-display");
    const popup = document.getElementById("location-popup");
    const mapSearch = document.getElementById("map-search");

    if (!container || !slider || !popup) return;

    let currentYear = parseInt(slider.value, 10);
    let searchQuery = "";

    function normalize(value) {
        return value.toLowerCase().replace(/['']/g, "").trim();
    }

    function locationMatchesQuery(loc, query) {
        const q = normalize(query);
        if (!q) return true;
        const haystack = normalize([
            loc.name,
            loc.organizationName,
            loc.locationLabel,
            loc.address,
            loc.type,
            loc.desc,
            loc.shortDescription,
            loc.description,
            loc.tags,
            loc.tags2
        ].join(" "));
        return haystack.includes(q);
    }

    function showPopup(loc) {
        document.getElementById("popup-name").textContent = loc.name;
        document.getElementById("popup-address").querySelector("span").textContent = loc.address;
        document.getElementById("popup-dates").textContent =
            loc.open + " - " + (loc.close === 2026 ? "Present" : loc.close);
        document.getElementById("popup-desc").textContent = loc.desc;

        const detailBtn = document.getElementById("popup-detail-btn");
        if (detailBtn) {
            if (loc.detailPage) {
                detailBtn.classList.remove("hidden");
                detailBtn.onclick = function () {
                    window.location.href = loc.detailPage;
                };
            } else {
                detailBtn.classList.add("hidden");
            }
        }

        popup.classList.remove("hidden");
    }

    function updatePins() {
        container.innerHTML = "";

        locations.forEach(function (loc) {
            if (loc.open <= currentYear && loc.close >= currentYear && locationMatchesQuery(loc, searchQuery)) {
                const pin = document.createElement("div");
                pin.className = "absolute cursor-pointer group transition-transform hover:scale-110";
                pin.dataset.locationId = loc.id;
                const top = ((34.1 - loc.lat) * 5000) + 40;
                const left = ((loc.lng + 118.4) * 5000) + 50;
                pin.style.top = top + "%";
                pin.style.left = left + "%";
                pin.innerHTML =
                    '<div class="w-8 h-8 bg-primary text-white rounded-t-lg rounded-b-2xl flex items-center justify-center shadow-md border-2 border-white">' +
                    '<span class="material-symbols-outlined text-sm">' + (icons[loc.type] || "location_on") + '</span></div>';
                pin.onclick = function () { showPopup(loc); };
                container.appendChild(pin);
            }
        });
    }

    function setYear(year) {
        currentYear = year;
        slider.value = String(year);
        display.textContent = String(year);
        updatePins();
    }

    function showLocation(id) {
        const loc = locations.find(function (item) { return item.id === id; });
        if (!loc) return;

        const mapSection = document.getElementById("map");
        if (mapSection) mapSection.scrollIntoView({ behavior: "smooth", block: "start" });

        const midYear = Math.min(Math.max(Math.floor((loc.open + loc.close) / 2), loc.open), loc.close);
        setYear(midYear);
        window.setTimeout(function () { showPopup(loc); }, 350);
    }

    slider.addEventListener("input", function (event) {
        currentYear = parseInt(event.target.value, 10);
        display.textContent = event.target.value;
        updatePins();
    });

    if (mapSearch) {
        mapSearch.addEventListener("input", function (event) {
            searchQuery = event.target.value;
            updatePins();
        });
    }

    document.getElementById("close-popup").addEventListener("click", function () {
        popup.classList.add("hidden");
    });

    window.Route66Map = {
        showLocation: showLocation,
        setSearchQuery: function (query) {
            searchQuery = query;
            if (mapSearch) mapSearch.value = query;
            updatePins();
        }
    };

    updatePins();

    const params = new URLSearchParams(window.location.search);
    const locParam = params.get("loc");
    if (locParam) {
        window.setTimeout(function () { showLocation(locParam); }, 300);
    }
})();
