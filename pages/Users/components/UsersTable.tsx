
import React from 'react';
import { User, Role, Property } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';

interface UsersTableProps {
    users: User[];
    roles: Role[];
    allProperties: Property[];
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    openEditUser: (user: User) => void;
    loading: boolean;
    t: (key: string, options?: { [key: string]: string | number }) => string;
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    usersPerPage: number;
    filteredUsersLength: number;
}

export const UsersTable: React.FC<UsersTableProps> = ({
    users,
    roles,
    allProperties,
    searchTerm,
    setSearchTerm,
    openEditUser,
    loading,
    t,
    currentPage,
    totalPages,
    onPageChange,
    usersPerPage,
    filteredUsersLength,
}) => {
    const { language } = useLanguage(); // Ensure language context is available for RTL/LTR

    const getRoleName = (roleId: number) => roles.find(r => r.id === roleId)?.name || 'N/A';

    if (loading) {
        return (
            <div className="p-32 text-center flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-hotel-navy border-t-hotel-gold rounded-full animate-spin mb-4"></div>
                <p className="text-hotel-muted font-bold text-xs uppercase tracking-widest">{t('loading')}</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="p-5 border-b dark:border-slate-700 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full max-w-sm">
                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                    <input type="text" placeholder={t('users.search')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-white border border-slate-200 text-xs font-bold rounded-xl w-full pl-10 pr-4 py-2.5 dark:bg-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-hotel-gold" />
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
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                                    <i className="fas fa-users-slash text-5xl mb-4"></i>
                                    <p className="text-sm font-bold uppercase tracking-widest">{t('errors.noRecords')}</p>
                                    <p className="text-xs text-slate-400 mt-2">{t('errors.noMatches')}</p>
                                </td>
                            </tr>
                        ) : (
                            users.map(user => (
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
                                            {getRoleName(user.roleId)}
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
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="p-4 flex justify-between items-center border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                        {t('reports.showing', { 
                            count: ((currentPage - 1) * usersPerPage) + 1, 
                            total: Math.min(currentPage * usersPerPage, filteredUsersLength),
                            totalRecords: filteredUsersLength
                        })}
                    </span>
                    <div className="flex gap-2">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => onPageChange(currentPage - 1)}
                            className="px-3 py-1.5 text-[9px] font-black uppercase border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-all"
                        >
                            <i className={`fas ${language === 'ar' ? 'fa-arrow-right' : 'fa-arrow-left'} mr-2`}></i>
                            {t('layout.previous')}
                        </button>
                        <span className="px-3 py-1.5 text-[10px] font-bold text-slate-700 dark:text-slate-200">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => onPageChange(currentPage + 1)}
                            className="px-3 py-1.5 text-[9px] font-black uppercase border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-all"
                        >
                            {t('layout.next')}
                            <i className={`fas ${language === 'ar' ? 'fa-arrow-left' : 'fa-arrow-right'} ml-2`}></i>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
