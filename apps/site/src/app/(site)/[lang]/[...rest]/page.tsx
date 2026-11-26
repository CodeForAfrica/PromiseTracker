import type { Metadata } from 'next'

import { EditorPage, editorPageMetadata } from '@/editorPage'

type Props = { params: Promise<{ lang: string; rest: string[] }> }

/**
 * Any other address under a language: an editor page nested deeper than the
 * country routes reach, or nothing on the record.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, rest } = await params
  return editorPageMetadata(lang, rest.join('/'))
}

export default async function Rest({ params }: Props) {
  const { lang, rest } = await params
  return <EditorPage lang={lang} path={rest.join('/')} />
}
