
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildingApi } from '../services/apiService';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { exportToPdf, exportToExcel } from '../services/exportService';
import { Building, ReportDefinition } from '../types';
import { useProperty } from '../context/PropertyContext';
import { usePermissions } from '../hooks/usePermissions';
import { REPORT_REGISTRY } from '../services/reportConfig';

// Modular Components
import FiltersPanel from '../components/reports/FiltersPanel';
import DataTable from '../components/reports/DataTable';
import ColumnsSelector from '../components/reports/ColumnsSelector';

const ReportsPage: React.FC = () => {
    const { t, language } = useLanguage();
    const { showToast } = useToast();
    const { settings: appSettings } = useSettings();
    const { currentProperty, allProperties } = useProperty();
    const perms = usePermissions();
    const location = useLocation();
    const navigate = useNavigate();

    // 1. Authorized Reports List (Stable Memo)
    const authorizedReports = useMemo(() => {
        return REPORT_REGISTRY.filter(report => perms.resolvePermission(report.permissions.view));
    }, [perms.resolvePermission]);

    const [activeReport, setActiveReport] = useState<ReportDefinition | null>(null);
    const [rawData, setRawData] = useState<any[]>([]); // Store raw data for totals
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
    const [allPossibleColumns, setAllPossibleColumns] = useState<string[]>([]);

    const [filters, setFilters] = useState({
        propertyId: String(currentProperty?.id || 'all'),
        building: 'all',
        department: 'all',
        status: 'all',
        gender: 'all',
        priority: 'all',
        roomType: 'all',
        dateFrom: '',
        dateTo: '',
        bookingType: 'all',
        module: 'all',
        user: 'all',
        level: 'all'
    });

    // Track processed state to avoid re-applying same location.state
    const stateHandledRef = useRef<string | null>(null);

    // Consuming state from other pages (e.g., Generate Report)
    useEffect(() => {
        const stateKey = JSON.stringify(location.state);
        if (location.state?.reportKey && stateHandledRef.current !== stateKey) {
            stateHandledRef.current = stateKey;
            const target = authorizedReports.find(r => r.key === location.state.reportKey);
            if (target) {
                setActiveReport(target);
                if (location.state.filters) {
                    setFilters(prev => ({ ...prev, ...location.state.filters }));
                }
                // Clear state from history to prevent re-application on refresh/back
                navigate(location.pathname, { replace: true, state: {} });
            }
        } else if (!activeReport && authorizedReports.length > 0 && !location.state?.reportKey) {
            setActiveReport(authorizedReports[0]);
        }
    }, [location.state, authorizedReports, activeReport, location.pathname, navigate]);

    // Reset Columns on Report Switch
    useEffect(() => {
        if (!activeReport) return;
        setSearchTerm('');
        setVisibleColumns(activeReport.defaultColumns);
        // Use predefined allowed columns instead of guessing from object keys
        setAllPossibleColumns(activeReport.availableColumns);
    }, [activeReport]);

    const fetchData = async () => {
        if (!activeReport) return;
        setLoading(true);
        try {
            const pIdNum = filters.propertyId === 'all' ? undefined : parseInt(filters.propertyId);
            const bData = await buildingApi.getAll();
            setBuildings(pIdNum ? bData.filter(b => b.propertyId === pIdNum) : bData);

            const data = await activeReport.apiEndpoint(pIdNum);
            setRawData(data);
        } catch (e) {
            showToast(t('errors.fetchFailed'), 'critical');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { 
        fetchData(); 
    }, [activeReport, filters.propertyId]);

    const processedData = useMemo(() => {
        let data = [...rawData];
        
        data = data.filter(item => {
            const matchBuilding = filters.building === 'all' || item.buildingName === filters.building;
            const matchDept = filters.department === 'all' || item.department === filters.department;
            const matchStatus = filters.status === 'all' || item.status === filters.status || item.roomStatus === filters.status;
            const matchGender = filters.gender === 'all' || item.gender === filters.gender;
            const matchPriority = filters.priority === 'all' || item.priority === filters.priority;
            const matchModule = filters.module === 'all' || item.module === filters.module;
            const matchUser = filters.user === 'all' || item.username === filters.user;
            const matchLevel = filters.level === 'all' || item.level === filters.level;
            
            const itemDate = item.checkInDate || item.startDate || item.reportedAt || item.timestamp || item.contractStartDate;
            const matchDateFrom = !filters.dateFrom || (itemDate && new Date(itemDate) >= new Date(filters.dateFrom));
            const matchDateTo = !filters.dateTo || (itemDate && new Date(itemDate) <= new Date(filters.dateTo + 'T23:59:59'));

            return matchBuilding && matchDept && matchStatus && matchGender && matchPriority && matchDateFrom && matchDateTo && matchModule && matchUser && matchLevel;
        });

        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            data = data.filter(item => Object.values(item).some(v => String(v).toLowerCase().includes(s)));
        }

        return data;
    }, [rawData, filters, searchTerm]);

    const handleExport = (format: 'pdf' | 'excel') => {
        if (!activeReport || processedData.length === 0) {
            showToast(language === 'ar' ? 'لا توجد بيانات' : 'Empty dataset', 'warning');
            return;
        }

        const reportTitle = language === 'ar' ? activeReport.labelAr : activeReport.labelEn;
        const filename = `Report_${activeReport.key}_${new Date().toISOString().split('T')[0]}`;
        
        const headers = visibleColumns.map(col => {
            if (col === 'employeeId') return language === 'ar' ? 'كود الموظف' : 'Employee Code';
            if (col === 'clockId') return t('employees.employeeId');
            if (col === 'gender') return t('employees.gender');
            if (col === 'priority') return t('maintenance.priority');
            if (col === 'profileImage') return language === 'ar' ? 'الصورة' : 'Image';
            if (col === 'propertyId') return language === 'ar' ? 'الفرع' : 'Property';
            const translation = t(`housing.${col}`);
            const empTranslation = t(`employees.${col}`);
            if (translation !== `housing.${col}`) return translation;
            if (empTranslation !== `employees.${col}`) return empTranslation;
            return col.charAt(0).toUpperCase() + col.slice(1);
        });

        const body = processedData.map(row => visibleColumns.map(col => {
            const val = row[col];
            if (col === 'profileImage') return val ? '[Image]' : '—'; // Placeholder for excel
            if (col === 'department') return t(`departments.${val}`);
            if (col === 'status' || col === 'roomStatus') return t(`statuses.${val}`);
            if (col === 'gender') return t(`employees.${val}`) || val;
            if (col === 'priority') return t(`maintenance.priorities.${val}`) || val;
            if (col === 'propertyId') return allProperties.find(p => p.id === val)?.code || val;
            if (typeof val === 'string' && val.includes('T') && !isNaN(Date.parse(val))) return new Date(val).toLocaleDateString();
            return val ?? '—';
        }));

        if (format === 'pdf') {
            if (!perms.resolvePermission(activeReport.permissions.exportPdf)) {
                showToast("Action Denied: Insufficient Export Rights", "critical");
                return;
            }
            exportToPdf({ 
                headers, 
                data: body, 
                title: reportTitle, 
                filename: filename + '.pdf', 
                settings: appSettings, 
                language, 
                property: currentProperty,
                summableColumns: activeReport.summableColumns, // Pass summable columns
                rawData: processedData // Pass raw data for totals calculation
            });
        } else {
            if (!perms.resolvePermission(activeReport.permissions.exportExcel)) {
                showToast("Action Denied: Insufficient Export Rights", "critical");
                return;
            }
            exportToExcel({ 
                headers, 
                data: body, 
                filename: filename + '.xlsx', 
                settings: appSettings, 
                property: currentProperty,
                summableColumns: activeReport.summableColumns, // Pass summable columns
                rawData: processedData // Pass raw data for totals calculation
            });
        }
    };

    if (authorizedReports.length === 0) {
        return (
            <div className="h-96 flex flex-col items-center justify-center text-center p-10 animate-fade-in-up">
                <i className="fas fa-lock-open text-4xl text-slate-200 mb-4"></i>
                <h2 className="text-xl font-black uppercase text-slate-400">Restricted Access</h2>
                <p className="text-xs text-slate-400 mt-2 font-bold uppercase tracking-widest">Reporting permissions not provisioned.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-hotel-navy dark:text-white uppercase tracking-tighter leading-none">
                        {language === 'ar' ? 'محرك التقارير' : 'Reporting Hub'}
                    </h1>
                    <p className="text-hotel-muted dark:text-slate-400 text-[10px] mt-2 font-bold uppercase tracking-[0.2em] opacity-70">
                        Normalized Definitions • Dynamic Context • Enterprise Grade
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ColumnsSelector 
                        allColumns={allPossibleColumns} 
                        visibleColumns={visibleColumns} 
                        onChange={setVisibleColumns} 
                        t={t}
                    />
                    <div className="h-10 w-[1px] bg-slate-200 dark:bg-slate-700 mx-2"></div>
                    <button 
                        onClick={() => handleExport('excel')}
                        className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:brightness-110 transition-all"
                    >
                        <i className="fas fa-file-excel mr-2"></i> Excel
                    </button>
                    <button 
                        onClick={() => handleExport('pdf')}
                        className="px-5 py-2.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:brightness-110 transition-all"
                    >
                        <i className="fas fa-file-pdf mr-2"></i> PDF
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 dark:bg-slate-900/50 rounded-2xl w-fit shadow-inner border border-slate-200 dark:border-slate-800">
                {authorizedReports.map(report => (
                    <button 
                        key={report.key} 
                        onClick={() => setActiveReport(report)}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeReport?.key === report.key ? 'bg-hotel-navy text-white shadow-lg scale-[1.02]' : 'text-slate-500 hover:text-hotel-navy dark:hover:text-white'}`}
                    >
                        {language === 'ar' ? report.labelAr : report.labelEn}
                    </button>
                ))}
            </div>

            {activeReport && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-12">
                        <FiltersPanel 
                            reportType={activeReport.key} 
                            allowedFilters={activeReport.allowedFilters}
                            filters={filters} 
                            setFilters={setFilters} 
                            buildings={buildings}
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            allProperties={allProperties}
                            isSuperAdmin={perms.isSuperAdmin}
                            t={t}
                            rawData={rawData}
                        />
                    </div>

                    <div className="lg:col-span-12">
                        <DataTable 
                            data={processedData} 
                            visibleColumns={visibleColumns} 
                            loading={loading}
                            t={t}
                            allProperties={allProperties}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportsPage;