import type { Payload, PayloadRequest } from 'payload'

type TransactionID = number | string
type Work = () => Promise<void>

/** Work waiting for a transaction to commit, for each database adapter. */
const waiting = new WeakMap<object, Map<TransactionID, Work[]>>()

const settle = async (id: TransactionID | Promise<TransactionID>): Promise<TransactionID> =>
  id instanceof Promise ? await id : id

/**
 * Lets work wait until a save is committed. Payload runs a save's hooks,
 * `afterOperation` included, inside the save's transaction and commits after
 * them, and it offers no hook after the commit. So this wraps the database
 * adapter's commit and rollback: work queued during a save runs once that
 * save commits, and is dropped if it rolls back.
 *
 * It depends on Payload committing through `payload.db.commitTransaction`,
 * so a Payload upgrade should keep `tests/int/countries.int.spec.ts` green.
 */
export function installAfterCommit(payload: Payload): void {
  const { db } = payload
  if (waiting.has(db)) return
  const queue = new Map<TransactionID, Work[]>()
  waiting.set(db, queue)
  const commit = db.commitTransaction.bind(db)
  const rollback = db.rollbackTransaction.bind(db)
  db.commitTransaction = async (incoming) => {
    const id = await settle(incoming)
    await commit(id)
    const work = queue.get(id) ?? []
    queue.delete(id)
    for (const run of work) await run()
  }
  db.rollbackTransaction = async (incoming) => {
    const id = await settle(incoming)
    queue.delete(id)
    await rollback(id)
  }
}

/**
 * Runs work once the request's transaction commits. With no transaction, the
 * write is already saved, so the work runs at once.
 */
export async function afterCommit(req: PayloadRequest, work: Work): Promise<void> {
  const queue = waiting.get(req.payload.db)
  const id = req.transactionID === undefined ? undefined : await settle(req.transactionID)
  if (!queue || id === undefined) return work()
  queue.set(id, [...(queue.get(id) ?? []), work])
}
