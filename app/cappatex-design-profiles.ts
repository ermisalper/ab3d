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

// This registry grants design access only; it never grants checkout or fulfillment access.
export const CAPPATEX_DESIGN_PROFILES: DesignProfile[] = variants.length ? [{
  id: "gildan-64000-opt-front", version: "2026-10-09-design-1",
  verifiedAt: "2026-10-09T19:15:00Z", validUntil: "2026-11-09T00:00:00Z",
  shopId: "23104859", printifyProductId: "6ac927b73b3a3e64620a53a3", blueprintId: 145, providerId: 30,
  shopifyProductId: "gid://shopify/Product/15925915418998", kind: "tshirt", name: "Gildan 64000 · Unisex T-Shirt",
  mockupReferenceSize: "L",
  evidence: ["docs/CAPPATEX-FIRST-BLANK.md", "docs/CAPPATEX-MOCKUP-CALIBRATION.md"], variants,
}] : [];
