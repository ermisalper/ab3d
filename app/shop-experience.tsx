"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AIDesignStudio from "./ai-design-studio";
import AssistantChat from "./assistant-chat";
import CartDrawer from "./shop-cart-drawer";
import { ProductCollection, QuickProductModal } from "./shop-product-ui";
import { CappatexTeaser, FaqSection, PlansSection, ShopFooter, ShopHero } from "./shop-sections";
import { defaultProductSelection, type ProductSelection } from "./shop-types";
import SiteHeader from "./site-header";
import { productPrice, productVariant, type Product } from "./products";

export default function ShopExperience({ user, products }: { user: { displayName: string; email: string } | null; products: Product[] }) {
  const [filter, setFilter] = useState("Alle");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [selections, setSelections] = useState<Record<string, ProductSelection>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [cartStep, setCartStep] = useState<"cart" | "checkout">("cart");
  const [quickProduct, setQuickProduct] = useState<Product | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => ["Alle", ...Array.from(new Set(products.map((product) => product.category)))], [products]);
  const shownProducts = filter === "Alle" ? products : products.filter((product) => product.category === filter);
  const cartCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const subtotal = useMemo(
    () => products.reduce((sum, product) => {
      const selection = selections[product.id] || defaultProductSelection(product);
      return sum + productPrice(product, selection.size, selection.color) * (cart[product.id] || 0);
    }, 0),
    [cart, selections, products],
  );
  const shipping = subtotal >= 80 || subtotal === 0 ? 0 : 9;
  const total = subtotal + shipping;

  useEffect(() => {
    void import("@google/model-viewer");
    const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -35px" });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [filter]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        update();
        frame = 0;
      });
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = cartOpen || quickProduct ? "hidden" : "";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCartOpen(false);
        setQuickProduct(null);
      }
    };
    if (cartOpen || quickProduct) window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [cartOpen, quickProduct]);

  const selectionFor = (product: Product) => selections[product.id] || defaultProductSelection(product);

  const updateSelection = (product: Product, patch: Partial<ProductSelection>) => {
    setSelections((current) => ({ ...current, [product.id]: { ...(current[product.id] || defaultProductSelection(product)), ...patch } }));
  };

  const addToCart = (product: Product) => {
    setSelections((current) => current[product.id] ? current : { ...current, [product.id]: defaultProductSelection(product) });
    setCart((current) => ({ ...current, [product.id]: (current[product.id] || 0) + 1 }));
    setQuickProduct(null);
    setCartStep("cart");
    setCartOpen(true);
  };

  const changeQuantity = (id: string, delta: number) => {
    setCart((current) => {
      const next = Math.max(0, (current[id] || 0) + delta);
      const updated = { ...current, [id]: next };
      if (!next) delete updated[id];
      return updated;
    });
  };

  const setCheckoutStep = (step: "cart" | "checkout") => {
    if (step === "checkout") {
      setCheckoutError("");
      setTermsAccepted(false);
    }
    setCartStep(step);
  };

  const startShopifyCheckout = async () => {
    if (!termsAccepted || checkoutBusy) return;
    setCheckoutBusy(true);
    setCheckoutError("");
    try {
      const items = products.filter((product) => cart[product.id]).map((product) => {
        const selection = selectionFor(product);
        return {
          productHandle: product.handle,
          variantId: productVariant(product, selection.size, selection.color)?.id,
          quantity: cart[product.id],
        };
      });
      const response = await fetch("/api/shopify/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, termsAccepted }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Der sichere Checkout konnte nicht vorbereitet werden.");
      const checkoutUrl = new URL(data.checkoutUrl);
      if (checkoutUrl.protocol !== "https:") throw new Error("Der sichere Checkout konnte nicht geöffnet werden.");
      window.location.assign(checkoutUrl.toString());
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Der sichere Checkout konnte nicht vorbereitet werden.");
      setCheckoutBusy(false);
    }
  };

  const closeOverlays = () => {
    setCartOpen(false);
    setQuickProduct(null);
  };

  return (
    <main id="main-content">
      <div className="scroll-progress" ref={progressRef} />
      <SiteHeader area="objects" userName={user?.displayName} cartCount={cartCount} onCartOpen={() => { setCartStep("cart"); setCartOpen(true); }} />
      <ShopHero productCount={products.length} />
      <ProductCollection categories={categories} filter={filter} products={shownProducts} selectionFor={selectionFor} onFilter={setFilter} onSelect={updateSelection} onQuickView={setQuickProduct} onAdd={addToCart} />
      <AIDesignStudio signedIn={Boolean(user)} />
      <CappatexTeaser />
      <PlansSection signedIn={Boolean(user)} />
      <FaqSection />
      <ShopFooter />

      <CartDrawer open={cartOpen} step={cartStep} cart={cart} products={products} subtotal={subtotal} shipping={shipping} total={total} termsAccepted={termsAccepted} checkoutBusy={checkoutBusy} checkoutError={checkoutError} selectionFor={selectionFor} onClose={() => setCartOpen(false)} onStep={setCheckoutStep} onQuantity={changeQuantity} onTerms={setTermsAccepted} onCheckout={startShopifyCheckout} />
      {quickProduct && <QuickProductModal product={quickProduct} selection={selectionFor(quickProduct)} onClose={() => setQuickProduct(null)} onSelect={(patch) => updateSelection(quickProduct, patch)} onAdd={() => addToCart(quickProduct)} />}
      {(cartOpen || quickProduct) && <button type="button" className="overlay" onClick={closeOverlays} aria-label="Dialog schliessen" />}
      <AssistantChat signedIn={Boolean(user)} />
    </main>
  );
}
