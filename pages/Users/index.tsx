
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Role, SystemPermission, TempPermissionOverride } from '../../types';
import { userApi, roleApi, logActivity } from '../../services/apiService';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useProperty } from '../../context/PropertyContext'; 
import { Navigate } from 'react-router-dom';
import { PermissionCalculator } from '../../utils/permissions.utils'; // NEW: Import PermissionCalculator
import { UsersTable } from './components/UsersTable'; // NEW: Component
import { UserModal } from './components/UserModal'; // NEW: Component
import { RoleModal } from './components/RoleModal'; // NEW: Component
import { debounce } from 'lodash-es'; // Using lodash for debounce as requested in prompt

// This constant defines logical groupings of permissions for display purposes in the UI.
// It is used in RoleModal and PermissionsTab to organize checkboxes and overrides.
export const PERMISSION_GROUPS: Record<string, SystemPermission[]> = {
    'DASHBOARD': ['DASHBOARD.VIEW'],
    'HOUSING': ['HOUSING.VIEW', 'HOUSING.MANAGE', 'HOUSING.DELETE'],
    'EMPLOYEES': ['EMPLOYEE.VIEW', 'EMPLOYEE.CREATE', 'EMPLOYEE.EDIT', 'EMPLOYEE.DELETE', 'EMPLOYEE.IMPORT', 'EMPLOYEE.EXPORT.PDF', 'EMPLOYEE.EXPORT.EXCEL'],
    'RESERVATIONS': ['RESERVATION.VIEW', 'RESERVATION.MANAGE', 'RESERVATION.DELETE'],
    'MAINTENANCE': ['MAINTENANCE.VIEW', 'MAINTENANCE.MANAGE', 'MAINTENANCE.DELETE'],
    'REPORTS': PermissionCalculator.getAllPermissions().filter(p => p.startsWith('REPORT.VIEW') || p.startsWith('report.export')), // Dynamically get all report permissions
    'USERS & SECURITY': ['USER.VIEW', 'USER.CREATE', 'USER.EDIT', 'USER.DISABLE', 'USER.RESET_PASSWORD', 'ROLE.VIEW', 'ROLE.MANAGE', 'LOG.VIEW'],
    'SYSTEM': ['PROPERTY.MANAGE', 'SETTINGS.VIEW', 'SETTINGS.MANAGE']
};

const USERS_PER_PAGE = 10; // For pagination

