import type { PrintProfile } from "./cappatex-print-profile";

// Add a version only after recording provider, blank mockup geometry, SKU/ID mapping,
// CH + LI shipping, manual approval and native-import unlink evidence in docs/.
// An empty registry is intentional: never infer production readiness from a title/SKU.
export const CAPPATEX_PRINT_PROFILES: PrintProfile[] = [];
