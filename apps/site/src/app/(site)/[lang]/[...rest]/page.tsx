import { notFound } from 'next/navigation'

/** Any other address under a language is not on the record. */
export default function Rest(): never {
  notFound()
}
