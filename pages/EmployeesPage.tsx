
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Employee, DEPARTMENTS, departmentJobTitles, Assignment, Room, Building, Floor } from '../types';
import { employeeApi, logActivity, importApi, assignmentApi, roomApi, buildingApi, floorApi } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { usePermissions } from '../hooks/usePermissions';
import { downloadEmployeeTemplate } from '../services/exportService';
import * as XLSX from 'xlsx';
import { useProperty } from '../context/PropertyContext';

type EmployeeKey = keyof Employee;

const EmployeesPage: React.FC = () => {
    const navigate = useNavigate();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | Employee['status']>('all');
    const [departmentFilter, setDepartmentFilter] = useState<string>('all');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    
    // UI Refs
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Confirmation screens
    const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
    const [pendingLeftAction, setPendingLeftAction] = useState<{
        emp: Employee;
        assignment?: Assignment;
        room?: Room;
        building?: Building;
    } | null>(null);

    const [sortConfig, setSortConfig] = useState<{ key: EmployeeKey | 'fullName', direction: 'asc' | 'desc' }>({ 
        key: 'firstName', direction: 'asc' 
    });

    const { user } = useAuth();
    const { language, t } = useLanguage();
    const { showToast } = useToast();
    const { settings: appSettings } = useSettings();
    const perms = usePermissions();
    const { currentProperty } = useProperty();

    const combinedDepartments = useMemo(() => {
        const taxonomy = appSettings.customTaxonomy || { departments: [], hiddenDepartments: [] };
        const customDepts = taxonomy.departments || [];
        const hiddenDepts = taxonomy.hiddenDepartments || [];
        const combined = Array.from(new Set([...DEPARTMENTS, ...customDepts]));
        return combined.filter(d => !hiddenDepts.includes(d));
    }, [appSettings.customTaxonomy]);

    const workLocations = useMemo(() => {
        return appSettings.customTaxonomy?.workLocations || [];
    }, [appSettings.customTaxonomy]);

    const getJobTitlesForDept = (dept: string) => {
        const taxonomy = appSettings.customTaxonomy || { jobTitles: {}, hiddenJobTitles: {} };
        const defaults = departmentJobTitles[dept] || [];
        const customs = taxonomy.jobTitles?.[dept] || [];
        const hiddens = taxonomy.hiddenJobTitles?.[dept] || [];
        const combined = Array.from(new Set([...defaults, ...customs]));
        return combined.filter(t => !hiddens.includes(t));
    };

    const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
        const saved = localStorage.getItem('employee_columns_v5');
        return saved ? JSON.parse(saved) : {
            idImage: true, 
            clockId: true, 
            employeeId: false, 
            firstName: true, 
            lastName: true, 
            nationalId: true, 
            gender: true, 
            department: true, 
            workLocation: true, 
            dateOfBirth: false, 
            jobTitle: true, 
            level: false, 
            phone: true, 
            status: true, 
            contractStartDate: false
        };
    });

    useEffect(() => { localStorage.setItem('employee_columns_v5', JSON.stringify(visibleColumns)); }, [visibleColumns]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
    const columnDropdownRef = useRef<HTMLDivElement>(null);

    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [formData, setFormData] = useState({
        employeeId: '', 
        clockId: '', 
        firstName: '', 
        lastName: '', 
        nationalId: '', 
        jobTitle: '', 
        level: '', 
        phone: '', 
        department: '', 
        workLocation: '',
        address: '',
        dateOfBirth: '',
        status: 'active' as Employee['status'], 
        contractStartDate: '',
        contractEndDate: '', 
        profileImage: null as string | null, 
        idImage: null as string | null,
        gender: 'male' as Employee['gender']
    });
    
    const [isPdfExporting, setIsPdfExporting] = useState(false);
    const [isExcelExporting, setIsExcelExporting] = useState(false);

    const [importData, setImportData] = useState<any[]>([]);
    const [importErrors, setImportErrors] = useState<{row: number, msg: string}[]>([]);
    
    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const data = await employeeApi.getAll();
            setEmployees(data);
        } catch (error) { 
            showToast(t('errors.fetchFailed'), 'critical'); 
        } finally { setLoading(false); }
    };

    useEffect(() => { 
        fetchEmployees();
        const handleClickOutside = (e: MouseEvent) => {
            if (columnDropdownRef.current && !columnDropdownRef.current.contains(e.target as Node)) {
                setIsColumnDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const handleSort = (key: EmployeeKey | 'fullName') => {
        setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    };

    const renderSortIcon = (key: string) => {
        if (sortConfig.key !== key) return <i className="fas fa-sort text-slate-300 ml-1 text-[10px]"></i>;
        return sortConfig.direction === 'asc' 
            ? <i className="fas fa-sort-up ml-1 text-primary-500"></i> 
            : <i className="fas fa-sort-down ml-1 text-primary-500"></i>;
    };

    const filteredAndSortedEmployees = useMemo(() => {
        let filtered = employees.filter(emp => {
            const fullName = `${emp.firstName} ${emp.lastName}`;
            const matchesSearch = fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  emp.nationalId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  (emp.clockId && emp.clockId.toLowerCase().includes(searchTerm.toLowerCase())) ||
                                  (emp.employeeId && emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
            const matchesDepartment = departmentFilter === 'all' || emp.department === departmentFilter;
            return matchesSearch && matchesStatus && matchesDepartment;
        });
        filtered.sort((a: any, b: any) => {
            let valA: any, valB: any;
            if (sortConfig.key === 'fullName') {
                valA = `${a.firstName} ${a.lastName}`.toLowerCase();
                valB = `${b.firstName} ${b.lastName}`.toLowerCase();
            } else {
                valA = String(a[sortConfig.key] || '').toLowerCase();
                valB = String(b[sortConfig.key] || '').toLowerCase();
            }
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return filtered;
    }, [employees, searchTerm, statusFilter, departmentFilter, sortConfig]);
    
    const toggleColumn = (col: string) => setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
    const toggleSelect = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    const toggleSelectAll = () => setSelectedIds(selectedIds.length === filteredAndSortedEmployees.length && filteredAndSortedEmployees.length > 0 ? [] : filteredAndSortedEmployees.map(e => e.id));

    const handleBulkDelete = async () => {
        if (!perms.canDeleteEmployee) return;
        if (!window.confirm(t('confirmBulkDelete', { count: selectedIds.length }))) return;
        setIsSubmitting(true);
        try {
            await employeeApi.deleteMany(selectedIds);
            logActivity(user!.username, `Bulk deleted ${selectedIds.length} employees`);
            showToast(t('employees.updated'), 'success');
            setSelectedIds([]);
            await fetchEmployees();
        } catch (e) { 
            showToast(t('errors.generic'), 'critical'); 
        } finally { setIsSubmitting(false); }
    };

    const handleBulkStatusChange = async (newStatus: Employee['status']) => {
        if (!perms.canManageEmployees || selectedIds.length === 0) return;
        setIsSubmitting(true);
        try {
            await employeeApi.updateMany(selectedIds, { status: newStatus });
            logActivity(user!.username, `Bulk updated status to ${newStatus} for ${selectedIds.length} employees`);
            showToast(t('employees.updated'), 'success');
            setSelectedIds([]);
            await fetchEmployees();
        } catch (err) { 
            showToast(t('errors.generic'), 'critical'); 
        } finally { setIsSubmitting(false); }
    };

    const handleMarkAsLeft = async (e: React.MouseEvent, emp: Employee) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (processingId) return;
        setProcessingId(emp.id);

        try {
            const assignments = await assignmentApi.getAll();
            const activeAssign = assignments.find(a => a.employeeId === emp.id && !a.checkOutDate);
            
            if (activeAssign) {
                const room = await roomApi.getById(activeAssign.roomId);
                let building: Building | undefined = undefined;
                if (room) {
                    const floor = await floorApi.getById(room.floorId);
                    if (floor) {
                        building = (await buildingApi.getById(floor.buildingId)) || undefined;
                    }
                }
                setPendingLeftAction({ emp, assignment: activeAssign, room: room || undefined, building });
                setShowCheckoutConfirm(true);
            } else {
                setPendingLeftAction({ emp });
                setShowCheckoutConfirm(true);
            }
        } catch (error) {
            showToast(t('errors.generic'), 'critical');
        } finally {
            setProcessingId(null);
        }
    };

    const confirmMarkAsLeft = async (shouldCheckout: boolean) => {
        if (!pendingLeftAction) return;
        const { emp, assignment, room } = pendingLeftAction;
        setIsSubmitting(true);
        
        try {
            await employeeApi.update(emp.id, { status: 'left' });

            if (shouldCheckout && assignment && room) {
                const now = new Date().toISOString();
                await assignmentApi.update(assignment.id, { 
                    checkOutDate: now, 
                    notes: `Auto Checkout during Status Change by ${user?.username}` 
                });
                
                const newOcc = Math.max(0, room.currentOccupancy - 1);
                await roomApi.update(room.id, { 
                    currentOccupancy: newOcc, 
                    status: newOcc === 0 ? 'available' : room.status 
                });
                showToast(language === 'ar' ? 'تم تسجيل المغادرة وتحديث الحالة' : 'Checkout processed & Status updated', 'success');
            } else {
                showToast(t('employees.updated'), 'success');
            }
            
            if (user) await logActivity(user.username, `Status changed to Left for: ${emp.firstName} ${emp.lastName}`);
            
            setEmployees(prev => prev.map(item => item.id === emp.id ? { ...item, status: 'left' } : item));
            setShowCheckoutConfirm(false);
            setPendingLeftAction(null);
            
        } catch (error) {
            showToast(t('errors.generic'), 'critical');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSingleDelete = async (id: number, name: string) => {
        if (!perms.canDeleteEmployee) return;
        if (!window.confirm(t('users.deleteConfirm', { name }))) return;
        setIsSubmitting(true);
        try {
            await employeeApi.delete(id);
            logActivity(user!.username, `Deleted employee: ${name}`);
            showToast(t('employees.updated'), 'success');
            await fetchEmployees();
            setSelectedIds(prev => prev.filter(x => x !== id));
        } catch (e) { 
            showToast(t('errors.generic'), 'critical'); 
        } finally { setIsSubmitting(false); }
    };

    const openAddModal = () => {
        const firstDept = combinedDepartments[0] || 'reception';
        setEditingEmployee(null);
        setFormData({ 
            employeeId: '', 
            clockId: '', 
            firstName: '', 
            lastName: '', 
            nationalId: '', 
            jobTitle: getJobTitlesForDept(firstDept)[0] || '', 
            level: '',
            phone: '', 
            department: firstDept, 
            workLocation: workLocations[0] || '',
            address: '',
            dateOfBirth: '',
            status: 'active', 
            contractStartDate: new Date().toISOString().split('T')[0],
            contractEndDate: '', 
            profileImage: null, 
            idImage: null,
            gender: 'male'
        });
        setIsModalOpen(true);
    };

    const openEditModal = (employee: Employee) => {
        setEditingEmployee(employee);
        // Fix: Explicitly set optional string fields to an empty string if they are undefined in the employee object
        setFormData({ 
            ...employee, 
            address: employee.address || '', // Ensure address is a string
            clockId: employee.clockId || '', 
            contractStartDate: employee.contractStartDate ? employee.contractStartDate.split('T')[0] : '',
            contractEndDate: employee.contractEndDate ? employee.contractEndDate.split('T')[0] : '', 
            dateOfBirth: employee.dateOfBirth ? employee.dateOfBirth.split('T')[0] : '',
            profileImage: employee.profileImage || null,
            idImage: employee.idImage || null, 
            level: employee.level || '', 
            gender: employee.gender || 'male' 
        });
        setIsModalOpen(true);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'department') {
            setFormData(prev => ({ ...prev, department: value, jobTitle: getJobTitlesForDept(value)?.[0] || '' }));
        } else setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) {
            showToast("Photo too large (Max 20MB)", "critical");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            setFormData(prev => ({ ...prev, profileImage: reader.result as string }));
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        setIsSubmitting(true);
        try {
            // Ensure employeeId has a value if missing (Internal fallback)
            const finalEmployeeId = formData.employeeId || formData.clockId || 'SYS-' + Date.now();
            
            const data = { 
                ...formData, 
                employeeId: finalEmployeeId,
                contractStartDate: formData.contractStartDate ? new Date(formData.contractStartDate).toISOString() : '',
                dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth).toISOString() : ''
            };
            
            let oldValues = '';
            if (editingEmployee) {
                oldValues = JSON.stringify(editingEmployee);
                await employeeApi.update(editingEmployee.id, data);
                logActivity(user!.username, `Updated employee: ${formData.firstName} ${formData.lastName}`, {
                    oldValues,
                    newValues: JSON.stringify(data),
                    actionType: 'UPDATE',
                    module: 'employees'
                });
                showToast(t('employees.updated'), 'success');
            } else {
                await employeeApi.create(data);
                logActivity(user!.username, `Created employee: ${formData.firstName} ${formData.lastName}`, {
                    newValues: JSON.stringify(data),
                    actionType: 'CREATE',
                    module: 'employees'
                });
                showToast(t('employees.added'), 'success');
            }
            setIsModalOpen(false);
            await fetchEmployees();
        } catch (error: any) { 
            showToast(error.message || t('errors.generic'), 'critical'); 
        } finally { setIsSubmitting(false); }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                // Read starting from Excel row 4 (index 3) and use it as header
                const jsonRows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1, range: 3 }); 

                const errors: { row: number, msg: string }[] = [];
                const validData: any[] = [];
                
                const excelDateToISO = (excelDate: any): string | null => {
                    if (!excelDate) return null;
                    // Check if it's an Excel date number
                    if (typeof excelDate === 'number') {
                        // Excel epoch is 1899-12-30. JS epoch is 1970-01-01.
                        // 25569 is the number of days between 1899-12-30 and 1970-01-01.
                        const jsDate = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
                        return jsDate.toISOString();
                    }
                    // Try to parse as a string date
                    const parsedDate = new Date(excelDate);
                    return !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null;
                };

                jsonRows.forEach((row, index) => {
                    const rowNum = index + 5; // Data starts at Excel row 5 (after header row 4)

                    // Map Excel headers (as generated by sheet_to_json) to Employee interface properties
                    const empCode = row["Employee Code (*)"];
                    const clockId = row["Clock ID"];
                    const fName = row["First Name (*)"];
                    const lName = row["Last Name (*)"];
                    const natId = row["National ID (*)"];
                    const gender = row["Gender (male/female) (*)"];
                    const dob = row["Date of Birth (YYYY-MM-DD)"];
                    const phone = row["Phone Number (*)"];
                    const address = row["Address"];
                    const deptCode = row["Department Code (*)"];
                    const jobTitle = row["Job Title (*)"];
                    const level = row["Level"];
                    const wLoc = row["Work Location (*)"];
                    const contractStart = row["Contract Start Date (YYYY-MM-DD) (*)"];
                    const contractEnd = row["Contract End Date (YYYY-MM-DD)"];
                    const status = row["Status (active/left) (*)"];
                    
                    // Validation (updated to match new fields and mandatory status)
                    if (!empCode) { errors.push({ row: rowNum, msg: 'Missing Employee Code (*)' }); return; }
                    if (!fName) { errors.push({ row: rowNum, msg: 'Missing First Name (*)' }); return; }
                    if (!lName) { errors.push({ row: rowNum, msg: 'Missing Last Name (*)' }); return; }
                    if (!natId) { errors.push({ row: rowNum, msg: 'Missing National ID (*)' }); return; }
                    if (!gender) { errors.push({ row: rowNum, msg: 'Missing Gender (*)' }); return; }
                    if (!phone) { errors.push({ row: rowNum, msg: 'Missing Phone Number (*)' }); return; }
                    if (!deptCode) { errors.push({ row: rowNum, msg: 'Missing Department Code (*)' }); return; }
                    if (!jobTitle) { errors.push({ row: rowNum, msg: 'Missing Job Title (*)' }); return; }
                    if (!wLoc) { errors.push({ row: rowNum, msg: 'Missing Work Location (*)' }); return; }
                    if (!contractStart) { errors.push({ row: rowNum, msg: 'Missing Contract Start Date (*)' }); return; }
                    if (!status) { errors.push({ row: rowNum, msg: 'Missing Status (*)' }); return; }

                    if (!combinedDepartments.includes(String(deptCode).toLowerCase())) { 
                        errors.push({ row: rowNum, msg: `Invalid Department Code: ${deptCode}` }); 
                        return;
                    }
                    if (!['male', 'female'].includes(String(gender)?.toLowerCase())) {
                        errors.push({ row: rowNum, msg: `Gender must be 'male' or 'female'` });
                        return;
                    }
                    if (!['active', 'left'].includes(String(status)?.toLowerCase())) {
                        errors.push({ row: rowNum, msg: `Status must be 'active' or 'left'` });
                        return;
                    }

                    validData.push({
                        employeeId: String(empCode),
                        clockId: clockId ? String(clockId) : null,
                        firstName: String(fName),
                        lastName: String(lName),
                        nationalId: String(natId),
                        gender: String(gender).toLowerCase(),
                        dateOfBirth: excelDateToISO(dob),
                        phone: String(phone),
                        address: address ? String(address) : null,
                        department: String(deptCode).toLowerCase(), 
                        jobTitle: String(jobTitle),
                        level: level ? String(level) : null,
                        workLocation: String(wLoc),
                        contractStartDate: excelDateToISO(contractStart),
                        contractEndDate: excelDateToISO(contractEnd),
                        status: String(status).toLowerCase(),
                    });
                });
                
                setImportData(validData);
                setImportErrors(errors);
            } catch (err) {
                console.error("Excel parsing error:", err);
                showToast("Failed to parse Excel file. Ensure you use the official template and correct date formats (YYYY-MM-DD).", 'critical');
            }
        };
        reader.readAsBinaryString(file);
    };

    const confirmImport = async () => {
        if (importData.length === 0) return;
        setIsSubmitting(true);
        try {
            await importApi.importEmployees(importData);
            logActivity(user!.username, `HR Enterprise Import: ${importData.length} staff records`);
            showToast(t('employees.import.success', { successCount: importData.length }), 'success');
            setIsImportModalOpen(false);
            setImportData([]); // Clear data on success
            setImportErrors([]); // Clear errors on success
            await fetchEmployees();
        } catch (e: any) { // Catch the error thrown by importApi.importEmployees
            showToast(e.message || t('errors.generic'), 'critical'); // Display specific error or generic one
            // Do not clear importData/importErrors here so user can see what failed
        } finally {
            setIsSubmitting(false);
        }
    };

    const generateReport = () => {
        navigate('/reports', { 
            state: { 
                reportKey: 'employees',
                filters: {
                    department: departmentFilter,
                    status: statusFilter
                }
            } 
        });
    };

    const inputClass = "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-hotel-gold outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white transition-all shadow-inner placeholder-slate-400";
    const labelClass = "block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-widest";

    const getInitials = (f: string, l: string) => `${f.substring(0, 1)}${l.substring(0, 1)}`.toUpperCase();

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">{t('employees.title')}</h1>
                    <p className="text-hotel-muted dark:text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">HR Staff Directory & Lifecycle Management</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative" ref={columnDropdownRef}>
                        <button onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)} className="px-4 py-2 bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 text-xs font-bold flex items-center gap-2 uppercase tracking-wider shadow-sm transition-all">
                            <i className="fas fa-columns text-hotel-gold"></i> {t('columns')}
                        </button>
                        {isColumnDropdownOpen && (
                            <div className="absolute top-full mt-2 w-64 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-2xl z-[60] p-4 animate-fade-in-up">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2 border-b pb-2">{t('showHideColumns')}</p>
                                <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
                                    {Object.keys(visibleColumns).map(col => (
                                        <label key={col} className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors group">
                                            <input type="checkbox" checked={visibleColumns[col]} onChange={() => toggleColumn(col)} className="w-4 h-4 text-primary-600 rounded border-slate-300 group-hover:scale-110 transition-transform" />
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                {col === 'idImage' ? 'Avatar Scan' : col === 'profileImage' ? 'Profile Photo' : col === 'clockId' ? 'Clock ID' : col === 'employeeId' ? 'System ID' : col === 'contractStartDate' ? t('employees.contractStartDate') : t(`employees.${col}`)}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    {perms.canManageEmployees && (
                        <>
                            {selectedIds.length > 0 && (
                                <div className="flex items-center gap-2 animate-fade-in-up">
                                    {perms.canDeleteEmployee && (
                                        <button onClick={handleBulkDelete} className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-xs font-bold uppercase tracking-wider shadow-md flex items-center gap-2">
                                            <i className="fas fa-trash-alt"></i> {t('bulkDelete')} ({selectedIds.length})
                                        </button>
                                    )}
                                    <div className="relative group">
                                        <button className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-xs font-bold uppercase tracking-wider shadow-md flex items-center gap-2">
                                            <i className="fas fa-sync-alt"></i> {t('housing.changeStatus')}
                                        </button>
                                        <div className="absolute top-full right-0 mt-1 w-40 bg-white dark:bg-slate-800 rounded-lg shadow-xl border dark:border-slate-700 hidden group-hover:block z-50 overflow-hidden">
                                            <button onClick={() => handleBulkStatusChange('active')} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 border-b dark:border-slate-700 text-emerald-600 uppercase">
                                                {t('statuses.active')}
                                            </button>
                                            <button onClick={() => handleBulkStatusChange('left')} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 text-rose-600 uppercase">
                                                {t('statuses.left')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <button onClick={() => setIsImportModalOpen(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs font-bold uppercase tracking-wider shadow-sm flex items-center gap-2">
                                <i className="fas fa-file-import"></i> {t('importExcel')}
                            </button>
                            <button onClick={openAddModal} className="px-5 py-2 bg-primary-600 text-white rounded-lg hover:brightness-110 text-xs font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
                                <i className="fas fa-plus"></i> {t('employees.add')}
                            </button>
                        </>
                    )}
                    <button onClick={generateReport} className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-xs font-bold uppercase tracking-wider shadow-sm flex items-center gap-2">
                        <i className="fas fa-chart-line"></i> Generate Report
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5 border dark:border-slate-700">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                        <div className="relative">
                            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                            <input type="text" placeholder={t('employees.search')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={inputClass + " pl-9"}/>
                        </div>
                    </div>
                    <div>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className={inputClass}>
                            <option value="all">{t('employees.allStatuses')}</option>
                            <option value="active">{t('statuses.active')}</option>
                            <option value="left">{t('statuses.left')}</option>
                        </select>
                    </div>
                    <div>
                        <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} className={inputClass}>
                            <option value="all">{t('employees.allDepartments')}</option>
                            {combinedDepartments.map(dept => <option key={dept} value={dept}>{t(`departments.${dept}`) !== `departments.${dept}` ? t(`departments.${dept}`) : dept.replace(/_/g, ' ')}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border dark:border-slate-700">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
                        <thead className="text-[10px] text-slate-500 font-black bg-slate-50 dark:bg-slate-700 uppercase tracking-widest border-b dark:border-slate-700">
                            <tr>
                                {perms.canManageEmployees && (
                                    <th className="px-6 py-5 w-10">
                                        <input type="checkbox" checked={selectedIds.length === filteredAndSortedEmployees.length && filteredAndSortedEmployees.length > 0} onChange={toggleSelectAll} className="w-4 h-4 text-primary-600 rounded border-slate-300" />
                                    </th>
                                )}
                                {Object.keys(visibleColumns).map(col => visibleColumns[col] && (
                                    <th key={col} className={`px-6 py-5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors ${col === 'idImage' ? 'w-16' : ''}`} onClick={() => col !== 'idImage' && handleSort(col as EmployeeKey)}>
                                        <div className="flex items-center gap-1">
                                            {col === 'idImage' ? 'Avatar' : col === 'clockId' ? 'Clock ID' : col === 'employeeId' ? 'System ID' : col === 'contractStartDate' ? t('employees.contractStartDate') : t(`employees.${col}`)}
                                            {col !== 'idImage' && renderSortIcon(col)}
                                        </div>
                                    </th>
                                ))}
                                {perms.canManageEmployees && <th className="px-6 py-5 text-center">{t('actions')}</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
                            {filteredAndSortedEmployees.map(emp => (
                                <tr key={emp.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group ${selectedIds.includes(emp.id) ? 'bg-primary-50/50' : ''} ${emp.status === 'left' ? 'opacity-60' : ''}`}>
                                    {perms.canManageEmployees && (
                                        <td className="px-6 py-4">
                                            <input type="checkbox" checked={selectedIds.includes(emp.id)} onChange={() => toggleSelect(emp.id)} className="w-4 h-4 text-primary-600 rounded border-slate-300" />
                                        </td>
                                    )}
                                    {visibleColumns.idImage && (
                                        <td className="px-6 py-4">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 overflow-hidden shadow-inner flex items-center justify-center">
                                                {emp.profileImage ? (
                                                    <img src={emp.profileImage} className="w-full h-full object-cover" alt="Profile" />
                                                ) : emp.idImage ? (
                                                     <img src={emp.idImage} className="w-full h-full object-cover" alt="Scan" />
                                                ) : (
                                                    <span className="text-[10px] font-black text-slate-400">{getInitials(emp.firstName, emp.lastName)}</span>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                    {visibleColumns.clockId && <td className="px-6 py-4 font-mono font-bold text-hotel-gold tracking-tight">{emp.clockId || '—'}</td>}
                                    {visibleColumns.employeeId && <td className="px-6 py-4 font-mono font-bold text-slate-400 tracking-tight">{emp.employeeId}</td>}
                                    {visibleColumns.firstName && <td className="px-6 py-4 font-black text-slate-900 dark:text-white uppercase text-xs">{emp.firstName}</td>}
                                    {visibleColumns.lastName && <td className="px-6 py-4 font-black text-slate-900 dark:text-white uppercase text-xs">{emp.lastName}</td>}
                                    {visibleColumns.nationalId && <td className="px-6 py-4 font-mono text-[11px]">{emp.nationalId}</td>}
                                    {visibleColumns.gender && <td className="px-6 py-4 font-bold uppercase text-[10px]">{emp.gender ? t(`employees.${emp.gender}`) : '—'}</td>}
                                    {visibleColumns.department && <td className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-tight">{t(`departments.${emp.department}`)}</td>}
                                    {visibleColumns.workLocation && <td className="px-6 py-4 text-[10px] font-black uppercase text-hotel-gold">{emp.workLocation || '—'}</td>}
                                    {visibleColumns.dateOfBirth && <td className="px-6 py-4 text-[10px] font-mono">{emp.dateOfBirth ? new Date(emp.dateOfBirth).toLocaleDateString() : '—'}</td>}
                                    {visibleColumns.jobTitle && <td className="px-6 py-4 text-xs font-bold">{emp.jobTitle}</td>}
                                    {visibleColumns.level && <td className="px-6 py-4 font-bold text-hotel-gold text-xs">{emp.level || '—'}</td>}
                                    {visibleColumns.phone && <td className="px-6 py-4 font-mono text-[11px]">{emp.phone}</td>}
                                    {visibleColumns.status && (
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border ${emp.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                                {t(`statuses.${emp.status}`)}
                                            </span>
                                        </td>
                                    )}
                                    {visibleColumns.contractStartDate && <td className="px-6 py-4 text-[11px] font-bold text-slate-400">{emp.contractStartDate ? new Date(emp.contractStartDate).toLocaleDateString() : '—'}</td>}
                                    {perms.canManageEmployees && (
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openEditModal(emp)} className="text-primary-600 hover:text-white hover:bg-primary-600 p-2 rounded-lg transition-all" title={t('edit')}>
                                                    <i className="fas fa-edit text-[12px]"></i>
                                                </button>
                                                {emp.status === 'active' && (
                                                    <button 
                                                        onClick={(e) => handleMarkAsLeft(e, emp)} 
                                                        disabled={processingId === emp.id} 
                                                        className="text-amber-600 hover:text-white hover:bg-amber-600 p-2 rounded-lg transition-all disabled:opacity-30" 
                                                        title={language === 'ar' ? 'إنهاء الخدمة / قفل' : 'Mark as Left / Close'}
                                                    >
                                                        <i className={`fas ${processingId === emp.id ? 'fa-spinner fa-spin' : 'fa-user-lock'} text-[12px]`}></i>
                                                    </button>
                                                )}
                                                {perms.canDeleteEmployee && (
                                                    <button onClick={() => handleSingleDelete(emp.id, `${emp.firstName} ${emp.lastName}`)} className="text-rose-600 hover:text-white hover:bg-rose-600 p-2 rounded-lg transition-all" title={t('delete')}>
                                                        <i className="fas fa-trash-alt text-[12px]"></i>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
                        <div className="p-6 bg-emerald-600 text-white flex justify-between items-center">
                            <h2 className="text-xl font-black uppercase tracking-widest">{t('employees.import.title')}</h2>
                            <button onClick={() => { setIsImportModalOpen(false); setImportData([]); setImportErrors([]); }} className="text-white/60 hover:text-white transition-colors"><i className="fas fa-times"></i></button>
                        </div>
                        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 shadow-inner">
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white uppercase tracking-tight">{language === 'ar' ? 'اختر ملف إكسيل (.xlsx)' : 'Select Excel File (.xlsx)'}</h3>
                                    <p className="text-xs text-slate-500 mt-1">Ensure data starts from <b>Row 4</b> as per the official template.</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => downloadEmployeeTemplate(t, currentProperty?.displayName || 'Property')} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 shadow-sm transition-all flex items-center gap-2">
                                        <i className="fas fa-download text-hotel-gold"></i> {t('employees.import.downloadTemplate')}
                                    </button>
                                    <label className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg cursor-pointer hover:brightness-110 transition-all flex items-center gap-2">
                                        <i className="fas fa-upload"></i> {language === 'ar' ? 'رفع الملف' : 'Upload File'}
                                        <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                                    </label>
                                </div>
                            </div>

                            {importData.length > 0 && (
                                <div className="space-y-4 animate-fade-in-up">
                                    <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                                        <div className="flex gap-4">
                                            <span className="text-xs font-black uppercase text-blue-700 dark:text-blue-300">{importData.length} Valid Records Ready</span>
                                            {importErrors.length > 0 && <span className="text-xs font-black uppercase text-rose-600">{importErrors.length} Formatting Errors Found</span>}
                                        </div>
                                        <button onClick={confirmImport} disabled={isSubmitting} className="px-8 py-2 bg-blue-600 text-white rounded-lg font-black text-[10px] uppercase shadow-md hover:bg-blue-700 transition-all">
                                            {isSubmitting ? <i className="fas fa-spinner fa-spin"></i> : 'Confirm HR Migration'}
                                        </button>
                                    </div>
                                    
                                    <div className="overflow-x-auto rounded-xl border dark:border-slate-700">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 dark:bg-slate-900 font-bold uppercase text-[9px] text-slate-400">
                                                <tr><th className="p-3">Clock ID</th><th className="p-3">Name</th><th className="p-3">Dept</th><th className="p-3">Gender</th><th className="p-3">Status</th></tr>
                                            </thead>
                                            <tbody className="divide-y dark:divide-slate-700">
                                                {importData.slice(0, 10).map((row, i) => (
                                                    <tr key={i} className="dark:text-slate-300">
                                                        <td className="p-3 font-mono font-bold text-hotel-gold">{row.clockId || row.employeeId}</td>
                                                        <td className="p-3">{row.firstName} {row.lastName}</td>
                                                        <td className="p-3 uppercase">{row.department}</td>
                                                        <td className="p-3 uppercase">{row.gender}</td>
                                                        <td className="p-3"><span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase">{row.status}</span></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {importData.length > 10 && <p className="p-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">... and {importData.length - 10} more records</p>}
                                    </div>
                                </div>
                            )}

                            {importErrors.length > 0 && (
                                <div className="space-y-2 animate-fade-in-up">
                                    <h4 className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Formatting Issues</h4>
                                    <div className="bg-rose-50 dark:bg-rose-900/10 p-4 rounded-xl border border-rose-100 dark:border-rose-900/30 max-h-40 overflow-y-auto custom-scrollbar">
                                        {importErrors.map((err, i) => (
                                            <p key={i} className="text-[11px] text-rose-700 dark:text-rose-400 mb-1">Row {err.row}: {err.msg}</p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal for Employee */}
            {isModalOpen && perms.canManageEmployees && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-fade-in-up flex flex-col max-h-[95vh]">
                        <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-hotel-navy text-white">
                            <h2 className="text-xl font-black uppercase tracking-widest">{editingEmployee ? t('employees.edit') : t('employees.add')}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-white/60 hover:text-white transition-colors"><i className="fas fa-times text-xl"></i></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto custom-scrollbar flex-1">
                            <div className="flex flex-col md:flex-row gap-10 items-start mb-8">
                                <div className="flex flex-col items-center gap-4 w-full md:w-auto">
                                    <div className="w-32 h-32 rounded-3xl bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shadow-inner relative group">
                                        {formData.profileImage ? <img src={formData.profileImage} className="w-full h-full object-cover" alt="Profile" /> : <i className="fas fa-user text-slate-200 text-5xl"></i>}
                                        <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i className="fas fa-camera text-2xl"></i></button>
                                    </div>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                                    <p className="text-[8px] font-black uppercase text-slate-400">Max Size: 20MB</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                                    <div className="space-y-1">
                                        <label className={labelClass}>Clock ID</label>
                                        <input type="text" name="clockId" value={formData.clockId} onChange={handleFormChange} className={inputClass} placeholder="External Clocking Number" />
                                    </div>
                                    <div className="space-y-1"><label className={labelClass}>{t('employees.firstName')}</label><input type="text" name="firstName" value={formData.firstName} onChange={handleFormChange} required className={inputClass} /></div>
                                    <div className="space-y-1"><label className={labelClass}>{t('employees.lastName')}</label><input type="text" name="lastName" value={formData.lastName} onChange={handleFormChange} required className={inputClass} /></div>
                                    <div className="space-y-1"><label className={labelClass}>{t('employees.nationalId')}</label><input type="text" name="nationalId" value={formData.nationalId} onChange={handleFormChange} required className={inputClass} /></div>
                                    <div className="space-y-1"><label className={labelClass}>{t('employees.dateOfBirth')} (Optional)</label><input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleFormChange} className={`${inputClass}`} /></div>
                                    <div className="space-y-1"><label className={labelClass}>{t('employees.gender')}</label><select name="gender" value={formData.gender} onChange={handleFormChange} className={inputClass}><option value="male">{t('employees.male')}</option><option value="female">{t('employees.female')}</option></select></div>
                                    <div className="space-y-1"><label className={labelClass}>{t('employees.department')}</label><select name="department" value={formData.department} onChange={handleFormChange} required className={inputClass}>{combinedDepartments.map(dept => <option key={dept} value={dept}>{t(`departments.${dept}`)}</option>)}</select></div>
                                    <div className="space-y-1"><label className={labelClass}>{t('employees.workLocation')}</label><select name="workLocation" value={formData.workLocation} onChange={handleFormChange} required className={inputClass}><option value="">-- {t('select')} --</option>{workLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}</select></div>
                                    <div className="space-y-1"><label className={labelClass}>{t('employees.jobTitle')}</label><select name="jobTitle" value={formData.jobTitle} onChange={handleFormChange} required className={inputClass}>{getJobTitlesForDept(formData.department).map(title => <option key={title} value={title}>{title}</option>)}</select></div>
                                    <div className="space-y-1">
                                        <label className={labelClass}>{t('employees.level')}</label>
                                        <input type="text" name="level" value={formData.level} onChange={handleFormChange} className={inputClass} placeholder="Staff Level / Grade" />
                                    </div>
                                    <div className="space-y-1"><label className={labelClass}>{t('employees.phone')}</label><input type="text" name="phone" value={formData.phone} onChange={handleFormChange} required className={inputClass} /></div>
                                    <div className="col-span-2 space-y-1"><label className={labelClass}>{t('employees.address')}</label><input type="text" name="address" value={formData.address} onChange={handleFormChange} className={inputClass} placeholder="Residential Address" /></div>
                                    <div className="space-y-1"><label className={labelClass}>{t('employees.contractStartDate')}</label><input type="date" name="contractStartDate" value={formData.contractStartDate} onChange={handleFormChange} className={`${inputClass}`} /></div>
                                    <div className="space-y-1"><label className={labelClass}>Contract End Date (Optional)</label><input type="date" name="contractEndDate" value={formData.contractEndDate} onChange={handleFormChange} className={`${inputClass}`} /></div>
                                </div>
                            </div>
                        </form>
                        <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50/50">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-slate-500 font-black uppercase text-[10px] tracking-widest">{t('cancel')}</button>
                            <button onClick={handleSubmit} disabled={isSubmitting} className="px-12 py-3 bg-hotel-navy text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:brightness-110 transition-all">{isSubmitting ? t('saving') : t('save')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mark as Left Confirmation */}
            {showCheckoutConfirm && pendingLeftAction && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 w-full max-w-md animate-fade-in-up text-center">
                        <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                            <i className="fas fa-user-lock"></i>
                        </div>
                        <h2 className="text-xl font-black uppercase tracking-widest mb-2 text-slate-900 dark:text-white">Status Change Required</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                            {language === 'ar' 
                                ? `الموظف ${pendingLeftAction.emp.firstName} لديه تسكين نشط في غرفة ${pendingLeftAction.room?.roomNumber || 'غير معروفة'}. هل ترغب في تسجيل المغادرة آلياً أيضاً؟`
                                : `${pendingLeftAction.emp.firstName} is currently assigned to Room ${pendingLeftAction.room?.roomNumber || 'Unknown'}. Perform automatic checkout as well?`
                            }
                        </p>
                        
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={() => confirmMarkAsLeft(true)} 
                                disabled={isSubmitting}
                                className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-door-open"></i>}
                                {language === 'ar' ? 'إنهاء الخدمة مع تسجيل المغادرة' : 'Mark Left & Checkout'}
                            </button>
                            <button 
                                onClick={() => confirmMarkAsLeft(false)}
                                disabled={isSubmitting}
                                className="w-full py-4 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl font-black text-xs uppercase hover:bg-slate-200 transition-all"
                            >
                                {language === 'ar' ? 'إنهاء الخدمة فقط' : 'Mark Left Only'}
                            </button>
                            <button 
                                onClick={() => { setShowCheckoutConfirm(false); setPendingLeftAction(null); }}
                                className="w-full py-2 text-slate-400 font-black text-[10px] uppercase hover:text-slate-600"
                            >
                                {t('cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeesPage;