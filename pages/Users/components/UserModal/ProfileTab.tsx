

import React from 'react';
import { User, Role } from '../../../../types';
import { useLanguage } from '../../../../context/LanguageContext';

interface ProfileTabProps {
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
    setUserForm: React.Dispatch<React.SetStateAction<any>>;
    roles: Role[];
}

export const ProfileTab: React.FC<ProfileTabProps> = ({ userForm, setUserForm, roles }) => {
    const { t } = useLanguage();

    const inputClass = "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-hotel-gold outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white transition-all shadow-inner placeholder-slate-400";
    const labelClass = "block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-widest";

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up max-w-3xl">
            <div className="col-span-2 space-y-4">
                <h3 className="text-xs font-black uppercase text-hotel-gold tracking-[0.2em] border-b pb-2">Core Identity</h3>
            </div>
            <div>
                <label className={labelClass}>{t('users.username')}</label>
                <input 
                    value={userForm.username} 
                    onChange={e => setUserForm(p=>({...p, username: e.target.value.toLowerCase()}))} 
                    disabled={!!userForm.id} // Assuming userForm.id exists if editing
                    required 
                    className={inputClass} 
                />
            </div>
            <div>
                <label className={labelClass}>Full Legal Name</label>
                <input 
                    value={userForm.fullName} 
                    onChange={e => setUserForm(p=>({...p, fullName: e.target.value}))} 
                    required 
                    className={inputClass} 
                />
            </div>
            <div>
                <label className={labelClass}>Email Vector</label>
                <input 
                    type="email" 
                    value={userForm.email} 
                    onChange={e => setUserForm(p=>({...p, email: e.target.value}))} 
                    required 
                    className={inputClass} 
                />
            </div>
            <div>
                <label className={labelClass}>Security Passphrase</label>
                <input 
                    type="password" 
                    value={userForm.password} 
                    onChange={e => setUserForm(p=>({...p, password: e.target.value}))} 
                    placeholder={userForm.id ? 'Retain current' : 'Define secure string'} 
                    className={inputClass} 
                />
            </div>
            
            <div className="col-span-2 mt-4 space-y-4">
                <h3 className="text-xs font-black uppercase text-hotel-gold tracking-[0.2em] border-b pb-2">Account Lifecycle</h3>
            </div>
            <div>
                <label className={labelClass}>Security Template (Role)</label>
                <select 
                    value={userForm.roleId} 
                    onChange={e => setUserForm(p=>({...p, roleId: parseInt(e.target.value)}))} 
                    className={inputClass}
                >
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name.toUpperCase()}</option>)}
                </select>
            </div>
            <div>
                <label className={labelClass}>Operational Status</label>
                <select 
                    value={userForm.status} 
                    onChange={e => setUserForm(p=>({...p, status: e.target.value as any}))} 
                    className={inputClass}
                >
                    <option value="active">Authorized (Active)</option>
                    <option value="disabled">Revoked (Disabled)</option>
                </select>
            </div>
        </div>
    );
};