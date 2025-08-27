import { User } from '@/payload-types'
import { Access } from 'payload'

export const isSuperAdmin = (user: User | null) => {
  return Boolean(user?.roles?.includes('super-admin'))
}

export const isSuperAdminAccess: Access = ({ req }): boolean => {
  return isSuperAdmin(req.user)
}
