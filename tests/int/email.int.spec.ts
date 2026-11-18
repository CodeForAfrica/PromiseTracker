import { getPayload } from '@promisetracker/cms'
import { afterAll, describe, expect, it } from 'vitest'

// Mailpit's API, from `pnpm services` or the CI service.
const mailpit = `http://localhost:${process.env.PT_MAIL_UI_PORT || '8025'}/api/v1`

type Message = { Subject: string; To: { Address: string }[]; From: { Address: string } }

async function findMessage(subject: string): Promise<Message | undefined> {
  // Mailpit stores a message a moment after accepting it.
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(`${mailpit}/search?query=${encodeURIComponent(`subject:"${subject}"`)}`)
    const { messages } = (await res.json()) as { messages: Message[] }
    if (messages[0]) return messages[0]
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return undefined
}

describe('email', () => {
  afterAll(async () => {
    const payload = await getPayload()
    await payload.destroy()
  })

  it('sends through Payload to Mailpit, where tests can read it', async () => {
    const payload = await getPayload()
    const subject = `Test ${crypto.randomUUID()}`
    await payload.sendEmail({ to: 'editor@example.org', subject, text: 'Hello from the tests.' })

    const message = await findMessage(subject)
    expect(message?.To[0]?.Address).toBe('editor@example.org')
    expect(message?.From.Address).toBe('noreply@promisetracker.local')
  })
})
