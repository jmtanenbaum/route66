(function () {
    const locations = window.ROUTE66_LOCATIONS || [];
    const leafletMap = window.Route66LeafletMap;

    const slider = document.getElementById("year-slider");
    const display = document.getElementById("year-display");
    const popup = document.getElementById("location-popup");
    const mapSearch = document.getElementById("map-search");
    const mapSection = document.getElementById("map");
    const tagFilters = document.getElementById("map-tag-filters");
    const popupImg = document.getElementById("popup-img");
    const defaultPopupImg = popupImg ? popupImg.getAttribute("src") : "";
    const zoomInBtn = document.getElementById("map-zoom-in");
    const zoomOutBtn = document.getElementById("map-zoom-out");

    const TAG_LABELS = {
        "Mixed LGBT Space": "Mixed LGBT",
        "Lesbian Owned Business": "Owned Business",
        "Lesbian Run Non-Profit Organization": "Non-Profit"
    };

    const TAG_ACTIVE_CLASS =
        "px-3 py-1 rounded-full border border-primary bg-primary text-white text-xs font-ui-main transition-all";
    const TAG_INACTIVE_CLASS =
        "px-3 py-1 rounded-full border border-outline text-on-surface-variant text-xs font-ui-main hover:border-primary transition-all";

    if (!slider || !popup || !leafletMap) return;

    let currentYear = parseInt(slider.value, 10);
    let searchQuery = "";
    let leafletReady = false;
    let allTags = [];
    const activeTags = new Set();

    function normalize(value) {
        return value.toLowerCase().replace(/['']/g, "").trim();
    }

    function collectTags() {
        const tagSet = new Set();
        locations.forEach(function (loc) {
            if (loc.tags && loc.tags.trim()) tagSet.add(loc.tags.trim());
            if (loc.tags2 && loc.tags2.trim()) tagSet.add(loc.tags2.trim());
        });
        return Array.from(tagSet).sort(function (a, b) {
            return a.localeCompare(b);
        });
    }

    function locationTagList(loc) {
        return [loc.tags, loc.tags2]
            .filter(function (tag) { return tag && tag.trim(); })
            .map(function (tag) { return tag.trim(); });
    }

    function locationMatchesTags(loc) {
        if (activeTags.size === allTags.length) return true;
        if (activeTags.size === 0) return false;

        const locTags = locationTagList(loc);
        return locTags.some(function (tag) {
            return activeTags.has(tag);
        });
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

    function isLocationVisible(loc) {
        return loc.open <= currentYear &&
            loc.close >= currentYear &&
            locationMatchesQuery(loc, searchQuery) &&
            locationMatchesTags(loc);
    }

    function tagLabel(tag) {
        return TAG_LABELS[tag] || tag;
    }

    function syncTagButton(button, isActive) {
        button.className = isActive ? TAG_ACTIVE_CLASS : TAG_INACTIVE_CLASS;
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
    }

    function renderTagFilters() {
        if (!tagFilters) return;

        allTags = collectTags();
        allTags.forEach(function (tag) {
            activeTags.add(tag);
        });

        tagFilters.innerHTML = "";

        allTags.forEach(function (tag) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = tagLabel(tag);
            button.dataset.tag = tag;
            syncTagButton(button, true);

            button.addEventListener("click", function () {
                if (activeTags.has(tag)) {
                    activeTags.delete(tag);
                    syncTagButton(button, false);
                } else {
                    activeTags.add(tag);
                    syncTagButton(button, true);
                }
                updatePins();
            });

            tagFilters.appendChild(button);
        });
    }

    function photoUrl(file) {
        return file ? "assets/photos/" + file : null;
    }

    function showPopup(loc) {
        document.getElementById("popup-name").textContent = loc.name;
        document.getElementById("popup-address").querySelector("span").textContent = loc.address;
        document.getElementById("popup-dates").textContent =
            loc.openLabel && loc.closeLabel
                ? loc.openLabel + " - " + loc.closeLabel
                : loc.open + " - " + (loc.close === 2026 ? "Present" : loc.close);
        document.getElementById("popup-desc").textContent = loc.desc;

        if (popupImg) {
            const firstPhoto = loc.photos && loc.photos[0];
            if (firstPhoto && firstPhoto.file) {
                popupImg.src = photoUrl(firstPhoto.file);
                popupImg.alt = firstPhoto.caption || loc.name;
            } else {
                popupImg.src = defaultPopupImg;
                popupImg.alt = loc.name;
            }
        }

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
        if (!leafletReady) return;

        const visible = locations.filter(isLocationVisible);
        leafletMap.updateMarkers(visible, showPopup);
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

        if (mapSection) mapSection.scrollIntoView({ behavior: "smooth", block: "start" });

        bootMap();
        const midYear = Math.min(Math.max(Math.floor((loc.open + loc.close) / 2), loc.open), loc.close);
        setYear(midYear);
        leafletMap.flyToLocation(loc, 16);
        window.setTimeout(function () { showPopup(loc); }, 350);
    }

    function bootMap() {
        if (leafletReady) {
            leafletMap.refreshSize();
            return;
        }

        leafletReady = leafletMap.init(locations);
        if (leafletReady) updatePins();
    }

    renderTagFilters();

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

    if (zoomInBtn) {
        zoomInBtn.addEventListener("click", function () {
            bootMap();
            leafletMap.zoomIn();
        });
    }

    if (zoomOutBtn) {
        zoomOutBtn.addEventListener("click", function () {
            bootMap();
            leafletMap.zoomOut();
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

    window.addEventListener("load", bootMap);

    if (mapSection && "IntersectionObserver" in window) {
        const mapObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) bootMap();
            });
        }, { threshold: 0.1 });
        mapObserver.observe(mapSection);
    }

    if (document.readyState === "complete") {
        bootMap();
    }

    const params = new URLSearchParams(window.location.search);
    const locParam = params.get("loc");
    if (locParam) {
        window.setTimeout(function () { showLocation(locParam); }, 300);
    }
})();
