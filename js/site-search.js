(function () {
    const HOME_PAGE = "restored-hero-layout.html";
    const locations = window.ROUTE66_LOCATIONS || [];

    function normalize(value) {
        return value.toLowerCase().replace(/['']/g, "").trim();
    }

    function searchLocations(query) {
        const q = normalize(query);
        if (!q) return locations.slice();

        return locations.filter(function (loc) {
            const haystack = normalize([
                loc.name,
                loc.address,
                loc.type,
                loc.desc,
                loc.id.replace(/-/g, " ")
            ].join(" "));
            return haystack.includes(q);
        });
    }

    function navigateToLocation(loc) {
        if (loc.detailPage) {
            window.location.href = loc.detailPage;
            return;
        }

        const onHomePage = /restored-hero-layout\.html$/.test(window.location.pathname) ||
            window.location.pathname.endsWith("/") ||
            /\/index\.html$/.test(window.location.pathname);

        if (onHomePage && window.Route66Map) {
            window.Route66Map.showLocation(loc.id);
            return;
        }

        window.location.href = HOME_PAGE + "?loc=" + encodeURIComponent(loc.id);
    }

    function createModal() {
        const root = document.createElement("div");
        root.id = "site-search-modal";
        root.className = "site-search-modal hidden";
        root.setAttribute("role", "dialog");
        root.setAttribute("aria-modal", "true");
        root.setAttribute("aria-label", "Search locations");
        root.innerHTML =
            '<div class="site-search-backdrop" data-close="true"></div>' +
            '<div class="site-search-panel">' +
                '<div class="site-search-header">' +
                    '<span class="material-symbols-outlined site-search-icon">search</span>' +
                    '<input id="site-search-input" type="search" placeholder="Search locations… e.g. Palms" autocomplete="off" />' +
                    '<button type="button" class="site-search-close" aria-label="Close search" data-close="true">' +
                        '<span class="material-symbols-outlined">close</span>' +
                    '</button>' +
                '</div>' +
                '<ul id="site-search-results" class="site-search-results" role="listbox"></ul>' +
                '<p id="site-search-empty" class="site-search-empty hidden">No locations found. Try &ldquo;Palms&rdquo; or an address.</p>' +
            '</div>';

        document.body.appendChild(root);

        const style = document.createElement("style");
        style.textContent =
            ".site-search-modal{position:fixed;inset:0;z-index:100;display:flex;align-items:flex-start;justify-content:center;padding:96px 20px 20px}" +
            ".site-search-modal.hidden{display:none}" +
            ".site-search-backdrop{position:absolute;inset:0;background:rgba(31,27,25,.55);backdrop-filter:blur(4px)}" +
            ".site-search-panel{position:relative;width:min(100%,520px);background:#fff8f5;border:1px solid #dfbec5;border-radius:12px;box-shadow:0 24px 48px rgba(31,27,25,.18);overflow:hidden}" +
            ".site-search-header{display:flex;align-items:center;gap:8px;padding:12px 12px 12px 16px;border-bottom:1px solid #eae1dd}" +
            ".site-search-icon{color:#8c7076;font-size:22px}" +
            "#site-search-input{flex:1;border:0;background:transparent;font:500 16px/24px Inter,sans-serif;color:#1f1b19;outline:none}" +
            "#site-search-input::placeholder{color:#8c7076}" +
            ".site-search-close{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border:0;border-radius:9999px;background:transparent;color:#584046;cursor:pointer}" +
            ".site-search-close:hover{background:#eae1dd;color:#b21559}" +
            ".site-search-results{list-style:none;margin:0;padding:8px;max-height:min(60vh,420px);overflow-y:auto}" +
            ".site-search-result{width:100%;display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:12px 14px;border:0;border-radius:8px;background:transparent;text-align:left;cursor:pointer;font-family:Inter,sans-serif}" +
            ".site-search-result:hover,.site-search-result:focus-visible{background:#f5ece8;outline:2px solid #b21559;outline-offset:-2px}" +
            ".site-search-result-name{font:600 16px/1.3 Oswald,sans-serif;color:#b21559;text-transform:uppercase;letter-spacing:.02em}" +
            ".site-search-result-meta{font:400 13px/1.4 Inter,sans-serif;color:#584046}" +
            ".site-search-result-badge{font:700 10px/1 Inter,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:#9e3678}" +
            ".site-search-empty{margin:0;padding:16px 20px 20px;font:400 14px/1.5 Inter,sans-serif;color:#584046}";
        document.head.appendChild(style);

        return root;
    }

    function renderResults(listEl, emptyEl, query) {
        const results = searchLocations(query);
        listEl.innerHTML = "";

        if (results.length === 0) {
            emptyEl.classList.remove("hidden");
            return;
        }

        emptyEl.classList.add("hidden");

        results.forEach(function (loc) {
            const item = document.createElement("li");
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "site-search-result";
            btn.setAttribute("role", "option");

            const years = loc.open + " – " + (loc.close === 2026 ? "Present" : loc.close);
            btn.innerHTML =
                '<span class="site-search-result-name">' + loc.name + '</span>' +
                '<span class="site-search-result-meta">' + loc.address + ' · ' + years + '</span>' +
                (loc.detailPage ? '<span class="site-search-result-badge">View full history</span>' : '');

            btn.addEventListener("click", function () {
                closeModal();
                navigateToLocation(loc);
            });

            item.appendChild(btn);
            listEl.appendChild(item);
        });
    }

    let modal;
    let input;
    let resultsEl;
    let emptyEl;
    let lastTrigger = null;

    function openModal(trigger) {
        lastTrigger = trigger || null;
        modal.classList.remove("hidden");
        document.body.style.overflow = "hidden";
        input.value = "";
        renderResults(resultsEl, emptyEl, "");
        window.setTimeout(function () { input.focus(); }, 0);
    }

    function closeModal() {
        modal.classList.add("hidden");
        document.body.style.overflow = "";
        if (lastTrigger) lastTrigger.focus();
    }

    document.addEventListener("DOMContentLoaded", function () {
        modal = createModal();
        input = document.getElementById("site-search-input");
        resultsEl = document.getElementById("site-search-results");
        emptyEl = document.getElementById("site-search-empty");

        document.querySelectorAll(".nav-search-btn").forEach(function (btn) {
            btn.addEventListener("click", function () { openModal(btn); });
        });

        input.addEventListener("input", function () {
            renderResults(resultsEl, emptyEl, input.value);
        });

        input.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                event.preventDefault();
                closeModal();
            }
            if (event.key === "Enter") {
                const first = resultsEl.querySelector(".site-search-result");
                if (first) {
                    event.preventDefault();
                    first.click();
                }
            }
        });

        modal.addEventListener("click", function (event) {
            if (event.target.closest("[data-close='true']")) closeModal();
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
        });
    });
})();
