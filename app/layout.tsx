import type { Metadata } from "next";
import "./globals.css";
import BrandIntro from "./brand-intro";

export const metadata: Metadata = {
  metadataBase: new URL("https://ab3d-swiss-design.berk-ermis.chatgpt.site"),
  title: "AB3D | Schweizer 3D Design & Wohnobjekte",
  description: "Skulpturale Wohnobjekte, Vasen und individuelle Kleinserien – lokal und auf Bestellung in der Schweiz gefertigt.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "AB3D | Aus Ideen werden Lieblingsstücke.",
    description: "Skulpturale Wohnobjekte und individuelle Kleinserien – Swiss made.",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "AB3D Schweizer 3D Design" }],
    locale: "de_CH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AB3D | Aus Ideen werden Lieblingsstücke.",
    description: "Skulpturale Wohnobjekte und individuelle Kleinserien – Swiss made.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body><a className="skip-link" href="#main-content">Direkt zum Inhalt</a><BrandIntro />{children}</body></html>;
}
