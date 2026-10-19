import type { Metadata } from "next";
import ContactPage from "../contact-page";
import { getChatGPTUser } from "../chatgpt-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Kontakt & individuelle 3D-Wünsche | AB3D",
  description: "Kontaktiere Berk direkt per WhatsApp oder E-Mail für Fragen, eigene 3D-Objekte und Hilfe mit deinem Modell.",
};

export default async function ObjectsContactPage() {
  const user = await getChatGPTUser();
  return <ContactPage area="objects" userName={user?.fullName || user?.displayName || null} />;
}
