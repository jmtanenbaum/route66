(function () {
    document.addEventListener("DOMContentLoaded", function () {
        const menuBtn = document.getElementById("mobile-menu-btn");
        const mobileNav = document.getElementById("mobile-nav");
        const menuIcon = menuBtn ? menuBtn.querySelector(".material-symbols-outlined") : null;
        const mainNav = document.getElementById("main-nav");

        function setMenuOpen(open) {
            if (!menuBtn || !mobileNav) return;
            mobileNav.classList.toggle("hidden", !open);
            menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
            menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
            if (menuIcon) menuIcon.textContent = open ? "close" : "menu";
            document.body.style.overflow = open ? "hidden" : "";
        }

        if (menuBtn && mobileNav) {
            menuBtn.addEventListener("click", function () {
                setMenuOpen(mobileNav.classList.contains("hidden"));
            });

            mobileNav.querySelectorAll("a").forEach(function (link) {
                link.addEventListener("click", function () {
                    setMenuOpen(false);
                });
            });

            document.addEventListener("keydown", function (event) {
                if (event.key === "Escape") setMenuOpen(false);
            });
        }

        if (mainNav) {
            window.addEventListener("scroll", function () {
                if (window.scrollY > 50) {
                    mainNav.classList.add("header-scrolled", "shadow-sm");
                } else {
                    mainNav.classList.remove("header-scrolled", "shadow-sm");
                }
            });
        }
    });
})();
