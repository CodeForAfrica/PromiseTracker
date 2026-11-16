/** A configuration problem that must stop start-up. The message says how to fix it. */
export class KernelError extends Error {
  override name = 'KernelError'
}
