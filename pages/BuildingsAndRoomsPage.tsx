
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Building, Room, Floor, RoomTypeConfig } from '../types';
import { buildingApi, roomApi, floorApi, logActivity } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { usePermissions } from '../hooks/usePermissions';
import { useSettings } from '../context/SettingsContext';

// --- BuildingsView Sub-component ---
const BuildingsView: React.FC<any> = ({ buildings, onAdd, onEdit, onDelete, perms, t, language, onSort, renderSortIcon, selectedIds, setSelectedIds, onBulkDelete, onBulkStatus }) => {
    const toggleSelectAll = () => {
        if (selectedIds.length === buildings.length) setSelectedIds([]);
        else setSelectedIds(buildings.map((b: any) => b.id));
    };

    const toggleSelect = (id: number) => {
        if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter((x: number) => x !== id));
        else setSelectedIds([...selectedIds, id]);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border dark:border-slate-700">
                <div className="flex items-center gap-4">
                    {perms.canManageHousing && (
                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={selectedIds.length === buildings.length && buildings.length > 0} onChange={toggleSelectAll} className="w-4 h-4 text-primary-600 rounded border-slate-300" />
                            <span className="text-xs font-bold text-slate-500">{t('housing.buildingsSelected', { count: selectedIds.length })}</span>
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    {selectedIds.length > 0 && perms.canManageHousing && (
                        <>
                            <button onClick={onBulkStatus} className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-200 transition-all">{t('housing.changeStatus')}</button>
                            {perms.canDeleteHousing && <button onClick={onBulkDelete} className="px-3 py-1.5 bg-rose-100 text-rose-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-200 transition-all">{t('bulkDelete')}</button>}
                        </>
                    )}
                    {perms.canManageHousing && <button onClick={onAdd} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:brightness-110 shadow-lg transition-all"><i className="fas fa-plus mr-2"></i>{t('housing.addBuilding')}</button>}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left rtl:text-right">
                        <thead className="text-[10px] font-black uppercase text-slate-500 bg-slate-50 dark:bg-slate-700 tracking-wider">
                            <tr>
                                {perms.canManageHousing && <th className="px-6 py-4 w-10"></th>}
                                <th className="px-6 py-4 cursor-pointer" onClick={() => onSort('name')}>{t('housing.buildingName')} {renderSortIcon('name')}</th>
                                <th className="px-6 py-4 cursor-pointer" onClick={() => onSort('location')}>{t('housing.location')} {renderSortIcon('location')}</th>
                                <th className="px-6 py-4 cursor-pointer text-center" onClick={() => onSort('capacity')}>{t('housing.capacity')} {renderSortIcon('capacity')}</th>
                                <th className="px-6 py-4 text-center">{t('housing.buildingStatus')}</th>
                                {perms.canManageHousing && <th className="px-6 py-4 text-center">{t('actions')}</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {buildings.map((b: any) => (
                                <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    {perms.canManageHousing && (
                                        <td className="px-6 py-4">
                                            <input type="checkbox" checked={selectedIds.includes(b.id)} onChange={() => toggleSelect(b.id)} className="w-4 h-4 text-primary-600 rounded border-slate-300" />
                                        </td>
                                    )}
                                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white uppercase">{b.name}</td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{b.location}</td>
                                    <td className="px-6 py-4 text-center font-bold">{b.capacity}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${b.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{t(`statuses.${b.status}`)}</span>
                                    </td>
                                    {perms.canManageHousing && (
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => onEdit(b)} className="text-primary-600 hover:bg-primary-50 p-2 rounded-lg transition-all"><i className="fas fa-edit text-xs"></i></button>
                                                {perms.canDeleteHousing && <button onClick={() => onDelete(b.id, b.name)} className="text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-all"><i className="fas fa-trash-alt text-xs"></i></button>}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- FloorsView Sub-component ---
const FloorsView: React.FC<any> = ({ buildings, floors, onAdd, onEdit, onDelete, perms, t, onSort, renderSortIcon, selectedIds, setSelectedIds, onBulkDelete }) => {
    const toggleSelectAll = () => {
        if (selectedIds.length === floors.length) setSelectedIds([]);
        else setSelectedIds(floors.map((f: any) => f.id));
    };

    const toggleSelect = (id: number) => {
        if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter((x: number) => x !== id));
        else setSelectedIds([...selectedIds, id]);
    };

    const getBuildingName = (id: number) => buildings.find((b: any) => b.id === id)?.name || '—';

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border dark:border-slate-700">
                <div className="flex items-center gap-4">
                    {perms.canManageHousing && (
                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={selectedIds.length === floors.length && floors.length > 0} onChange={toggleSelectAll} className="w-4 h-4 text-primary-600 rounded border-slate-300" />
                            <span className="text-xs font-bold text-slate-500">{t('housing.floorsSelected', { count: selectedIds.length })}</span>
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    {selectedIds.length > 0 && perms.canDeleteHousing && (
                        <button onClick={onBulkDelete} className="px-3 py-1.5 bg-rose-100 text-rose-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-200 transition-all">{t('bulkDelete')}</button>
                    )}
                    {perms.canManageHousing && <button onClick={onAdd} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:brightness-110 shadow-lg transition-all"><i className="fas fa-plus mr-2"></i>{t('housing.addFloor')}</button>}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left rtl:text-right">
                        <thead className="text-[10px] font-black uppercase text-slate-500 bg-slate-50 dark:bg-slate-700 tracking-wider">
                            <tr>
                                {perms.canManageHousing && <th className="px-6 py-4 w-10"></th>}
                                <th className="px-6 py-4 cursor-pointer" onClick={() => onSort('buildingId')}>{t('housing.building')} {renderSortIcon('buildingId')}</th>
                                <th className="px-6 py-4 cursor-pointer" onClick={() => onSort('floorNumber')}>{t('housing.floorNumber')} {renderSortIcon('floorNumber')}</th>
                                <th className="px-6 py-4">{t('housing.description')}</th>
                                {perms.canManageHousing && <th className="px-6 py-4 text-center">{t('actions')}</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {floors.map((f: any) => (
                                <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    {perms.canManageHousing && (
                                        <td className="px-6 py-4">
                                            <input type="checkbox" checked={selectedIds.includes(f.id)} onChange={() => toggleSelect(f.id)} className="w-4 h-4 text-primary-600 rounded border-slate-300" />
                                        </td>
                                    )}
                                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white uppercase">{getBuildingName(f.buildingId)}</td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-black">{f.floorNumber}</td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">{f.description}</td>
                                    {perms.canManageHousing && (
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => onEdit(f)} className="text-primary-600 hover:bg-primary-50 p-2 rounded-lg transition-all"><i className="fas fa-edit text-xs"></i></button>
                                                {perms.canDeleteHousing && <button onClick={() => onDelete(f.id, f.floorNumber)} className="text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-all"><i className="fas fa-trash-alt text-xs"></i></button>}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- RoomsView Sub-component ---
const RoomsView: React.FC<any> = ({ buildings, floors, rooms, onAdd, onEdit, onDelete, perms, t, onSort, renderSortIcon, selectedIds, setSelectedIds, onBulkDelete, onBulkStatus, activeBuildingId, setActiveBuildingId, activeFloorId, setActiveFloorId }) => {
    const toggleSelectAll = () => {
        if (selectedIds.length === rooms.length) setSelectedIds([]);
        else setSelectedIds(rooms.map((r: any) => r.id));
    };

    const toggleSelect = (id: number) => {
        if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter((x: number) => x !== id));
        else setSelectedIds([...selectedIds, id]);
    };

    const currentFloors = floors.filter((f: any) => f.buildingId === parseInt(activeBuildingId));
    
    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-widest">{t('housing.selectBuilding')}</label>
                    <select value={activeBuildingId} onChange={(e) => { setActiveBuildingId(e.target.value); setActiveFloorId(''); }} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-hotel-gold outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white transition-all shadow-inner">
                        <option value="">-- {t('select')} --</option>
                        {buildings.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-widest">{t('housing.selectFloor')}</label>
                    <select value={activeFloorId} onChange={(e) => setActiveFloorId(e.target.value)} disabled={!activeBuildingId} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-hotel-gold outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white transition-all shadow-inner disabled:opacity-50">
                        <option value="">-- {t('select')} --</option>
                        {currentFloors.map((f: any) => <option key={f.id} value={f.id}>{f.floorNumber}</option>)}
                    </select>
                </div>
            </div>

            {activeFloorId ? (
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border dark:border-slate-700">
                        <div className="flex items-center gap-4">
                            {perms.canManageHousing && (
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" checked={selectedIds.length === rooms.length && rooms.length > 0} onChange={toggleSelectAll} className="w-4 h-4 text-primary-600 rounded border-slate-300" />
                                    <span className="text-xs font-bold text-slate-500">{t('housing.roomsSelected', { count: selectedIds.length })}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {selectedIds.length > 0 && perms.canManageHousing && (
                                <>
                                    <button onClick={onBulkStatus} className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-200 transition-all">{t('housing.changeStatus')}</button>
                                    {perms.canDeleteHousing && <button onClick={onBulkDelete} className="px-3 py-1.5 bg-rose-100 text-rose-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-200 transition-all">{t('bulkDelete')}</button>}
                                </>
                            )}
                            {perms.canManageHousing && <button onClick={onAdd} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:brightness-110 shadow-lg transition-all"><i className="fas fa-plus mr-2"></i>{t('housing.addRoom')}</button>}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border dark:border-slate-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left rtl:text-right">
                                <thead className="text-[10px] font-black uppercase text-slate-500 bg-slate-50 dark:bg-slate-700 tracking-wider">
                                    <tr>
                                        {perms.canManageHousing && <th className="px-6 py-4 w-10"></th>}
                                        <th className="px-6 py-4 cursor-pointer" onClick={() => onSort('roomNumber')}>{t('housing.roomNumber')} {renderSortIcon('roomNumber')}</th>
                                        <th className="px-6 py-4 cursor-pointer" onClick={() => onSort('roomType')}>{t('housing.roomType')} {renderSortIcon('roomType')}</th>
                                        <th className="px-6 py-4 text-center cursor-pointer" onClick={() => onSort('capacity')}>{t('housing.capacity')} {renderSortIcon('capacity')}</th>
                                        <th className="px-6 py-4 text-center cursor-pointer" onClick={() => onSort('currentOccupancy')}>{t('housing.occupancy')} {renderSortIcon('currentOccupancy')}</th>
                                        <th className="px-6 py-4 text-center">{t('housing.buildingStatus')}</th>
                                        {perms.canManageHousing && <th className="px-6 py-4 text-center">{t('actions')}</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {rooms.map((r: any) => (
                                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            {perms.canManageHousing && (
                                                <td className="px-6 py-4">
                                                    <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggleSelect(r.id)} className="w-4 h-4 text-primary-600 rounded border-slate-300" />
                                                </td>
                                            )}
                                            <td className="px-6 py-4 font-black text-slate-900 dark:text-white">{r.roomNumber}</td>
                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400 uppercase font-bold text-xs">{r.roomType}</td>
                                            <td className="px-6 py-4 text-center font-bold">{r.capacity}</td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="font-bold">{r.currentOccupancy}</span>
                                                    <div className="w-12 h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div className={`h-full transition-all ${r.currentOccupancy >= r.capacity ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (r.currentOccupancy / r.capacity) * 100)}%` }}></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${r.status === 'available' ? 'bg-emerald-50 text-emerald-600' : r.status === 'occupied' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>{t(`statuses.${r.status}`)}</span>
                                            </td>
                                            {perms.canManageHousing && (
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => onEdit(r)} className="text-primary-600 hover:bg-primary-50 p-2 rounded-lg transition-all"><i className="fas fa-edit text-xs"></i></button>
                                                        {perms.canDeleteHousing && <button onClick={() => onDelete(r.id, r.roomNumber)} className="text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-all"><i className="fas fa-trash-alt text-xs"></i></button>}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-800 p-20 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6">
                        <i className="fas fa-door-open text-3xl text-slate-300"></i>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white uppercase mb-2">{t('housing.selectFloorPrompt')}</h3>
                </div>
            )}
        </div>
    );
};

// --- Main Page Component ---
const BuildingsAndRoomsPage: React.FC = () => {
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [floors, setFloors] = useState<Floor[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'buildings' | 'floors' | 'rooms'>('buildings');
    
    const [activeBuildingId, setActiveBuildingId] = useState<string>(''); // Changed to string
    const [activeFloorId, setActiveFloorId] = useState<string>(''); // Changed to string
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [sortConfig, setSortConfig] = useState<any>({ key: 'name', direction: 'asc' });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'building' | 'floor' | 'room'>('building');
    const [editingItem, setEditingItem] = useState<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
    const [bulkNewStatus, setBulkNewStatus] = useState<any>('active');

    const { user } = useAuth();
    const { t, language } = useLanguage();
    const { showToast } = useToast();
    const { settings: appSettings } = useSettings();
    const perms = usePermissions();

    const roomTypes = useMemo(() => {
        const tax = appSettings.customTaxonomy?.roomTypes || [];
        return tax.map(rt => typeof rt === 'string' ? { name: rt, description: '', defaultCapacity: 1 } : rt);
    }, [appSettings.customTaxonomy]);

    const [formData, setFormData] = useState<any>({});

    const fetchData = async () => {
        setLoading(true);
        try {
            const [b, f, r] = await Promise.all([buildingApi.getAll(), floorApi.getAll(), roomApi.getAll()]);
            setBuildings(b); setFloors(f); setRooms(r);
        } catch (e) { showToast(t('errors.fetchFailed'), 'critical'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const sortedData = useMemo(() => {
        let list = [];
        if (activeTab === 'buildings') list = [...buildings];
        else if (activeTab === 'floors') list = [...floors];
        else list = rooms.filter(r => r.floorId === parseInt(activeFloorId));

        if (sortConfig.key) {
            list.sort((a: any, b: any) => {
                const aVal = String(a[sortConfig.key] || '').toLowerCase();
                const bVal = String(b[sortConfig.key] || '').toLowerCase();
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return list;
    }, [activeTab, buildings, floors, rooms, sortConfig, activeFloorId]);

    const handleSort = (key: string) => {
        setSortConfig((prev: any) => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    };

    const renderSortIcon = (key: string) => {
        if (sortConfig.key !== key) return <i className="fas fa-sort text-slate-300 ml-1"></i>;
        return sortConfig.direction === 'asc' ? <i className="fas fa-sort-up ml-1"></i> : <i className="fas fa-sort-down ml-1"></i>;
    };

    const openModal = (mode: any, item = null) => {
        setModalMode(mode);
        setEditingItem(item);
        if (item) setFormData({ ...item });
        else {
            if (mode === 'building') setFormData({ name: '', location: '', capacity: 1, status: 'active' });
            else if (mode === 'floor') setFormData({ buildingId: activeBuildingId || '', floorNumber: '', description: '' });
            else if (mode === 'room') setFormData({ floorId: activeFloorId, roomNumber: '', roomType: roomTypes[0]?.name || 'Standard', capacity: roomTypes[0]?.defaultCapacity || 2, status: 'available', currentOccupancy: 0 });
        }
        setIsModalOpen(true);
    };

    const handleModalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (modalMode === 'building') {
                if (editingItem) await buildingApi.update(editingItem.id, formData);
                else await buildingApi.create(formData);
                showToast(t(`housing.building${editingItem ? 'Updated' : 'Added'}`), 'success');
            } else if (modalMode === 'floor') {
                const data = { ...formData, buildingId: parseInt(formData.buildingId) };
                if (editingItem) await floorApi.update(editingItem.id, data);
                else await floorApi.create(data);
                showToast(t(`housing.floor${editingItem ? 'Updated' : 'Added'}`), 'success');
            } else if (modalMode === 'room') {
                const data = { ...formData, floorId: parseInt(formData.floorId), capacity: parseInt(formData.capacity), currentOccupancy: parseInt(formData.currentOccupancy) };
                if (editingItem) await roomApi.update(editingItem.id, data);
                else await roomApi.create(data);
                showToast(t(`housing.${editingItem ? 'roomUpdated' : 'roomAdded'}`), 'success');
            }
            setIsModalOpen(false);
            fetchData();
        } catch (e: any) { showToast(e.message || t('errors.generic'), 'critical'); }
        finally { setIsSubmitting(false); }
    };

    const handleDelete = async (id: number, name: string) => {
        if (!window.confirm(t('users.deleteConfirm', { name }))) return;
        try {
            if (activeTab === 'buildings') await buildingApi.delete(id);
            else if (activeTab === 'floors') await floorApi.delete(id);
            else await roomApi.delete(id);
            showToast(t('users.deleted'), 'success');
            fetchData();
        } catch (e: any) { showToast(e.message, 'critical'); }
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(t('confirmBulkDelete', { count: selectedIds.length }))) return;
        try {
            if (activeTab === 'buildings') await buildingApi.deleteMany(selectedIds);
            else if (activeTab === 'floors') await floorApi.deleteMany(selectedIds);
            else await roomApi.deleteMany(selectedIds);
            showToast(t('users.deleted'), 'success');
            setSelectedIds([]);
            fetchData();
        } catch (e: any) { showToast(e.message, 'critical'); }
    };

    const handleBulkStatusUpdate = async () => {
        try {
            if (activeTab === 'buildings') await buildingApi.updateMany(selectedIds, { status: bulkNewStatus });
            else if (activeTab === 'rooms') await roomApi.updateMany(selectedIds, { status: bulkNewStatus });
            showToast(t('housing.statusUpdated'), 'success');
            setIsBulkStatusModalOpen(false);
            setSelectedIds([]);
            fetchData();
        } catch (e: any) { showToast(e.message, 'critical'); }
    };

    const inputClass = "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-hotel-gold outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white transition-all shadow-inner placeholder-slate-400";
    const labelClass = "block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-widest";

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none">{t('housing.buildings')} & Inventory</h1>
                    <p className="text-hotel-muted dark:text-slate-400 text-xs mt-1 font-bold uppercase tracking-widest opacity-80">Configuration of physical assets and bed capacity.</p>
                </div>
            </div>

            <div className="flex gap-1.5 p-1.5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border dark:border-slate-700 w-fit">
                {(['buildings', 'floors', 'rooms'] as const).map(tab => (
                    <button key={tab} onClick={() => { setActiveTab(tab); setSelectedIds([]); }} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-hotel-navy text-white shadow-lg scale-[1.02]' : 'text-slate-500 hover:text-hotel-navy dark:hover:text-white'}`}>
                        {t(`housing.tabs.${tab}`)}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="p-32 flex flex-col items-center justify-center space-y-4">
                    <div className="w-12 h-12 border-4 border-slate-200 border-t-hotel-gold rounded-full animate-spin"></div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('loading')}...</p>
                </div>
            ) : (
                <div className="animate-fade-in-up">
                    {activeTab === 'buildings' && <BuildingsView buildings={sortedData} onAdd={() => openModal('building')} onEdit={(b: any) => openModal('building', b)} onDelete={handleDelete} perms={perms} t={t} language={language} onSort={handleSort} renderSortIcon={renderSortIcon} selectedIds={selectedIds} setSelectedIds={setSelectedIds} onBulkDelete={handleBulkDelete} onBulkStatus={() => setIsBulkStatusModalOpen(true)} />}
                    {activeTab === 'floors' && <FloorsView buildings={buildings} floors={sortedData} onAdd={() => openModal('floor')} onEdit={(f: any) => openModal('floor', f)} onDelete={handleDelete} perms={perms} t={t} onSort={handleSort} renderSortIcon={renderSortIcon} selectedIds={selectedIds} setSelectedIds={setSelectedIds} onBulkDelete={handleBulkDelete} />}
                    {activeTab === 'rooms' && <RoomsView buildings={buildings} floors={floors} rooms={sortedData} onAdd={() => openModal('room')} onEdit={(r: any) => openModal('room', r)} onDelete={handleDelete} perms={perms} t={t} onSort={handleSort} renderSortIcon={renderSortIcon} selectedIds={selectedIds} setSelectedIds={setSelectedIds} onBulkDelete={handleBulkDelete} onBulkStatus={() => setIsBulkStatusModalOpen(true)} activeBuildingId={activeBuildingId} setActiveBuildingId={setActiveBuildingId} activeFloorId={activeFloorId} setActiveFloorId={setActiveFloorId} />}
                </div>
            )}

            {/* Entity Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
                        <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-hotel-navy text-white">
                            <h2 className="text-xl font-black uppercase tracking-widest">{editingItem ? t('edit') : t('save')} {t(`housing.${modalMode}`)}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-white/60 hover:text-white transition-colors"><i className="fas fa-times text-xl"></i></button>
                        </div>
                        <form onSubmit={handleModalSubmit} className="p-8 space-y-5">
                            {modalMode === 'building' && (
                                <>
                                    <div><label className={labelClass}>{t('housing.buildingName')}</label><input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className={inputClass} /></div>
                                    <div><label className={labelClass}>{t('housing.location')}</label><input value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} required className={inputClass} /></div>
                                    <div><label className={labelClass}>{t('housing.capacity')}</label><input type="number" min="1" value={formData.capacity} onChange={e => setFormData({...formData, capacity: e.target.value})} required className={inputClass} /></div>
                                    <div><label className={labelClass}>{t('housing.buildingStatus')}</label><select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className={inputClass}><option value="active">{t('statuses.active')}</option><option value="inactive">{t('statuses.inactive')}</option></select></div>
                                </>
                            )}
                            {modalMode === 'floor' && (
                                <>
                                    <div><label className={labelClass}>{t('housing.selectBuilding')}</label><select value={formData.buildingId} onChange={e => setFormData({...formData, buildingId: e.target.value})} required className={inputClass}><option value="">-- {t('select')} --</option>{buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                                    <div><label className={labelClass}>{t('housing.floorNumber')}</label><input value={formData.floorNumber} onChange={e => setFormData({...formData, floorNumber: e.target.value})} required className={inputClass} /></div>
                                    <div><label className={labelClass}>{t('housing.description')}</label><input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className={inputClass} /></div>
                                </>
                            )}
                            {modalMode === 'room' && (
                                <>
                                    <div><label className={labelClass}>{t('housing.roomNumber')}</label><input value={formData.roomNumber} onChange={e => setFormData({...formData, roomNumber: e.target.value})} required className={inputClass} /></div>
                                    <div><label className={labelClass}>{t('housing.roomType')}</label>
                                        <select value={formData.roomType} onChange={e => {
                                            const type = roomTypes.find(rt => rt.name === e.target.value);
                                            setFormData({...formData, roomType: e.target.value, capacity: type?.defaultCapacity || formData.capacity});
                                        }} className={inputClass}>
                                            {roomTypes.map(rt => <option key={rt.name} value={rt.name}>{rt.name}</option>)}
                                        </select>
                                    </div>
                                    <div><label className={labelClass}>{t('housing.capacity')}</label><input type="number" min="1" value={formData.capacity} onChange={e => setFormData({...formData, capacity: e.target.value})} required className={inputClass} /></div>
                                    <div><label className={labelClass}>{t('housing.buildingStatus')}</label><select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className={inputClass}><option value="available">{t('statuses.available')}</option><option value="occupied">{t('statuses.occupied')}</option><option value="maintenance">{t('statuses.maintenance')}</option><option value="reserved">{t('statuses.reserved')}</option></select></div>
                                </>
                            )}
                            <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700 bg-slate-50/50 -mx-8 -mb-8 p-6">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-slate-500 font-black uppercase text-[10px] tracking-widest">{t('cancel')}</button>
                                <button type="submit" disabled={isSubmitting} className="px-10 py-2.5 bg-hotel-navy text-white rounded-xl font-black text-xs uppercase shadow-xl hover:brightness-110 active:scale-95 transition-all">{isSubmitting ? t('saving') : t('save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bulk Status Modal */}
            {isBulkStatusModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up">
                        <div className="p-6 border-b dark:border-slate-700 bg-amber-500 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center">
                            <span>{t('housing.changeStatus')}</span>
                            <button onClick={() => setIsBulkStatusModalOpen(false)}><i className="fas fa-times"></i></button>
                        </div>
                        <div className="p-8 space-y-6 text-center">
                            <p className="text-xs font-bold text-slate-500 uppercase">{t(`housing.bulk${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}StatusModalTitle`)} ({selectedIds.length})</p>
                            <select value={bulkNewStatus} onChange={e => setBulkNewStatus(e.target.value)} className={inputClass}>
                                {activeTab === 'buildings' ? (
                                    <>
                                        <option value="active">{t('statuses.active')}</option>
                                        <option value="inactive">{t('statuses.inactive')}</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="available">{t('statuses.available')}</option>
                                        <option value="occupied">{t('statuses.occupied')}</option>
                                        <option value="maintenance">{t('statuses.maintenance')}</option>
                                        <option value="reserved">{t('statuses.reserved')}</option>
                                    </>
                                )}
                            </select>
                            <div className="flex flex-col gap-2 pt-4">
                                <button onClick={handleBulkStatusUpdate} className="w-full py-3 bg-hotel-navy text-white rounded-xl font-black text-xs uppercase shadow-lg hover:brightness-110">{t('housing.changeStatus')}</button>
                                <button onClick={() => setIsBulkStatusModalOpen(false)} className="w-full py-2 text-slate-400 font-black uppercase text-[10px] tracking-widest">{t('cancel')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BuildingsAndRoomsPage;