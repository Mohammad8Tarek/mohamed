
import React, { useMemo } from 'react';
import { User, Role, SystemPermission, Property, TempPermissionOverride } from '../../../../types';
import { useLanguage } from '../../../../context/LanguageContext';
import { PERMISSION_GROUPS } from '../../index'; // Import from parent UsersPage
import { PermissionOverrideControl } from './PermissionOverrideControl';
import { PermissionCalculator } from '../../../../utils/permissions.utils'; // Import PermissionCalculator

interface PermissionsTabProps {
    editingUser: User | null;
    userForm: {
        username: string;
        fullName: string;
        email: string;
        password?: string;
        roleId: number;
        status: User['status'];
        propertyId: number;
    };
    permissionOverrides: TempPermissionOverride[];
    setPermissionOverrides: React.Dispatch<React.SetStateAction<TempPermissionOverride[]>>;
    roles: Role[];
    allProperties: Property[];
    propertyAccess: number[];
    handleToggleOverride: (perm: SystemPermission, propId: number, state: 'inherit' | 'grant' | 'deny') => void;
    showDashboardAccessWarning: boolean; // Prop for warning visibility
}

export const PermissionsTab: React.FC<PermissionsTabProps> = ({
    editingUser,
    userForm,
    permissionOverrides,
    roles,
    allProperties,
    propertyAccess,
    handleToggleOverride,
    showDashboardAccessWarning,
}) => {
    const { t, language } = useLanguage();

    const getBaseRolePermissionState = (perm: SystemPermission, roleId: number): boolean => {
        const baseRole = roles.find(r => r.id === roleId);
        return baseRole?.permissions.includes(perm) || false;
    };

    return (
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

                                {/* NEW: In-tab warning for DASHBOARD.VIEW */}
                                {showDashboardAccessWarning && pId === userForm.propertyId && (
                                    <div className="mb-6 p-6 bg-rose-50 border-2 border-rose-500 dark:bg-rose-900/20 dark:border-rose-800 rounded-2xl animate-shake">
                                        <div className="flex items-start gap-4">
                                            <i className="fas fa-exclamation-triangle text-rose-500 text-3xl"></i>
                                            <div>
                                                <h4 className="font-black text-rose-900 text-sm uppercase mb-2">
                                                    🚨 Critical Permission Missing
                                                </h4>
                                                <p className="text-xs text-rose-800 leading-relaxed mb-3">
                                                    This user <strong>does not have DASHBOARD.VIEW permission</strong> for their 
                                                    default property (<strong>{allProperties.find(p => p.id === userForm.propertyId)?.name}</strong>).
                                                </p>
                                                <p className="text-xs text-rose-800 leading-relaxed">
                                                    <strong>They will not be able to log in.</strong> Please either:
                                                </p>
                                                <ul className="mt-2 ml-4 text-xs text-rose-700 space-y-1">
                                                    <li>• Change their role to one that includes DASHBOARD.VIEW</li>
                                                    <li>• Grant DASHBOARD.VIEW permission using the override below</li>
                                                    <li>• Change their default property to one where they have access</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                                    {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
                                        <div key={group} className="space-y-4">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-l-4 border-hotel-gold pl-3">{group}</h4>
                                            <div className="grid gap-3">
                                                {perms.map(p => {
                                                    // For new users (editingUser is null), the userId in permissionOverrides might be 0 or undefined,
                                                    // but for display, we check against the temporary state directly.
                                                    const currentOverride = permissionOverrides.find(ov => 
                                                        ov.propertyId === pId && 
                                                        ov.permissionKey === p &&
                                                        (editingUser ? ov.userId === editingUser.id : ov.userId === 0 || ov.tempId) // Match by actual userId if editing, else by placeholder 0 or tempId
                                                    );
                                                    const currentState = currentOverride === undefined 
                                                        ? 'inherit' 
                                                        : currentOverride.isAllowed 
                                                            ? 'grant' 
                                                            : 'deny';
                                                    const baseRoleHasPermission = getBaseRolePermissionState(p, userForm.roleId);

                                                    return (
                                                        <PermissionOverrideControl
                                                            key={p}
                                                            permission={p}
                                                            propertyId={pId}
                                                            currentState={currentState}
                                                            baseRoleHasPermission={baseRoleHasPermission}
                                                            onChange={(state) => handleToggleOverride(p, pId, state)}
                                                        />
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
    );
};
