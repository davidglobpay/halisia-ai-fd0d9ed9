export function visibleOutputText(root: Element): string {
  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (!(node instanceof HTMLElement)) return "";
    if (
      node.matches(
        'button:not([data-output-content]), input, select, textarea, script, style, [data-output-tools], [hidden], [aria-hidden="true"]',
      )
    )
      return "";
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return "";
    if (node.tagName === "DETAILS" && !node.hasAttribute("open"))
      return walk(node.querySelector("summary") ?? document.createElement("span"));
    return Array.from(node.childNodes).map(walk).join(" ");
  }
  return walk(root).replace(/\s+/g, " ").trim();
}
