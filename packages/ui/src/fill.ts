/** Replaces `{name}` placeholders in interface text. */
export const fill = (template: string, values: Readonly<Record<string, string>>): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
