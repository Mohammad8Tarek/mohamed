
import React, { useState, useEffect, useMemo } from 'react';
import { User, Role, SystemPermission, AVAILABLE_MODULES, UserPermissionOverride } from '../types';
import { userApi, roleApi, logActivity } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { usePermissions } from '../hooks/usePermissions';
import { useProperty } from '../context/PropertyContext'; 
import { Navigate } from 'react-router-dom';

const PERMISSION_GROUPS: Record<string, SystemPermission[]> = {
    'DASHBOARD': ['DASHBOARD.VIEW'],
    'HOUSING': ['HOUSING.VIEW', 'HOUSING.MANAGE', 'HOUSING.DELETE'],
    'EMPLOYEES': ['EMPLOYEE.VIEW', 'EMPLOYEE.CREATE', 'EMPLOYEE.EDIT', 'EMPLOYEE.DELETE', 'EMPLOYEE.IMPORT', 'EMPLOYEE.EXPORT.PDF', 'EMPLOYEE.EXPORT.EXCEL'],
    'RESERVATIONS': ['RESERVATION.VIEW', 'RESERVATION.MANAGE', 'RESERVATION.DELETE'],
    'MAINTENANCE': ['MAINTENANCE.VIEW', 'MAINTENANCE.MANAGE', 'MAINTENANCE.DELETE'],
    'REPORTS': ['REPORT.VIEW', 'REPORT.EXPORT'],
    'USERS & SECURITY': ['USER.VIEW', 'USER.CREATE', 'USER.EDIT', 'USER.DISABLE', 'USER.RESET_PASSWORD', 'ROLE.VIEW', 'ROLE.MANAGE', 'LOG.VIEW'],
    'SYSTEM': ['PROPERTY.MANAGE', 'SETTINGS.VIEW', 'SETTINGS.MANAGE']
};

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

    // Modal states
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    
    // Tab tracking inside user modal
    const [activeUserTab, setActiveUserTab] = useState<'profile' | 'access' | 'permissions'>('profile');

    const [userForm, setUserForm] = useState({
        username: '',
        fullName: '',
        email: '',
        password: '',
        roleId: 6,
        status: 'active' as User['status'],
        propertyId: 1 
    });

    const [propertyAccess, setPropertyAccess] = useState<number[]>([]);
    const [permissionOverrides, setPermissionOverrides] = useState<UserPermissionOverride[]>([]);

    const [roleForm, setRoleForm] = useState({
        name: '',
        permissions: [] as SystemPermission[]
    });

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
    }, [perms.isSuperAdmin]);

    const filteredUsers = useMemo(() => {
        return users.filter(user => 
            user.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
            user.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [users, searchTerm]);

    const openAddUser = () => {
        setEditingUser(null);
        setActiveUserTab('profile');
        setUserForm({ 
            username: '', fullName: '', email: '', password: '', 
            roleId: roles[roles.length-1]?.id || 6, 
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
        
        // Fetch specific overrides for this user
        const overrides = await userApi.getOverrides(user.id);
        setPermissionOverrides(overrides);
        
        setIsUserModalOpen(true);
    };

    // Helper to compute effective permissions based on role and overrides for a given property
    const computeEffectivePermissions = (
        baseRoleId: number,
        propId: number,
        userOverrides: UserPermissionOverride[],
        allRoles: Role[]
    ): SystemPermission[] => {
        const baseRole = allRoles.find(r => r.id === baseRoleId);
        let effectivePerms = new Set<SystemPermission>(baseRole?.permissions || []);

        const relevantOverrides = userOverrides.filter(ov => ov.propertyId === propId);

        // Apply explicit denials first
        relevantOverrides
            .filter(ov => !ov.isAllowed)
            .forEach(ov => effectivePerms.delete(ov.permissionKey));

        // Then apply explicit grants
        relevantOverrides
            .filter(ov => ov.isAllowed)
            .forEach(ov => effectivePerms.add(ov.permissionKey));

        return Array.from(effectivePerms);
    };

    const handleUserSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation Layer - Ensure data integrity before API call
        if (!userForm.username || !userForm.username.trim()) {
            showToast("User Identity (Username) is mandatory.", "warning");
            setActiveUserTab('profile');
            return;
        }
        if (!editingUser && (!userForm.password || !userForm.password.trim())) {
            showToast("A secure passphrase is required for new identities.", "warning");
            setActiveUserTab('profile');
            return;
        }
        if (propertyAccess.length === 0) {
            showToast("Identity must be mapped to at least one property scope.", "warning");
            setActiveUserTab('access');
            return;
        }

        const submissionData = {
            ...userForm,
            username: userForm.username.trim().toLowerCase(),
            fullName: userForm.fullName.trim(),
            email: userForm.email.trim()
        };

        // CRITICAL VALIDATION: Ensure user has DASHBOARD.VIEW permission for their default property
        const effectivePermissionsForDefaultProperty = computeEffectivePermissions(
            submissionData.roleId,
            submissionData.propertyId,
            permissionOverrides, // Use the current state of overrides
            roles
        );

        if (!effectivePermissionsForDefaultProperty.includes('DASHBOARD.VIEW')) {
            showToast(t('errors.noDashboardAccess'), 'critical');
            setActiveUserTab('permissions'); // Direct user to the permissions tab
            return;
        }

        setIsSubmitting(true);
        try {
            let userId = editingUser?.id;
            let finalPermissionOverrides = permissionOverrides;

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
                finalPermissionOverrides = permissionOverrides.map(ov => ({
                    ...ov,
                    userId: newUser.id!, // Set actual userId
                }));
            }

            if (userId) {
                // Update Multi-Property Access
                await userApi.updateAccess(userId, propertyAccess, userForm.propertyId);
                // Update Permission Overrides
                await userApi.updateOverrides(userId, finalPermissionOverrides);
                
                logActivity(currentUser!.username, `Security Policy Updated: ${submissionData.username}`, { 
                    actionType: 'SECURITY',
                    module: 'users'
                });
            }

            showToast(t(editingUser ? 'users.updated' : 'users.added'), 'success');
            setIsUserModalOpen(false);
            fetchData();
        } catch (error: any) {
            showToast(error.message || t('errors.generic'), 'critical');
        } finally { setIsSubmitting(false); }
    };

    const handleToggleProperty = (propId: number) => {
        setPropertyAccess(prev => 
            prev.includes(propId) ? prev.filter(id => id !== propId) : [...prev, propId]
        );
    };

    const handleToggleOverride = (perm: SystemPermission, propId: number, state: 'inherit' | 'grant' | 'deny') => {
        // For new users (editingUser is null), use a placeholder userId (e.g., 0) for temporary state management
        const userIdForOverride = editingUser?.id || 0; 

        setPermissionOverrides(prev => {
            const base = prev.filter(ov => !(ov.propertyId === propId && ov.permissionKey === perm && ov.userId === userIdForOverride));
            if (state === 'inherit') return base;
            return [...base, { userId: userIdForOverride, propertyId: propId, permissionKey: perm, isAllowed: state === 'grant' }];
        });
    };

    const handleRoleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!roleForm.name.trim()) return;
        setIsSubmitting(true);
        try {
            if (editingRole) {
                await roleApi.update(editingRole.id, roleForm);
                showToast("Role template updated", 'success');
            } else {
                await roleApi.create(roleForm);
                showToast("Role template created", 'success');
            }
            setIsRoleModalOpen(false);
            fetchData();
        } catch (e: any) { showToast(e.message, 'critical'); }
        finally { setIsSubmitting(false); }
    };

    const inputClass = "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-hotel-gold outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white transition-all shadow-inner placeholder-slate-400";
    const labelClass = "block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-widest";

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

            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="p-5 border-b dark:border-slate-700 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="relative w-full max-w-sm">
                        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                        <input type="text" placeholder="Filter identities..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-white border border-slate-200 text-xs font-bold rounded-xl w-full pl-10 pr-4 py-2.5 dark:bg-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-hotel-gold" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
                        <thead className="text-[10px] font-black uppercase text-slate-500 bg-white dark:bg-slate-700 tracking-wider">
                            <tr>
                                <th className="px-6 py-5">Identity</th>
                                <th className="px-6 py-5">Base Role</th>
                                <th className="px-6 py-5">Property Scope</th>
                                <th className="px-6 py-5 text-center">Authorization</th>
                                <th className="px-6 py-5 text-center">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {filteredUsers.map(user => {
                                const role = roles.find(r => r.id === user.roleId);
                                return (
                                    <tr key={user.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors ${user.status === 'disabled' ? 'opacity-40' : ''}`}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-hotel-navy text-white flex items-center justify-center text-xs font-black">
                                                    {user.username.substring(0, 1).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-900 dark:text-white uppercase text-xs tracking-tight">{user.username}</span>
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase">{user.fullName}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-[10px] font-black uppercase text-hotel-gold bg-hotel-navy/5 px-2.5 py-1 rounded-lg">
                                                {role?.name || 'VIEWER'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                {user.authorizedProperties?.map(pId => (
                                                    <span key={pId} className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${pId === user.propertyId ? 'bg-hotel-gold/10 text-hotel-gold border-hotel-gold/20' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                                                        {allProperties.find(p => p.id === pId)?.code || 'EXT'}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border ${user.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                                {user.status === 'active' ? 'Verified' : 'Revoked'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button onClick={() => openEditUser(user)} className="p-2.5 text-primary-600 hover:bg-primary-50 rounded-xl transition-all">
                                                <i className="fas fa-fingerprint text-lg"></i>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Advanced User Authorization Modal */}
            {isUserModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[110] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-hotel-navy text-white">
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-widest">{editingUser ? 'Policy Configuration' : 'Identity Provisioning'}</h2>
                                <p className="text-[10px] font-bold uppercase opacity-60 mt-1">Global Identity: {userForm.username || 'New Entity'}</p>
                            </div>
                            <button onClick={() => setIsUserModalOpen(false)} className="text-white/40 hover:text-white transition-colors"><i className="fas fa-times text-2xl"></i></button>
                        </div>
                        
                        {/* Tab Navigation */}
                        <div className="flex border-b dark:border-slate-700 px-8 bg-slate-50/50">
                            {[
                                { id: 'profile', icon: 'fa-user-circle', label: 'Identity Profile' },
                                { id: 'access', icon: 'fa-building', label: 'Property Scope' },
                                { id: 'permissions', icon: 'fa-lock-open', label: 'Atomic Overrides' }
                            ].map(tab => (
                                <button key={tab.id} onClick={() => setActiveUserTab(tab.id as any)} className={`flex items-center gap-2.5 px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeUserTab === tab.id ? 'border-hotel-gold text-hotel-navy dark:text-hotel-gold' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                                    <i className={`fas ${tab.icon}`}></i> {tab.label}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleUserSubmit} className="flex-1 overflow-hidden flex flex-col">
                            <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                                {activeUserTab === 'profile' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up max-w-3xl">
                                        <div className="col-span-2 space-y-4">
                                            <h3 className="text-xs font-black uppercase text-hotel-gold tracking-[0.2em] border-b pb-2">Core Identity</h3>
                                        </div>
                                        <div><label className={labelClass}>Username</label><input value={userForm.username} onChange={e => setUserForm(p=>({...p, username: e.target.value.toLowerCase()}))} disabled={!!editingUser} required className={inputClass} /></div>
                                        <div><label className={labelClass}>Full Legal Name</label><input value={userForm.fullName} onChange={e => setUserForm(p=>({...p, fullName: e.target.value}))} required className={inputClass} /></div>
                                        <div><label className={labelClass}>Email Vector</label><input type="email" value={userForm.email} onChange={e => setUserForm(p=>({...p, email: e.target.value}))} required className={inputClass} /></div>
                                        <div><label className={labelClass}>Security Passphrase</label><input type="password" value={userForm.password} onChange={e => setUserForm(p=>({...p, password: e.target.value}))} placeholder={editingUser ? 'Retain current' : 'Define secure string'} className={inputClass} /></div>
                                        
                                        <div className="col-span-2 mt-4 space-y-4">
                                            <h3 className="text-xs font-black uppercase text-hotel-gold tracking-[0.2em] border-b pb-2">Account Lifecycle</h3>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Security Template (Role)</label>
                                            <select value={userForm.roleId} onChange={e => setUserForm(p=>({...p, roleId: parseInt(e.target.value)}))} className={inputClass}>
                                                {roles.map(r => <option key={r.id} value={r.id}>{r.name.toUpperCase()}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Operational Status</label>
                                            <select value={userForm.status} onChange={e => setUserForm(p=>({...p, status: e.target.value as any}))} className={inputClass}>
                                                <option value="active">Authorized (Active)</option>
                                                <option value="disabled">Revoked (Disabled)</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {activeUserTab === 'access' && (
                                    <div className="animate-fade-in-up space-y-8">
                                        <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex gap-4 items-center">
                                            <i className="fas fa-info-circle text-amber-600 text-2xl"></i>
                                            <p className="text-[11px] text-amber-800 font-bold leading-relaxed uppercase tracking-tight">Select which property data sets this identity can access. One property must be designated as the primary default context.</p>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {allProperties.map(prop => (
                                                <div key={prop.id} className={`p-5 rounded-2xl border-2 transition-all flex flex-col gap-4 ${propertyAccess.includes(prop.id) ? 'bg-white border-hotel-gold shadow-lg' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-hotel-gold font-black shadow-inner">
                                                                {prop.code.substring(0, 2)}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{prop.displayName || prop.name}</span>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{prop.code}</span>
                                                            </div>
                                                        </div>
                                                        <input type="checkbox" checked={propertyAccess.includes(prop.id)} onChange={() => handleToggleProperty(prop.id)} className="w-5 h-5 rounded text-hotel-gold border-slate-300 focus:ring-hotel-gold" />
                                                    </div>
                                                    
                                                    {propertyAccess.includes(prop.id) && (
                                                        <label className="flex items-center gap-2 cursor-pointer pt-3 border-t">
                                                            <input type="radio" name="defaultProp" checked={userForm.propertyId === prop.id} onChange={() => setUserForm(p => ({...p, propertyId: prop.id}))} className="text-hotel-gold focus:ring-hotel-gold" />
                                                            <span className="text-[9px] font-black uppercase text-hotel-gold">Set as Default Entry</span>
                                                        </label>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {activeUserTab === 'permissions' && (
                                    <div className="animate-fade-in-up space-y-8">
                                        <div className="flex justify-between items-center border-b pb-4">
                                            <h3 className="text-xs font-black uppercase text-hotel-gold tracking-[0.2em]">Atomic Permission Matrix</h3>
                                            <div className="flex items-center gap-4">
                                                <span className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase"><span className="w-2 h-2 rounded-full bg-slate-200"></span> Inherited</span>
                                                <span className="flex items-center gap-1.5 text-[9px] font-black text-emerald-600 uppercase"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Forced Grant</span>
                                                <span className="flex items-center gap-1.5 text-[9px] font-black text-rose-600 uppercase"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Forced Deny</span>
                                            </div>
                                        </div>

                                        {propertyAccess.length === 0 ? (
                                            <div className="p-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                                <i className="fas fa-lock-open text-4xl text-slate-200 mb-4"></i>
                                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Select at least one property scope to configure atomic overrides</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-12">
                                                {propertyAccess.map(pId => {
                                                    const prop = allProperties.find(p => p.id === pId);
                                                    return (
                                                        <div key={pId} className="space-y-6">
                                                            <div className="flex items-center gap-3 bg-hotel-navy text-white px-5 py-3 rounded-xl w-fit shadow-md">
                                                                <i className="fas fa-building text-hotel-gold"></i>
                                                                <span className="text-[10px] font-black uppercase tracking-widest">{prop?.displayName || prop?.name}</span>
                                                            </div>

                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                                                                {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
                                                                    <div key={group} className="space-y-4">
                                                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-l-4 border-hotel-gold pl-3">{group}</h4>
                                                                        <div className="grid gap-3">
                                                                            {perms.map(p => {
                                                                                const userIdForOverride = editingUser?.id || 0; // Use 0 as placeholder for new users
                                                                                const override = permissionOverrides.find(ov => ov.userId === userIdForOverride && ov.propertyId === pId && ov.permissionKey === p);
                                                                                const state = override === undefined ? 'inherit' : override.isAllowed ? 'grant' : 'deny';
                                                                                
                                                                                return (
                                                                                    <div key={p} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl group transition-all hover:shadow-sm">
                                                                                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tighter truncate max-w-[180px]">
                                                                                            {p.split('.').join(' • ')}
                                                                                        </span>
                                                                                        <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 border dark:border-slate-700 shadow-inner">
                                                                                            <button type="button" onClick={() => handleToggleOverride(p, pId, 'inherit')} className={`px-2 py-1 text-[8px] font-black uppercase rounded ${state === 'inherit' ? 'bg-slate-200 text-slate-700 shadow-sm' : 'text-slate-400'}`}>Template</button>
                                                                                            <button type="button" onClick={() => handleToggleOverride(p, pId, 'grant')} className={`px-2 py-1 text-[8px] font-black uppercase rounded ${state === 'grant' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400'}`}>Allow</button>
                                                                                            <button type="button" onClick={() => handleToggleOverride(p, pId, 'deny')} className={`px-2 py-1 text-[8px] font-black uppercase rounded ${state === 'deny' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400'}`}>Block</button>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="p-8 border-t dark:border-slate-700 flex justify-end gap-4 bg-slate-50/50">
                                <button type="button" onClick={() => setIsUserModalOpen(false)} className="px-8 py-3 text-[10px] font-black uppercase text-slate-500 hover:text-slate-700 transition-all">Discard Changes</button>
                                <button type="submit" disabled={isSubmitting || propertyAccess.length === 0} className="px-12 py-3 bg-hotel-navy text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all">
                                    {isSubmitting ? <i className="fas fa-spinner fa-spin me-2"></i> : <i className="fas fa-shield-check me-2"></i>}
                                    Commit Identity Policy
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Role Matrix Modal */}
            {isRoleModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-hotel-navy text-white">
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-widest">{editingRole ? 'Update Security Template' : 'New Security Template'}</h2>
                                <p className="text-[10px] font-bold uppercase opacity-60 mt-1">Defines default permissions for assigned users.</p>
                            </div>
                            <button onClick={() => setIsRoleModalOpen(false)} className="text-white/40 hover:text-white transition-colors"><i className="fas fa-times text-2xl"></i></button>
                        </div>
                        <form onSubmit={handleRoleSubmit} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                                <div className="max-w-md">
                                    <label className={labelClass}>Template Name</label>
                                    <input type="text" value={roleForm.name} onChange={e => setRoleForm(p => ({...p, name: e.target.value}))} required disabled={editingRole?.isSystem} className={inputClass} placeholder="e.g. Regional HR" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
                                        <div key={group} className="p-5 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200">
                                            <h4 className="text-[10px] font-black uppercase text-slate-500 mb-4">{group}</h4>
                                            <div className="space-y-2">
                                                {perms.map(p => (
                                                    <label key={p} className="flex items-center gap-3 p-2 bg-white dark:bg-slate-800 rounded-xl cursor-pointer hover:shadow-sm">
                                                        <input type="checkbox" checked={roleForm.permissions.includes(p)} onChange={() => {
                                                            const has = roleForm.permissions.includes(p);
                                                            setRoleForm(prev => ({ ...prev, permissions: has ? prev.permissions.filter(x => x !== p) : [...prev.permissions, p] }));
                                                        }} className="w-4 h-4 text-hotel-gold rounded border-slate-300 focus:ring-hotel-gold" />
                                                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">{p.replace('.', ' • ')}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50/50">
                                <button type="button" onClick={() => setIsRoleModalOpen(false)} className="px-6 py-2 text-slate-400 font-black uppercase text-[10px]">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="px-10 py-2.5 bg-hotel-navy text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl">Save Template</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UsersPage;