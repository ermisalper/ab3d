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

const pulloverVariants = expansionVariants([
  ["Black","XS",63714,"58954577117558","32678872341066129788",3366,4230],
  ["White","XS",63717,"58954577150326","21330026037772914430",3366,4230],
  ["Black","S",63719,"58954577183094","62750618291080586982",3780,4749],
  ["White","S",63722,"58954577215862","25449384969924700261",3780,4749],
  ["Black","M",63724,"58954577248630","95880420421167395577",4193,5268],
  ["White","M",63727,"58954577281398","24353776547763930379",4193,5268],
  ["Black","L",63729,"58954577314166","17274892019395195918",4606,5787],
  ["White","L",63732,"58954577346934","15620322811627210052",4606,5787],
  ["Black","XL",63734,"58954577379702","43773110261645666736",4606,5787],
  ["White","XL",63737,"58954577412470","88081754547045227028",4606,5787],
  ["White","2XL",63742,"58954577445238","22674604911372817753",4606,5787],
  ["Black","3XL",63744,"58954577478006","15638368416559766960",4606,5787],
  ["White","3XL",63747,"58954577510774","32388819339877992522",4606,5787],
  ["Black","4XL",63749,"58954577543542","49285417354779670938",4606,5787],
  ["White","4XL",63752,"58954577576310","15795834611143535959",4606,5787],
], {
  "White": {
    "url": "https://images.printify.com/mockup/6aca555903e91232940b49e4/63732/5081/cappatex-blanko-bc-wui23-pullover-textildruck-europa.jpg?camera_label=front",
    "width": 1200,
    "height": 1200,
    "left": 387,
    "top": 353,
    "printWidth": 429,
    "printHeight": 538
  },
  "Black": {
    "url": "https://images.printify.com/mockup/6aca555903e91232940b49e4/63729/5078/cappatex-blanko-bc-wui23-pullover-textildruck-europa.jpg?camera_label=front",
    "width": 1200,
    "height": 1200,
    "left": 387,
    "top": 352,
    "printWidth": 429,
    "printHeight": 538
  }
}, { first: 1089, additional: 239 });

const longsleeveVariants = expansionVariants([
  ["White","S",33791,"58954602676598","10966533159593605708",3461,3955],
  ["White","M",33792,"58954602742134","29415264002795040152",3839,4387],
  ["White","L",33793,"58954602807670","30327933967500366128",4200,4800],
  ["White","XL",33794,"58954602873206","14062220185393388474",4200,4800],
  ["White","2XL",33795,"58954602938742","13386688221712842581",4200,4800],
  ["Black","S",33796,"58954602709366","53195723560638243391",3461,3955],
  ["Black","M",33797,"58954602774902","31423304680849399144",3839,4387],
  ["Black","L",33798,"58954602840438","16490252266190400769",4200,4800],
  ["Black","XL",33799,"58954602905974","23511004661059502159",4200,4800],
  ["Black","2XL",33800,"58954602971510","32719392498732429126",4200,4800],
  ["White","3XL",64722,"58954603004278","20866819771864043377",4200,4800],
  ["Black","3XL",64723,"58954603037046","25867235486070762761",4200,4800],
  ["Black","4XL",77147,"58954603069814","21783118743071385653",4200,4800],
  ["Black","5XL",77171,"58954603102582","57613983606352375621",4200,4800],
], {
  "White": {
    "url": "https://images.printify.com/mockup/6aca580a7e00a6f93b0445b0/33793/105264/cappatex-blanko-gildan-2400-langarmshirt-opt-ondemand.jpg?camera_label=front",
    "width": 1200,
    "height": 1200,
    "left": 440,
    "top": 357,
    "printWidth": 322,
    "printHeight": 368
  },
  "Black": {
    "url": "https://images.printify.com/mockup/6aca580a7e00a6f93b0445b0/33798/105264/cappatex-blanko-gildan-2400-langarmshirt-opt-ondemand.jpg?camera_label=front",
    "width": 1200,
    "height": 1200,
    "left": 437,
    "top": 355,
    "printWidth": 326,
    "printHeight": 372
  }
}, { first: 849, additional: 119 });

