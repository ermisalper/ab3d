"use client";

import { useEffect, useRef } from "react";

const focusableSelector = [
  "a[href]",
  "button",
  "input:not([type=hidden])",
  "select",
  "textarea",
  "summary",
  "[tabindex]",
].join(",");

function focusableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => (
    element.tabIndex >= 0
    && !element.matches(":disabled")
    && !element.closest("[inert], [hidden], [aria-hidden=true]")
    && element.getClientRects().length > 0
    && window.getComputedStyle(element).visibility !== "hidden"
  ));
}

export default function useDialogFocus<T extends HTMLElement>(open: boolean) {
  const dialogRef = useRef<T>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;

    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFirst = () => (focusableElements(dialog)[0] || dialog).focus({ preventScroll: true });

    const keepFocusInside = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) focusFirst();
    };
    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = focusableElements(dialog);
      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;

      if (!first) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
      } else if (!dialog.contains(active) || active === dialog) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    focusFirst();
    document.addEventListener("focusin", keepFocusInside);
    document.addEventListener("keydown", handleTab, true);
    return () => {
      document.removeEventListener("focusin", keepFocusInside);
      document.removeEventListener("keydown", handleTab, true);
      if (trigger?.isConnected && !trigger.closest("[inert], [hidden], [aria-hidden=true]") && !trigger.matches(":disabled")) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, [open]);

  return dialogRef;
}
