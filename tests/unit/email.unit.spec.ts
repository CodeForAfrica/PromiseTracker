import { emailAdapter, smtpSettings } from '@promisetracker/cms/email'
import { describe, expect, it } from 'vitest'

describe('smtpSettings', () => {
  it('sends to Mailpit outside production', () => {
    expect(smtpSettings({})).toEqual({
      host: 'localhost',
      port: 1025,
      fromAddress: 'noreply@promisetracker.local',
      fromName: 'PromiseTracker',
    })
  })

  it("follows Mailpit's host port", () => {
    expect(smtpSettings({ PT_SMTP_PORT: '51025' })?.port).toBe(51025)
  })

  it('sends nothing in production until a provider is set', () => {
    expect(smtpSettings({ NODE_ENV: 'production' })).toBeNull()
    expect(emailAdapter({ NODE_ENV: 'production' })).toBeUndefined()
  })

  it('uses the provider settings when given', () => {
    expect(
      smtpSettings({
        NODE_ENV: 'production',
        SMTP_HOST: 'smtp.example.org',
        SMTP_USER: 'user',
        SMTP_PASSWORD: 'secret',
        PT_EMAIL_FROM: 'news@example.org',
        PT_EMAIL_FROM_NAME: 'PromiseTracker Kenya',
      }),
    ).toEqual({
      host: 'smtp.example.org',
      port: 587,
      user: 'user',
      password: 'secret',
      fromAddress: 'news@example.org',
      fromName: 'PromiseTracker Kenya',
    })
  })

  it('refuses a port that is not a number', () => {
    expect(() => smtpSettings({ SMTP_PORT: 'smtp' })).toThrow('SMTP_PORT must be a port number')
  })
})
