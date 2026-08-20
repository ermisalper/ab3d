"use client";

import Link from "next/link";
import { productPrice, type Product } from "./products";
import { ProductPhoto } from "./shop-product-ui";
import { formatChf, type ProductSelection } from "./shop-types";

type CartDrawerProps = {
  open: boolean;
  step: "cart" | "checkout";
  cart: Record<string, number>;
  products: Product[];
  subtotal: number;
  shipping: number;
  total: number;
  termsAccepted: boolean;
  checkoutBusy: boolean;
  checkoutError: string;
  selectionFor: (product: Product) => ProductSelection;
  onClose: () => void;
  onStep: (step: "cart" | "checkout") => void;
  onQuantity: (id: string, delta: number) => void;
  onTerms: (accepted: boolean) => void;
  onCheckout: () => void;
};

export default function CartDrawer({ open, step, cart, products, subtotal, shipping, total, termsAccepted, checkoutBusy, checkoutError, selectionFor, onClose, onStep, onQuantity, onTerms, onCheckout }: CartDrawerProps) {
  const cartProducts = products.filter((product) => cart[product.id]);
  const count = cartProducts.reduce((sum, product) => sum + cart[product.id], 0);
  const freeShippingProgress = Math.min(100, subtotal / 80 * 100);

  return (
    <aside className={`cart-drawer ${open ? "open" : ""}`} aria-hidden={!open} inert={!open} role={open ? "dialog" : undefined} aria-modal={open || undefined} aria-labelledby="cart-title">
      <div className="cart-head"><div><small>{step === "checkout" ? "Sicher bezahlen" : "Deine Auswahl"}</small><h2 id="cart-title">{step === "checkout" ? "Checkout" : "Warenkorb"}</h2></div><button type="button" onClick={onClose} aria-label="Warenkorb schliessen">×</button></div>
      {step === "checkout" ? (
        <div className="checkout-form">
          <button type="button" className="checkout-back" onClick={() => onStep("cart")}>← Zurück zum Warenkorb</button>
          <div className="checkout-trust"><span>✓ Sicherer Shopify-Checkout</span><span>✓ Keine Kontopflicht bei AB3D</span></div>
          <div className="checkout-review">
            {cartProducts.map((product) => {
              const choice = selectionFor(product);
              return <div key={product.id}><span>{cart[product.id]}× {product.name}<small>{choice.size} · {choice.color}</small></span><b>{formatChf.format(productPrice(product, choice.size, choice.color) * cart[product.id])}</b></div>;
            })}
          </div>
          <div className="checkout-total"><span>Warenwert inkl. Versandrichtwert</span><b>{formatChf.format(total)}</b></div>
          <label className="legal-consent"><input type="checkbox" required checked={termsAccepted} onChange={(event) => onTerms(event.target.checked)} /><span>Ich akzeptiere die <Link href="/recht/agb" target="_blank">AGB</Link> und habe die <Link href="/recht/datenschutz" target="_blank">Datenschutzerklärung</Link> gelesen.</span></label>
          {checkoutError && <div className="ai-error" role="alert">{checkoutError}</div>}
          <button type="button" className="button primary full" onClick={onCheckout} disabled={checkoutBusy || !termsAccepted}>{checkoutBusy ? "Checkout wird vorbereitet …" : "Zahlung bei Shopify öffnen →"}</button>
          <small className="checkout-note">Nur dieser Klick öffnet das geschützte Zahlungsfenster von Shopify. Adresse, definitive Versandkosten und Zahlungsmethode werden dort sicher erfasst; deine Produktauswahl bleibt mit AB3D verknüpft.</small>
        </div>
      ) : !count ? (
        <div className="empty-cart"><span aria-hidden="true">◯</span><p>Dein Warenkorb ist noch leer.</p><button type="button" onClick={onClose}>Kollektion ansehen</button></div>
      ) : (
        <>
          <div className="shipping-progress"><div><span>{subtotal >= 80 ? "Kostenloser Versand freigeschaltet" : `Noch ${formatChf.format(80 - subtotal)} bis kostenloser Versand`}</span><b>{freeShippingProgress.toFixed(0)}%</b></div><i><b style={{ width: `${freeShippingProgress}%` }} /></i></div>
          <div className="cart-items">
            {cartProducts.map((product) => {
              const choice = selectionFor(product);
              return (
                <div className="cart-item" key={product.id}>
                  <div className="cart-thumb"><ProductPhoto product={product} color={choice.color} /></div>
                  <div><strong>{product.name}</strong><small>{choice.size} · {choice.color} · {formatChf.format(productPrice(product, choice.size, choice.color))}</small><div className="quantity"><button type="button" onClick={() => onQuantity(product.id, -1)} aria-label={`${product.name} Menge verringern`}>−</button><span>{cart[product.id]}</span><button type="button" onClick={() => onQuantity(product.id, 1)} aria-label={`${product.name} Menge erhöhen`}>+</button></div></div>
                </div>
              );
            })}
          </div>
          <div className="cart-summary"><span>Zwischensumme <b>{formatChf.format(subtotal)}</b></span><span>Versand <b>{shipping ? formatChf.format(shipping) : "Kostenlos"}</b></span><strong>Richtwert <b>{formatChf.format(total)}</b></strong></div>
          <button type="button" className="button primary full" onClick={() => onStep("checkout")}>Sicher zum Checkout</button>
          <p className="cart-note">Du bleibst bis zum Bezahlen bei AB3D. Adresse und Zahlung folgen sicher im Shopify-Checkout.</p>
        </>
      )}
    </aside>
  );
}
