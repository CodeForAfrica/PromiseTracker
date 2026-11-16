import { z } from 'zod'

/**
 * The public API's response shapes. Every response the SDK returns is parsed
 * with one of these schemas, whichever transport fetched it.
 */

export const SiteInfo = z.object({
  name: z.string().min(1),
  tagline: z.string().nullable(),
})
export type SiteInfo = z.infer<typeof SiteInfo>

const ServiceHealth = z.object({
  healthy: z.boolean(),
  latencyMs: z.number().nonnegative(),
  kind: z.string().optional(),
  error: z.string().optional(),
})
export type ServiceHealth = z.infer<typeof ServiceHealth>

export const Health = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  plugins: z.object({ enabled: z.array(z.string()) }),
  /** The adapter ids running for each port. */
  ports: z.record(z.string(), z.array(z.string())),
  services: z.record(z.string(), ServiceHealth),
})
export type Health = z.infer<typeof Health>
