
import { Role, SystemPermission, UserPermissionOverride } from '../types';

export class PermissionCalculator {
  // All possible permissions in the system, for Super Admin role.
  private static ALL_SYSTEM_PERMISSIONS: SystemPermission[] = [
    'DASHBOARD.VIEW',
    'HOUSING.VIEW', 'HOUSING.MANAGE', 'HOUSING.DELETE',
    'EMPLOYEE.VIEW', 'EMPLOYEE.CREATE', 'EMPLOYEE.EDIT', 'EMPLOYEE.DELETE',
    'EMPLOYEE.IMPORT', 'EMPLOYEE.EXPORT.PDF', 'EMPLOYEE.EXPORT.EXCEL',
    'RESERVATION.VIEW', 'RESERVATION.MANAGE', 'RESERVATION.DELETE',
    'MAINTENANCE.VIEW', 'MAINTENANCE.MANAGE', 'MAINTENANCE.DELETE',
    'REPORT.VIEW', 'REPORT.EXPORT',
    // Dynamic Report Permissions
    'report.view.employees', 'report.export.pdf.employees', 'report.export.excel.employees',
    'report.view.housing', 'report.export.pdf.housing', 'report.export.excel.housing',
    'report.view.inhouse', 'report.export.pdf.inhouse', 'report.export.excel.inhouse',
    'report.view.reservations', 'report.export.pdf.reservations', 'report.export.excel.reservations',
    'report.view.maintenance', 'report.export.pdf.maintenance', 'report.export.excel.maintenance',
    'report.view.audit', 'report.export.pdf.audit', 'report.export.excel.audit',
    'USER.VIEW', 'USER.CREATE', 'USER.EDIT', 'USER.DISABLE', 'USER.RESET_PASSWORD',
    'ROLE.VIEW', 'ROLE.MANAGE',
    'PROPERTY.MANAGE',
    'LOG.VIEW',
    'SETTINGS.VIEW', 'SETTINGS.MANAGE'
  ];

  /**
   * Compute effective permissions for a user at a specific property,
   * taking into account their base role and any explicit overrides.
   * Super Admins automatically get all permissions.
   */
  static computeEffective(
    baseRoleId: number,
    propertyId: number,
    userOverrides: UserPermissionOverride[],
    allRoles: Role[],
    isSuperAdmin: boolean = false
  ): SystemPermission[] {
    // Super Admin always has all permissions
    if (isSuperAdmin) {
      return PermissionCalculator.ALL_SYSTEM_PERMISSIONS;
    }
    
    // Start with base role permissions
    const baseRole = allRoles.find(r => r.id === baseRoleId);
    if (!baseRole) {
      // This should ideally not happen if roles are managed correctly
      console.warn(`Role with ID ${baseRoleId} not found. Returning empty permissions.`);
      return [];
    }
    
    const effectivePerms = new Set<SystemPermission>(baseRole.permissions);
    
    // Apply property-specific overrides (only relevant ones for this property)
    const relevantOverrides = userOverrides.filter(
      ov => ov.propertyId === propertyId
    );
    
    // Step 1: Apply explicit DENIALS (highest priority, override role grants)
    relevantOverrides
      .filter(ov => !ov.isAllowed) // isAllowed === false means deny
      .forEach(ov => effectivePerms.delete(ov.permissionKey));
    
    // Step 2: Apply explicit GRANTS (override role denials)
    relevantOverrides
      .filter(ov => ov.isAllowed) // isAllowed === true means grant
      .forEach(ov => effectivePerms.add(ov.permissionKey));
    
    return Array.from(effectivePerms);
  }
  
  /**
   * Validate that a user can access the system dashboard.
   * This is a critical check to prevent users from being locked out.
   */
  static validateMinimumAccess(
    permissions: SystemPermission[],
  ): { valid: boolean; error?: string } {
    if (!permissions.includes('DASHBOARD.VIEW')) {
      return {
        valid: false,
        error: `User must have 'DASHBOARD.VIEW' permission to access the dashboard.`
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Returns all possible system permissions. Useful for Super Admin roles.
   */
  static getAllPermissions(): SystemPermission[] {
    return PermissionCalculator.ALL_SYSTEM_PERMISSIONS;
  }
}
