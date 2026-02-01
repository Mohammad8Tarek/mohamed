
import React, { useMemo } from 'react';
import { Building, Property, DEPARTMENTS, ReportFilterKey, AVAILABLE_MODULES } from '../../types';

interface FiltersPanelProps {
    reportType: string;
    allowedFilters: ReportFilterKey[];
    filters: any;
    setFilters: React.Dispatch<React.SetStateAction<any>>;
    buildings: Building[];
    searchTerm: string;
    setSearchTerm: (s: string) => void;
    allProperties: Property[];
    isSuperAdmin: boolean;
    t: any;
    rawData?: any[];
}

const FiltersPanel: React.FC<FiltersPanelProps> = ({ 
    reportType, allowedFilters, filters, setFilters, buildings, searchTerm, setSearchTerm, allProperties, isSuperAdmin, t, rawData = []
}) => {
    
    const inputClass = "w-full p-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold focus:ring-2 focus:ring-hotel-gold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white transition-all shadow-sm";
    const labelClass = "block text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest";

    const isVisible = (key: ReportFilterKey) => allowedFilters.includes(key);

    const uniqueUsers = useMemo(() => {
        const users = new Set<string>();
        rawData.forEach(item => {
            if (item.username) users.add(item.username);
        });
        return Array.from(users).sort();
    }, [rawData]);

    const uniqueLevels = useMemo(() => {
        const levels = new Set<string>();
        rawData.forEach(item => {
            if (item.level) levels.add(item.level);
        });
        return Array.from(levels).sort();
    }, [rawData]);

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-2">
                    <label className={labelClass}>Search Index</label>
                    <div className="relative">
                        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                        <input 
                            type="text" 
                            placeholder="Search by keywords..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className={inputClass + " pl-10"} 
                        />
                    </div>
                </div>

                {isSuperAdmin && isVisible('property') && (
                    <div>
                        <label className={labelClass}>Node Context</label>
                        <select 
                            value={filters.propertyId} 
                            onChange={e => setFilters({...filters, propertyId: e.target.value})} 
                            className={inputClass}
                        >
                            <option value="all">Enterprise Global</option>
                            {allProperties.map(p => <option key={p.id} value={p.id}>{p.code} - {p.displayName || p.name}</option>)}
                        </select>
                    </div>
                )}

                {isVisible('building') && (
                    <div>
                        <label className={labelClass}>Asset Site</label>
                        <select 
                            value={filters.building} 
                            onChange={e => setFilters({...filters, building: e.target.value})} 
                            className={inputClass}
                        >
                            <option value="all">Any Building</option>
                            {buildings.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                        </select>
                    </div>
                )}

                {isVisible('dateRange') && (
                    <div>
                        <label className={labelClass}>Timeline Start</label>
                        <input 
                            type="date" 
                            value={filters.dateFrom} 
                            onChange={e => setFilters({...filters, dateFrom: e.target.value})} 
                            className={inputClass} 
                        />
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 pt-4 border-t dark:border-slate-700/50">
                {isVisible('department') && (
                    <div>
                        <label className={labelClass}>Dept. Matrix</label>
                        <select 
                            value={filters.department} 
                            onChange={e => setFilters({...filters, department: e.target.value})} 
                            className={inputClass}
                        >
                            <option value="all">All Departments</option>
                            {DEPARTMENTS.map(d => <option key={d} value={d}>{t(`departments.${d}`)}</option>)}
                        </select>
                    </div>
                )}

                {isVisible('gender') && (
                    <div>
                        <label className={labelClass}>Profile Gender</label>
                        <select 
                            value={filters.gender} 
                            onChange={e => setFilters({...filters, gender: e.target.value})} 
                            className={inputClass}
                        >
                            <option value="all">All Genders</option>
                            <option value="male">{t('employees.male')}</option>
                            <option value="female">{t('employees.female')}</option>
                        </select>
                    </div>
                )}

                {isVisible('level') && (
                    <div>
                        <label className={labelClass}>Staff Level</label>
                        <select 
                            value={filters.level} 
                            onChange={e => setFilters({...filters, level: e.target.value})} 
                            className={inputClass}
                        >
                            <option value="all">Any Level</option>
                            {uniqueLevels.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                        </select>
                    </div>
                )}

                {isVisible('status') && (
                    <div>
                        <label className={labelClass}>State Filter</label>
                        <select 
                            value={filters.status} 
                            onChange={e => setFilters({...filters, status: e.target.value})} 
                            className={inputClass}
                        >
                            <option value="all">Any Status</option>
                            <option value="available">{t('statuses.available')}</option>
                            <option value="occupied">{t('statuses.occupied')}</option>
                            <option value="maintenance">{t('statuses.maintenance')}</option>
                            <option value="active">{t('statuses.active')}</option>
                            <option value="left">{t('statuses.left')}</option>
                        </select>
                    </div>
                )}

                {isVisible('dateRange') && (
                    <div>
                        <label className={labelClass}>Timeline End</label>
                        <input 
                            type="date" 
                            value={filters.dateTo} 
                            onChange={e => setFilters({...filters, dateTo: e.target.value})} 
                            className={inputClass} 
                        />
                    </div>
                )}

                <div className="flex items-end">
                    <button 
                        onClick={() => setFilters({
                            propertyId: String(allProperties[0]?.id || 'all'), 
                            building: 'all', 
                            department: 'all', 
                            status: 'all', 
                            gender: 'all', 
                            priority: 'all',
                            dateFrom: '', 
                            dateTo: '',
                            bookingType: 'all',
                            module: 'all',
                            user: 'all',
                            level: 'all'
                        })}
                        className="w-full h-10 text-[9px] font-black uppercase text-slate-400 hover:text-hotel-navy transition-colors bg-slate-50 dark:bg-slate-900 rounded-xl"
                    >
                        Reset Engine
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FiltersPanel;
