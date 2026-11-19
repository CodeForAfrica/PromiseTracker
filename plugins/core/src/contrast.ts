/**
 * Colour contrast as WCAG 2 defines it (section 10.5). A rating's text sits on
 * its colour, and both are chosen by editors, so the admin checks every pair.
 *
 * No imports, so the admin's browser code can use it without the rest of
 * plugin-core.
 */

/** WCAG AA for normal text. Rating chips are small, so the large-text minimum never applies. */
export const AA_CONTRAST = 4.5

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Whether a value is a colour the admin accepts: `#rgb` or `#rrggbb`. */
export const isHexColour = (value: unknown): value is string =>
  typeof value === 'string' && HEX.test(value)

function channels(hex: string): [number, number, number] {
  const digits = hex.slice(1)
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((d) => d + d)
          .join('')
      : digits
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ]
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) =>
    c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The contrast ratio of two colours, from 1 to 21. Null when either is not a colour. */
export function contrastRatio(a: unknown, b: unknown): number | null {
  if (!isHexColour(a) || !isHexColour(b)) return null
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}

/** A ratio as the admin shows it: `4.52:1`, rounded down so a pass is never overstated. */
export const formatRatio = (ratio: number): string => `${Math.floor(ratio * 100) / 100}:1`
