import Link from "next/link";
import PreparedReview from "./review";

export const metadata = { title: "Gespeicherte Druckseiten | CAPPATEX", robots: { index: false, follow: false } };
export default async function PreparationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="cappatex-preparation" style={{ maxWidth: 980, margin: "32px auto" }}>
    <Link className="text-link" href="/cappatex#studio">← Zurück zum CAPPATEX Studio</Link>
    <p className="eyebrow">CAPPATEX · Druckvorbereitung</p><h1>Deine gespeicherten Druckseiten</h1>
    <p>Motiv, Platzierung und Druckdatei bleiben für jede Seite zusammen gespeichert.</p>
    <PreparedReview id={id} />
  </main>;
}
