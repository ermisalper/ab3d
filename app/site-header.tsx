"use client";

import Link from "next/link";
import { useState } from "react";

type SiteHeaderProps = {
  area: "objects" | "cappatex";
  userName?: string | null;
  cartCount?: number;
  onCartOpen?: () => void;
};

const objectLinks = [
  ["Kollektion", "/#kollektion"],
  ["3D AI Studio", "/#studio"],
  ["Creator Plans", "/#preise"],
  ["FAQ", "/#faq"],
] as const;

const cappatexLinks = [
  ["Design Studio", "/cappatex#studio"],
  ["So funktioniert es", "/cappatex#ablauf"],
  ["FAQ", "/cappatex#faq"],
] as const;

export default function SiteHeader({ area, userName, cartCount = 0, onCartOpen }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isObjects = area === "objects";
  const links = isObjects ? objectLinks : cappatexLinks;
  const accountHref = userName ? "/konto" : "/signin-with-chatgpt?return_to=%2Fkonto";

  return (
    <>
      <div className={`announcement ${isObjects ? "" : "cappatex-announcement"}`}>
        {isObjects ? (
          <><span>Swiss made</span><b>Kostenloser Versand ab CHF 80</b><span>Auf Bestellung gefertigt</span></>
        ) : (
          <><span>CAPPATEX by AB3D</span><b>Dein Motiv. Dein Produkt.</b><span>Print on Demand</span></>
        )}
      </div>
      <header className={`site-header ${isObjects ? "" : "cappatex-site-header"}`}>
        <div className="nav-shell">
          <Link className="brand" href="/#top" aria-label="AB3D Startseite"><span>AB</span><b>3D</b></Link>

          <nav className="division-nav division-nav-desktop" aria-label="AB3D Bereiche">
            <Link className={isObjects ? "active" : ""} href="/#top" aria-current={isObjects ? "page" : undefined}>
              <span className="division-mark">3D</span>
              <span className="division-copy"><b>3D Objekte</b><small>Shop & AI Studio</small></span>
            </Link>
            <Link className={!isObjects ? "active cappatex-active" : ""} href="/cappatex" aria-current={!isObjects ? "page" : undefined}>
              <span className="division-mark">POD</span>
              <span className="division-copy"><b>CAPPATEX</b><small>Kleidung gestalten</small></span>
            </Link>
          </nav>

          <span className="mobile-area-label">{isObjects ? "3D Objekte" : "CAPPATEX"}</span>

          <div className="nav-actions">
            <Link className="account-button" href={accountHref}>
              <i aria-hidden="true" /> <span>{userName ? userName.split(" ")[0] : "Anmelden"}</span>
            </Link>
            {isObjects && onCartOpen && (
              <button className="cart-button" onClick={onCartOpen} aria-label={`Warenkorb öffnen, ${cartCount} Artikel`}>
                <span className="cart-label">Warenkorb</span><b>{cartCount}</b>
              </button>
            )}
            <button
              className="header-menu-button"
              type="button"
              aria-label={menuOpen ? "Menü schließen" : "Menü öffnen"}
              aria-expanded={menuOpen}
              aria-controls="mobile-site-navigation"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <i /><i />
            </button>
          </div>
        </div>

        <div className="section-nav">
          <nav aria-label={isObjects ? "3D-Shop Navigation" : "CAPPATEX Navigation"}>
            {links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
          </nav>
          <span>{isObjects ? "Entworfen & gefertigt in Zürich" : "KI-Motiv · Print on Demand"}</span>
        </div>

        <div id="mobile-site-navigation" className={`mobile-site-navigation ${menuOpen ? "open" : ""}`}>
          <p>Bereich wählen</p>
          <nav className="division-nav" aria-label="AB3D Bereiche mobil">
            <Link className={isObjects ? "active" : ""} href="/#top" onClick={() => setMenuOpen(false)}><span className="division-mark">3D</span><span className="division-copy"><b>3D Objekte</b><small>Shop & AI Studio</small></span></Link>
            <Link className={!isObjects ? "active cappatex-active" : ""} href="/cappatex" onClick={() => setMenuOpen(false)}><span className="division-mark">POD</span><span className="division-copy"><b>CAPPATEX</b><small>Kleidung gestalten</small></span></Link>
          </nav>
          <nav className="mobile-section-links" aria-label="Seitennavigation mobil">
            {links.map(([label, href]) => <Link key={href} href={href} onClick={() => setMenuOpen(false)}>{label}<span>↗</span></Link>)}
          </nav>
          <Link className="mobile-account-link" href={accountHref} onClick={() => setMenuOpen(false)}>
            {userName ? `Konto von ${userName.split(" ")[0]}` : "Anmelden & Designs speichern"}
          </Link>
        </div>
      </header>
    </>
  );
}
