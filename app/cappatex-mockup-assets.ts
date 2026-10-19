export type MockupAsset = Readonly<{
  sourceUrl: string;
  src: string;
  sha256: string;
  width: number;
  height: number;
}>;

export type MockupAssetResolution = ({ verified: true } & MockupAsset) | {
  verified: false;
  reason: "missing_evidence" | "dimensions_mismatch" | "invalid_mockup";
  sourceUrl?: string;
};

// Unmodified, previously calibrated reference JPEGs. This does not assert that
// today's remote CDN response is unchanged or grant sales/production approval.
// Evidence and unresolved references: docs/evidence/cappatex-mockup-assets.json.
const rows: MockupAsset[] = [
  {
    "sourceUrl": "https://images.printify.com/mockup/6ac927b73b3a3e64620a53a3/38191/97992/cappatex-blanko-gildan-64000-opt-ondemand-pilot.jpg?camera_label=front",
    "src": "/cappatex/mockups/7538270b71ee463b51e5c0c88f32fd3b8c3a6b44ca400f7d83a0b562911aa5db.jpg",
    "sha256": "7538270b71ee463b51e5c0c88f32fd3b8c3a6b44ca400f7d83a0b562911aa5db",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6ac927b73b3a3e64620a53a3/38192/97992/cappatex-blanko-gildan-64000-opt-ondemand-pilot.jpg?camera_label=front",
    "src": "/cappatex/mockups/d7885bf4c8cde159f9ceb0d8281445858198c8a9f1e73db8164717497762e342.jpg",
    "sha256": "d7885bf4c8cde159f9ceb0d8281445858198c8a9f1e73db8164717497762e342",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6ac9455655a9ebcaa50bc346/68258/8876/cappatex-blanko-bc-king-hoodie-opt-ondemand.jpg?camera_label=front",
    "src": "/cappatex/mockups/8d5b240aad930e36360e516e91a76dd0964040393fff51dc405a6f8e482c4179.jpg",
    "sha256": "8d5b240aad930e36360e516e91a76dd0964040393fff51dc405a6f8e482c4179",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6ac9455655a9ebcaa50bc346/69090/8867/cappatex-blanko-bc-king-hoodie-opt-ondemand.jpg?camera_label=front",
    "src": "/cappatex/mockups/3ae8e6a36d3ca680cbd3e00c50e3da0607a580b066371b4afcba5a6fd431e8a2.jpg",
    "sha256": "3ae8e6a36d3ca680cbd3e00c50e3da0607a580b066371b4afcba5a6fd431e8a2",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6ac9455655a9ebcaa50bc346/69058/8872/cappatex-blanko-bc-king-hoodie-opt-ondemand.jpg?camera_label=front",
    "src": "/cappatex/mockups/d754c95693345dcaabb89010b5c2862602ae4190729cea243df35ec7659e8e90.jpg",
    "sha256": "d754c95693345dcaabb89010b5c2862602ae4190729cea243df35ec7659e8e90",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6ac9455655a9ebcaa50bc346/69066/8860/cappatex-blanko-bc-king-hoodie-opt-ondemand.jpg?camera_label=front",
    "src": "/cappatex/mockups/495ab80304f882c3b0de8eefebb002376ee7540490da720d43412501e4422cc7.jpg",
    "sha256": "495ab80304f882c3b0de8eefebb002376ee7540490da720d43412501e4422cc7",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6ac9455655a9ebcaa50bc346/68258/8890/cappatex-blanko-bc-king-hoodie-opt-ondemand.jpg?camera_label=back",
    "src": "/cappatex/mockups/2ae6a127d191f7dc9b4e9beff987f785cd16bb1e9d49dfe08d3d9df85fdd8bdf.jpg",
    "sha256": "2ae6a127d191f7dc9b4e9beff987f785cd16bb1e9d49dfe08d3d9df85fdd8bdf",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6ac9455655a9ebcaa50bc346/69090/8886/cappatex-blanko-bc-king-hoodie-opt-ondemand.jpg?camera_label=back",
    "src": "/cappatex/mockups/17f71f90cb6ada0d0160215f9da185fb99d79b59096c142168246cefc8737178.jpg",
    "sha256": "17f71f90cb6ada0d0160215f9da185fb99d79b59096c142168246cefc8737178",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6ac9455655a9ebcaa50bc346/69058/8884/cappatex-blanko-bc-king-hoodie-opt-ondemand.jpg?camera_label=back",
    "src": "/cappatex/mockups/03faea62ff0746ce5ae4a4be8db7cc6b1b0733abdd3857bfbaedebd86a3b9bca.jpg",
    "sha256": "03faea62ff0746ce5ae4a4be8db7cc6b1b0733abdd3857bfbaedebd86a3b9bca",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6ac9455655a9ebcaa50bc346/69066/8888/cappatex-blanko-bc-king-hoodie-opt-ondemand.jpg?camera_label=back",
    "src": "/cappatex/mockups/bbd4e4f0dc25c9dc53692e850439afd3231ff7d7d9eee4263f1c72713a585126.jpg",
    "sha256": "bbd4e4f0dc25c9dc53692e850439afd3231ff7d7d9eee4263f1c72713a585126",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6ac948494e4b21bea10a38d4/24828/101889/cappatex-blanko-bellacanvas-3480-tanktop-textildruck-europa.jpg?camera_label=front",
    "src": "/cappatex/mockups/a2005af40be7bfb66085adc8a217c339a7189a90966b7c978f41c633b554676d.jpg",
    "sha256": "a2005af40be7bfb66085adc8a217c339a7189a90966b7c978f41c633b554676d",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6ac948494e4b21bea10a38d4/24639/101889/cappatex-blanko-bellacanvas-3480-tanktop-textildruck-europa.jpg?camera_label=front",
    "src": "/cappatex/mockups/08113f89a43518d2547f03285120e624fb3e5ba8887bffc7aac6af0bdb8a9fda.jpg",
    "sha256": "08113f89a43518d2547f03285120e624fb3e5ba8887bffc7aac6af0bdb8a9fda",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6ac948494e4b21bea10a38d4/24828/101892/cappatex-blanko-bellacanvas-3480-tanktop-textildruck-europa.jpg?camera_label=back",
    "src": "/cappatex/mockups/6b2d07f7f81fc31ffeee9af97b86a0e10eb8bc26bf4bc950ba8a7e9cf33bbe55.jpg",
    "sha256": "6b2d07f7f81fc31ffeee9af97b86a0e10eb8bc26bf4bc950ba8a7e9cf33bbe55",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6ac948494e4b21bea10a38d4/24639/101892/cappatex-blanko-bellacanvas-3480-tanktop-textildruck-europa.jpg?camera_label=back",
    "src": "/cappatex/mockups/7f341acea1a6ab3e077ad3aa807b22c4bea5d6057a1d8a4004ccccf4f965a2ff.jpg",
    "sha256": "7f341acea1a6ab3e077ad3aa807b22c4bea5d6057a1d8a4004ccccf4f965a2ff",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6aca555903e91232940b49e4/63729/5078/cappatex-blanko-bc-wui23-pullover-textildruck-europa.jpg?camera_label=front",
    "src": "/cappatex/mockups/3c2e88e81b10d6b0c3482854d02f1f107eaad889f14a047dcc263a782afe7fe4.jpg",
    "sha256": "3c2e88e81b10d6b0c3482854d02f1f107eaad889f14a047dcc263a782afe7fe4",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6aca555903e91232940b49e4/63732/5081/cappatex-blanko-bc-wui23-pullover-textildruck-europa.jpg?camera_label=front",
    "src": "/cappatex/mockups/09c522924d6bc7dd891276e1ba0d5f02d7c957b4817f24f1bac2c53372c5ba3f.jpg",
    "sha256": "09c522924d6bc7dd891276e1ba0d5f02d7c957b4817f24f1bac2c53372c5ba3f",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6aca555903e91232940b49e4/63729/5083/cappatex-blanko-bc-wui23-pullover-textildruck-europa.jpg?camera_label=back",
    "src": "/cappatex/mockups/882006828a21cf178dfb8fb26651b66f4601d37f1921e927c776668969dc2531.jpg",
    "sha256": "882006828a21cf178dfb8fb26651b66f4601d37f1921e927c776668969dc2531",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6aca555903e91232940b49e4/63732/5086/cappatex-blanko-bc-wui23-pullover-textildruck-europa.jpg?camera_label=back",
    "src": "/cappatex/mockups/c320d15742f2500b2817119c7f6f53f748e2e01217a7a57758ed116c913bed46.jpg",
    "sha256": "c320d15742f2500b2817119c7f6f53f748e2e01217a7a57758ed116c913bed46",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6aca580a7e00a6f93b0445b0/33793/105264/cappatex-blanko-gildan-2400-langarmshirt-opt-ondemand.jpg?camera_label=front",
    "src": "/cappatex/mockups/d2180c702495b2a5a3f5cd2657809b84b417e6a3998451d32762d42c47c3be81.jpg",
    "sha256": "d2180c702495b2a5a3f5cd2657809b84b417e6a3998451d32762d42c47c3be81",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6aca580a7e00a6f93b0445b0/33798/105264/cappatex-blanko-gildan-2400-langarmshirt-opt-ondemand.jpg?camera_label=front",
    "src": "/cappatex/mockups/8293f1460101638b0a90a9302383c00bab925f976c548de7ecca6a52c351254d.jpg",
    "sha256": "8293f1460101638b0a90a9302383c00bab925f976c548de7ecca6a52c351254d",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6aca580a7e00a6f93b0445b0/33793/105265/cappatex-blanko-gildan-2400-langarmshirt-opt-ondemand.jpg?camera_label=back",
    "src": "/cappatex/mockups/a64c042330e41fa56810235b84e7d56ff5ed209fb45ad6efad655ddf8d67c465.jpg",
    "sha256": "a64c042330e41fa56810235b84e7d56ff5ed209fb45ad6efad655ddf8d67c465",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6aca580a7e00a6f93b0445b0/33798/105265/cappatex-blanko-gildan-2400-langarmshirt-opt-ondemand.jpg?camera_label=back",
    "src": "/cappatex/mockups/7465175797289c8e4deb0272adff2c32e8c0e89af8e2c8a3b85540562bbb1b2c.jpg",
    "sha256": "7465175797289c8e4deb0272adff2c32e8c0e89af8e2c8a3b85540562bbb1b2c",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6aca585903e91232940b4de3/62338/105533/cappatex-blanko-poster-hochformat-eu-opt-ondemand.jpg?camera_label=front",
    "src": "/cappatex/mockups/2c67e124eb86687caf863ddd3792902b9407d3c6547e8d5b1e9919708d653134.jpg",
    "sha256": "2c67e124eb86687caf863ddd3792902b9407d3c6547e8d5b1e9919708d653134",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6aca585903e91232940b4de3/62339/105534/cappatex-blanko-poster-hochformat-eu-opt-ondemand.jpg?camera_label=front",
    "src": "/cappatex/mockups/528c3ccf7b7c893e95665febab4b36089bd2b973bef80f8cf07596ae2cb13d98.jpg",
    "sha256": "528c3ccf7b7c893e95665febab4b36089bd2b973bef80f8cf07596ae2cb13d98",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6aca585903e91232940b4de3/62354/105529/cappatex-blanko-poster-hochformat-eu-opt-ondemand.jpg?camera_label=front",
    "src": "/cappatex/mockups/7d738fdd76d32cdf59d94f9c49b5fd3d49c4e22dc4c52a378cd25da1ef47fdc1.jpg",
    "sha256": "7d738fdd76d32cdf59d94f9c49b5fd3d49c4e22dc4c52a378cd25da1ef47fdc1",
    "width": 1200,
    "height": 1200
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6aca585903e91232940b4de3/62355/105530/cappatex-blanko-poster-hochformat-eu-opt-ondemand.jpg?camera_label=front",
    "src": "/cappatex/mockups/5da9622cac50a3114069f856fbd0b09874b6f93792e37ad821220390d9e7f1aa.jpg",
    "sha256": "5da9622cac50a3114069f856fbd0b09874b6f93792e37ad821220390d9e7f1aa",
    "width": 1200,
    "height": 1200
  }
];

