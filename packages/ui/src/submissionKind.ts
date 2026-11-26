/** The three kinds of citizen submission (section 7.9). Shared by server and client code. */
export type SubmissionKind = 'evidence' | 'correction' | 'changed'

/** Reads `?kind=` into one of the three kinds, evidence by default. */
export const kindOf = (value: string | undefined | null): SubmissionKind =>
  value === 'correction' || value === 'changed' ? value : 'evidence'
