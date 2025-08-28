import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import './styles.css'

export default async function HomePage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const host = headers.get('host')
  const isLocalhost = host?.includes('localhost')

  // Extract the base domain and port
  let baseDomain = host
  let port = ''

  if (host) {
    // Extract port if present
    const hostParts = host.split(':')
    if (hostParts.length > 1) {
      port = `:${hostParts[1]}`
    }

    // Extract base domain without subdomain
    const domainParts = hostParts[0].split('.')
    if (domainParts.length > 2) {
      // For domains like sub.example.com, get example.com
      baseDomain = `${domainParts[domainParts.length - 2]}.${domainParts[domainParts.length - 1]}${port}`
    }
  }

  let subdomain = null
  if (host) {
    const parts = host.split('.')
    // Only extract subdomain if it's a pattern like api.example.com
    // For example.com, subdomain will remain null
    if (parts.length > 2) {
      subdomain = parts[0]
    }
  }

  const { docs: allTenants } = await payload.find({
    collection: 'tenants',
    limit: -1,
  })

  const tenant = allTenants.find(
    (t) => t.country?.toLocaleLowerCase() === subdomain?.toLocaleLowerCase(),
  )

  if (isLocalhost) {
    return (
      <div className="home">
        <div className="content">
          <div className="warning">
            <h2>Warning: Localhost does not work properly with subdomains</h2>
            <p>
              Please use{' '}
              <b>
                <i>localtest.me</i>
              </b>{' '}
              instead. This domain points to 127.0.0.1 and supports subdomains.
            </p>
          </div>
          <div className="tenant-list">
            <h2>Available Tenants</h2>
            <ul>
              {allTenants.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`http://${t.country?.toLowerCase()}.localtest.me${port}`}
                    target="_blank"
                  >
                    {t.name} - {t.country?.toLowerCase()}.localtest.me{port}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )
  }

  if (tenant) {
    return (
      <div className="home">
        <div className="content">
          <div>
            <h2>Welcome to {tenant.name}</h2>
            <p>Subdomain: {subdomain}</p>
            <p>Country: {tenant.country}</p>
            <p>Locale: {tenant.locale}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="home">
      <div className="content">
        <div>
          <h2>Tenant not found</h2>
          <p>Please select from one of the available tenants:</p>
          <ul className="tenant-list">
            {allTenants.map((t) => (
              <li key={t.id}>
                <Link href={`http://${t.country?.toLowerCase()}.${baseDomain}`}>
                  {t.name} - {t.country?.toLowerCase()}.{baseDomain?.split(':')[0]}
                  {port}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
