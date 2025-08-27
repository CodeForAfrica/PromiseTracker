import type { User } from '@/payload-types'
import type { Access, Where } from 'payload'
import { getTenantFromCookie } from '@payloadcms/plugin-multi-tenant/utilities'
import { isAccessingSelf } from './isAccessingSelf'
import { isSuperAdmin } from '@/access/isSuperAdmin'
import { getCollectionIDType } from '@/utils/getCollectionIDTypes'
import { getUserTenantIDs } from '@/utils/getUserTenantIDs'

export const readAccess: Access<User> = ({ req, id }) => {
  const { user } = req

  if (!user) {
    return false
  }

  if (isAccessingSelf({ id, user })) {
    return true
  }

  const superAdmin = isSuperAdmin(user)
  const selectedTenant = getTenantFromCookie(
    req.headers,
    getCollectionIDType({ payload: req.payload, collectionSlug: 'tenants' }),
  )

  const adminTenantAccessIDs = getUserTenantIDs(user, 'tenant-admin')

  if (selectedTenant) {
    // If it's a super admin, or they have access to the tenant ID set in cookie
    const hasTenantAccess = adminTenantAccessIDs.some((id) => id === selectedTenant)
    if (superAdmin || hasTenantAccess) {
      return {
        'tenants.tenant': {
          equals: selectedTenant,
        },
      }
    }
  }

  if (superAdmin) {
    return true
  }

  return {
    or: [
      {
        id: {
          equals: user.id,
        },
      },
      {
        'tenants.tenant': {
          in: adminTenantAccessIDs,
        },
      },
    ],
  } as Where
}
