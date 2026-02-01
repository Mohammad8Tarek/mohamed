
import { useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { SystemPermission } from '../types';
import { useProperty } from '../context/PropertyContext';

export const usePermissions = () => {
    const { user, role } = useAuth();
    const { currentProperty } = useProperty();
    
    const rolePermissions = role?.permissions || [];
    const currentPropertyId = currentProperty?.id || 1;

    const has = useCallback((perm: SystemPermission) => {
        if (!user) return false;
        
        // 1. Check for Forced Deny (Highest Priority)
        const forcedDeny = user.overrides?.find(
            ov => ov.propertyId === currentPropertyId && ov.permissionKey === perm && ov.isAllowed === false
        );
        if (forcedDeny) return false;

        // 2. Check for Forced Grant
        const forcedGrant = user.overrides?.find(
            ov => ov.propertyId === currentPropertyId && ov.permissionKey === perm && ov.isAllowed === true
        );
        if (forcedGrant) return true;

        // 3. Fallback to Role Permissions
        if (role?.id === 1 || role?.name === 'Super Admin') return true;
        return rolePermissions.includes(perm);
    }, [user, role, rolePermissions, currentPropertyId]);

    const isAuthorizedForProperty = useCallback((pId: number) => {
        if (role?.id === 1) return true;
        return user?.authorizedProperties?.includes(pId);
    }, [user, role]);

    return useMemo(() => ({
        // General Navigation Permissions
        canViewDashboard: has('DASHBOARD.VIEW'),
        canViewHousing: has('HOUSING.VIEW'),
        canViewEmployees: has('EMPLOYEE.VIEW'),
        canViewReservations: has('RESERVATION.VIEW'),
        canViewMaintenance: has('MAINTENANCE.VIEW'),
        canViewReports: has('REPORT.VIEW'),
        canViewSettings: has('SETTINGS.VIEW'),
        canViewUsers: has('USER.VIEW'),
        canViewRoles: has('ROLE.VIEW'),
        canViewActivityLog: has('LOG.VIEW'),

        // Action Permissions - Employees
        canManageEmployees: has('EMPLOYEE.CREATE') || has('EMPLOYEE.EDIT'),
        canCreateEmployee: has('EMPLOYEE.CREATE'),
        canEditEmployee: has('EMPLOYEE.EDIT'),
        canDeleteEmployee: has('EMPLOYEE.DELETE'),
        canImportEmployees: has('EMPLOYEE.IMPORT'),
        canExportPdf: has('EMPLOYEE.EXPORT.PDF'),
        canExportExcel: has('EMPLOYEE.EXPORT.EXCEL'),

        // Action Permissions - Housing
        canManageHousing: has('HOUSING.MANAGE'),
        canDeleteHousing: has('HOUSING.DELETE'),

        // Action Permissions - Maintenance
        canManageMaintenance: has('MAINTENANCE.MANAGE'),

        // User Management
        canManageUsers: has('USER.CREATE') || has('USER.EDIT'),
        canCreateUser: has('USER.CREATE'),
        canEditUser: has('USER.EDIT'),
        canDisableUser: has('USER.DISABLE'),
        canResetPassword: has('USER.RESET_PASSWORD'),
        canManageRoles: has('ROLE.MANAGE'),

        // System
        isSuperAdmin: role?.id === 1,
        canManageProperties: has('PROPERTY.MANAGE'),
        canManageSettings: has('SETTINGS.MANAGE'),
        
        // Scope Check
        isAuthorizedForProperty,
        resolvePermission: has
    }), [has, isAuthorizedForProperty, role]);
};
