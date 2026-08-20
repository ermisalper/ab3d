"use client";

/* Shopify product images use dynamic CDN URLs. */
/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";
import { productPrice, type Product, type ProductSize } from "./products";
import { formatChf, type ProductSelection } from "./shop-types";

export function ProductPhoto({ product, color }: { product: Product; color?: string }) {
  const selectedColor = product.colors.find((entry) => entry.name === color) || product.colors[0];
  return (
    <span className="product-photo-wrap" style={{ "--selected-color": selectedColor?.value || "#d8d0c3" } as CSSProperties}>
      {product.image && <img className="product-photo" src={product.image} alt={product.imageAlt} width="800" height="800" loading="lazy" decoding="async" />}
      <span className="product-color-wash" aria-hidden="true" />
    </span>
  );
}

type ProductCollectionProps = {
  categories: string[];
  filter: string;
  products: Product[];
  selectionFor: (product: Product) => ProductSelection;
  onFilter: (category: string) => void;
  onSelect: (product: Product, patch: Partial<ProductSelection>) => void;
  onQuickView: (product: Product) => void;
  onAdd: (product: Product) => void;
};

export function ProductCollection({ categories, filter, products, selectionFor, onFilter, onSelect, onQuickView, onAdd }: ProductCollectionProps) {
  return (
    <section className="collection section" id="kollektion">
      <div className="section-heading" data-reveal>
        <div><p className="eyebrow">Die Kollektion</p><h2>Formen, die bleiben.</h2></div>
        <p>Wähle Farbe und Grösse direkt am Objekt. Jedes Stück wird erst nach deiner Bestellung produziert.</p>
      </div>
      <div className="filters" role="group" aria-label="Produkte filtern">
        {categories.map((category) => (
          <button type="button" key={category} className={filter === category ? "active" : ""} aria-pressed={filter === category} onClick={() => onFilter(category)}>
            {category}
          </button>
        ))}
      </div>
      <div className="product-grid">
        {!products.length && <div className="catalog-empty" role="status"><strong>Kollektion wird synchronisiert</strong><p>Shopify liefert momentan keine veröffentlichten Produkte für diese Kollektion.</p></div>}
        {products.map((product, index) => {
          const choice = selectionFor(product);
          return (
            <article className="product-card" key={product.id} data-reveal style={{ "--delay": `${(index % 4) * 70}ms` } as CSSProperties}>
              <button type="button" className={`product-visual tone-${index % 4}`} onClick={() => onQuickView(product)} aria-label={`${product.name} ansehen`}>
                {product.badge && <span className="badge">{product.badge}</span>}
                <ProductPhoto product={product} color={choice.color} />
                <span className="quick-label">Details ansehen</span>
              </button>
              <div className="product-info">
                <div><p>{product.category}</p><h3>{product.name}</h3></div>
                <strong>ab {formatChf.format(product.price)}</strong>
              </div>
              <p className="product-meta">{product.description}</p>
              <div className="mini-swatches" aria-label={`Farbe für ${product.name}`}>
                {product.colors.map((color) => (
                  <button type="button" key={color.name} className={choice.color === color.name ? "active" : ""} style={{ background: color.value }} onClick={() => onSelect(product, { color: color.name })} aria-label={`${color.name} wählen`} aria-pressed={choice.color === color.name} />
                ))}
              </div>
              <button type="button" className="add-button" onClick={() => onAdd(product)}>In den Warenkorb <span aria-hidden="true">+</span></button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

type QuickProductModalProps = {
  product: Product;
  selection: ProductSelection;
  onClose: () => void;
  onSelect: (patch: Partial<ProductSelection>) => void;
  onAdd: () => void;
};

export function QuickProductModal({ product, selection, onClose, onSelect, onAdd }: QuickProductModalProps) {
  return (
    <div className="quick-modal" role="dialog" aria-modal="true" aria-labelledby="quick-product-title">
      <button type="button" className="quick-close" onClick={onClose} aria-label="Schnellansicht schliessen">×</button>
      <div className="quick-art">
        <ProductPhoto product={product} color={selection.color} />
        <span>Produktansicht · Farbe direkt wählbar</span>
      </div>
      <div className="quick-copy">
        <p className="eyebrow">{product.category}</p>
        <h2 id="quick-product-title">{product.name}</h2>
        <p>{product.description}</p>
        <div className="quick-detail"><span>Fertigung <b>{product.leadTime}</b></span><span>Material <b>PLA · matt</b></span></div>
        <fieldset className="product-choice-group">
          <legend>Farbe</legend>
          <div className="color-options">
            {product.colors.map((color) => (
              <button type="button" key={color.name} className={selection.color === color.name ? "active" : ""} onClick={() => onSelect({ color: color.name })} aria-pressed={selection.color === color.name}>
                <i style={{ background: color.value }} aria-hidden="true" />{color.name}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="product-choice-group">
          <legend>Grösse</legend>
          <div className="size-options">
            {(product.sizes as ProductSize[]).map((size) => (
              <button type="button" key={size} className={selection.size === size ? "active" : ""} onClick={() => onSelect({ size })} aria-pressed={selection.size === size}>
                {size}<small>{size === "S" ? "kompakt" : size === "M" ? "standard" : size === "L" ? "gross" : "Variante"}</small>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="quick-buy"><strong>{formatChf.format(productPrice(product, selection.size, selection.color))}</strong><button type="button" className="button primary" onClick={onAdd}>In den Warenkorb</button></div>
      </div>
    </div>
  );
}
