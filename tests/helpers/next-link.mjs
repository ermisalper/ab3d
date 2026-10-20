// Only the framework navigation adapter is substituted; application components
// and their hooks, effects, controls and handlers are imported unchanged.
import { createElement } from "react";
export default function Link({ href, children, ...props }) {
  return createElement("a", { ...props, href: typeof href === "string" ? href : href.pathname }, children);
}
