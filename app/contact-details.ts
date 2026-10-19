export type ContactArea = "objects" | "cappatex";

export const CONTACT_EMAIL = "berk_ermis@icloud.com";
export const CONTACT_PHONE_DISPLAY = "+41 78 820 66 84";
export const CONTACT_WHATSAPP_NUMBER = "41788206684";

export const contactPageHref = (area: ContactArea) => area === "cappatex" ? "/cappatex/kontakt" : "/kontakt";

/** Opens a draft only. No visitor data or saved design is sent by the website. */
export function contactWhatsAppUrl(area: ContactArea) {
  const text = area === "cappatex"
    ? "Hallo Berk, ich habe eine Frage zu CAPPATEX oder brauche Hilfe mit meinem Design."
    : "Hallo Berk, ich habe eine Frage zu AB3D oder einen Wunsch für ein 3D-Objekt.";
  return `https://wa.me/${CONTACT_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

export function contactEmailUrl(area: ContactArea) {
  const subject = area === "cappatex" ? "CAPPATEX – Frage oder Designwunsch" : "AB3D – Frage oder 3D-Wunsch";
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
