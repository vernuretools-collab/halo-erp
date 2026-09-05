import { PERMISSIONS } from './permissions'

export const ROLES = {
  SUPERADMIN: {
    id: 'superadmin',
    name: 'Platform Super Admin',
    tier: 'platform',
  },
  OWNER: {
    id: 'owner',
    name: 'Company Owner',
    tier: 'company',
  },
  ADMIN: {
    id: 'admin',
    name: 'Company Administrator',
    tier: 'company',
  },
  DIRECTOR: {
    id: 'director',
    name: 'Director',
    tier: 'company',
  },
  MANAGER: {
    id: 'manager',
    name: 'Manager',
    tier: 'company',
  },
  EMPLOYEE: {
    id: 'employee',
    name: 'Employee',
    tier: 'company',
  },
  CLIENT: {
    id: 'client',
    name: 'Client Portal User',
    tier: 'client',
  },
}
