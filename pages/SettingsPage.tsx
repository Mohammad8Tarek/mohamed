
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { AppSettings, DEFAULT_SETTINGS, DEPARTMENTS, departmentJobTitles, RoomTypeConfig } from '../types';
import { logActivity } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';

const SettingsPage: React.FC = () => {
    const { settings, updateSettings } = useSettings();
    const { t, language, setLanguage } = useLanguage();
    const { showToast } = useToast();
    const { user } = useAuth();
    
    const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- State for dynamic taxonomy inputs ---
    const [newWLocName, setNewWLocName] = useState('');
    const [newDeptName, setNewDeptName] = useState('');
    const [roomTypeForm, setRoomTypeForm] = useState<RoomTypeConfig>({ name: '', description: '', defaultCapacity: 1 });
    const [searchTerm, setSearchTerm] = useState(''); // For department search
    const [expandedDept, setExpandedDept] = useState<string | null>(null); // For department accordion

    useEffect(() => {
        setLocalSettings(settings);
        setIsDirty(false);
    }, [settings]);

    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--primary-color', localSettings.primaryColor);
        root.style.setProperty('--sidebar-color', localSettings.sidebarColor);
        root.style.setProperty('--button-color', localSettings.buttonColor);
        root.style.setProperty('--header-color', localSettings.headerColor || '#FFFFFF');
        root.style.setProperty('--bg-color', localSettings.backgroundColor || '#E2E8F0');
        root.style.setProperty('--text-color', localSettings.textColor || '#1A202C');
    }, [localSettings]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target as HTMLInputElement;
        const finalValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        setLocalSettings(prev => ({ ...prev, [name]: finalValue }));
        setIsDirty(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 500 * 1024) {
            showToast(t('settings.logoSizeError'), 'critical');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setLocalSettings(prev => ({ ...prev, systemLogo: reader.result as string }));
            setIsDirty(true);
        };
        reader.readAsDataURL(file);
    };

    const handleTaxonomyUpdate = (newTax: Partial<AppSettings['customTaxonomy']>) => {
        setLocalSettings(prev => ({
            ...prev,
            customTaxonomy: { ...prev.customTaxonomy, ...newTax }
        }));
        setIsDirty(true);
    };

    const addWorkLocation = () => {
        if (!newWLocName.trim()) return;
        const current = localSettings.customTaxonomy.workLocations || [];
        handleTaxonomyUpdate({ workLocations: [...current, newWLocName.trim()] });
        setNewWLocName('');
    };

    const removeWorkLocation = (loc: string) => {
        const current = localSettings.customTaxonomy.workLocations || [];
        handleTaxonomyUpdate({ workLocations: current.filter(l => l !== loc) });
    };

    const addDepartment = () => {
        if (!newDeptName.trim()) return;
        handleTaxonomyUpdate({ departments: [...localSettings.customTaxonomy.departments, newDeptName.trim()] });
        setNewDeptName('');
    };

    const removeDepartment = (dept: string) => {
        const isDefault = DEPARTMENTS.includes(dept);
        if (isDefault) {
            handleTaxonomyUpdate({ hiddenDepartments: [...localSettings.customTaxonomy.hiddenDepartments, dept] });
        } else {
            handleTaxonomyUpdate({ departments: localSettings.customTaxonomy.departments.filter(d => d !== dept) });
        }
    };

    const addRoomType = () => {
        if (!roomTypeForm.name.trim()) return;
        handleTaxonomyUpdate({ roomTypes: [...localSettings.customTaxonomy.roomTypes, roomTypeForm] });
        setRoomTypeForm({ name: '', description: '', defaultCapacity: 1 });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateSettings(localSettings);
            logActivity(user!.username, 'Updated System Settings', { actionType: 'UPDATE', module: 'settings' });
            showToast(t('settings.saved'), 'success');
            setIsDirty(false);
        } catch (error) {
            showToast(t('errors.generic'), 'critical');
        } finally {
            setIsSaving(false);
        }
    };

    const combinedDepts = Array.from(new Set([...DEPARTMENTS, ...localSettings.customTaxonomy.departments]))
        .filter(d => !localSettings.customTaxonomy.hiddenDepartments.includes(d))
        .filter(d => d.toLowerCase().includes(searchTerm.toLowerCase()));

    const inputClass = "w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-hotel-gold outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white transition-all shadow-sm";
    const labelClass = "block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-widest";
    const sectionClass = "bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-8 space-y-8";

    return (
        <div className="w-full space-y-10 pb-20 animate-fade-in-up">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-8 dark:border-slate-700">
                <div>
                    <h1 className="text-4xl font-black text-hotel-navy dark:text-white uppercase tracking-tighter">{t('settings.title')}</h1>
                    <p className="text-hotel-muted dark:text-slate-400 text-sm mt-1 font-bold uppercase tracking-widest">{t('settings.subtitle')}</p>
                </div>
                <div className="flex gap-3">
                    {/* Removed Reset Defaults button */}
                    <button onClick={handleSave} disabled={isSaving || !isDirty} className="px-8 py-2.5 bg-hotel-navy text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-2">
                        {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                        {t('settings.saveChanges')}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* General Branding Section */}
                <div className={sectionClass}>
                    <div className="flex items-center gap-3 border-b dark:border-slate-700 pb-4">
                        <i className="fas fa-paint-brush text-hotel-gold"></i>
                        <h2 className="text-sm font-black uppercase tracking-widest">{t('settings.generalConfig')}</h2>
                    </div>
                    
                    <div className="space-y-6">
                        <div>
                            <label className={labelClass}>{t('settings.displayName')}</label>
                            <input type="text" name="systemName" value={localSettings.systemName} onChange={handleInputChange} className={inputClass} />
                        </div>

                        <div>
                            <label className={labelClass}>{t('settings.defaultLang')}</label>
                            <div className="flex gap-2 p-1 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                <button 
                                    onClick={() => { setLocalSettings(p => ({ ...p, defaultLanguage: 'en' })); setIsDirty(true); }} 
                                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${localSettings.defaultLanguage === 'en' ? 'bg-white dark:bg-slate-700 text-hotel-navy dark:text-white shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
                                    {t('settings.langEn')}
                                </button>
                                <button 
                                    onClick={() => { setLocalSettings(p => ({ ...p, defaultLanguage: 'ar' })); setIsDirty(true); }} 
                                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${localSettings.defaultLanguage === 'ar' ? 'bg-white dark:bg-slate-700 text-hotel-navy dark:text-white shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
                                    {t('settings.langAr')}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>{t('settings.customLogo.label')}</label>
                            <div className="flex items-center gap-5 p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                                <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-inner dark:bg-slate-800 dark:border-slate-700">
                                    {localSettings.systemLogo ? <img src={localSettings.systemLogo} className="w-full h-full object-contain" /> : <i className="fas fa-image text-slate-200 text-2xl"></i>}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => fileInputRef.current?.click()} className="px-4 py-1.5 bg-hotel-navy text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:brightness-110 shadow-md">Upload Image</button>
                                    {localSettings.systemLogo && <button onClick={() => setLocalSettings(p => ({ ...p, systemLogo: null }))} className="px-4 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-100">Clear</button>}
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* UI Colors Section */}
                <div className={sectionClass}>
                    <div className="flex items-center gap-3 border-b dark:border-slate-700 pb-4">
                        <i className="fas fa-swatchbook text-hotel-gold"></i>
                        <h2 className="text-sm font-black uppercase tracking-widest">{t('settings.uiBranding')}</h2>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div><label className={labelClass}>{t('settings.primaryColor')}</label><input type="color" name="primaryColor" value={localSettings.primaryColor} onChange={handleInputChange} className="h-12 w-full rounded-xl cursor-pointer bg-white border border-slate-200 p-1 shadow-sm" /></div>
                            <div><label className={labelClass}>{t('settings.sidebarBg')}</label><input type="color" name="sidebarColor" value={localSettings.sidebarColor} onChange={handleInputChange} className="h-12 w-full rounded-xl cursor-pointer bg-white border border-slate-200 p-1 shadow-sm" /></div>
                        </div>
                        <div className="space-y-4">
                            <div><label className={labelClass}>{t('settings.headerColor')}</label><input type="color" name="headerColor" value={localSettings.headerColor || '#FFFFFF'} onChange={handleInputChange} className="h-12 w-full rounded-xl cursor-pointer bg-white border border-slate-200 p-1 shadow-sm" /></div>
                            <div><label className={labelClass}>{t('settings.accentColor')}</label><input type="color" name="buttonColor" value={localSettings.buttonColor} onChange={handleInputChange} className="h-12 w-full rounded-xl cursor-pointer bg-white border border-slate-200 p-1 shadow-sm" /></div>
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                        <p className="text-[10px] text-slate-400 italic font-bold leading-relaxed">{t('settings.brandingNote')}</p>
                    </div>
                </div>
            </div>

            {/* Rule 3: Work Location Matrix & Enterprise Taxonomy */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 {/* Work Locations */}
                 <div className={sectionClass}>
                    <div className="flex items-center gap-3 border-b dark:border-slate-700 pb-4">
                        <i className="fas fa-map-marker-alt text-hotel-gold"></i>
                        <h2 className="text-sm font-black uppercase tracking-widest">Work Locations</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <input type="text" placeholder="New Area/Outlet..." value={newWLocName} onChange={e => setNewWLocName(e.target.value)} className={inputClass} />
                            <button onClick={addWorkLocation} className="px-5 py-2.5 bg-hotel-navy text-white rounded-xl"><i className="fas fa-plus"></i></button>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                            {(localSettings.customTaxonomy.workLocations || []).map(loc => (
                                <div key={loc} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-xl group transition-all hover:shadow-sm">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">{loc}</span>
                                    <button onClick={() => removeWorkLocation(loc)} className="opacity-0 group-hover:opacity-100 p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><i className="fas fa-trash-alt"></i></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Departments & Job Titles */}
                <div className={`${sectionClass} lg:col-span-2`}>
                    <div className="flex justify-between items-center border-b dark:border-slate-700 pb-6">
                        <div className="flex items-center gap-3">
                            <i className="fas fa-tags text-hotel-gold"></i>
                            <h2 className="text-sm font-black uppercase tracking-widest">Enterprise Taxonomy</h2>
                        </div>
                        <div className="relative w-64">
                            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                            <input type="text" placeholder="Search departments..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] outline-none" />
                        </div>
                    </div>

                    <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                        {combinedDepts.map(dept => (
                            <div key={dept} className="group border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden transition-all hover:shadow-lg">
                                <div className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${expandedDept === dept ? 'bg-slate-50 dark:bg-slate-900' : 'bg-white dark:bg-slate-800'}`} onClick={() => setExpandedDept(expandedDept === dept ? null : dept)}>
                                    <div className="flex items-center gap-3">
                                        <i className={`fas fa-chevron-${expandedDept === dept ? 'down' : 'right'} text-hotel-gold text-xs`}></i>
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">{t(`departments.${dept}`) !== `departments.${dept}` ? t(`departments.${dept}`) : dept.replace(/_/g, ' ')}</span>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); removeDepartment(dept); }} className="opacity-0 group-hover:opacity-100 p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><i className="fas fa-trash-alt text-[10px]"></i></button>
                                </div>
                            </div>
                        ))}
                        <div className="flex gap-2 p-2 border-t mt-4">
                            <input type="text" placeholder="New department..." value={newDeptName} onChange={e => setNewDeptName(e.target.value)} className={inputClass} />
                            <button onClick={addDepartment} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl"><i className="fas fa-plus"></i></button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Inventory & Alerts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 {/* Inventory Classification */}
                 <div className={sectionClass}>
                    <div className="flex items-center gap-3 border-b dark:border-slate-700 pb-4">
                        <i className="fas fa-bed text-hotel-gold"></i>
                        <h2 className="text-sm font-black uppercase tracking-widest">Inventory Classification (Rule 1)</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl space-y-4">
                            <input type="text" placeholder="e.g. Master Suite" value={roomTypeForm.name} onChange={e => setRoomTypeForm(p => ({...p, name: e.target.value}))} className={inputClass} />
                            <div className="flex gap-2">
                                <input type="number" min="1" value={roomTypeForm.defaultCapacity} onChange={e => setRoomTypeForm(p => ({ ...p, defaultCapacity: parseInt(e.target.value) }))} className={inputClass} placeholder="Beds" />
                                <button onClick={addRoomType} className="px-6 py-2 bg-hotel-gold text-white rounded-xl font-black uppercase text-[10px]">Register</button>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {localSettings.customTaxonomy.roomTypes.map(rt => (
                                <div key={rt.name} className="flex items-center justify-between p-4 border rounded-2xl dark:border-slate-700">
                                    <div><p className="text-xs font-black uppercase text-slate-800 dark:text-white">{rt.name}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{rt.defaultCapacity} Default Beds</p></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Notifications */}
                <div className={sectionClass}>
                    <div className="flex items-center gap-3 border-b dark:border-slate-700 pb-4">
                        <i className="fas fa-bell text-hotel-gold"></i>
                        <h2 className="text-sm font-black uppercase tracking-widest">Intelligence & Alerts</h2>
                    </div>
                    <div className="space-y-8">
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
                            <div>
                                <p className="text-xs font-black uppercase text-slate-700 dark:text-slate-200">Checkout Threshold Alerts</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Trigger notifications for upcoming checkout dates</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" name="departureAlertsEnabled" checked={localSettings.departureAlertsEnabled} onChange={handleInputChange} className="sr-only peer" />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-hotel-gold"></div>
                            </label>
                        </div>
                        <div className="space-y-2">
                            <label className={labelClass}>Alert Threshold (Days before checkout)</label>
                            <div className="flex items-center gap-4">
                                <input type="range" min="1" max="14" name="departureAlertThreshold" value={localSettings.departureAlertThreshold} onChange={handleInputChange} className="flex-1 accent-hotel-gold" />
                                <span className="w-12 h-10 flex items-center justify-center bg-hotel-navy text-white font-black rounded-xl text-xs">{localSettings.departureAlertThreshold}d</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
