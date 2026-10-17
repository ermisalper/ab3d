"use client";
import { useEffect, useState } from "react";
import { PreparedReceipt } from "../../cappatex-preparation-panel";
import type { PreparationSummary } from "../../../cappatex-preparation";

export default function PreparedReview({ id }: { id: string }) {
  const [receipt, setReceipt] = useState<PreparationSummary | null>(null);
  const [message, setMessage] = useState("Gespeicherte Druckseiten werden geladen …");
  useEffect(() => {
    let active = true;
    fetch(`/api/cappatex/preparations/${encodeURIComponent(id)}`, { cache: "no-store" }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Stand nicht verfügbar.");
      if (active) { setReceipt(data); setMessage(""); }
    }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [id]);
  return <>{message && <p role="status">{message}</p>}{receipt && <PreparedReceipt receipt={receipt} />}</>;
}
