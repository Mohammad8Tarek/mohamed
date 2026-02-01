
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Assignment, Employee, Room, Building, Floor, Reservation, DEPARTMENTS, departmentJobTitles, ReservationGuest, Hosting, Property, RoomTypeConfig } from '../types';
import { assignmentApi, employeeApi, roomApi, buildingApi, floorApi, logActivity, reservationApi, hostingApi } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { useProperty } from '../context/PropertyContext';
import { usePermissions } from '../hooks/usePermissions';

const EMPTY_GUEST: ReservationGuest = { 
    firstName: '', lastName: '', guestIdCardNumber: '', guestPhone: '', jobTitle: '', department: 'reception', guestType: 'adult', age: ''
};

const toDatetimeLocal = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
};

const ReservationsPage: React.FC = () => {
    const { user } = useAuth();
    const { language, t } = useLanguage();
    const { showToast } = useToast();
    const { allProperties, currentProperty } = useProperty();
    const perms = usePermissions();
    const { settings: appSettings } = useSettings();

    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [hostings, setHostings] = useState<Hosting[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [floors, setFloors] = useState<Floor[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [activeTab, setActiveTab] = useState<'assignments' | 'reservations' | 'hosting'>('assignments');
    const [selectedCompanions, setSelectedCompanions] = useState<ReservationGuest[] | null>(null);

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

    // Filter Logic for Modals
    const [selectedBuildId, setSelectedBuildId] = useState<string>('');
    const [selectedFloorId, setSelectedFloorId] = useState<string>('');
    const [selectedRoomType, setSelectedRoomType] = useState<string>('');

    // Global Search (Cross-Property) Logic
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [globalResults, setGlobalResults] = useState<Employee[]>([]);
    const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
    const [selectedSearchPropertyId, setSelectedSearchPropertyId] = useState<string>('all');

    // Column Manager State
    const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
    const columnDropdownRef = useRef<HTMLDivElement>(null);
    const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() => {
        const saved = localStorage.getItem('reservations_cols_v2');
        return saved ? JSON.parse(saved) : {
            id: true, name: true, nationalId: true, gender: true, phone: true, department: true, level: true, jobTitle: true, location: true, dates: true
        };
    });

    useEffect(() => {
        localStorage.setItem('reservations_cols_v2', JSON.stringify(visibleCols));
    }, [visibleCols]);

    // Modals visibility
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
    const [isHostingModalOpen, setIsHostingModalOpen] = useState(false);
    const [isCheckOutModalOpen, setIsCheckOutModalOpen] = useState(false);
    const [isEndHostingModalOpen, setIsEndHostingModalOpen] = useState(false);

    // Dynamic Taxonomy
    const combinedDepartments = useMemo(() => {
        const taxonomy = appSettings.customTaxonomy || { departments: [], hiddenDepartments: [] };
        const combined = Array.from(new Set([...DEPARTMENTS, ...(taxonomy.departments || [])]));
        return combined.filter(d => !(taxonomy.hiddenDepartments || []).includes(d));
    }, [appSettings.customTaxonomy]);

    const getJobTitlesForDept = (dept: string) => {
        const taxonomy = appSettings.customTaxonomy || { jobTitles: {}, hiddenJobTitles: {} };
        const defaults = departmentJobTitles[dept] || [];
        const customs = taxonomy.jobTitles?.[dept] || [];
        return Array.from(new Set([...defaults, ...customs])).filter(t => !(taxonomy.hiddenJobTitles?.[dept] || []).includes(t));
    };

    const roomTypes = useMemo(() => {
        const tax = appSettings.customTaxonomy?.roomTypes || [];
        return tax.map(rt => typeof rt === 'string' ? { name: rt, description: '', defaultCapacity: 1 } : rt);
    }, [appSettings.customTaxonomy]);

    // Form Datas
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [assignForm, setAssignForm] = useState({ employeeId: '', roomId: '', checkInDate: toDatetimeLocal(new Date().toISOString()), expectedCheckOutDate: '' });
    const [reserveForm, setReserveForm] = useState({ firstName: '', lastName: '', guestIdCardNumber: '', guestPhone: '', roomId: '', checkInDate: toDatetimeLocal(new Date().toISOString()), checkOutDate: '', department: combinedDepartments[0] || 'reception', jobTitle: '', notes: '' });
    const [hostingForm, setHostingForm] = useState({ employeeId: '', roomId: '', startDate: toDatetimeLocal(new Date().toISOString()), endDate: '', guests: [{ ...EMPTY_GUEST }] as ReservationGuest[], notes: '' });
    
    const [targetAssignment, setTargetAssignment] = useState<Assignment | null>(null);
    const [checkOutDateInput, setCheckOutDateInput] = useState(toDatetimeLocal(new Date().toISOString()));
    
    const [targetHosting, setTargetHosting] = useState<Hosting | null>(null);
    const [endDateInput, setEndDateInput] = useState(toDatetimeLocal(new Date().toISOString()));

    const fetchData = async () => {
        setLoading(true);
        try {
            const [assignData, reservData, hostData, localEmpData, roomData, buildingData, floorData] = await Promise.all([
                assignmentApi.getAll(), reservationApi.getAll(), hostingApi.getAll(), employeeApi.getAll(), roomApi.getAll(), buildingApi.getAll(), floorApi.getAll()
            ]);
            setAssignments(assignData);
            setReservations(reservData);
            setHostings(hostData);
            setEmployees(localEmpData);
            setRooms(roomData);
            setBuildings(buildingData);
            setFloors(floorData);
        } catch (error) { 
            showToast(t('errors.fetchFailed'), 'critical');
        } finally { setLoading(false); }
    };

    useEffect(() => { 
        fetchData(); 
        const handleClickOutside = (e: MouseEvent) => {
            if (columnDropdownRef.current && !columnDropdownRef.current.contains(e.target as Node)) {
                setIsColumnDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const employeeMap = useMemo(() => {
        return new Map<number, Employee>(employees.map(e => [e.id, e]));
    }, [employees]);

    const getRoomLocation = (roomId: number) => {
        const room = rooms.find(r => r.id === roomId);
        if (!room) return { building: '—', floor: '—', roomNumber: '—', roomType: '—', floorId: 0, buildingId: 0 };
        const floor = floors.find(f => f.id === room.floorId);
        const building = buildings.find(b => b.id === floor?.buildingId);
        return { building: building?.name || '—', floor: floor?.floorNumber || '—', roomNumber: room.roomNumber, roomType: room.roomType, floorId: room.floorId, buildingId: building?.id || 0 };
    };

    const handleSort = (key: string) => {
        setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    };

    const renderSortIcon = (key: string) => {
        if (sortConfig.key !== key) return <i className="fas fa-sort text-slate-300 ml-1 text-[10px]"></i>;
        return sortConfig.direction === 'asc' 
            ? <i className="fas fa-sort-up ml-1 text-primary-500"></i> 
            : <i className="fas fa-sort-down ml-1 text-primary-500"></i>;
    };

    const sortedData = useMemo(() => {
        let currentList: (Assignment | Reservation | Hosting)[] = [];
        if (activeTab === 'assignments') {
            const activeAssignments = assignments.filter(a => !a.checkOutDate);
            const activeHostings = hostings.filter(h => h.status === 'active');
            currentList = [...activeAssignments, ...activeHostings];
        } else if (activeTab === 'reservations') {
            currentList = reservations;
        } else {
            currentList = hostings.filter(h => h.status === 'pending');
        }

        const getPersonData = (item: Assignment | Reservation | Hosting): Employee | Reservation | null => {
            if (item && 'employeeId' in item) {
                const empId = (item as Assignment | Hosting).employeeId;
                const emp = employeeMap.get(empId);
                return emp || null;
            }
            return item as Reservation; 
        };

        return [...currentList].sort((a: any, b: any) => {
            let valA: any = '';
            let valB: any = '';

            const personA = getPersonData(a);
            const personB = getPersonData(b);

            switch(sortConfig.key) {
                case 'name':
                    valA = personA ? `${(personA as any).firstName || ''} ${(personA as any).lastName || ''}`.toLowerCase() : '';
                    valB = personB ? `${(personB as any).firstName || ''} ${(personB as any).lastName || ''}`.toLowerCase() : '';
                    break;
                case 'date':
                    valA = new Date((a as any).checkInDate || (a as any).startDate || 0).getTime();
                    valB = new Date((b as any).checkInDate || (b as any).startDate || 0).getTime();
                    break;
                case 'department':
                    valA = (personA && (personA as any).department ? (personA as any).department : '').toLowerCase();
                    valB = (personB && (personB as any).department ? (personB as any).department : '').toLowerCase();
                    break;
                default:
                    valA = (a as any)[sortConfig.key] || '';
                    valB = (b as any)[sortConfig.key] || '';
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [activeTab, assignments, reservations, hostings, sortConfig, employeeMap]);

    const handleGlobalSearch = async () => {
        if (!globalSearchQuery.trim()) return;
        setIsSearchingGlobal(true);
        try {
            const propId = selectedSearchPropertyId === 'all' ? undefined : parseInt(selectedSearchPropertyId);
            const results = await employeeApi.searchGlobal(globalSearchQuery, propId);
            setGlobalResults(results);
        } catch (e) { 
            showToast(t('errors.generic'), 'critical'); 
        } 
        finally { setIsSearchingGlobal(false); }
    };

    const selectGlobalEmployee = async (emp: Employee) => {
        if (!emp) return;
        let targetEmp: Employee | null = emp;
        // Search the employees array directly to avoid type inference issues with Map.values() and Array.from().
        const localExisting = employees.find(e => e.nationalId === emp.nationalId);
        if (localExisting) {
            targetEmp = localExisting;
            showToast(language === 'ar' ? 'تم اختيار الموظف الموجود مسبقاً' : 'Existing local profile selected', "info");
        } else if (emp.propertyId !== currentProperty?.id) {
            try {
                // Ensure all cloned data fields match the interface for Employee creation.
                const clonedData: Partial<Employee> = { 
                    firstName: emp.firstName, 
                    lastName: emp.lastName, 
                    nationalId: emp.nationalId, 
                    employeeId: emp.employeeId, 
                    phone: emp.phone, 
                    department: emp.department, 
                    jobTitle: emp.jobTitle, 
                    status: 'active', 
                    gender: emp.gender || 'male', // Default to 'male' if undefined
                    level: emp.level || null, // Default to null if undefined
                    contractEndDate: emp.contractEndDate || null, // Default to null if undefined
                    workLocation: emp.workLocation || '', // Mandatory, defaulted to empty string
                    address: emp.address || '', // Optional in interface but needs to be string
                    dateOfBirth: emp.dateOfBirth || '', // Optional in interface but needs to be string
                    contractStartDate: emp.contractStartDate || new Date().toISOString() // Mandatory
                };
                targetEmp = await employeeApi.create(clonedData);
                await fetchData();
            } catch (e: any) { 
                showToast(e.message || "Sync failed", "critical"); return; 
            }
        }
        if (!targetEmp || !targetEmp.id) { 
            showToast("Selection error: Record invalid", "critical"); return; 
        }
        if (isAssignModalOpen) setAssignForm(p => ({ ...p, employeeId: String(targetEmp?.id) }));
        if (isReserveModalOpen) setReserveForm(p => ({ ...p, firstName: targetEmp?.firstName || '', lastName: targetEmp?.lastName || '', guestIdCardNumber: targetEmp?.nationalId || '', guestPhone: targetEmp?.phone || '', department: targetEmp?.department || '', jobTitle: targetEmp?.jobTitle || '' }));
        if (isHostingModalOpen) setHostingForm(p => ({ ...p, employeeId: String(targetEmp?.id) }));
        setGlobalResults([]); setGlobalSearchQuery(''); showToast(`${targetEmp.firstName} selected`, "success");
    };

    const handleReservationCheckIn = async (res: Reservation) => {
        if (isSubmitting || !res) return;
        setIsSubmitting(true);
        try {
            const currentEmployees = await employeeApi.getAll();
            let emp: Employee | undefined = currentEmployees.find(e => e.nationalId === res.guestIdCardNumber);
            if (!emp) {
                // Added missing mandatory fields (workLocation, address, dateOfBirth, contractStartDate) to satisfy the Employee interface.
                const newEmp: Partial<Employee> = { 
                    firstName: res.firstName, 
                    lastName: res.lastName, 
                    nationalId: res.guestIdCardNumber, 
                    employeeId: `RSV-${Date.now().toString().slice(-6)}`, 
                    phone: res.guestPhone, 
                    department: res.department, 
                    jobTitle: res.jobTitle, 
                    status: 'active', 
                    contractEndDate: res.checkOutDate || null,
                    workLocation: '', // Mandatory, defaulted to empty string
                    address: '', // Optional in interface, defaulted to empty string
                    dateOfBirth: '', // Optional in interface, defaulted to empty string
                    contractStartDate: new Date().toISOString() // Mandatory, defaulted to now
                };
                emp = await employeeApi.create(newEmp);
            }
            if (!emp || !emp.id) { 
                showToast("Process aborted: Valid profile required.", 'critical'); return; 
            }
            await assignmentApi.create({ employeeId: emp.id, roomId: res.roomId, checkInDate: new Date().toISOString(), expectedCheckOutDate: res.checkOutDate });
            await reservationApi.delete(res.id);
            const room = rooms.find(r => r.id === res.roomId);
            if (room) { const newOcc = room.currentOccupancy + 1; await roomApi.update(room.id, { currentOccupancy: newOcc, status: newOcc >= room.capacity ? 'occupied' : 'available' }); }
            showToast(t('reservations.resConverted'), 'success'); 
            setActiveTab('assignments');
            await fetchData();
        } catch (e: any) { 
            showToast(e.message || t('errors.generic'), 'critical'); 
        } finally { setIsSubmitting(false); }
    };

    const handleHostingCheckIn = async (h: Hosting) => {
        if (!h) return;
        try { 
            await hostingApi.update(h.id, { status: 'active' }); 
            showToast(language === 'ar' ? 'تم تفعيل الاستضافة' : 'Hosting Activated', 'success'); 
            setActiveTab('assignments');
            await fetchData(); 
        } catch (e) { 
            showToast(t('errors.generic'), 'critical'); 
        }
    };

    const handleEndHosting = async () => {
        if (!targetHosting) return;
        setIsSubmitting(true);
        try {
            await hostingApi.update(targetHosting.id, { 
                status: 'completed',
                endDate: new Date(endDateInput).toISOString() 
            });
            showToast(t('reservations.hostingEnded'), 'success');
            setIsEndHostingModalOpen(false);
            await fetchData();
        } catch(e) {
            showToast(t('errors.generic'), 'critical');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAssignSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assignForm.employeeId || !assignForm.roomId) return;
        setIsSubmitting(true);
        try {
            const data = { employeeId: parseInt(assignForm.employeeId), roomId: parseInt(assignForm.roomId), checkInDate: new Date(assignForm.checkInDate).toISOString(), expectedCheckOutDate: assignForm.expectedCheckOutDate ? new Date(assignForm.expectedCheckOutDate).toISOString() : null };
            await assignmentApi.create(data);
            const room = rooms.find(r => r.id === data.roomId);
            if (room) await roomApi.update(room.id, { currentOccupancy: room.currentOccupancy + 1, status: room.currentOccupancy + 1 >= room.capacity ? 'occupied' : 'available' });
            showToast(t('reservations.added'), 'success'); setIsAssignModalOpen(false); 
            setActiveTab('assignments');
            await fetchData();
        } finally { setIsSubmitting(false); }
    };

    const handleReserveSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setIsSubmitting(true);
        try {
            const data = { ...reserveForm, roomId: parseInt(reserveForm.roomId), checkInDate: new Date(reserveForm.checkInDate).toISOString(), checkOutDate: reserveForm.checkOutDate ? new Date(reserveForm.checkOutDate).toISOString() : null, guests: '[]' };
            if (editingItem) await reservationApi.update(editingItem.id, data as any);
            else { await reservationApi.create(data as any); await roomApi.update(data.roomId, { status: 'reserved' }); }
            showToast(t(editingItem ? 'employees.updated' : 'reservations.resAdded'), 'success'); setIsReserveModalOpen(false); setEditingItem(null); 
            await fetchData();
        } finally { setIsSubmitting(false); }
    };

    const handleHostingSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); if (!hostingForm.guests || hostingForm.guests.length === 0) { 
            showToast("Please add at least one guest.", 'critical'); return; 
        }
        setIsSubmitting(true);
        try {
            const data = { employeeId: parseInt(hostingForm.employeeId), roomId: parseInt(hostingForm.roomId), startDate: new Date(hostingForm.startDate).toISOString(), endDate: hostingForm.endDate ? new Date(hostingForm.endDate).toISOString() : null, guests: JSON.stringify(hostingForm.guests), guestFirstName: hostingForm.guests[0]?.firstName || 'Guest', guestLastName: hostingForm.guests[0]?.lastName || '', guestIdCardNumber: hostingForm.guests[0]?.guestIdCardNumber || '', status: editingItem?.status || 'pending' };
            if (editingItem) { await hostingApi.update(editingItem.id, data as any); showToast(language === 'ar' ? 'تم تحديث الاستضافة' : 'Hosting updated', 'success'); }
            else { await hostingApi.create(data as any); showToast(t('reservations.hostingAdded'), 'success'); }
            setIsHostingModalOpen(false); setEditingItem(null); 
            await fetchData();
        } finally { setIsSubmitting(false); }
    };

    const modalFloors = useMemo(() => {
        if (!selectedBuildId) return [];
        return floors.filter(f => f.buildingId === parseInt(selectedBuildId));
    }, [floors, selectedBuildId]);

    const modalRooms = useMemo(() => {
        if (!selectedFloorId) return [];
        let filtered = rooms.filter(r => r.floorId === parseInt(selectedFloorId) && (r.status === 'available' || r.currentOccupancy < r.capacity));
        if (selectedRoomType) filtered = filtered.filter(r => r.roomType === selectedRoomType);
        return filtered;
    }, [rooms, selectedFloorId, selectedRoomType]);

    const inputClass = "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-hotel-gold outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white transition-all shadow-inner placeholder-slate-400";
    const labelClass = "block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-widest";

    return (
        <div className="space-y-4">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 border-b border-slate-200 pb-3.5 dark:border-slate-700">
                <div>
                    <h1 className="text-xl font-black text-hotel-navy dark:text-white uppercase tracking-tighter leading-none">{t('layout.reservations')}</h1>
                    <p className="text-hotel-muted dark:text-slate-400 text-[10px] mt-1 font-bold uppercase tracking-widest opacity-80">Allocation audit & staff housing ledger.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative" ref={columnDropdownRef}>
                        <button onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm border-transparent">
                            <i className="fas fa-columns text-hotel-gold"></i> {t('columns')}
                        </button>
                        {isColumnDropdownOpen && (
                            <div className="absolute top-full right-0 mt-1.5 w-60 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 p-3 animate-fade-in-up">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b pb-1.5">{t('showHideColumns')}</p>
                                <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                                    {Object.keys(visibleCols).map(col => (
                                        <label key={col} className="flex items-center gap-2.5 cursor-pointer group p-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-md">
                                            <input type="checkbox" checked={visibleCols[col]} onChange={() => setVisibleCols(p => ({...p, [col]: !p[col]}))} className="w-3.5 h-3.5 rounded text-hotel-gold border-slate-300 focus:ring-hotel-gold" />
                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 group-hover:text-hotel-navy transition-colors">
                                                {t(`employees.${col}`) !== `employees.${col}` ? t(`employees.${col}`) : col === 'location' ? t('housing.room') : col === 'dates' ? t('reservations.checkIn') : col}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <button onClick={() => { 
                        setSelectedBuildId(''); setSelectedFloorId(''); setSelectedRoomType(''); setEditingItem(null); 
                        if(activeTab === 'assignments') setIsAssignModalOpen(true); 
                        else if(activeTab === 'reservations') setIsReserveModalOpen(true); 
                        else if(activeTab === 'hosting') {
                            setHostingForm({ employeeId: '', roomId: '', startDate: toDatetimeLocal(new Date().toISOString()), endDate: '', guests: [{ ...EMPTY_GUEST }], notes: '' });
                            setIsHostingModalOpen(true); 
                        }
                    }} className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:brightness-110 transition-all flex items-center gap-2">
                        <i className="fas fa-plus"></i> {t(`reservations.${activeTab === 'assignments' ? 'new' : activeTab === 'reservations' ? 'newRes' : 'newHosting'}`)}
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="p-3 border-b flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/20">
                    <div className="flex gap-1 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner">
                        {(['assignments', 'reservations', 'hosting'] as const).map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === tab ? 'bg-hotel-navy text-white shadow-md' : 'text-slate-500 hover:text-hotel-navy'}`}>{t(`reservations.${tab === 'assignments' ? 'active' : tab === 'reservations' ? 'future' : 'hosting'}`)}</button>
                        ))}
                    </div>
                </div>
                
                <div className="overflow-x-auto custom-scrollbar min-h-[400px]">
                    <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
                        <thead className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 bg-slate-50/80 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 transition-colors">
                            <tr>
                                {visibleCols.id && <th scope="col" className="px-6 py-4 align-middle border-x border-slate-100 dark:border-slate-800/50 text-center w-12">ID / #</th>}
                                {visibleCols.name && (
                                    <th scope="col" className="px-6 py-4 align-middle cursor-pointer whitespace-nowrap border-x border-slate-100 dark:border-slate-800/50 bg-slate-100/30 dark:bg-slate-800/20 hover:bg-white dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('name')}>
                                        <div className="flex items-center justify-between gap-2"><span>{t('employees.fullName')}</span>{renderSortIcon('name')}</div>
                                    </th>
                                )}
                                {visibleCols.nationalId && <th scope="col" className="px-6 py-4 align-middle border-x border-slate-100 dark:border-slate-800/50">{t('employees.nationalId')}</th>}
                                {visibleCols.gender && <th scope="col" className="px-6 py-4 align-middle border-x border-slate-100 dark:border-slate-800/50">{t('employees.gender')}</th>}
                                {visibleCols.phone && <th scope="col" className="px-6 py-4 align-middle border-x border-slate-100 dark:border-slate-800/50">{t('employees.phone')}</th>}
                                {visibleCols.department && <th scope="col" className="px-6 py-4 align-middle border-x border-slate-100 dark:border-slate-800/50">{t('employees.department')}</th>}
                                {visibleCols.level && <th scope="col" className="px-6 py-4 align-middle border-x border-slate-100 dark:border-slate-800/50">{t('employees.level')}</th>}
                                {visibleCols.jobTitle && <th scope="col" className="px-6 py-4 align-middle border-x border-slate-100 dark:border-slate-800/50">{t('employees.jobTitle')}</th>}
                                {visibleCols.location && (
                                    <>
                                        <th scope="col" className="px-6 py-4 align-middle border-x border-slate-100 dark:border-slate-800/50">{t('housing.building')}</th>
                                        <th scope="col" className="px-6 py-4 align-middle border-x border-slate-100 dark:border-slate-800/50">{t('housing.room')}</th>
                                    </>
                                )}
                                {visibleCols.dates && (
                                    <>
                                        <th scope="col" className="px-6 py-4 align-middle cursor-pointer border-x border-slate-100 dark:border-slate-800/50 bg-slate-100/30 dark:bg-slate-800/20 hover:bg-white dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('date')}>
                                            <div className="flex items-center justify-between gap-2"><span>{t('reservations.checkIn')}</span>{renderSortIcon('date')}</div>
                                        </th>
                                        <th scope="col" className="px-6 py-4 align-middle border-x border-slate-100 dark:border-slate-800/50">{t('reservations.expectedCheckOut')}</th>
                                    </>
                                )}
                                <th scope="col" className="px-6 py-4 text-center align-middle border-x border-slate-100 dark:border-slate-800/50 bg-slate-100/50 dark:bg-slate-900/50 font-black text-hotel-gold tracking-widest min-w-[140px]">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {sortedData.map((item: any) => {
                                const emp = activeTab === 'reservations' ? null : employeeMap.get((item as any).employeeId);
                                const loc = getRoomLocation(item.roomId);
                                
                                return (
                                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                                        {visibleCols.id && <td className="px-6 py-4 font-mono text-[9px] font-black text-slate-400">{emp?.employeeId || item.id}</td>}
                                        {visibleCols.name && <td className="px-6 py-4">
                                            <span className="font-bold text-slate-900 dark:text-white uppercase text-[11px] block truncate max-w-[180px]">
                                                {activeTab === 'reservations' ? `${(item as Reservation).firstName} ${(item as Reservation).lastName}` : `${emp?.firstName || '—'} ${emp?.lastName || '—'}`}
                                            </span>
                                            {(activeTab === 'hosting' || (activeTab === 'assignments' && 'startDate' in item)) && <span className="text-[8px] text-hotel-gold font-black uppercase mt-0.5 block">Guest: {(item as Hosting).guestFirstName} {(item as Hosting).guestLastName}</span>}
                                        </td>}
                                        {visibleCols.nationalId && <td className="px-6 py-4 font-mono text-[10px]">{emp?.nationalId || (item as Reservation).guestIdCardNumber || (item as Hosting).guestIdCardNumber || '—'}</td>}
                                        {visibleCols.gender && <td className="px-6 py-4 text-[10px] font-black uppercase">{emp?.gender ? t(`employees.${emp.gender}`) : '—'}</td>}
                                        {visibleCols.phone && <td className="px-6 py-4 font-bold text-emerald-600 text-[10px]">{emp?.phone || (item as Reservation).guestPhone || '—'}</td>}
                                        {visibleCols.department && <td className="px-6 py-4 text-[9px] font-black uppercase text-slate-400">{emp || (item as Reservation).department ? t(`departments.${emp?.department || (item as Reservation).department}`) : '—'}</td>}
                                        {visibleCols.level && <td className="px-6 py-4 font-black text-[9px] text-amber-600 uppercase">{emp?.level || '—'}</td>}
                                        {visibleCols.jobTitle && <td className="px-6 py-4 text-[10px] font-bold truncate max-w-[120px] uppercase">{emp?.jobTitle || (item as Reservation).jobTitle || '—'}</td>}
                                        {visibleCols.location && (
                                            <>
                                                <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200 uppercase text-[10px]">{loc.building}</td>
                                                <td className="px-6 py-4 font-black text-primary-600 text-[10px]">{loc.roomNumber}</td>
                                            </>
                                        )}
                                        {visibleCols.dates && (
                                            <>
                                                <td className="px-6 py-4 font-mono font-bold text-slate-500 text-[10px]">{new Date((item as Assignment).checkInDate || (item as Hosting).startDate).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 font-mono text-rose-500 font-bold text-[10px]">{(item as Assignment).expectedCheckOutDate || (item as Hosting).endDate || (item as Reservation).checkOutDate ? new Date((item as Assignment).expectedCheckOutDate || (item as Hosting).endDate || (item as Reservation).checkOutDate!).toLocaleDateString() : '—'}</td>
                                            </>
                                        )}
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-1.5">
                                                {activeTab === 'assignments' && ('checkInDate' in item) && (
                                                    <button onClick={() => { setTargetAssignment(item as Assignment); setIsCheckOutModalOpen(true); }} className="px-4 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black uppercase hover:bg-rose-600 hover:text-white transition-all shadow-sm">
                                                        {t('reservations.checkout')}
                                                    </button>
                                                )}
                                                 {activeTab === 'assignments' && ('startDate' in item) && (
                                                    <>
                                                        <button onClick={() => { setTargetHosting(item as Hosting); setIsEndHostingModalOpen(true); }} className="px-4 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black uppercase hover:bg-rose-600 hover:text-white transition-all shadow-sm">
                                                            {t('reservations.endHosting')}
                                                        </button>
                                                        <button onClick={() => setSelectedCompanions(JSON.parse((item as Hosting).guests || '[]'))} className="px-3 py-1.5 bg-hotel-navy/5 text-hotel-navy text-[8px] font-black uppercase rounded-lg hover:bg-hotel-navy hover:text-white transition-all">Companions</button>
                                                    </>
                                                )}
                                                {activeTab === 'reservations' && (
                                                    <>
                                                        <button onClick={() => handleReservationCheckIn(item as Reservation)} disabled={isSubmitting} className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all shadow-sm disabled:opacity-50"><i className="fas fa-sign-in-alt mr-1"></i> {language === 'ar' ? 'تسكين' : 'Check-In'}</button>
                                                        <button onClick={() => { setEditingItem(item); setReserveForm({ ...(item as Reservation), checkInDate: toDatetimeLocal((item as Reservation).checkInDate), checkOutDate: (item as Reservation).checkOutDate ? toDatetimeLocal((item as Reservation).checkOutDate!) : '', roomId: String(item.roomId) }); setSelectedBuildId(String(buildings.find(b => b.name === loc.building)?.id || '')); setIsReserveModalOpen(true); }} className="text-primary-600 hover:bg-primary-50 p-2 rounded-lg transition-all"><i className="fas fa-edit text-[10px]"></i></button>
                                                        <button onClick={async () => { if(window.confirm(t('reservations.resCancelConfirm'))) { await reservationApi.delete(item.id); await fetchData(); } }} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-all"><i className="fas fa-trash-alt text-[10px]"></i></button>
                                                    </>
                                                )}
                                                {activeTab === 'hosting' && (
                                                    <>
                                                        <button onClick={() => handleHostingCheckIn(item as Hosting)} className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all shadow-sm"><i className="fas fa-sign-in-alt mr-1"></i> {language === 'ar' ? 'تسكين' : 'Check-In'}</button>
                                                        <button onClick={() => {
                                                            setEditingItem(item);
                                                            const hostingItem = item as Hosting;
                                                            setHostingForm({
                                                                employeeId: String(hostingItem.employeeId),
                                                                roomId: String(hostingItem.roomId),
                                                                startDate: toDatetimeLocal(hostingItem.startDate),
                                                                endDate: toDatetimeLocal(hostingItem.endDate),
                                                                guests: JSON.parse(hostingItem.guests || '[]'),
                                                                notes: hostingItem.notes || ''
                                                            });
                                                            const hostLoc = getRoomLocation(hostingItem.roomId);
                                                            setSelectedBuildId(String(hostLoc.buildingId || ''));
                                                            setSelectedFloorId(String(hostLoc.floorId || ''));
                                                            setIsHostingModalOpen(true);
                                                        }} className="text-primary-600 hover:bg-primary-50 p-2 rounded-lg transition-all"><i className="fas fa-edit text-[10px]"></i></button>
                                                        <button onClick={() => setSelectedCompanions(JSON.parse((item as Hosting).guests || '[]'))} className="px-3 py-1.5 bg-hotel-navy/5 text-hotel-navy text-[8px] font-black uppercase rounded-lg hover:bg-hotel-navy hover:text-white transition-all">Companions</button>
                                                        <button onClick={async () => { if(window.confirm(language === 'ar' ? "هل أنت متأكد من إلغاء هذه الاستضافة؟" : "Cancel this hosting?")) { await hostingApi.delete(item.id); await fetchData(); } }} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-all" title="Cancel Hosting"><i className="fas fa-trash-alt text-[10px]"></i></button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL COMPONENTS */}
            {isReserveModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b dark:border-slate-700 bg-hotel-navy text-white flex justify-between items-center">
                            <h2 className="text-xl font-black uppercase tracking-widest">{editingItem ? (language === 'ar' ? 'تعديل حجز' : 'Edit Booking') : t('reservations.newRes')}</h2>
                            <button onClick={() => setIsReserveModalOpen(false)} className="text-white/60 hover:text-white"><i className="fas fa-times"></i></button>
                        </div>
                        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                            <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                                <label className={labelClass}>{language === 'ar' ? 'بحث عن موظف (من كافة الفروع)' : 'Link to Staff Member (Global Search)'}</label>
                                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                                    <select value={selectedSearchPropertyId} onChange={e => setSelectedSearchPropertyId(e.target.value)} className="w-full sm:w-48 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-hotel-gold shadow-sm">
                                        <option value="all">{language === 'ar' ? 'كل الفروع' : 'All Branches'}</option>
                                        {allProperties.map(p => <option key={p.id} value={p.id}>{p.code} - {p.displayName || p.name}</option>)}
                                    </select>
                                    <input placeholder={language === 'ar' ? 'الاسم، الهوية، أو الرقم الوظيفي...' : 'Name, ID, or Staff ID...'} value={globalSearchQuery} onChange={e => setGlobalSearchQuery(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleGlobalSearch()} className={inputClass + " flex-1"} />
                                    <button onClick={handleGlobalSearch} disabled={isSearchingGlobal} className="bg-hotel-gold text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-lg">
                                        {isSearchingGlobal ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-search"></i>}
                                    </button>
                                </div>
                                {globalResults.length > 0 && (
                                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                        {globalResults.map(emp => (
                                            <div key={emp.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border flex justify-between items-center group">
                                                <div className="flex flex-col"><span className="text-xs font-black text-slate-800 dark:text-white uppercase">{emp.firstName} {emp.lastName}</span><span className="text-[9px] text-slate-400 font-bold uppercase">{allProperties.find(p=>p.id===emp.propertyId)?.code || 'EXT'} • {emp.jobTitle}</span></div>
                                                <button onClick={() => selectGlobalEmployee(emp)} className="px-4 py-1.5 bg-hotel-navy text-white rounded-lg text-[9px] font-black uppercase shadow-md transition-all">Select</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <form onSubmit={handleReserveSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div><label className={labelClass}>First Name</label><input value={reserveForm.firstName} onChange={e => setReserveForm(p=>({...p, firstName: e.target.value}))} required className={inputClass} /></div>
                                <div><label className={labelClass}>Last Name</label><input value={reserveForm.lastName} onChange={e => setReserveForm(p=>({...p, lastName: e.target.value}))} required className={inputClass} /></div>
                                <div><label className={labelClass}>ID / Passport</label><input value={reserveForm.guestIdCardNumber} onChange={e => setReserveForm(p=>({...p, guestIdCardNumber: e.target.value}))} required className={inputClass} /></div>
                                <div><label className={labelClass}>Phone</label><input value={reserveForm.guestPhone} onChange={e => setReserveForm(p=>({...p, guestPhone: e.target.value}))} className={inputClass} /></div>
                                <div><label className={labelClass}>Department</label><select value={reserveForm.department} onChange={e => setReserveForm(p=>({...p, department: e.target.value, jobTitle: getJobTitlesForDept(e.target.value)[0]}))} className={inputClass}>{combinedDepartments.map(d => <option key={d} value={d}>{t(`departments.${d}`)}</option>)}</select></div>
                                <div><label className={labelClass}>Job Title</label><select value={reserveForm.jobTitle} onChange={e => setReserveForm(p=>({...p, jobTitle: e.target.value}))} className={inputClass}>{getJobTitlesForDept(reserveForm.department).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                                <div className="col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                                    <div className="col-span-3 pb-1 border-b mb-1 flex justify-between items-center"><h4 className="text-[9px] font-black uppercase text-hotel-gold tracking-[0.2em]">Unit Selection</h4></div>
                                    <div><label className={labelClass}>Building</label><select value={selectedBuildId} onChange={e => { setSelectedBuildId(e.target.value); setSelectedFloorId(''); setReserveForm(p=>({...p, roomId: ''}))}} className={inputClass}><option value="">-- Select --</option>{buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                                    <div><label className={labelClass}>Floor</label><select value={selectedFloorId} onChange={e => { setSelectedFloorId(e.target.value); setReserveForm(p=>({...p, roomId: ''}))}} disabled={!selectedBuildId} className={inputClass}><option value="">-- Select --</option>{modalFloors.map(f => <option key={f.id} value={f.id}>{f.floorNumber}</option>)}</select></div>
                                    <div><label className={labelClass}>Room Type</label><select value={selectedRoomType} onChange={e => { setSelectedRoomType(e.target.value); setReserveForm(p=>({...p, roomId: ''}))}} disabled={!selectedFloorId} className={inputClass}><option value="">-- All --</option>{roomTypes.map(rt => <option key={rt.name} value={rt.name}>{rt.name}</option>)}</select></div>
                                    <div className="col-span-3"><label className={labelClass}>Room</label><select value={reserveForm.roomId} onChange={e => setReserveForm(p=>({...p, roomId: e.target.value}))} disabled={!selectedFloorId} required className={inputClass}><option value="">-- Choose Assigned Room --</option>{modalRooms.map(r => <option key={r.id} value={r.id}>{r.roomNumber} ({r.roomType})</option>)}</select></div>
                                </div>
                                <div><label className={labelClass}>Arrival Date</label><input type="datetime-local" value={reserveForm.checkInDate} onChange={e => setReserveForm(p=>({...p, checkInDate: e.target.value}))} required className={inputClass} /></div>
                                <div><label className={labelClass}>Departure Date</label><input type="datetime-local" value={reserveForm.checkOutDate} onChange={e => setReserveForm(p=>({...p, checkOutDate: e.target.value}))} className={inputClass} /></div>
                                <div className="col-span-2"><label className={labelClass}>Notes</label><textarea value={reserveForm.notes} onChange={e => setReserveForm(p=>({...p, notes: e.target.value}))} rows={2} className={inputClass}></textarea></div>
                            </form>
                        </div>
                        <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50/50">
                            <button type="button" onClick={() => setIsReserveModalOpen(false)} className="px-6 py-2 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancel</button>
                            <button onClick={handleReserveSubmit} disabled={isSubmitting} className="px-12 py-3 bg-hotel-navy text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:brightness-110">{isSubmitting ? t('saving') : t('save')}</button>
                        </div>
                    </div>
                </div>
            )}
            
            {isAssignModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b dark:border-slate-700 bg-hotel-navy text-white flex justify-between items-center">
                            <h2 className="text-xl font-black uppercase tracking-widest">{t('reservations.new')}</h2>
                            <button onClick={() => setIsAssignModalOpen(false)} className="text-white/60 hover:text-white"><i className="fas fa-times"></i></button>
                        </div>
                        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                            <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                                <label className={labelClass}>{language === 'ar' ? 'البحث العالمي عن موظف' : 'Staff Search (Any Branch)'}</label>
                                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                                    <select value={selectedSearchPropertyId} onChange={e => setSelectedSearchPropertyId(e.target.value)} className="w-full sm:w-48 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase outline-none shadow-sm">
                                        <option value="all">{language === 'ar' ? 'كل الفروع' : 'All Branches'}</option>
                                        {allProperties.map(p => <option key={p.id} value={p.id}>{p.code} - {p.displayName || p.name}</option>)}
                                    </select>
                                    <input placeholder="Name, National ID, or Staff ID..." value={globalSearchQuery} onChange={e => setGlobalSearchQuery(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleGlobalSearch()} className={inputClass + " flex-1"} />
                                    <button onClick={handleGlobalSearch} disabled={isSearchingGlobal} className="bg-hotel-gold text-white px-6 rounded-xl font-black text-[10px] uppercase shadow-lg">
                                        {isSearchingGlobal ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-search"></i>}
                                    </button>
                                </div>
                                {globalResults.length > 0 && (
                                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                        {globalResults.map(emp => (
                                            <div key={emp.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border flex justify-between items-center group">
                                                <div className="flex flex-col"><span className="text-xs font-black text-slate-800 dark:text-white uppercase">{emp.firstName} {emp.lastName}</span><span className="text-[9px] text-slate-400 font-bold uppercase">{allProperties.find(p=>p.id===emp.propertyId)?.code || 'EXT'} • {emp.jobTitle}</span></div>
                                                <button onClick={() => selectGlobalEmployee(emp)} className="px-4 py-1.5 bg-hotel-navy text-white rounded-lg text-[9px] font-black uppercase shadow-md transition-all">Select</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <form onSubmit={handleAssignSubmit} className="space-y-6">
                                <div>
                                    <label className={labelClass}>Select Local Profile</label>
                                    <select value={assignForm.employeeId} onChange={e => setAssignForm(p=>({...p, employeeId: e.target.value}))} required className={inputClass}>
                                        <option value="">-- Choose Profile --</option>
                                        {employees.filter(e=>e.status === 'active').map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeId})</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                                    <div className="col-span-3 pb-1 border-b mb-1"><h4 className="text-[9px] font-black uppercase text-hotel-gold tracking-[0.2em]">Housing Allocation</h4></div>
                                    <div><label className={labelClass}>Building</label><select value={selectedBuildId} onChange={e => { setSelectedBuildId(e.target.value); setSelectedFloorId(''); setAssignForm(p=>({...p, roomId: ''}))}} className={inputClass}><option value="">-- Select --</option>{buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                                    <div><label className={labelClass}>Floor</label><select value={selectedFloorId} onChange={e => { setSelectedFloorId(e.target.value); setAssignForm(p=>({...p, roomId: ''}))}} disabled={!selectedBuildId} className={inputClass}><option value="">-- Select --</option>{modalFloors.map(f => <option key={f.id} value={f.id}>{f.floorNumber}</option>)}</select></div>
                                    <div><label className={labelClass}>Room Type</label><select value={selectedRoomType} onChange={e => { setSelectedRoomType(e.target.value); setAssignForm(p=>({...p, roomId: ''}))}} disabled={!selectedFloorId} className={inputClass}><option value="">-- All --</option>{roomTypes.map(rt => <option key={rt.name} value={rt.name}>{rt.name}</option>)}</select></div>
                                    <div className="col-span-3"><label className={labelClass}>Room</label><select value={assignForm.roomId} onChange={e => setAssignForm(p=>({...p, roomId: e.target.value}))} disabled={!selectedFloorId} required className={inputClass}><option value="">-- Select Room --</option>{modalRooms.map(r => <option key={r.id} value={r.id}>{r.roomNumber} ({r.roomType} - {r.capacity - r.currentOccupancy} Beds Available)</option>)}</select></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className={labelClass}>Check-In Date</label><input type="datetime-local" value={assignForm.checkInDate} onChange={e => setAssignForm(p=>({...p, checkInDate: e.target.value}))} required className={inputClass} /></div>
                                    <div><label className={labelClass}>Expected Checkout</label><input type="datetime-local" value={assignForm.expectedCheckOutDate} onChange={e => setAssignForm(p=>({...p, expectedCheckOutDate: e.target.value}))} className={inputClass} /></div>
                                </div>
                            </form>
                        </div>
                        <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50/50">
                            <button type="button" onClick={() => setIsAssignModalOpen(false)} className="px-6 py-2 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancel</button>
                            <button onClick={handleAssignSubmit} disabled={isSubmitting} className="px-12 py-3 bg-hotel-navy text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:brightness-110">{isSubmitting ? t('saving') : t('save')}</button>
                        </div>
                    </div>
                </div>
            )}

            {isHostingModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b dark:border-slate-700 bg-hotel-navy text-white flex justify-between items-center">
                            <h2 className="text-xl font-black uppercase tracking-widest">{editingItem ? (language === 'ar' ? 'تعديل استضافة' : 'Edit Hosting') : t('reservations.newHosting')}</h2>
                            <button onClick={() => setIsHostingModalOpen(false)} className="text-white/60 hover:text-white"><i className="fas fa-times"></i></button>
                        </div>
                        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                            <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                                <label className={labelClass}>{language === 'ar' ? 'البحث العالمي عن موظف (المضيف)' : 'Staff Search (Host)'}</label>
                                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                                    <select value={selectedSearchPropertyId} onChange={e => setSelectedSearchPropertyId(e.target.value)} className="w-full sm:w-48 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-hotel-gold shadow-sm">
                                        <option value="all">{language === 'ar' ? 'كل الفروع' : 'All Branches'}</option>
                                        {allProperties.map(p => <option key={p.id} value={p.id}>{p.code} - {p.displayName || p.name}</option>)}
                                    </select>
                                    <input placeholder="Name, National ID, or Staff ID..." value={globalSearchQuery} onChange={e => setGlobalSearchQuery(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleGlobalSearch()} className={inputClass + " flex-1"} />
                                    <button onClick={handleGlobalSearch} disabled={isSearchingGlobal} className="bg-hotel-gold text-white px-6 rounded-xl font-black text-[10px] uppercase shadow-lg">
                                        {isSearchingGlobal ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-search"></i>}
                                    </button>
                                </div>
                                {globalResults.length > 0 && (
                                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                        {globalResults.map(emp => (
                                            <div key={emp.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border flex justify-between items-center group">
                                                <div className="flex flex-col"><span className="text-xs font-black text-slate-800 dark:text-white uppercase">{emp.firstName} {emp.lastName}</span><span className="text-[9px] text-slate-400 font-bold uppercase">{allProperties.find(p=>p.id===emp.propertyId)?.code || 'EXT'} • {emp.jobTitle}</span></div>
                                                <button onClick={() => selectGlobalEmployee(emp)} className="px-4 py-1.5 bg-hotel-navy text-white rounded-lg text-[9px] font-black uppercase shadow-md transition-all">Select</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <form onSubmit={handleHostingSubmit} className="space-y-6">
                                <div>
                                    <label className={labelClass}>Host Employee</label>
                                    <select value={hostingForm.employeeId} onChange={e => setHostingForm(p=>({...p, employeeId: e.target.value}))} required className={inputClass}>
                                        <option value="">-- Choose Host --</option>
                                        {employees.filter(e=>e.status === 'active').map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeId})</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                                    <div className="col-span-3 pb-1 border-b mb-1"><h4 className="text-[9px] font-black uppercase text-hotel-gold tracking-[0.2em]">Housing Allocation</h4></div>
                                    <div><label className={labelClass}>Building</label><select value={selectedBuildId} onChange={e => { setSelectedBuildId(e.target.value); setSelectedFloorId(''); setHostingForm(p=>({...p, roomId: ''}))}} className={inputClass}><option value="">-- Select --</option>{buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                                    <div><label className={labelClass}>Floor</label><select value={selectedFloorId} onChange={e => { setSelectedFloorId(e.target.value); setHostingForm(p=>({...p, roomId: ''}))}} disabled={!selectedBuildId} className={inputClass}><option value="">-- Select --</option>{modalFloors.map(f => <option key={f.id} value={f.id}>{f.floorNumber}</option>)}</select></div>
                                    <div><label className={labelClass}>Room Type</label><select value={selectedRoomType} onChange={e => { setSelectedRoomType(e.target.value); setHostingForm(p=>({...p, roomId: ''}))}} disabled={!selectedFloorId} className={inputClass}><option value="">-- All --</option>{roomTypes.map(rt => <option key={rt.name} value={rt.name}>{rt.name}</option>)}</select></div>
                                    <div className="col-span-3"><label className={labelClass}>Room</label><select value={hostingForm.roomId} onChange={e => setHostingForm(p=>({...p, roomId: e.target.value}))} disabled={!selectedFloorId} required className={inputClass}><option value="">-- Select Room --</option>{modalRooms.map(r => <option key={r.id} value={r.id}>{r.roomNumber} ({r.roomType} - {r.capacity - r.currentOccupancy} Beds Available)</option>)}</select></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className={labelClass}>From Date</label><input type="datetime-local" value={hostingForm.startDate} onChange={e => setHostingForm(p=>({...p, startDate: e.target.value}))} required className={inputClass} /></div>
                                    <div><label className={labelClass}>To Date</label><input type="datetime-local" value={hostingForm.endDate} onChange={e => setHostingForm(p=>({...p, endDate: e.target.value}))} className={inputClass} /></div>
                                </div>
                                <div className="space-y-4 pt-4 border-t dark:border-slate-700">
                                    <h4 className="text-[10px] font-black uppercase text-hotel-gold tracking-[0.2em]">{t('reservations.guestDetails')}</h4>
                                    {hostingForm.guests.map((guest, index) => (
                                        <div key={index} className="grid grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 relative">
                                            <div className="col-span-3 flex justify-between items-center mb-2">
                                                <span className="text-[9px] font-black uppercase text-slate-500">Companion #{index + 1}</span>
                                                {index > 0 && <button type="button" onClick={() => setHostingForm(p => ({ ...p, guests: p.guests.filter((_, i) => i !== index) }))} className="text-rose-500 hover:text-rose-700"><i className="fas fa-trash-alt text-[10px]"></i></button>}
                                            </div>
                                            <div><label className={labelClass}>First Name</label><input value={guest.firstName} onChange={e => setHostingForm(p => ({ ...p, guests: p.guests.map((g, i) => i === index ? { ...g, firstName: e.target.value } : g) }))} required className={inputClass} /></div>
                                            <div><label className={labelClass}>Last Name</label><input value={guest.lastName} onChange={e => setHostingForm(p => ({ ...p, guests: p.guests.map((g, i) => i === index ? { ...g, lastName: e.target.value } : g) }))} required className={inputClass} /></div>
                                            <div><label className={labelClass}>ID / Passport</label><input value={guest.guestIdCardNumber} onChange={e => setHostingForm(p => ({ ...p, guests: p.guests.map((g, i) => i === index ? { ...g, guestIdCardNumber: e.target.value } : g) }))} required className={inputClass} /></div>
                                            <div><label className={labelClass}>Phone</label><input value={guest.guestPhone} onChange={e => setHostingForm(p => ({ ...p, guests: p.guests.map((g, i) => i === index ? { ...g, guestPhone: e.target.value } : g) }))} className={inputClass} /></div>
                                            <div><label className={labelClass}>Department</label><select value={guest.department} onChange={e => setHostingForm(p => ({ ...p, guests: p.guests.map((g, i) => i === index ? { ...g, department: e.target.value, jobTitle: getJobTitlesForDept(e.target.value)[0] } : g) }))} className={inputClass}>{combinedDepartments.map(d => <option key={d} value={d}>{t(`departments.${d}`)}</option>)}</select></div>
                                            <div><label className={labelClass}>Job Title</label><select value={guest.jobTitle} onChange={e => setHostingForm(p => ({ ...p, guests: p.guests.map((g, i) => i === index ? { ...g, jobTitle: e.target.value } : g) }))} className={inputClass}>{getJobTitlesForDept(guest.department).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                                        </div>
                                    ))}
                                    <button type="button" onClick={() => setHostingForm(p => ({ ...p, guests: [...p.guests, { ...EMPTY_GUEST }] }))} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-hotel-navy dark:text-slate-200 rounded-lg text-[9px] font-black uppercase hover:bg-slate-200 transition-all flex items-center gap-2">
                                        <i className="fas fa-user-plus"></i> {t('reservations.addGuest')}
                                    </button>
                                </div>
                                <div className="col-span-2"><label className={labelClass}>Notes</label><textarea value={hostingForm.notes} onChange={e => setHostingForm(p=>({...p, notes: e.target.value}))} rows={2} className={inputClass}></textarea></div>
                            </form>
                        </div>
                        <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50/50">
                            <button type="button" onClick={() => setIsHostingModalOpen(false)} className="px-6 py-2 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancel</button>
                            <button onClick={handleHostingSubmit} disabled={isSubmitting} className="px-12 py-3 bg-hotel-navy text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:brightness-110">{isSubmitting ? t('saving') : t('save')}</button>
                        </div>
                    </div>
                </div>
            )}

            {selectedCompanions && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-fade-in-up">
                        <div className="p-6 border-b dark:border-slate-700 bg-hotel-navy text-white flex justify-between items-center">
                            <h2 className="text-xl font-black uppercase tracking-widest">{language === 'ar' ? 'تفاصيل المرافقين' : 'Companion Details'}</h2>
                            <button onClick={() => setSelectedCompanions(null)} className="text-white/60 hover:text-white"><i className="fas fa-times"></i></button>
                        </div>
                        <div className="p-8 overflow-y-auto custom-scrollbar max-h-[70vh]">
                            {selectedCompanions.length > 0 ? (
                                <div className="space-y-4">
                                    {selectedCompanions.map((guest, index) => (
                                        <div key={index} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
                                            <p className="text-[10px] font-black uppercase text-hotel-gold mb-2">Companion #{index + 1}</p>
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <p><span className="font-bold text-slate-700 dark:text-slate-200">{language === 'ar' ? 'الاسم:' : 'Name:'}</span> {guest.firstName} {guest.lastName}</p>
                                                <p><span className="font-bold text-slate-700 dark:text-slate-200">{language === 'ar' ? 'الهوية:' : 'ID:'}</span> {guest.guestIdCardNumber}</p>
                                                <p><span className="font-bold text-slate-700 dark:text-slate-200">{language === 'ar' ? 'الهاتف:' : 'Phone:'}</span> {guest.guestPhone}</p>
                                                <p><span className="font-bold text-slate-700 dark:text-slate-200">{language === 'ar' ? 'القسم:' : 'Department:'}</span> {t(`departments.${guest.department}`)}</p>
                                                <p><span className="font-bold text-slate-700 dark:text-slate-200">{language === 'ar' ? 'المسمى الوظيفي:' : 'Job Title:'}</span> {guest.jobTitle}</p>
                                                <p><span className="font-bold text-slate-700 dark:text-slate-200">{language === 'ar' ? 'النوع:' : 'Type:'}</span> {guest.guestType}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-slate-400 italic p-10">
                                    {language === 'ar' ? 'لا يوجد مرافقون مسجلون لهذه الاستضافة.' : 'No companions registered for this hosting.'}
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t dark:border-slate-700 flex justify-end bg-slate-50/50">
                            <button onClick={() => setSelectedCompanions(null)} className="px-8 py-3 bg-hotel-navy text-white rounded-xl font-black text-xs uppercase shadow-lg hover:brightness-110">
                                {t('login.forgotPasswordModal.close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isCheckOutModalOpen && targetAssignment && (
                 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                        <div className="p-6 border-b dark:border-slate-700 bg-rose-600 text-white flex justify-between items-center">
                            <h2 className="text-xl font-black uppercase tracking-widest">{t('reservations.checkoutTitle')}</h2>
                            <button onClick={() => setIsCheckOutModalOpen(false)} className="text-white/60 hover:text-white"><i className="fas fa-times"></i></button>
                        </div>
                        <form onSubmit={async (e) => {
                                e.preventDefault();
                                setIsSubmitting(true);
                                try {
                                    await assignmentApi.update(targetAssignment.id, { checkOutDate: new Date(checkOutDateInput).toISOString() });
                                    const room = rooms.find(r => r.id === targetAssignment.roomId);
                                    if (room) {
                                        const newOccupancy = Math.max(0, room.currentOccupancy - 1);
                                        await roomApi.update(room.id, { currentOccupancy: newOccupancy, status: newOccupancy === 0 ? 'available' : 'occupied' });
                                    }
                                    showToast(t('reservations.checkedOut'), 'success');
                                    setIsCheckOutModalOpen(false);
                                    setTargetAssignment(null);
                                    await fetchData();
                                } catch (e) {
                                    showToast(t('errors.generic'), 'critical');
                                } finally {
                                    setIsSubmitting(false);
                                }
                            }} className="p-8 space-y-6">
                            <div>
                                <label className={labelClass}>{t('reservations.checkOutDate')}</label>
                                <input type="datetime-local" value={checkOutDateInput} onChange={e => setCheckOutDateInput(e.target.value)} required className={inputClass} />
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                                <button type="button" onClick={() => setIsCheckOutModalOpen(false)} className="px-6 py-2 text-slate-500 font-black uppercase text-[10px] tracking-widest">{t('cancel')}</button>
                                <button type="submit" disabled={isSubmitting} className="px-10 py-2.5 bg-rose-600 text-white rounded-xl font-black text-xs uppercase shadow-xl hover:brightness-110">{isSubmitting ? t('saving') : t('reservations.confirmCheckout')}</button>
                            </div>
                        </form>
                    </div>
                 </div>
            )}

            {isEndHostingModalOpen && targetHosting && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                        <div className="p-6 border-b dark:border-slate-700 bg-rose-600 text-white flex justify-between items-center">
                            <h2 className="text-xl font-black uppercase tracking-widest">{t('reservations.endHosting')}</h2>
                            <button onClick={() => setIsEndHostingModalOpen(false)} className="text-white/60 hover:text-white"><i className="fas fa-times"></i></button>
                        </div>
                        <form onSubmit={handleEndHosting} className="p-8 space-y-6">
                            <div>
                                <label className={labelClass}>{t('reservations.endDate')}</label>
                                <input type="datetime-local" value={endDateInput} onChange={e => setEndDateInput(e.target.value)} required className={inputClass} />
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                                <button type="button" onClick={() => setIsEndHostingModalOpen(false)} className="px-6 py-2 text-slate-500 font-black uppercase text-[10px] tracking-widest">{t('cancel')}</button>
                                <button type="submit" disabled={isSubmitting} className="px-10 py-2.5 bg-rose-600 text-white rounded-xl font-black text-xs uppercase shadow-xl hover:brightness-110">{isSubmitting ? t('saving') : t('reservations.confirmCheckout')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReservationsPage;