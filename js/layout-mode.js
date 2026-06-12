(function () {
    const DESKTOP_MIN = 768;

    function readWidth() {
        if (window.visualViewport && window.visualViewport.width > 0) {
            return window.visualViewport.width;
        }
        return document.documentElement.clientWidth || window.innerWidth;
    }

    function updateLayoutMode() {
        const mode = readWidth() >= DESKTOP_MIN ? "desktop" : "mobile";
        const root = document.documentElement;

        if (root.dataset.layoutMode === mode) {
            return;
        }

        root.dataset.layoutMode = mode;
        window.dispatchEvent(new Event("resize"));

        if (window.Route66LeafletMap && window.Route66LeafletMap.refreshSize) {
            window.Route66LeafletMap.refreshSize();
        }
    }

    window.addEventListener("resize", updateLayoutMode, { passive: true });
    window.addEventListener("orientationchange", updateLayoutMode, { passive: true });

    if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", updateLayoutMode, { passive: true });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", updateLayoutMode);
    } else {
        updateLayoutMode();
    }
})();
