import type { Kernel } from './kernel'

type RouteHandler<TArgs extends unknown[]> = (request: Request, ...args: TArgs) => Promise<Response>

/**
 * Wraps a route handler under `/api/plugins/{slug}/` so it answers 503 while
 * its plugin is disabled (section 4.7).
 */
export function pluginRoute<TArgs extends unknown[]>(
  kernel: Pick<Kernel, 'isEnabled'>,
  slug: string,
  handler: RouteHandler<TArgs>,
): RouteHandler<TArgs> {
  return async (request, ...args) => {
    if (!kernel.isEnabled(slug)) {
      return Response.json(
        { error: `The ${slug} plugin is not enabled.` },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      )
    }
    return handler(request, ...args)
  }
}