const posterVariants: DesignProfile["variants"] = [
  { printifyVariantId: 62338, shopifyVariantId: "gid://shopify/ProductVariant/58954622206326", sku: "22943121005929413080",
    color: "Glossy", size: "11.7\" x 16.5\"",
    area: {"position":"front","decorationMethod":"digital-printing","widthPx":3510,"heightPx":4950,"widthMm":297.18,"heightMm":419.1,"minDpi":300,"minScale":0.1,"maxScale":1},
    mockup: { url: "https://images.printify.com/mockup/6aca585903e91232940b4de3/62338/105533/cappatex-blanko-poster-hochformat-eu-opt-ondemand.jpg?camera_label=front", width: 1200, height: 1200, left: 251, top: 107, printWidth: 698, printHeight: 985,
      foreground: [[[359,105],[340,106],[339,107],[340,108],[340,116],[341,117],[341,132],[390,132],[391,131],[391,122],[390,121],[390,108],[391,107],[390,106],[374,105]],[[826,105],[810,106],[809,107],[810,108],[810,128],[809,129],[809,131],[810,132],[859,132],[859,120],[860,119],[860,108],[861,107],[860,106],[841,105]]] },
    shipping: [{"country":"CH","method":1,"currency":"USD","firstCents":849,"additionalCents":199},{"country":"LI","method":1,"currency":"USD","firstCents":849,"additionalCents":199}],
  },
  { printifyVariantId: 62339, shopifyVariantId: "gid://shopify/ProductVariant/58954622239094", sku: "33631565641566729113",
    color: "Matte", size: "11.7\" x 16.5\"",
    area: {"position":"front","decorationMethod":"digital-printing","widthPx":3510,"heightPx":4950,"widthMm":297.18,"heightMm":419.1,"minDpi":300,"minScale":0.1,"maxScale":1},
    mockup: { url: "https://images.printify.com/mockup/6aca585903e91232940b4de3/62339/105534/cappatex-blanko-poster-hochformat-eu-opt-ondemand.jpg?camera_label=front", width: 1200, height: 1200, left: 251, top: 107, printWidth: 698, printHeight: 985,
      foreground: [[[359,105],[340,106],[339,107],[340,108],[340,117],[341,118],[341,132],[391,132],[391,119],[390,118],[390,108],[391,107],[390,106],[374,105]],[[826,105],[810,106],[809,107],[810,108],[810,128],[809,129],[809,131],[810,132],[859,132],[859,118],[860,117],[860,106],[841,105]]] },
    shipping: [{"country":"CH","method":1,"currency":"USD","firstCents":849,"additionalCents":199},{"country":"LI","method":1,"currency":"USD","firstCents":849,"additionalCents":199}],
  },
  { printifyVariantId: 62354, shopifyVariantId: "gid://shopify/ProductVariant/58954622140790", sku: "10308888179880755219",
    color: "Glossy", size: "8.3\" x 11.7\"",
    area: {"position":"front","decorationMethod":"digital-printing","widthPx":2490,"heightPx":3510,"widthMm":210.82,"heightMm":297.18,"minDpi":300,"minScale":0.1,"maxScale":1},
    mockup: { url: "https://images.printify.com/mockup/6aca585903e91232940b4de3/62354/105529/cappatex-blanko-poster-hochformat-eu-opt-ondemand.jpg?camera_label=front", width: 1200, height: 1200, left: 251, top: 107, printWidth: 698, printHeight: 985,
      foreground: [[[328,105],[328,108],[329,109],[329,123],[330,124],[330,142],[331,143],[399,143],[400,142],[400,116],[399,115],[399,109],[400,108],[401,107],[400,106],[400,105]],[[801,105],[800,106],[799,107],[800,108],[801,109],[801,121],[800,122],[800,142],[801,143],[869,143],[870,142],[870,125],[871,124],[871,111],[872,110],[872,105]]] },
    shipping: [{"country":"CH","method":1,"currency":"USD","firstCents":849,"additionalCents":199},{"country":"LI","method":1,"currency":"USD","firstCents":849,"additionalCents":199}],
  },
  { printifyVariantId: 62355, shopifyVariantId: "gid://shopify/ProductVariant/58954622173558", sku: "79637912688942858255",
    color: "Matte", size: "8.3\" x 11.7\"",
    area: {"position":"front","decorationMethod":"digital-printing","widthPx":2490,"heightPx":3510,"widthMm":210.82,"heightMm":297.18,"minDpi":300,"minScale":0.1,"maxScale":1},
    mockup: { url: "https://images.printify.com/mockup/6aca585903e91232940b4de3/62355/105530/cappatex-blanko-poster-hochformat-eu-opt-ondemand.jpg?camera_label=front", width: 1200, height: 1200, left: 251, top: 107, printWidth: 698, printHeight: 985,
      foreground: [[[329,105],[328,106],[328,108],[329,109],[329,123],[330,124],[330,142],[331,143],[399,143],[400,142],[400,114],[399,113],[399,109],[400,108],[401,107],[400,106],[400,105]],[[801,105],[800,106],[799,107],[800,108],[801,109],[801,121],[800,122],[800,142],[801,143],[869,143],[870,142],[870,125],[871,124],[871,111],[872,110],[872,105]]] },
    shipping: [{"country":"CH","method":1,"currency":"USD","firstCents":849,"additionalCents":199},{"country":"LI","method":1,"currency":"USD","firstCents":849,"additionalCents":199}],
  },
];

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
}, {
  id: "bc-wui23-tde-front", version: "2026-10-10-design-1",
  verifiedAt: "2026-10-10T15:19:41.892Z", validUntil: "2026-11-09T00:00:00Z",
  shopId: "23104859", printifyProductId: "6aca555903e91232940b49e4", blueprintId: 457, providerId: 26,
  shopifyProductId: "gid://shopify/Product/15927108829558", kind: "sweatshirt", name: "B&C WUI23 · Unisex Pullover",
  mockupReferenceSize: "L", evidence: ["docs/CAPPATEX-CATALOG-EXPANSION.md", "docs/CAPPATEX-MOCKUP-CALIBRATION.md"], variants: pulloverVariants,
}, {
  id: "gildan-2400-opt-front", version: "2026-10-10-design-1",
  verifiedAt: "2026-10-10T15:29:06.664Z", validUntil: "2026-11-09T00:00:00Z",
  shopId: "23104859", printifyProductId: "6aca580a7e00a6f93b0445b0", blueprintId: 80, providerId: 30,
  shopifyProductId: "gid://shopify/Product/15927119610230", kind: "tshirt", name: "Gildan 2400 · Unisex Langarmshirt",
  mockupReferenceSize: "L", evidence: ["docs/CAPPATEX-CATALOG-EXPANSION.md", "docs/CAPPATEX-MOCKUP-CALIBRATION.md"], variants: longsleeveVariants,
}, {
 id: "poster-eu-opt-front", version: "2026-10-10-design-1",
 verifiedAt: "2026-10-10T15:32:40.471Z", validUntil: "2026-11-09T00:00:00Z",
 shopId: "23104859", printifyProductId: "6aca585903e91232940b4de3", blueprintId: 443, providerId: 30,
 shopifyProductId: "gid://shopify/Product/15927121740150", kind: "accessory", name: "Poster · Hochformat EU",
 optionKey: "paper", mockupPosition: "other",
 evidence: ["docs/CAPPATEX-CATALOG-EXPANSION.md", "docs/CAPPATEX-MOCKUP-CALIBRATION.md"], variants: posterVariants,
}];