const UsersPage: React.FC = () => {
    const { user: currentUser } = useAuth();
    const { t, language } = useLanguage();
    const { showToast } = useToast();
    const perms = usePermissions();
    const { allProperties, currentProperty } = useProperty(); 
    
    if (!perms.canViewUsers) return <Navigate to="/" />;

    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);

    // Modal states
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    
    // User Modal form states
    const [activeUserTab, setActiveUserTab] = useState<'profile' | 'access' | 'permissions'>('profile');
    const [userForm, setUserForm] = useState({
        username: '',
        fullName: '',
        email: '',
        password: '',
        roleId: 6, // Default to 'Viewer' role if exists, otherwise first role or 6
        status: 'active' as User['status'],
        propertyId: 1 // Default property
    });
    const [propertyAccess, setPropertyAccess] = useState<number[]>([]);
    const [permissionOverrides, setPermissionOverrides] = useState<TempPermissionOverride[]>([]); // Using TempPermissionOverride

    // Role Modal form states
    const [roleForm, setRoleForm] = useState({
        name: '',
        permissions: [] as SystemPermission[]
    });

    // Debounce search term
    useEffect(() => {
        const handler = debounce(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300); // 300ms delay

        handler();
        return () => {
            handler.cancel();
        };
    }, [searchTerm]);


    const fetchData = async () => {
        setLoading(true);
        try {
            const [uData, rData] = await Promise.all([
                userApi.getAll(perms.isSuperAdmin),
                roleApi.getAll()
            ]);
            setUsers(uData);
            setRoles(rData);
        } catch (error) { 
            showToast(t('errors.fetchFailed'), 'critical'); 
        } finally { setLoading(false); }
    };

    useEffect(() => { 
        fetchData(); 
    }, [perms.isSuperAdmin, currentProperty?.id]); // Refresh when property changes

    const filteredUsers = useMemo(() => {
        const lowerSearch = debouncedSearchTerm.toLowerCase();
        return users.filter(user => 
            user.username.toLowerCase().includes(lowerSearch) || 
            user.fullName?.toLowerCase().includes(lowerSearch) ||
            user.email?.toLowerCase().includes(lowerSearch)
        );
    }, [users, debouncedSearchTerm]);

    // Pagination logic
    const paginatedUsers = useMemo(() => {
        const start = (currentPage - 1) * USERS_PER_PAGE;
        const end = start + USERS_PER_PAGE;
        return filteredUsers.slice(start, end);
    }, [filteredUsers, currentPage]);

    const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);

    const openAddUser = () => {
        setEditingUser(null);
        setActiveUserTab('profile');
        setUserForm({ 
            username: '', fullName: '', email: '', password: '', 
            roleId: roles[roles.length-1]?.id || 6, // Default to the last role (often 'Viewer') or 6
            status: 'active',
            propertyId: currentProperty?.id || 1
        });
        setPropertyAccess([currentProperty?.id || 1]);
        setPermissionOverrides([]); // Clear overrides for new user
        setIsUserModalOpen(true);
    };

    const openEditUser = async (user: User) => {
        setEditingUser(user);
        setActiveUserTab('profile');
        setUserForm({ 
            username: user.username, fullName: user.fullName || '', email: user.email || '', 
            password: '', roleId: user.roleId, status: user.status, propertyId: user.propertyId 
        });
        setPropertyAccess(user.authorizedProperties || []);
        
        // Fetch specific overrides for this user and map to TempPermissionOverride
        const overrides = await userApi.getOverrides(user.id);
        setPermissionOverrides(overrides.map(ov => ({ ...ov, tempId: `existing-${ov.permissionKey}-${ov.propertyId}` })));
        
        setIsUserModalOpen(true);
    };

    const handleUserSubmit = async (formData: typeof userForm, currentPropertyAccess: number[], currentPermissionOverrides: TempPermissionOverride[], showDashboardAccessWarning: boolean, setShowDashboardAccessWarning: React.Dispatch<React.SetStateAction<boolean>>) => {
        // Validation Layer - Ensure data integrity before API call
        if (!formData.username || !formData.username.trim()) {
            showToast("User Identity (Username) is mandatory.", "warning");
            setActiveUserTab('profile');
            return;
        }
        if (!editingUser && (!formData.password || !formData.password.trim())) {
            showToast("A secure passphrase is required for new identities.", "warning");
            setActiveUserTab('profile');
            return;
        }
        if (currentPropertyAccess.length === 0) {
            showToast("Identity must be mapped to at least one property scope.", "warning");
            setActiveUserTab('access');
            return;
        }
        if (!currentPropertyAccess.includes(formData.propertyId)) {
            showToast("The default property must be included in the user's accessible properties.", "warning");
            setActiveUserTab('access');
            return;
        }

        const submissionData = {
            ...formData,
            username: formData.username.trim().toLowerCase(),
            fullName: formData.fullName.trim(),
            email: formData.email.trim()
        };

        // CRITICAL VALIDATION: Ensure user has DASHBOARD.VIEW permission for their default property
        try {
            const effectivePermissionsForDefaultProperty = PermissionCalculator.computeEffective(
                submissionData.roleId,
                submissionData.propertyId,
                currentPermissionOverrides.map(ov => ({ // Map TempOverride to UserPermissionOverride for calculation
                    userId: editingUser?.id || 0, // Placeholder userId for calculation
                    propertyId: ov.propertyId,
                    permissionKey: ov.permissionKey,
                    isAllowed: ov.isAllowed
                })), 
                roles,
                perms.isSuperAdmin // Pass isSuperAdmin to calculator for global override
            );

            const validation = PermissionCalculator.validateMinimumAccess(effectivePermissionsForDefaultProperty);
            
            if (!validation.valid) {
                showToast(t('errors.noDashboardAccess'), 'critical');
                setActiveUserTab('permissions'); // Direct user to the permissions tab
                setShowDashboardAccessWarning(true); // Show in-tab warning
                return;
            } else {
                setShowDashboardAccessWarning(false); // Clear warning if check passes
            }
        } catch (error: any) {
            showToast(error.message || t('errors.generic'), 'critical');
            setActiveUserTab('permissions');
            setShowDashboardAccessWarning(true);
            return;
        }


        setIsSubmitting(true);
        try {
            let userId = editingUser?.id;
            let finalPermissionOverrides: TempPermissionOverride[] = currentPermissionOverrides;

            if (editingUser) {
                await userApi.update(editingUser.id, submissionData);
            } else {
                // Check if username already exists for new users
                const usernameExists = await userApi.checkUsernameExists(submissionData.username);
                if (usernameExists) {
                    showToast(t('errors.duplicateUsername', { username: submissionData.username }), 'critical');
                    setIsSubmitting(false);
                    return;
                }
                const newUser = await userApi.create({ ...submissionData, createdAt: new Date().toISOString() });
                userId = newUser.id;

                // For new users, update the userId in the temporary overrides with the actual new userId
                finalPermissionOverrides = currentPermissionOverrides.map(ov => ({
                    ...ov,
                    userId: newUser.id!, // Set actual userId
                }));
            }

            if (userId) {
                // Update Multi-Property Access
                await userApi.updateAccess(userId, currentPropertyAccess, formData.propertyId);
                // Update Permission Overrides
                await userApi.updateOverrides(userId, finalPermissionOverrides.map(ov => ({ // Map back to UserPermissionOverride
                    userId: userId!,
                    propertyId: ov.propertyId,
                    permissionKey: ov.permissionKey,
                    isAllowed: ov.isAllowed
                })));
                
                logActivity(currentUser!.username, `Security Policy Updated: ${submissionData.username}`, { 
                    actionType: 'SECURITY',
                    module: 'users'
                });
            }

            showToast(t(editingUser ? 'users.updated' : 'users.added'), 'success');
            setIsUserModalOpen(false);
            fetchData(); // Re-fetch data to update table
            setCurrentPage(1); // Reset pagination after add/edit
        } catch (error: any) {
            showToast(error.message || t('errors.generic'), 'critical');
        } finally { setIsSubmitting(false); }
    };

    const handleRoleSubmit = async (roleData: typeof roleForm, currentEditingRole: Role | null) => {
        if (!roleData.name.trim()) return;
        setIsSubmitting(true);
        try {
            if (currentEditingRole) {
                await roleApi.update(currentEditingRole.id, roleData);
                showToast("Role template updated", 'success');
            } else {
                await roleApi.create(roleData);
                showToast("Role template created", 'success');
            }
            setIsRoleModalOpen(false);
            fetchData();
        } catch (e: any) { showToast(e.message, 'critical'); }
        finally { setIsSubmitting(false); }
    };

    const inputClass = "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-hotel-gold outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white transition-all shadow-inner placeholder-slate-400";

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none">Security Center</h1>
                    <p className="text-hotel-muted dark:text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Granular Authorization & Property Access</p>
                </div>
                <div className="flex gap-2">
                    {perms.canManageRoles && (
                        <button onClick={() => { setEditingRole(null); setRoleForm({ name: '', permissions: [] }); setIsRoleModalOpen(true); }} className="px-5 py-2.5 bg-hotel-navy text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:brightness-110 transition-all">
                           <i className="fas fa-shield-alt me-2"></i>Security Templates
                        </button>
                    )}
                    {perms.canCreateUser && (
                        <button onClick={openAddUser} className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:brightness-110 transition-all">
                            <i className="fas fa-user-plus me-2"></i>{t('users.add')}
                        </button>
                    )}
                </div>
            </div>

            <UsersTable
                users={paginatedUsers}
                roles={roles}
                allProperties={allProperties}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                openEditUser={openEditUser}
                loading={loading}
                t={t}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                usersPerPage={USERS_PER_PAGE}
                filteredUsersLength={filteredUsers.length}
            />

            <UserModal
                isOpen={isUserModalOpen}
                onClose={() => {setIsUserModalOpen(false)}}
                editingUser={editingUser}
                userForm={userForm}
                setUserForm={setUserForm}
                propertyAccess={propertyAccess}
                setPropertyAccess={setPropertyAccess}
                permissionOverrides={permissionOverrides}
                setPermissionOverrides={setPermissionOverrides}
                roles={roles}
                allProperties={allProperties}
                activeTab={activeUserTab}
                setActiveTab={setActiveUserTab}
                isSubmitting={isSubmitting}
                onSubmit={handleUserSubmit}
                showDashboardAccessWarning={false} // Will be managed internally by UserModal now
            />

            <RoleModal
                isOpen={isRoleModalOpen}
                onClose={() => setIsRoleModalOpen(false)}
                editingRole={editingRole}
                roleForm={roleForm}
                setRoleForm={setRoleForm}
                isSubmitting={isSubmitting}
                onSubmit={handleRoleSubmit}
                permissionGroups={PERMISSION_GROUPS}
            />
        </div>
    );
};

export default UsersPage;
