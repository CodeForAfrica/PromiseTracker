/**
 * A term's label in the admin's lists, such as "Achieng Wekesa, Governor
 * (2022)". Names are in the default language, whichever language the editor
 * is using.
 */
export function termTitle(actor: string, office: string, startsOn: string | null): string {
  const year = startsOn ? ` (${startsOn.slice(0, 4)})` : ''
  return `${actor}, ${office}${year}`
}
