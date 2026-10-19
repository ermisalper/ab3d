import type { Metadata } from "next";
import ContactPage from "../../contact-page";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Kontakt & persönliche Designhilfe | CAPPATEX",
  description: "Fragen zum Motiv oder ein besonderer Designwunsch? Kontaktiere Berk direkt per WhatsApp oder E-Mail.",
};

export default async function CappatexContactPage() {
  const user = await getChatGPTUser();
  return <ContactPage area="cappatex" userName={user?.fullName || user?.displayName || null} />;
}
