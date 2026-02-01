
import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { usePermissions } from '../hooks/usePermissions';
import { useProperty } from '../context/PropertyContext'; 
import { ModuleType } from '../types';
// Removed: import GlobalSearch from '../components/GlobalSearch'; // Using relative path explicitly

const Layout: React.FC<{ theme: string; toggleTheme: () => void }> = ({ theme, toggleTheme }) => {
  const { user, role, logout } = useAuth();
  const { language, t } = useLanguage();
  const { settings } = useSettings();
  const { unreadCount, markAllAsRead, notifications } = useToast();
  const { currentProperty, allProperties, switchProperty } = useProperty(); 
  const perms = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [propertyMenuOpen, setPropertyMenuOpen] = useState(false);
  
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const propertyMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setUserMenuOpen(false);
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) setNotifMenuOpen(false);
      if (propertyMenuRef.current && !propertyMenuRef.current.contains(event.target as Node)) setPropertyMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  const isModuleEnabled = (moduleKey: ModuleType) => {
      if (!currentProperty?.enabledModules) return true; 
      return currentProperty.enabledModules.includes(moduleKey);
  };

  const navLinks = [
    { to: "/", icon: "fa-tachometer-alt", label: t('layout.dashboard'), visible: perms.canViewDashboard && isModuleEnabled('dashboard') },
    { to: "/housing", icon: "fa-hotel", label: t('layout.housing'), visible: perms.canViewHousing && isModuleEnabled('housing') },
    { to: "/employees", icon: "fa-user-tie", label: t('layout.employees'), visible: perms.canViewEmployees && isModuleEnabled('employees') },
    { to: "/reservations", icon: "fa-calendar-check", label: t('layout.reservations'), visible: perms.canViewReservations && isModuleEnabled('reservations') },
    { to: "/maintenance", icon: "fa-tools", label: t('layout.maintenance'), visible: perms.canViewMaintenance && isModuleEnabled('maintenance') },
    { to: "/reports", icon: "fa-chart-line", label: t('layout.reports'), visible: perms.canViewReports && isModuleEnabled('reports') },
    { to: "/users", icon: "fa-user-shield", label: t('layout.userManagement'), visible: perms.canViewUsers && isModuleEnabled('users') },
    { to: "/properties", icon: "fa-building", label: t('layout.properties'), visible: perms.canManageProperties }, 
    { to: "/settings", icon: "fa-cog", label: t('layout.settings'), visible: perms.canViewSettings && isModuleEnabled('settings') },
    { to: "/activity-log", icon: "fa-history", label: t('layout.activityLog'), visible: perms.canViewActivityLog && isModuleEnabled('activity_log') },
  ];

  const handleLogout = () => {
      logout();
      navigate('/login');
  };

  const initials = user?.username?.substring(0, 2).toUpperCase() || 'U';

  const allowedProperties = allProperties.filter(p => 
    perms.isSuperAdmin || user?.authorizedProperties?.includes(p.id)
  );

  return (
    <div className={`flex h-screen w-screen overflow-hidden ${language === 'ar' ? 'font-arabic' : 'font-sans'}`} dir={language === 'ar' ? 'rtl' : 'ltr'} style={{ backgroundColor: 'var(--bg-color)' }}>
      
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 border-r border-slate-200 dark:border-slate-800 shadow-2xl ${language === 'ar' ? 'right-0' : 'left-0'} ${sidebarOpen ? 'translate-x-0' : (language === 'ar' ? 'translate-x-full' : '-translate-x-full')}`} style={{ backgroundColor: 'var(--sidebar-color)' }}>
        <div className="flex flex-col h-full">
          <div className="h-20 flex flex-col justify-center items-center px-4 border-b border-white/10 bg-black/10">
            <div className="h-10 flex items-center justify-center overflow-hidden">
                {settings.systemLogo ? <img src={settings.systemLogo} className="max-h-full max-w-full object-contain" /> : <i className="fas fa-hotel text-white text-2xl"></i>}
            </div>
            <span className="text-[10px] font-bold text-white uppercase tracking-[0.2em] mt-2 opacity-70">{settings.systemName || 'Sunrise Housing'}</span>
          </div>

          <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5 custom-scrollbar">
            {navLinks.map(link => link.visible && (
              <NavLink key={link.to} to={link.to} className={({ isActive }) => `flex items-center px-4 py-3 rounded-xl transition-all duration-200 group ${isActive ? 'bg-white/10 text-white shadow-lg ring-1 ring-white/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                <i className={`fas ${link.icon} w-6 text-center text-sm ${location.pathname === link.to ? 'text-hotel-gold' : 'group-hover:text-hotel-gold'}`}></i>
                <span className="mx-3 text-xs font-semibold uppercase tracking-widest">{link.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0 h-full relative">
        <header className="h-20 flex-shrink-0 border-b border-slate-200 dark:border-slate-800 px-6 lg:px-10 flex items-center justify-between z-40 transition-all" style={{ backgroundColor: 'var(--header-color)' }}>
          <div className="flex items-center gap-6">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-xl">
              <i className="fas fa-bars text-xl"></i>
            </button>
            
            {/* Property Switcher */}
            <div className="relative" ref={propertyMenuRef}>
                <button 
                    onClick={() => setPropertyMenuOpen(!propertyMenuOpen)}
                    className="flex items-center gap-4 px-4 h-12 bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all group"
                >
                    <div className="w-10 h-7 flex items-center justify-center overflow-hidden">
                        {currentProperty?.logo ? <img src={currentProperty.logo} className="max-h-full max-w-full object-contain" /> : <i className="fas fa-building text-hotel-gold opacity-60"></i>}
                    </div>
                    <div className="flex flex-col leading-none text-left rtl:text-right">
                        <span className="text-[11px] font-black uppercase text-hotel-navy dark:text-slate-100 tracking-tight flex items-center gap-2">
                            {currentProperty?.displayName || currentProperty?.name}
                            <i className={`fas fa-chevron-down text-[8px] text-hotel-gold transition-transform ${propertyMenuOpen ? 'rotate-180' : ''}`}></i>
                        </span>
                        <span className="text-[9px] font-bold uppercase text-hotel-gold tracking-[0.1em] mt-0.5">{currentProperty?.code}</span>
                    </div>
                </button>

                {propertyMenuOpen && (
                    <div className={`absolute top-full mt-2 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-[60] overflow-hidden animate-fade-in-up ${language === 'ar' ? 'right-0' : 'left-0'}`}>
                        <div className="p-4 border-b dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{t('layout.switchProperty')}</span>
                        </div>
                        <div className="max-h-80 overflow-y-auto custom-scrollbar">
                            {allowedProperties.map(prop => (
                                <button 
                                    key={prop.id}
                                    onClick={() => { switchProperty(prop.id); setPropertyMenuOpen(false); }}
                                    className={`w-full flex items-center gap-4 p-4 text-left rtl:text-right hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${currentProperty?.id === prop.id ? 'bg-primary-50/30 dark:bg-primary-900/10' : ''}`}
                                >
                                    <div className="w-10 h-8 flex-shrink-0 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                                        {prop.logo ? <img src={prop.logo} className="h-full w-full object-contain" /> : <i className="fas fa-building text-slate-300 text-xs"></i>}
                                    </div>
                                    <div className="flex flex-col leading-tight min-w-0">
                                        <span className={`text-xs font-black uppercase truncate ${currentProperty?.id === prop.id ? 'text-hotel-gold' : 'text-slate-700 dark:text-slate-200'}`}>
                                            {prop.displayName || prop.name}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{prop.code}</span>
                                    </div>
                                    {currentProperty?.id === prop.id && (
                                        <i className="fas fa-check-circle text-hotel-gold ml-auto rtl:mr-auto"></i>
                                    )}
                                </button>
                            ))}
                        </div>
                        {perms.canManageProperties && (
                            <div className="p-2 border-t dark:border-slate-700">
                                <button onClick={() => { navigate('/properties'); setPropertyMenuOpen(false); }} className="w-full py-2.5 text-[9px] font-black uppercase text-hotel-navy dark:text-slate-300 hover:text-hotel-gold flex items-center justify-center gap-2">
                                    <i className="fas fa-cog"></i>
                                    {t('layout.manageProperties')}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Removed: <GlobalSearch /> */}
            <div className="relative" ref={notifMenuRef}>
              <button 
                onClick={() => { setNotifMenuOpen(!notifMenuOpen); if(!notifMenuOpen) markAllAsRead(); }}
                className="p-2.5 text-slate-500 hover:text-hotel-navy transition-colors relative"
              >
                <i className="fas fa-bell text-lg"></i>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 text-rose-600 text-[11px] font-black leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              {notifMenuOpen && (
                <div className={`absolute top-full mt-3 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-fade-in-up ${language === 'ar' ? 'left-0' : 'right-0'}`}>
                   <div className="p-4 border-b dark:border-slate-700 font-bold text-xs uppercase tracking-widest text-slate-400">
                      {t('layout.latestNotifications')}
                   </div>
                   <div className="max-h-96 overflow-y-auto custom-scrollbar">
                      {notifications.length > 0 ? (
                        <div className="divide-y dark:divide-slate-700">
                          {notifications.map(n => (
                            <div key={n.id} className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${!n.read ? 'bg-primary-50/20' : ''}`}>
                               <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{n.message}</p>
                               <span className="text-[10px] text-slate-400 mt-1 block">{new Date(n.timestamp).toLocaleTimeString()}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-10 text-center text-slate-400 italic text-xs">
                          {t('notifications.empty')}
                        </div>
                      )}
                   </div>
                </div>
              )}
            </div>

            <button onClick={toggleTheme} className="p-2.5 text-slate-500 hover:text-hotel-navy transition-colors">
              <i className={`fas fa-${theme === 'light' ? 'moon' : 'sun'} text-lg`}></i>
            </button>

            <div className="relative h-full flex items-center" ref={userMenuRef}>
              <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-3 p-1 rounded-xl transition-all group">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-lg" style={{ backgroundColor: 'var(--primary-color)' }}>{initials}</div>
                <div className="hidden sm:flex flex-col items-start leading-tight">
                  <span className="text-xs font-bold dark:text-slate-100">{user?.username}</span>
                  <span className="text-[9px] font-black text-hotel-gold uppercase tracking-[0.1em] mt-0.5">{role?.name || 'VIEWER'}</span>
                </div>
              </button>

              {userMenuOpen && (
                  <div className={`absolute top-full mt-3 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-fade-in-up ${language === 'ar' ? 'left-0' : 'right-0'}`}>
                      <div className="p-6 text-center bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white font-bold text-xl shadow-xl" style={{ backgroundColor: 'var(--primary-color)' }}>{initials}</div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white uppercase">{user?.fullName || user?.username}</p>
                          <p className="text-[9px] font-black text-hotel-gold uppercase mt-1">{role?.name || 'VIEWER'}</p>
                      </div>
                      <div className="p-3 space-y-1">
                          <button onClick={() => navigate('/settings')} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors">
                              <i className="fas fa-cog text-hotel-gold"></i>
                              <span>My Preferences</span>
                          </button>
                          <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-3 transition-colors">
                              <i className="fas fa-sign-out-alt"></i>
                              <span>{t('layout.signOut')}</span>
                          </button>
                      </div>
                  </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 lg:p-12 custom-scrollbar transition-all">
          <div className="w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
