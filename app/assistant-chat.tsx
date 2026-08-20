"use client";

import { FormEvent, useState } from "react";

type Message = { role: "assistant" | "user"; text: string };

const suggestions = ["Was kostet mein Design?", "Wie funktioniert Foto zu 3D?", "PLA oder PETG?", "Wie setze ich die Grösse?"];

export default function AssistantChat({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Hoi! Ich bin der AB3D Design-Guide. Frag mich zu 3D-Modellen, Fotos, Tokens, Materialien, Grössen oder Preisen." },
  ]);

  const ask = async (question: string) => {
    const value = question.trim();
    if (!value || busy) return;
    setMessages((current) => [...current, { role: "user", text: value }]);
    setInput("");
    setBusy(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: value }),
      });
      const data = await response.json();
      setMessages((current) => [...current, { role: "assistant", text: data.answer || "Bitte versuche es nochmals." }]);
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: "Ich bin kurz nicht erreichbar. Du kannst uns an hello@ab3d.ch schreiben." }]);
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void ask(input);
  };

  return (
    <div className={`assistant-widget ${open ? "open" : ""}`}>
      {open && (
        <section className="assistant-panel" aria-label="AB3D Design-Guide">
          <header><div><i>AI</i><span><b>AB3D Design-Guide</b><small>{signedIn ? "KI & Shopwissen" : "Shopwissen · KI nach Anmeldung"}</small></span></div><button onClick={() => setOpen(false)} aria-label="Chat schliessen">×</button></header>
          <div className="assistant-messages">
            {messages.map((message, index) => <p className={message.role} key={`${message.role}-${index}`}>{message.text}</p>)}
            {busy && <p className="assistant typing"><i /><i /><i /></p>}
          </div>
          {messages.length < 3 && <div className="assistant-suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => void ask(suggestion)}>{suggestion}</button>)}</div>}
          <form onSubmit={submit}><input value={input} onChange={(event) => setInput(event.target.value.slice(0, 500))} placeholder="Deine Frage …" aria-label="Frage an AB3D" /><button disabled={busy || !input.trim()} aria-label="Frage senden">↑</button></form>
          <small className="assistant-disclaimer">KI kann sich irren · Verbindliche Angaben bestätigt AB3D.</small>
        </section>
      )}
      <button className="assistant-launcher" onClick={() => setOpen((value) => !value)} aria-label={open ? "Design-Guide schliessen" : "Design-Guide öffnen"}><span>{open ? "×" : "✦"}</span><b>{open ? "Schliessen" : "Fragen?"}</b></button>
    </div>
  );
}
