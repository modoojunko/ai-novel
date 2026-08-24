/**
 * Render plain text/Markdown-like content to safe HTML for prose display.
 * Supports: paragraphs (split by \n\n), **bold**, *italic*, `inline code`, --- hr.
 * HTML is escaped to prevent XSS.
 */
export function renderMarkdown(text: string): string {
  if (!text) return '<p style="color:var(--muted)">暂无内容</p>';

  // Escape HTML to prevent XSS
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const paragraphs = escaped.split(/\n\n+/);

  return paragraphs
    .map((para) => {
      const t = para.trim();
      if (!t) return "";

      // Horizontal rule
      if (/^-{3,}$/.test(t)) return "<hr>";

      // Inline formatting
      let html = t
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/`(.*?)`/g, "<code>$1</code>");

      // Line breaks within paragraph
      html = html.replace(/\n/g, "<br>");

      return `<p>${html}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}
