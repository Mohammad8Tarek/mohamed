
import React from 'react';
import { Role, SystemPermission } from '../../../../types';
import { useLanguage } from '../../../../context/LanguageContext';
import { PERMISSION_GROUPS } from '../index'; // Import from parent UsersPage

interface RoleModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingRole: Role | null;
    roleForm: {
        name: string;
        permissions: SystemPermission[];
    };
    setRoleForm: React.Dispatch<React.SetStateAction<any>>;
    isSubmitting: boolean;
    onSubmit: (roleForm: RoleModalProps['roleForm'], editingRole: Role | null) => Promise<void>;
    permissionGroups: Record<string, SystemPermission[]>; // Use the centralized permission groups
}

export const RoleModal: React.FC<RoleModalProps> = ({
    isOpen,
    onClose,
    editingRole,
    roleForm,
    setRoleForm,
    isSubmitting,
    onSubmit,
    permissionGroups,
}) => {
    const { t } = useLanguage();

    const inputClass = "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-hotel-gold outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white transition-all shadow-inner placeholder-slate-400";
    const labelClass = "block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-widest";

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
                <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-hotel-navy text-white">
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-widest">{editingRole ? t('roles.update') : t('roles.new')}</h2>
                        <p className="text-[10px] font-bold uppercase opacity-60 mt-1">Defines default permissions for assigned users.</p>
                    </div>
                    <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><i className="fas fa-times text-2xl"></i></button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); onSubmit(roleForm, editingRole); }} className="flex flex-col flex-1 overflow-hidden">
                    <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                        <div className="max-w-md">
                            <label className={labelClass}>Template Name</label>
                            <input 
                                type="text" 
                                value={roleForm.name} 
                                onChange={e => setRoleForm(p => ({...p, name: e.target.value}))} 
                                required 
                                disabled={editingRole?.isSystem} 
                                className={inputClass} 
                                placeholder="e.g. Regional HR" 
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {Object.entries(permissionGroups).map(([group, perms]) => (
                                <div key={group} className="p-5 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200">
                                    <h4 className="text-[10px] font-black uppercase text-slate-500 mb-4">{group}</h4>
                                    <div className="space-y-2">
                                        {perms.map(p => (
                                            <label key={p} className="flex items-center gap-3 p-2 bg-white dark:bg-slate-800 rounded-xl cursor-pointer hover:shadow-sm">
                                                <input 
                                                    type="checkbox" 
                                                    checked={roleForm.permissions.includes(p)} 
                                                    onChange={() => {
                                                        const has = roleForm.permissions.includes(p);
                                                        setRoleForm(prev => ({ ...prev, permissions: has ? prev.permissions.filter(x => x !== p) : [...prev.permissions, p] }));
                                                    }} 
                                                    className="w-4 h-4 text-hotel-gold rounded border-slate-300 focus:ring-hotel-gold" 
                                                />
                                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">{p.replace('.', ' • ')}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50/50">
                        <button type="button" onClick={onClose} className="px-6 py-2 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="px-10 py-2.5 bg-hotel-navy text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl">Save Template</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