type LegacyMockup = Readonly<{ sourceUrl: string; width: number; height: number; reason: "historical_source_bytes_unavailable" }>;
// Explicit compatibility exceptions, not verified photo contents or new approvals.
const legacyRows: LegacyMockup[] = [
  {
    "sourceUrl": "https://images.printify.com/mockup/6ac927b73b3a3e64620a53a3/38191/97993/cappatex-blanko-gildan-64000-opt-ondemand-pilot.jpg?camera_label=back",
    "width": 1200,
    "height": 1200,
    "reason": "historical_source_bytes_unavailable"
  },
  {
    "sourceUrl": "https://images.printify.com/mockup/6ac927b73b3a3e64620a53a3/38192/97993/cappatex-blanko-gildan-64000-opt-ondemand-pilot.jpg?camera_label=back",
    "width": 1200,
    "height": 1200,
    "reason": "historical_source_bytes_unavailable"
  }
];

export const CAPPATEX_MOCKUP_ASSETS: Readonly<Record<string, MockupAsset>> = Object.freeze(
  Object.fromEntries(rows.map(asset => [asset.sourceUrl, Object.freeze(asset)])),
);

export const CAPPATEX_LEGACY_MOCKUPS: Readonly<Record<string, LegacyMockup>> = Object.freeze(
  Object.fromEntries(legacyRows.map(asset => [asset.sourceUrl, Object.freeze(asset)])),
);

