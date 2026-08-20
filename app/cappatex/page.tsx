import type { Metadata } from "next";
import CappatexStudio from "./cappatex-studio";
import { getChatGPTUser } from "../chatgpt-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CAPPATEX – KI-Design auf deinem Produkt | AB3D",
  description: "Erstelle ein eigenes Motiv mit KI, platziere es auf Kleidung oder Accessoires und bestelle dein Einzelstück on demand.",
};

export default async function CappatexPage() {
  const user = await getChatGPTUser();
  return <CappatexStudio userName={user?.fullName || null} />;
}
