import type { DesignProfile } from "./cappatex-design-catalog";

type PhotoCalibration = {
  color: "White" | "Black";
  referenceVariant: number;
  width: number;
  height: number;
  left: number;
  top: number;
  printWidth: number;
  printHeight: number;
};

// Only measured provider-photo rectangles belong here. No guessed photo placement.
// The technical SVG's rectangle is not a calibration of the photographic mockup.
const PHOTO_CALIBRATIONS: PhotoCalibration[] = [
  { color: "White", referenceVariant: 38191, width: 1200, height: 1200,
    left: 390, top: 316, printWidth: 424, printHeight: 484 },
  { color: "Black", referenceVariant: 38192, width: 1200, height: 1200,
    left: 390, top: 315, printWidth: 424, printHeight: 487 },
];

// Printify product + provider GET, matched against the saved Shopify variants.
// Evidence: docs/CAPPATEX-FIRST-BLANK.md, refreshed 2026-10-09.
const mappedVariants = [
  ["White", "S", 38163, "58948948132214", "33603799854393951295"],
  ["White", "M", 38177, "58948948164982", "16514680811209162343"],
  ["White", "L", 38191, "58948948197750", "20561467104941246541"],
  ["White", "XL", 38205, "58948948230518", "18802167567243624716"],
  ["White", "2XL", 38219, "58948948263286", "33604710571350644314"],
  ["Black", "S", 38164, "58948948296054", "95708940648128493227"],
  ["Black", "M", 38178, "58948948328822", "54345834634857859010"],
  ["Black", "L", 38192, "58948948361590", "11413559055592218079"],
  ["Black", "XL", 38206, "58948948394358", "17364865402080621657"],
  ["Black", "2XL", 38220, "58948948427126", "77167321191872434834"],
] as const;

const variants: DesignProfile["variants"] = mappedVariants.flatMap(([color, size, printifyVariantId, shopifyId, sku]) => {
  const photo = PHOTO_CALIBRATIONS.find(item => item.color === color);
  if (!photo) return [];
  const [widthPx, heightPx] = size === "S" ? [3461, 3955] : size === "M" ? [3839, 4387] : [4200, 4800];
  return [{ printifyVariantId, shopifyVariantId: `gid://shopify/ProductVariant/${shopifyId}`, sku, color, size,
    area: { position: "front", decorationMethod: "dtg", widthPx, heightPx,
      // Derived from the provider's 300-DPI template, not separately measured garment sizes.
      widthMm: widthPx * 25.4 / 300, heightMm: heightPx * 25.4 / 300,
      minDpi: 300, minScale: .1, maxScale: 1 },
    mockup: { url: `https://images.printify.com/mockup/6ac927b73b3a3e64620a53a3/${photo.referenceVariant}/97992/cappatex-blanko-gildan-64000-opt-ondemand-pilot.jpg?camera_label=front`,
      width: photo.width, height: photo.height, left: photo.left, top: photo.top,
      printWidth: photo.printWidth, printHeight: photo.printHeight },
    shipping: ["CH", "LI"].map(country => ({ country: country as "CH" | "LI", method: 1 as const,
      currency: "USD", firstCents: 849, additionalCents: 119 })),
  }];
});

const tshirtProfiles: DesignProfile[] = variants.length ? [{
  id: "gildan-64000-opt-front", version: "2026-10-09-design-1",
  verifiedAt: "2026-10-09T19:15:00Z", validUntil: "2026-11-09T00:00:00Z",
  shopId: "23104859", printifyProductId: "6ac927b73b3a3e64620a53a3", blueprintId: 145, providerId: 30,
  shopifyProductId: "gid://shopify/Product/15925915418998", kind: "tshirt", name: "Gildan 64000 · Unisex T-Shirt",
  mockupReferenceSize: "L",
  evidence: ["docs/CAPPATEX-FIRST-BLANK.md", "docs/CAPPATEX-MOCKUP-CALIBRATION.md"], variants,
}] : [];

type AuditedVariant = readonly [color: string, size: string, printifyVariantId: number, shopifyId: string, sku: string, widthPx: number, heightPx: number];

function expansionVariants(mappings: readonly AuditedVariant[], photos: Record<string, DesignProfile["variants"][number]["mockup"]>,
  shippingCents: { first: number; additional: number }): DesignProfile["variants"] {
  return mappings.flatMap(([color, size, printifyVariantId, shopifyId, sku, widthPx, heightPx]) => {
    const mockup = photos[color];
    if (!mockup) return [];
    return [{ printifyVariantId, shopifyVariantId: `gid://shopify/ProductVariant/${shopifyId}`, sku, color, size,
      area: { position: "front", decorationMethod: "dtg", widthPx, heightPx,
        widthMm: widthPx * 25.4 / 300, heightMm: heightPx * 25.4 / 300,
        minDpi: 300, minScale: .1, maxScale: 1 }, mockup,
      shipping: ["CH", "LI"].map(country => ({ country: country as "CH" | "LI", method: 1 as const,
        currency: "USD", firstCents: shippingCents.first, additionalCents: shippingCents.additional })),
    }];
  });
}

