import { cn } from './cn'

/**
 * A round country flag, drawn from the country's code. Flags are decorative:
 * the country's name is always beside one, so screen readers skip it.
 */
export function Flag({
  code,
  size = 17,
  className,
}: {
  code: string
  size?: number
  className?: string
}) {
  // Regional indicator letters, which most systems draw as the flag.
  const emoji = code
    .toUpperCase()
    .replace(/[A-Z]/g, (letter) => String.fromCodePoint(0x1f1a5 + letter.charCodeAt(0)))
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex flex-none items-center justify-center overflow-hidden rounded-full bg-tile leading-none shadow-[0_0_0_1px_rgba(22,24,28,.12)]',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.9 }}
    >
      {emoji}
    </span>
  )
}
