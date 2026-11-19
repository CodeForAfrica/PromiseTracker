import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { can, signedIn } from './access'
import { ADMIN_GROUPS } from './adminGroups'

/** The largest outline file accepted. A detailed county outline is well under this. */
export const MAX_BOUNDARY_BYTES = 10 * 1024 * 1024

const GEOJSON_TYPES = [
  'FeatureCollection',
  'Feature',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection',
] as const

/** Why a file is not a usable GeoJSON outline, or null when it is. */
export function geoJsonProblem(bytes: Uint8Array): string | null {
  if (bytes.byteLength > MAX_BOUNDARY_BYTES) {
    return `The file is larger than ${MAX_BOUNDARY_BYTES / 1024 / 1024} MB.`
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return 'The file is not JSON. Upload a GeoJSON file, such as nairobi.geojson.'
  }
  const type: unknown = parsed && typeof parsed === 'object' ? Reflect.get(parsed, 'type') : null
  if (typeof type !== 'string' || !(GEOJSON_TYPES as readonly string[]).includes(type)) {
    return `The file is JSON but not a GeoJSON outline. Its "type" must be one of ${GEOJSON_TYPES.join(', ')}.`
  }
  return null
}

/** Reads the uploaded file before it is stored, and refuses one that is not GeoJSON. */
const checkGeoJson: CollectionBeforeValidateHook = ({ data, req }) => {
  const file = req.file
  if (file) {
    const problem = geoJsonProblem(file.data)
    if (problem) throw new APIError(problem, 400)
  }
  return data
}

/**
 * Area outlines as GeoJSON files (section 7.2), kept for the maps in version 2.
 * Each file records where it came from and its licence, because boundary data
 * often must be credited.
 */
export const Boundaries: CollectionConfig = {
  slug: 'boundaries',
  labels: { singular: 'Boundary', plural: 'Boundaries' },
  admin: {
    group: ADMIN_GROUPS.places,
    useAsTitle: 'filename',
    description:
      'GeoJSON outlines of areas, for maps. Upload a .geojson file, then choose it on the area.',
  },
  upload: {
    // Browsers send a .geojson file as GeoJSON or JSON, and Payload reads the
    // extension as plain text. checkGeoJson reads the content, so plain text is
    // safe to let through.
    mimeTypes: ['application/geo+json', 'application/json', 'text/plain'],
  },
  access: {
    read: signedIn,
    create: can.manageStructure,
    update: can.manageStructure,
    delete: can.manageStructure,
  },
  hooks: { beforeValidate: [checkGeoJson] },
  fields: [
    {
      name: 'source',
      type: 'text',
      required: true,
      admin: { description: 'Where the outline comes from, such as the IEBC or OpenStreetMap.' },
    },
    {
      name: 'licence',
      type: 'text',
      required: true,
      admin: { description: 'Its licence, such as ODbL 1.0 or CC BY 4.0.' },
    },
  ],
}
