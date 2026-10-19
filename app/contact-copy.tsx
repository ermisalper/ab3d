"use client";

import { useState } from "react";

export default function ContactCopy({ value, label }: { value: string; label: string }) {
  const [status, setStatus] = useState("");
  const [copying, setCopying] = useState(false);

  async function copy() {
    setCopying(true);
    setStatus("");
    try {
      await navigator.clipboard.writeText(value);
      setStatus("Kopiert. Du kannst die Kontaktdaten jetzt einfügen.");
    } catch {
      setStatus("Kopieren ist hier nicht möglich. Markiere die Kontaktdaten oben und kopiere sie von Hand.");
    } finally {
      setCopying(false);
    }
  }

  return <div className="contact-copy">
    <button type="button" onClick={copy} disabled={copying}>{copying ? "Wird kopiert …" : label}</button>
    <p role="status">{status}</p>
  </div>;
}
