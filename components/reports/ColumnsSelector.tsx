
import React, { useState, useRef, useEffect } from 'react';

interface ColumnsSelectorProps {
    allColumns: string[];
    visibleColumns: string[];
    onChange: (cols: string[]) => void;
    t: any;
}

const ColumnsSelector: React.FC<ColumnsSelectorProps> = ({ allColumns, visibleColumns, onChange, t }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleColumn = (col: string) => {
        if (visibleColumns.includes(col)) {
            if (visibleColumns.length > 1) onChange(visibleColumns.filter(c => c !== col));
        } else {
            onChange([...visibleColumns, col]);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
            >
                <i className="fas fa-columns text-hotel-gold"></i> {t('columns')}
                <span className="bg-hotel-navy text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full ml-1">
                    {visibleColumns.length}
                </span>
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-[60] p-5 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Toggle Analysis Views</p>
                        <button onClick={() => onChange(allColumns)} className="text-[8px] font-black uppercase text-hotel-gold">Select All</button>
                    </div>
                    <div className="space-y-1.5 max-h-80 overflow-y-auto custom-scrollbar">
                        {allColumns.map(col => {
                            const isVisible = visibleColumns.includes(col);
                            return (
                                <label key={col} className={`flex items-center gap-3 cursor-pointer group p-2 rounded-lg transition-colors ${isVisible ? 'bg-primary-50/30 dark:bg-primary-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                    <input 
                                        type="checkbox" 
                                        checked={isVisible} 
                                        onChange={() => toggleColumn(col)} 
                                        className="w-4 h-4 rounded text-hotel-gold border-slate-300 focus:ring-hotel-gold" 
                                    />
                                    <span className={`text-[11px] font-bold uppercase transition-colors ${isVisible ? 'text-hotel-navy dark:text-white' : 'text-slate-400'}`}>
                                        {col === 'employeeId' || col === 'clockId' ? t('employees.employeeId') : t(`housing.${col}`) !== `housing.${col}` ? t(`housing.${col}`) : col}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ColumnsSelector;
