/**
 * Serialize a value for embedding in <script type="application/ld+json">.
 * JSON.stringify does not escape '<', so a string containing '</script>' can
 * break out of the tag. Replacing '<' with \u003c is a no-op for JSON.parse.
 */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
