import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("production build contains the Sites worker and hosting manifest", async () => {
  await Promise.all([
    access(new URL("dist/server/index.js", root)),
    access(new URL(".openai/hosting.json", root)),
  ]);

  const hosting = JSON.parse(await read(".openai/hosting.json"));
  assert.equal(hosting.project_id, "appgprj_6a69247390f08191811183b6a04bae94");

  const pnpmPolicy = await read("pnpm-workspace.yaml");
  assert.doesNotMatch(pnpmPolicy, /set this to true or false/);
  assert.match(pnpmPolicy, /workerd: true/);
});

test("Meshy route keeps secrets server-side and exposes the print pipeline", async () => {
  const route = await read("app/api/meshy/route.ts");

  assert.match(route, /process\.env\.MESHY_API_KEY/);
  assert.match(route, /searchParams\.get\("health"\)/);
  assert.match(route, /\/v1\/balance/);
  assert.doesNotMatch(route, /msy_[A-Za-z0-9]{12,}/);
  assert.match(route, /\/v1\/resize/);
  assert.match(route, /\/v1\/print\/analyze/);
  assert.match(route, /\/v1\/print\/repair/);
  assert.match(route, /\/v1\/convert/);
  assert.match(route, /assets\.meshy\.ai/);
  assert.match(route, /Content-Disposition/);
  assert.match(route, /getOwnedTask/);
});

