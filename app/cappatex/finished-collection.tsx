/* eslint-disable @next/next/no-img-element */
import type { ShopifyCatalogProduct } from "../shopify-catalog";

export default function FinishedCollection({ products, storeDomain }: { products: ShopifyCatalogProduct[]; storeDomain: string }) {
  return <section className="collection section" id="kollektion">
    <div className="section-heading"><div><p className="eyebrow">Fertige Motive</p><h2>Die CAPPATEX Kollektion.</h2></div>
      <p>Unsere bestehenden Designs – direkt als fertigen Artikel auswählen.</p></div>
    <div className="product-grid">{products.map(product => <article className="product-card" key={product.id}>
      <a className="product-visual" href={`https://${storeDomain}/products/${encodeURIComponent(product.handle)}`}>
        {product.image && <img className="product-photo" src={product.image} alt={product.imageAlt} loading="lazy" width="800" height="800" />}
      </a>
      <div className="product-info"><div><p>{product.category}</p><h3>{product.name}</h3></div>
        <strong>{new Intl.NumberFormat("de-CH", { style: "currency", currency: product.currency }).format(product.price)}</strong></div>
      <p className="product-meta">{product.description.length > 160 ? `${product.description.slice(0, 157).replace(/\s+\S*$/, "")}…` : product.description}</p>
      <a className="add-button" href={`https://${storeDomain}/products/${encodeURIComponent(product.handle)}`}>Artikel bei Shopify ansehen →</a>
    </article>)}</div>
    {!products.length && <p role="status">Die fertige Kollektion ist gerade nicht erreichbar.</p>}
  </section>;
}
