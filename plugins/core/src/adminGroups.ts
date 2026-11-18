/**
 * The groups the admin's menu sorts record types into, so editors find
 * things by what they are for rather than in one long list. Later record
 * types join these or add their own: claims and topics under "Claims",
 * documents under "Sources", themes and articles under "Editorial".
 */
export const ADMIN_GROUPS = {
  places: 'Places',
  library: 'Media library',
  site: 'Public site',
  administration: 'Administration',
} as const
