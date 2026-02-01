
import React, { useState, useEffect } from 'react';
import { User, Role, SystemPermission, Property, TempPermissionOverride } from '../../../../types';
import { useLanguage } from '../../../../context/LanguageContext';
import { ProfileTab } from './ProfileTab';
import { PropertyAccessTab } from './PropertyAccessTab';
import { PermissionsTab } from './PermissionsTab';

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingUser: User | null;
    userForm: {
        id?: number; // FIX: Added optional ID for existing users
        username: string;
        fullName: string;
        email: string;
        password?: string;
        roleId: number;
        status: User['status'];
        propertyId: number;
    };
    setUserForm: React.Dispatch<React.SetStateAction<UserModalProps['userForm']>>;
    propertyAccess: number[];
    setPropertyAccess: React.Dispatch<React.SetStateAction<number[]>>;
    permissionOverrides: TempPermissionOverride[];
    setPermissionOverrides: React.Dispatch<React.SetStateAction<TempPermissionOverride[]>>;
    roles: Role[];
    allProperties: Property[];
    activeTab: 'profile' | 'access' | 'permissions';
    setActiveTab: React.Dispatch<React.SetStateAction<'profile' | 'access' | 'permissions'>>;
    isSubmitting: boolean;
    onSubmit: (
        userForm: UserModalProps['userForm'],
        propertyAccess: number[],
        permissionOverrides: TempPermissionOverride[],
        showDashboardAccessWarning: boolean,
        setShowDashboardAccessWarning: React.Dispatch<React.SetStateAction<boolean>>
    ) => Promise<void>;
    showDashboardAccessWarning: boolean;
}

// Simple UUID generator (replace with proper library like 'uuid' if available in project)
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export const UserModal: React.FC<UserModalProps> = ({
    isOpen,
    onClose,
    editingUser,
    userForm,
    setUserForm,
    propertyAccess,
    setPropertyAccess,
    permissionOverrides,
    setPermissionOverrides,
    roles,
    allProperties,
    activeTab,
    setActiveTab,
    isSubmitting,
    onSubmit,
}) => {
    const { t, language } = useLanguage();
    const [showDashboardAccessWarning, setShowDashboardAccessWarning] = useState(false); // Managed internally here

    useEffect(() => {
        // Reset warning when modal opens/closes or user changes
        if (!isOpen) {
            setShowDashboardAccessWarning(false);
        }
    }, [isOpen, editingUser]);

    const handleToggleProperty = (propId: number) => {
        setPropertyAccess(prev => 
            prev.includes(propId) ? prev.filter(id => id !== propId) : [...prev, propId]
        );
    };

    const handleToggleOverride = (perm: SystemPermission, propId: number, state: 'inherit' | 'grant' | 'deny') => {
        // Generate a temporary ID for new overrides if no userId is present yet
        const tempId = editingUser?.id ? undefined : generateUUID(); // Only generate tempId for new users

        setPermissionOverrides(prev => {
            // Filter out any existing override for this permission/property combo (using userId or tempId)
            const filtered = prev.filter(ov => 
                !(ov.propertyId === propId && ov.permissionKey === perm && 
                  (editingUser?.id ? ov.userId === editingUser.id : ov.tempId === tempId || ov.userId === 0)) // Match by actual userId or tempId (or placeholder 0)
            );
            
            if (state === 'inherit') return filtered;
            
            return [...filtered, { 
                userId: editingUser?.id || 0, // Use actual userId if editing, else 0 as placeholder for new users
                tempId: editingUser?.id ? undefined : (tempId || generateUUID()), // Ensure tempId if it's a new user and not already set
                propertyId: propId, 
                permissionKey: perm, 
                isAllowed: state === 'grant' 
            }];
        });
    };


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[110] p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
                <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-hotel-navy text-white">
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-widest">{editingUser ? t('users.edit') : t('users.add')}</h2>
                        <p className="text-[10px] font-bold uppercase opacity-60 mt-1">Global Identity: {userForm.username || 'New Entity'}</p>
                    </div>
                    <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><i className="fas fa-times text-2xl"></i></button>
                </div>
                
                {/* Tab Navigation */}
                <div className="flex border-b dark:border-slate-700 px-8 bg-slate-50/50">
                    {[
                        { id: 'profile', icon: 'fa-user-circle', label: 'Identity Profile' },
                        { id: 'access', icon: 'fa-building', label: 'Property Scope' },
                        { id: 'permissions', icon: 'fa-lock-open', label: 'Atomic Overrides' }
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2.5 px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === tab.id ? 'border-hotel-gold text-hotel-navy dark:text-hotel-gold' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                            <i className={`fas ${tab.icon}`}></i> {tab.label}
                        </button>
                    ))}
                </div>

                <form onSubmit={(e) => { e.preventDefault(); onSubmit(userForm, propertyAccess, permissionOverrides, showDashboardAccessWarning, setShowDashboardAccessWarning); }} className="flex-1 overflow-hidden flex flex-col">
                    <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                        {activeTab === 'profile' && (
                            <ProfileTab userForm={userForm} setUserForm={setUserForm} roles={roles} />
                        )}

                        {activeTab === 'access' && (
                            <PropertyAccessTab 
                                userForm={userForm} 
                                setUserForm={setUserForm} 
                                propertyAccess={propertyAccess} 
                                handleToggleProperty={handleToggleProperty} 
                                allProperties={allProperties} 
                            />
                        )}

                        {activeTab === 'permissions' && (
                            <PermissionsTab
                                editingUser={editingUser}
                                userForm={userForm}
                                permissionOverrides={permissionOverrides}
                                setPermissionOverrides={setPermissionOverrides}
                                roles={roles}
                                allProperties={allProperties}
                                propertyAccess={propertyAccess}
                                handleToggleOverride={handleToggleOverride}
                                showDashboardAccessWarning={showDashboardAccessWarning}
                            />
                        )}
                    </div>

                    <div className="p-8 border-t dark:border-slate-700 flex justify-end gap-4 bg-slate-50/50">
                        <button type="button" onClick={onClose} className="px-8 py-3 text-[10px] font-black uppercase text-slate-500 hover:text-slate-700 transition-all">Discard Changes</button>
                        <button type="submit" disabled={isSubmitting || propertyAccess.length === 0} className="px-12 py-3 bg-hotel-navy text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all">
                            {isSubmitting ? <i className="fas fa-spinner fa-spin me-2"></i> : <i className="fas fa-shield-check me-2"></i>}
                            Commit Identity Policy
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};