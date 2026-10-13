/**
 * Joins class names, skipping empty values. Dependency-free on purpose; a kit that adopts these components
 * can swap in its own `cn` (with conflict merging) without touching the components.
 */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
