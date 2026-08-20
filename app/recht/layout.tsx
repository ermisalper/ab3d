import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rechtscenter | AB3D Swiss Design",
  description: "Rechtliche Informationen zu AB3D und CAPPATEX: Impressum, Datenschutz, AGB, Versand, Rückgabe und Produktsicherheit.",
  robots: { index: true, follow: true },
};

export default function LegalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
