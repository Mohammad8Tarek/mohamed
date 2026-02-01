

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
                    workLocation: emp.workLocation || (appSettings.customTaxonomy?.workLocations?.[0] || ''), // Mandatory, defaulted to first available or empty
                    address: '', // Optional in interface but needs to be string
                    dateOfBirth: '', // Optional in interface but needs to be string
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
                    workLocation: appSettings.customTaxonomy?.workLocations?.[0] || '', // Mandatory, defaulted to first available or empty
                    address: '', // Optional in interface, defaulted to empty string
                    dateOfBirth: '', // Optional in interface, defaulted to empty string
                    contractStartDate: new Date().toISOString(), // Mandatory, defaulted to now
                    gender: 'male', // Default to male
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
                            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === tab ? 'bg-hotel-navy text-white shadow-md' : 'text-slate-500 hover:text-hotel-navy dark:hover:text-white'}`}>{t(`reservations.${tab === 'assignments' ? 'active' : tab === 'reservations' ? 'future' : 'hosting'}`)}</button>
                        ))}
                    </div>
                </div>
                
                <div className="overflow-x-auto custom-scrollbar min-h-[400px]">
                    <table className="w-full text-sm text-left rtl:text-right"></table>
                </div>
            </div>
        </div>
    );
};

export default ReservationsPage;