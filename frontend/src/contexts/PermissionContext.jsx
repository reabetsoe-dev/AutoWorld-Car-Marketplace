import { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { PERMISSIONS } from '../services/api';

const PermissionContext = createContext(null);

const ROLE_PERMISSIONS = {
  viewer: [PERMISSIONS.CARS_VIEW, PERMISSIONS.ADMIN_STATS],
  editor: [
    PERMISSIONS.CARS_VIEW,
    PERMISSIONS.ADMIN_STATS,
    PERMISSIONS.CARS_CREATE,
    PERMISSIONS.CARS_UPDATE,
    PERMISSIONS.CARS_MARK_SOLD,
    PERMISSIONS.SELL_REQUESTS_VIEW,
    PERMISSIONS.SELL_REQUESTS_UPDATE,
    PERMISSIONS.ADMIN_UPLOAD,
    PERMISSIONS.ADMIN_BULK_IMPORT,
    PERMISSIONS.AUDIT_VIEW
  ],
  manager: [
    PERMISSIONS.CARS_VIEW,
    PERMISSIONS.ADMIN_STATS,
    PERMISSIONS.CARS_CREATE,
    PERMISSIONS.CARS_UPDATE,
    PERMISSIONS.CARS_MARK_SOLD,
    PERMISSIONS.SELL_REQUESTS_VIEW,
    PERMISSIONS.SELL_REQUESTS_UPDATE,
    PERMISSIONS.ADMIN_UPLOAD,
    PERMISSIONS.ADMIN_BULK_IMPORT,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.CARS_DELETE,
    PERMISSIONS.USERS_MANAGE
  ],
  admin: [
    PERMISSIONS.CARS_VIEW,
    PERMISSIONS.ADMIN_STATS,
    PERMISSIONS.CARS_CREATE,
    PERMISSIONS.CARS_UPDATE,
    PERMISSIONS.CARS_MARK_SOLD,
    PERMISSIONS.SELL_REQUESTS_VIEW,
    PERMISSIONS.SELL_REQUESTS_UPDATE,
    PERMISSIONS.ADMIN_UPLOAD,
    PERMISSIONS.ADMIN_BULK_IMPORT,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.CARS_DELETE,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.SYSTEM_SETTINGS
  ]
};

export function PermissionProvider({ children }) {
  const { profile } = useAuth();

  const value = useMemo(() => {
    const role = (profile?.role || 'viewer').toLowerCase();
    const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer;

    return {
      role,
      permissions,
      hasPermission(permission) {
        return permissions.includes(permission);
      },
      canViewDashboard: permissions.includes(PERMISSIONS.ADMIN_STATS),
      canManageCars: permissions.includes(PERMISSIONS.CARS_CREATE) || permissions.includes(PERMISSIONS.CARS_UPDATE),
      canManageSellRequests: permissions.includes(PERMISSIONS.SELL_REQUESTS_UPDATE),
      canDeleteCars: permissions.includes(PERMISSIONS.CARS_DELETE),
      canUploadImages: permissions.includes(PERMISSIONS.ADMIN_UPLOAD),
      canImportCsv: permissions.includes(PERMISSIONS.ADMIN_BULK_IMPORT),
      canManageUsers: permissions.includes(PERMISSIONS.USERS_MANAGE),
      canViewAudit: permissions.includes(PERMISSIONS.AUDIT_VIEW),
      canManageSettings: permissions.includes(PERMISSIONS.SYSTEM_SETTINGS)
    };
  }, [profile]);

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function usePermissions() {
  return useContext(PermissionContext);
}