/** Only the two documented T-shirt rear views may remain visible with an explicit warning. */
export function knownLegacyMockup(mockup: unknown): boolean {
  if (!mockup || typeof mockup !== "object" || Array.isArray(mockup)) return false;
  const value = mockup as { url?: unknown; width?: unknown; height?: unknown };
  if (typeof value.url !== "string" || !Object.hasOwn(CAPPATEX_LEGACY_MOCKUPS, value.url)) return false;
  const expected = CAPPATEX_LEGACY_MOCKUPS[value.url];
  return value.width === expected.width && value.height === expected.height;
}

/** Preserve the original profile URL as identity; only the displayed source changes. */
export function resolveMockupAsset(mockup: unknown): MockupAssetResolution {
  if (!mockup || typeof mockup !== "object" || Array.isArray(mockup)) return { verified: false, reason: "invalid_mockup" };
  const value = mockup as { url?: unknown; width?: unknown; height?: unknown };
  if (typeof value.url !== "string" || !value.url || typeof value.width !== "number" || typeof value.height !== "number"
    || !Number.isSafeInteger(value.width) || !Number.isSafeInteger(value.height) || value.width <= 0 || value.height <= 0)
    return { verified: false, reason: "invalid_mockup" };
  if (!Object.hasOwn(CAPPATEX_MOCKUP_ASSETS, value.url)) return { verified: false, reason: "missing_evidence", sourceUrl: value.url };
  const asset = CAPPATEX_MOCKUP_ASSETS[value.url];
  if (asset.width !== value.width || asset.height !== value.height)
    return { verified: false, reason: "dimensions_mismatch", sourceUrl: value.url };
  return { verified: true, ...asset };
}
