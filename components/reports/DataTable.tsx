
import React from 'react';
import { Property } from '../../types';

interface DataTableProps {
    data: any[];
    visibleColumns: string[];
    loading: boolean;
    t: any;
    allProperties?: Property[];
}

const DataTable: React.FC<DataTableProps> = ({ data, visibleColumns, loading, t, allProperties = [] }) => {
    if (loading) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl h-96 flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-slate-100 border-t-hotel-gold rounded-full animate-spin"></div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Crunching Data Matrix...</p>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-20 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-100 dark:border-slate-700">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6">
                    <i className="fas fa-folder-open text-3xl text-slate-200"></i>
                </div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter">Zero Records Detected</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Adjust your filters or property context to expand search.</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar max-h-[600px]">
                <table className="w-full text-sm text-left rtl:text-right border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-20 shadow-sm">
                        <tr>
                            {visibleColumns.map(col => (
                                <th key={col} className="px-6 py-5 whitespace-nowrap text-[10px] font-black uppercase text-slate-500 tracking-widest border-b dark:border-slate-700">
                                    {renderHeader(col, t)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {data.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors group">
                                {visibleColumns.map(col => {
                                    const val = row[col];
                                    return (
                                        <td key={col} className="px-6 py-4 whitespace-nowrap">
                                            {renderCell(col, val, t, allProperties)}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t dark:border-slate-700 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    Showing {data.length} analysis rows
                </span>
                <span className="text-[10px] font-black uppercase text-hotel-gold bg-hotel-navy px-3 py-1 rounded-lg">
                    Immutable Data View
                </span>
            </div>
        </div>
    );
};

const renderHeader = (col: string, t: any) => {
    if (col === 'employeeId') return t('employees.employeeId') === 'employeeId' ? 'Employee Code' : t('employees.employeeId');
    if (col === 'clockId') return 'Clock ID';
    if (col === 'gender') return t('employees.gender');
    if (col === 'profileImage') return '';
    if (col === 'propertyId') return 'Property';
    if (col === 'firstName') return t('employees.firstName');
    if (col === 'lastName') return t('employees.lastName');
    if (col === 'dateOfBirth') return t('employees.dateOfBirth');
    if (col === 'level') return t('employees.level');
    if (col === 'phone') return t('employees.phone');
    if (col === 'nationalId') return t('employees.nationalId');
    if (col === 'workLocation') return t('employees.workLocation');
    if (col === 'contractStartDate') return t('employees.contractStartDate');
    const translation = t(`housing.${col}`);
    return translation !== `housing.${col}` ? translation : col.charAt(0).toUpperCase() + col.slice(1);
}

const renderCell = (col: string, val: any, t: any, allProperties: Property[]) => {
    if (col === 'profileImage') {
        return (
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 overflow-hidden border dark:border-slate-600">
                {val ? <img src={val} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-300 font-black">?</div>}
            </div>
        );
    }

    if (val === null || val === undefined) return <span className="text-slate-300">—</span>;

    if (col === 'department') {
        return <span className="text-[11px] font-black uppercase text-slate-500">{t(`departments.${val}`)}</span>;
    }
    
    if (col === 'status' || col === 'roomStatus') {
        const color = (val === 'available' || val === 'active') ? 'text-emerald-600' : val === 'occupied' ? 'text-blue-600' : 'text-rose-500';
        return <span className={`text-[10px] font-black uppercase ${color}`}>{t(`statuses.${val}`)}</span>;
    }

    if (col === 'gender') {
        return <span className="text-[10px] font-black uppercase text-slate-500">{t(`employees.${val}`) || val}</span>;
    }

    if (col === 'propertyId') {
        const prop = allProperties.find(p => p.id === val);
        return <span className="text-[10px] font-black uppercase text-hotel-gold bg-hotel-navy/5 px-2 py-0.5 rounded">{prop?.code || val}</span>;
    }

    if (typeof val === 'string' && val.includes('T') && !isNaN(Date.parse(val))) {
        return <span className="font-mono text-xs font-bold text-slate-400">{new Date(val).toLocaleDateString()}</span>;
    }

    if (col === 'priority') {
        const pColor = val === 'high' ? 'text-rose-600' : 'text-amber-500';
        return <span className={`text-[10px] font-black uppercase ${pColor}`}>{val}</span>;
    }

    if (col === 'level') {
        return <span className="text-[10px] font-black text-amber-600 uppercase tracking-tighter">{val}</span>;
    }

    return <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">{String(val)}</span>;
};

export default DataTable;
