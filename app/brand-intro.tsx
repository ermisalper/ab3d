"use client";

import { usePathname } from "next/navigation";

export default function BrandIntro() {
  const pathname = usePathname();
  const isCappatex = pathname.startsWith("/cappatex");

  return (
    <div
      className={`brand-intro ${isCappatex ? "brand-intro-cappatex" : "brand-intro-ab3d"}`}
      aria-hidden="true"
      key={isCappatex ? "cappatex" : "ab3d"}
    >
      <div className="brand-print-stage">
        <div className="brand-print-machine">
          <div className="printer-frame">
            <span className="printer-rail" />
            <span className="printer-cable" />
            <span className="printer-head"><i /><b /></span>
          </div>
          <div className="printed-brand">
            {isCappatex ? <b>CAPPATEX</b> : <><span>AB</span><b>3D</b></>}
          </div>
          <span className="printer-bed" />
        </div>
        <p><i />{isCappatex ? "Dein Motiv wird tragbar" : "Idee wird Schicht für Schicht Form"}</p>
      </div>
    </div>
  );
}