test("studio provides a rotatable viewer and downloadable production formats", async () => {
  const [studio, viewer, css, creationImages] = await Promise.all([
    read("app/ai-design-studio.tsx"),
    read("app/model-viewer.tsx"),
    read("app/globals.css"),
    readdir(new URL("public/creations/", root)),
  ]);

  assert.match(viewer, /<model-viewer/);
  assert.doesNotMatch(studio, /Powered by Meshy|Was soll Meshy|Meshy baut|Meshy-Datei/);
  assert.match(viewer, /camera-controls/);
  assert.match(viewer, /auto-rotate/);
  assert.match(viewer, /Vollbild/);
  assert.match(studio, /Druckpaket f\u00fcr/);
  assert.match(studio, /STL \u00b7/);
  assert.match(studio, /3MF \u00b7/);
  assert.match(studio, /download/);
  assert.match(studio, /STL selbst laden · Abo wählen/);
  assert.match(studio, /createProductionOrder/);
  assert.match(studio, /Chibi-Figur/);
  assert.match(studio, /Vinyl-Figur/);
  assert.match(studio, /Brick-Figur/);
  assert.match(studio, /3D-Schl\u00fcsselanh\u00e4nger/);
  assert.match(studio, /Individuelle Keycap/);
  assert.match(studio, /Einklapp-Fidget/);
  assert.match(studio, /Tabletop-Terrain/);
  assert.match(studio, /selectedTemplate\.printRule/);
  assert.match(studio, /min=\{selectedTemplate\.minHeight\}/);
  assert.match(studio, /setGenerationMode\(template\.mode === "image" \? "quality" : "fast"\)/);
  assert.match(css, /\/\* AB3D PRODUCT CREATOR CATALOG \*\//);
  assert.match(css, /\.creation-grid\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /\.ai-output-panel\{grid-template-columns:minmax\(0,1fr\);min-width:0;overflow:hidden\}/);
  assert.match(css, /\.model-viewer-shell model-viewer\{cursor:grab\}/);
  assert.equal(creationImages.length, 16);
  assert.ok(creationImages.every((file) => file.endsWith(".webp")));
});

test("text-to-3D is gated by a functional product plan", async () => {
  const [studio, planner, agentRoute, meshyRoute, css] = await Promise.all([
    read("app/ai-design-studio.tsx"),
    read("app/design-planner.ts"),
    read("app/api/design-agent/route.ts"),
    read("app/api/meshy/route.ts"),
    read("app/globals.css"),
  ]);

  assert.match(studio, /Idee mit KI planen/);
  assert.match(studio, /id: "free-design"/);
  assert.match(studio, /Eigene Idee beschreiben/);
  assert.match(studio, /advanceDesignPlanner/);
  assert.match(studio, /selectedOption\.label.*bestätigen/);
  assert.doesNotMatch(studio, /finishDesignPlanner/);
  assert.match(studio, /Diesen Aufbau verwenden/);
  assert.match(studio, /!designPlan\?\.complete \|\| !plannerApproved/);
  assert.match(planner, /Klassische Mondkugel/);
  assert.match(planner, /Mit LED-Beleuchtung/);
  assert.match(planner, /id: "product_purpose"/);
  assert.match(planner, /getFreeDesignQuestions/);
  assert.match(planner, /freeContainerBlueprint/);
  assert.match(planner, /Lampe & Lichtobjekt/);
  assert.match(planner, /Aufbewahrung & Halter/);
  assert.match(planner, /Hohle, lichtdurchlässige Leuchtschale/);
  assert.match(planner, /keine gedruckte Netzspannungsfassung/);
  assert.match(planner, /buildServerMeshPrompt/);
  assert.match(agentRoute, /OPENAI_DESIGN_AGENT_MODEL/);
  assert.match(agentRoute, /json_schema/);
  assert.doesNotMatch(agentRoute, /sk-[A-Za-z0-9_-]{12,}/);
  assert.match(meshyRoute, /ab3d-print-plan-v2/);
  assert.match(meshyRoute, /buildDesignPlan/);
  assert.match(meshyRoute, /Bitte schliesse zuerst den AB3D Produktplaner ab/);
  assert.match(css, /AB3D functional product planner/);
  assert.match(css, /--lime:#c8ef63/);
  assert.match(css, /agent-choice-confirmation/);
  assert.match(studio, /Nicht drucken · separat einsetzen/);
  assert.match(studio, /Montage in dieser Reihenfolge/);
  assert.match(planner, /Exactly 3 separate watertight print solids/);
  assert.match(planner, /NEVER include cable, LED/);
  assert.match(planner, /USB-Kabel und passendes Niedervolt-Netzteil/);
  assert.match(planner, /strategy: "print-in-place"/);
  assert.match(planner, /slice\(0, 600\)/);
});

test("creator plans separate physical fulfillment from subscriber file exports", async () => {
  const [plans, accountRoute, productionRoute, meshyRoute, dashboard, schema, migration] = await Promise.all([
    read("app/creator-plans.ts"),
    read("app/api/account/route.ts"),
    read("app/api/production-orders/route.ts"),
    read("app/api/meshy/route.ts"),
    read("app/konto/account-dashboard.tsx"),
    read("db/schema.ts"),
    read("drizzle/0003_majestic_scarecrow.sql"),
  ]);

  assert.match(plans, /id: "3d-studio"/);
  assert.match(plans, /id: "cappatex"/);
  assert.match(plans, /id: "complete"/);
  assert.match(plans, /STL-, 3MF- und GLB-Download/);
  assert.match(plans, /Gemeinsames Token-Guthaben/);
  assert.match(accountRoute, /"3d-studio", "cappatex", "complete"/);
  assert.match(productionRoute, /awaiting_payment/);
  assert.match(productionRoute, /Zahlung bestätigt/);
  assert.match(productionRoute, /Nur AB3D darf den Produktionsstatus ändern/);
  assert.match(meshyRoute, /productionOrderId/);
  assert.match(meshyRoute, /3D-Studio- oder Complete-Abo/);
  assert.match(meshyRoute, /\["paid", "production", "shipped"\]/);
  assert.match(dashboard, /Was kostet wie viele Tokens/);
  assert.match(dashboard, /STL herunterladen/);
  assert.match(schema, /productionOrders/);
  assert.match(migration, /CREATE TABLE `production_orders`/);
});

test("storefront separates both studios and serves Shopify product imagery", async () => {
  const [shop, productUi, cappatex, siteHeader, catalog] = await Promise.all([
    read("app/shop-experience.tsx"),
    read("app/shop-product-ui.tsx"),
    read("app/cappatex/cappatex-studio.tsx"),
    read("app/site-header.tsx"),
    read("app/shopify-catalog.ts"),
  ]);

  assert.match(shop, /<SiteHeader/);
  assert.match(cappatex, /<SiteHeader area="cappatex"/);
  assert.match(siteHeader, /className="division-nav division-nav-desktop"/);
  assert.match(siteHeader, /3D Objekte/);
  assert.match(siteHeader, /CAPPATEX/);
  assert.match(siteHeader, /mobile-site-navigation/);
  assert.doesNotMatch(shop, /className="marquee"/);
  assert.doesNotMatch(shop, /className="craft-section/);
  assert.doesNotMatch(shop, /className="social-proof/);
  assert.doesNotMatch(shop, /className="newsletter/);
  assert.doesNotMatch(shop, /href="#impressum"/);
  assert.match(catalog, /collection\(handle: \$handle\)/);
  assert.match(catalog, /featuredImage \{ url altText \}/);
  assert.match(productUi, /product\.image/);
  assert.match(productUi, /alt=\{product\.imageAlt\}/);
});

test("hero uses a real interactive local 3D product instead of CSS geometry", async () => {
  const [hero, css, model] = await Promise.all([
    read("app/shop-sections.tsx"),
    read("app/globals.css"),
    readFile(new URL("public/models/ab3d-ribbed-vase.glb", root)),
  ]);

  assert.match(hero, /<model-viewer src="\/models\/ab3d-ribbed-vase\.glb"/);
  assert.match(hero, /camera-controls/);
  assert.match(hero, /Drehen &amp; zoomen/);
  assert.doesNotMatch(hero, /className="hero-vase"/);
  assert.match(css, /\.hero-model-wrap model-viewer/);
  assert.equal(model.subarray(0, 4).toString("ascii"), "glTF");
  assert.ok(model.length > 500_000 && model.length < 1_500_000);
});

test("CAPPATEX hero behaves like an accessible interactive print press", async () => {
  const [studio, css] = await Promise.all([
    read("app/cappatex/cappatex-studio.tsx"),
    read("app/globals.css"),
  ]);

  assert.match(studio, /const heroPrints = \[/);
  assert.match(studio, /pressNextHeroDesign/);
  assert.match(studio, /T-Shirt bedrucken\. Aktuelles Motiv:/);
  assert.match(studio, /Klicken & neu bedrucken/);
  assert.match(studio, /onAnimationEnd/);
  assert.match(css, /@keyframes cappatexPressHead/);
  assert.match(css, /@keyframes cappatexPrintSet/);
  assert.match(css, /\.cappatex-hero-shirt-real/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\).*\.cappatex-press-scene\.is-pressing/s);
});

test("route-aware brand intro prints AB3D and CAPPATEX with reduced-motion support", async () => {
  const [intro, css] = await Promise.all([
    read("app/brand-intro.tsx"),
    read("app/globals.css"),
  ]);

  assert.match(intro, /usePathname/);
  assert.match(intro, /pathname\.startsWith\("\/cappatex"\)/);
  assert.match(intro, /CAPPATEX/);
  assert.match(intro, /Idee wird Schicht für Schicht Form/);
  assert.match(css, /@keyframes printerHeadPass/);
  assert.match(css, /@keyframes textileHeadPass/);
  assert.match(css, /@keyframes printedBrandReveal/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)[\s\S]*?\.brand-intro\{display:none\}/);
});

test("CAPPATEX uses guarded OpenAI generation and verified Shopify to Printify fulfillment", async () => {
  const [generator, catalog, checkout, webhook, studio, envExample] = await Promise.all([
    read("app/api/cappatex/route.ts"),
    read("app/api/cappatex/catalog/route.ts"),
    read("app/api/cappatex/checkout/route.ts"),
    read("app/api/cappatex/webhooks/shopify/route.ts"),
    read("app/cappatex/cappatex-studio.tsx"),
    read(".env.example"),
  ]);

  assert.match(generator, /https:\/\/api\.openai\.com\/v1\/images\/generations/);
  assert.match(generator, /model: "gpt-image-2"/);
  assert.match(generator, /quality: "low"/);
  assert.match(generator, /output_format: "webp"/);
  assert.match(generator, /CAPPATEX_GENERATION_ENABLED/);
  assert.match(generator, /moderation_blocked/);
  assert.match(generator, /moderation_stage/);
  assert.doesNotMatch(generator, /icy-cell|CAPPATEX_WORKER_URL/);
  assert.doesNotMatch(generator, /sk-[A-Za-z0-9_-]{12,}/);

  assert.match(catalog, /api\.printify\.com\/v1\/shops/);
  assert.match(catalog, /fetchShopifyCollection\(SHOPIFY_COLLECTIONS\.cappatex\)/);
  assert.match(checkout, /cartCreate/);
  assert.match(checkout, /catalog_mismatch/);
  assert.match(checkout, /CAPPATEX_DESIGN_ID/);
  assert.match(webhook, /crypto\.subtle\.verify/);
  assert.match(webhook, /x-shopify-hmac-sha256/);
  assert.match(webhook, /orders\/paid/);
  assert.match(webhook, /v1\/images\/edits/);
  assert.match(webhook, /quality", "high"/);
  assert.match(webhook, /uploads\/images\.json/);
  assert.match(webhook, /send_to_production\.json/);
  assert.match(webhook, /CAPPATEX_AUTO_PRODUCTION_ENABLED/);

  assert.match(studio, /\/api\/cappatex\/catalog/);
  assert.match(studio, /\/api\/cappatex\/checkout/);
  assert.match(studio, /Zahlung sicher öffnen/);
  assert.doesNotMatch(studio, /Powered by Meshy|Was soll Meshy/);
  assert.doesNotMatch(studio, /demoProducts|source: "demo"|Produktbeispiele/);
  assert.match(studio, /keine erfundenen Produkte oder Preise/);
  assert.match(envExample, /CAPPATEX_GENERATION_ENABLED=false/);
  assert.match(envExample, /CAPPATEX_FULFILLMENT_ENABLED=false/);
  assert.match(envExample, /CAPPATEX_AUTO_PRODUCTION_ENABLED=false/);
});

test("legal launch phase is visible and both checkout flows require versioned consent", async () => {
  const [shop, cartDrawer, cappatex, orderRoute, cappatexCheckout, legalVersion, privacy, terms, shipping, safety, sitemap] = await Promise.all([
    read("app/shop-experience.tsx"),
    read("app/shop-cart-drawer.tsx"),
    read("app/cappatex/cappatex-studio.tsx"),
    read("app/api/shopify/checkout/route.ts"),
    read("app/api/cappatex/checkout/route.ts"),
    read("app/legal-version.ts"),
    read("app/recht/datenschutz/page.tsx"),
    read("app/recht/agb/page.tsx"),
    read("app/recht/versand-rueckgabe/page.tsx"),
    read("app/recht/ki-produktsicherheit/page.tsx"),
    read("app/sitemap.ts"),
  ]);

  assert.match(cartDrawer, /Zahlung bei Shopify öffnen/);
  assert.doesNotMatch(cartDrawer, /Bestellanfrage verbindlich senden/);
  assert.match(shop, /termsAccepted/);
  assert.match(cartDrawer, /\/recht\/agb/);
  assert.match(cappatex, /termsAccepted/);
  assert.match(cappatex, /Zahlung sicher öffnen/);
  assert.match(orderRoute, /body\?\.termsAccepted !== true/);
  assert.match(orderRoute, /LEGAL_TERMS_VERSION/);
  assert.match(cappatexCheckout, /terms_required/);
  assert.match(cappatexCheckout, /legalConsent: \{ acceptedAt, version: LEGAL_VERSION \}/);
  assert.match(legalVersion, /2026-08-19/);
  assert.match(privacy, /Datenschutzerklärung/);
  assert.match(terms, /sichere Shopify-Checkout/);
  assert.match(shipping, /kein allgemeines gesetzliches Widerrufsrecht/);
  assert.match(safety, /Mehrteilige Produkte/);
  assert.match(sitemap, /recht\/impressum/);
});

test("AB3D remains the storefront while Shopify handles payment checkout", async () => {
  const [shop, cartDrawer, checkout, products, cappatexCatalog, cappatexCheckout, envExample] = await Promise.all([
    read("app/shop-experience.tsx"),
    read("app/shop-cart-drawer.tsx"),
    read("app/api/shopify/checkout/route.ts"),
    read("app/products.ts"),
    read("app/api/cappatex/catalog/route.ts"),
    read("app/api/cappatex/checkout/route.ts"),
    read(".env.example"),
  ]);

  assert.match(shop, /fetch\("\/api\/shopify\/checkout"/);
  assert.match(cartDrawer, /Du bleibst bis zum Bezahlen bei AB3D/);
  assert.doesNotMatch(shop, /fetch\("\/api\/orders"/);
  assert.match(checkout, /cartCreate/);
  assert.match(checkout, /LEGAL_TERMS_VERSION/);
  assert.match(checkout, /AB3D_COLOR/);
  assert.match(checkout, /variant_unavailable/);
  assert.match(checkout, /checkoutUrl\.protocol !== "https:"/);
  assert.match(checkout, /checkoutUrl\.hostname\.toLowerCase\(\) !== domain/);
  assert.match(checkout, /AB3D_CHECKOUT_SESSION/);
  assert.match(checkout, /INSERT INTO checkout_sessions/);
  assert.match(products, /productVariant/);
  assert.match(products, /ShopifyCatalogProduct/);
  assert.match(checkout, /fetchShopifyCollection\(SHOPIFY_COLLECTIONS\.ab3d\)/);
  assert.doesNotMatch(cappatexCatalog, /!printifyToken \|\| !printifyShopId \|\| !storefrontToken/);
  assert.doesNotMatch(cappatexCheckout, /!printifyToken \|\| !printifyShopId \|\| !storefrontToken/);
  assert.match(envExample, /website remains the visible storefront/);
});

test("Shopify checkout and paid-order customer data are persisted safely", async () => {
  const [schema, migration, checkout, commerce, webhook, orders] = await Promise.all([
    read("db/schema.ts"),
    read("drizzle/0004_chemical_hemingway.sql"),
    read("app/api/shopify/checkout/route.ts"),
    read("db/commerce.ts"),
    read("app/api/cappatex/webhooks/shopify/route.ts"),
    read("app/api/orders/route.ts"),
  ]);

  assert.match(schema, /checkoutSessions/);
  assert.match(schema, /shopifyOrders/);
  assert.match(migration, /CREATE TABLE `checkout_sessions`/);
  assert.match(migration, /CREATE TABLE `shopify_orders`/);
  assert.match(checkout, /buyerIdentity/);
  assert.match(checkout, /INSERT INTO checkout_sessions/);
  assert.match(commerce, /recordPaidShopifyOrder/);
  assert.match(commerce, /incomplete_shipping_address/);
  assert.match(commerce, /INSERT INTO shopify_orders/);
  assert.match(webhook, /await recordPaidShopifyOrder\(order\)/);
  assert.match(orders, /FROM shopify_orders WHERE customer_email/);
});