// Product GET + provider GET + Shopify SKU links, measured reference-L photos.
// Evidence and the per-size front dimensions: docs/CAPPATEX-CATALOG-EXPANSION.md.
const hoodieVariants = expansionVariants([
  ["White", "S", 68254, "58949378408822", "79443817543322247857", 3543, 2591],
  ["White", "M", 68256, "58949378474358", "20608663527267452343", 3898, 2850],
  ["White", "L", 68258, "58949378539894", "12576155924086547144", 4200, 3071],
  ["White", "XL", 68260, "58949378605430", "79366225886983859293", 4200, 3071],
  ["White", "2XL", 68262, "58949378670966", "10034276845034413921", 4200, 3071],
  ["Black Pure", "S", 69088, "58949378441590", "98161376281522849245", 3543, 2591],
  ["Black Pure", "M", 69089, "58949378507126", "47462548419388241756", 3898, 2850],
  ["Black Pure", "L", 69090, "58949378572662", "15087323398869215439", 4200, 3071],
  ["Black Pure", "XL", 69091, "58949378638198", "17390505869233129707", 4200, 3071],
  ["Black Pure", "2XL", 69092, "58949378703734", "94475536643163851777", 4200, 3071],
], {
  White: { url: "https://images.printify.com/mockup/6ac9455655a9ebcaa50bc346/68258/8876/cappatex-blanko-bc-king-hoodie-opt-ondemand.jpg?camera_label=front",
    width: 1200, height: 1200, left: 391, top: 436, printWidth: 419, printHeight: 307 },
  "Black Pure": { url: "https://images.printify.com/mockup/6ac9455655a9ebcaa50bc346/69090/8867/cappatex-blanko-bc-king-hoodie-opt-ondemand.jpg?camera_label=front",
    width: 1200, height: 1200, left: 391, top: 436, printWidth: 419, printHeight: 308 },
}, { first: 1089, additional: 239 });

const tanktopVariants = expansionVariants([
  ["White", "S", 24830, "58949386830198", "19746673615853889641", 2362, 2908],
  ["White", "M", 24829, "58949386895734", "28550720649768312977", 2717, 3344],
  ["White", "L", 24828, "58949386928502", "20495463372002808285", 3071, 3780],
  ["White", "XL", 24831, "58949386961270", "18864056977205457455", 3071, 3780],
  ["White", "2XL", 24833, "58949386994038", "26864856465071405094", 3071, 3780],
  ["Black", "S", 24641, "58949386797430", "33114593541059620971", 2362, 2908],
  ["Black", "M", 24640, "58949386862966", "22615528761464870906", 2717, 3344],
], {
  White: { url: "https://images.printify.com/mockup/6ac948494e4b21bea10a38d4/24828/101889/cappatex-blanko-bellacanvas-3480-tanktop-textildruck-europa.jpg?camera_label=front",
    width: 1200, height: 1200, left: 448, top: 430, printWidth: 306, printHeight: 374 },
  Black: { url: "https://images.printify.com/mockup/6ac948494e4b21bea10a38d4/24639/101889/cappatex-blanko-bellacanvas-3480-tanktop-textildruck-europa.jpg?camera_label=front",
    width: 1200, height: 1200, left: 448, top: 430, printWidth: 306, printHeight: 376 },
}, { first: 729, additional: 199 });

// This registry grants private design access only; no checkout or fulfillment access.
export const CAPPATEX_DESIGN_PROFILES: DesignProfile[] = [...tshirtProfiles, {
  id: "bc-king-hoodie-opt-front", version: "2026-10-09-design-1",
  verifiedAt: "2026-10-09T19:59:00Z", validUntil: "2026-11-09T00:00:00Z",
  shopId: "23104859", printifyProductId: "6ac9455655a9ebcaa50bc346", blueprintId: 517, providerId: 30,
  shopifyProductId: "gid://shopify/Product/15926043509110", kind: "hoodie", name: "B&C King · Unisex Hoodie",
  mockupReferenceSize: "L", evidence: ["docs/CAPPATEX-CATALOG-EXPANSION.md"], variants: hoodieVariants,
}, {
  id: "bella-3480-tde-front", version: "2026-10-10-design-1",
  verifiedAt: "2026-10-10T15:02:00Z", validUntil: "2026-11-09T00:00:00Z",
  shopId: "23104859", printifyProductId: "6ac948494e4b21bea10a38d4", blueprintId: 39, providerId: 26,
  shopifyProductId: "gid://shopify/Product/15926045540726", kind: "tanktop", name: "Bella+Canvas 3480 · Unisex Tanktop",
  mockupReferenceSize: "L", evidence: ["docs/CAPPATEX-CATALOG-EXPANSION.md", "docs/CAPPATEX-MOCKUP-CALIBRATION.md"], variants: tanktopVariants,
}];
