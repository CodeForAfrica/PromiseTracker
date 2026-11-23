/** The header value that keeps a server out of search engines (section 16.1). */
export const NOINDEX = 'noindex, nofollow'

/** True for "true", "1", "yes" or "on", in any case. */
export function noindexFrom(value: string | undefined): boolean {
  return /^(true|1|yes|on)$/i.test(value?.trim() ?? '')
}
