import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';

export type NotificationPriority = 'info' | 'success' | 'warning' | 'critical';
export type NotificationCategory = 'operational' | 'maintenance' | 'system' | 'auth';

export interface Notification {
  id: number;
  message: string;
  type: NotificationPriority; // Compatibility mapping
  priority: NotificationPriority;
  category: NotificationCategory;
  read: boolean;
  timestamp: Date;
  actionLink?: string;
}

interface ToastContextType {
  showToast: (message: string, type: NotificationPriority, category?: NotificationCategory, actionLink?: string) => void;
  notifications: Notification[];
  unreadCount: number;
  highestPriority: NotificationPriority;
  markAllAsRead: () => void;
  markAsRead: (id: number) => void;
  clearNotifications: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let notificationId = Date.now();

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<{id: number, message: string, priority: NotificationPriority}[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const highestPriority = useMemo(() => {
    const unread = notifications.filter(n => !n.read);
    if (unread.some(n => n.priority === 'critical')) return 'critical';
    if (unread.some(n => n.priority === 'warning')) return 'warning';
    if (unread.some(n => n.priority === 'success')) return 'success';
    return 'info';
  }, [notifications]);

  const showToast = useCallback((message: string, type: NotificationPriority, category: NotificationCategory = 'operational', actionLink?: string) => {
    const id = notificationId++;
    
    // Add to volatile toasts (temporary UI feedback)
    setToasts(prev => [...prev, { id, message, priority: type }]);
    
    // Add to persistent notifications ledger
    const newNotification: Notification = { 
      id, 
      message, 
      type, // Mapping for backward compatibility
      priority: type, 
      category, 
      read: false, 
      timestamp: new Date(),
      actionLink
    };
    
    setNotifications(prev => [newNotification, ...prev].slice(0, 50)); // Buffer last 50 events

    // Auto-dismiss the temporary toast
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);
  
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const markAsRead = useCallback((id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const getPriorityColor = (p: NotificationPriority) => {
    switch(p) {
        case 'critical': return 'bg-rose-600';
        case 'warning': return 'bg-amber-500';
        case 'success': return 'bg-emerald-600';
        default: return 'bg-slate-700';
    }
  };

  const getPriorityIcon = (p: NotificationPriority) => {
    switch(p) {
        case 'critical': return 'fa-circle-exclamation';
        case 'warning': return 'fa-triangle-exclamation';
        case 'success': return 'fa-circle-check';
        default: return 'fa-circle-info';
    }
  };

  return (
    <ToastContext.Provider value={{ 
        showToast, 
        notifications, 
        unreadCount, 
        highestPriority, 
        markAllAsRead, 
        markAsRead, 
        clearNotifications 
    }}>
      {children}
      
      {/* Toast Overlay Layer */}
      <div className="fixed bottom-6 right-6 z-[999] flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center w-80 p-4 text-white ${getPriorityColor(toast.priority)} rounded-xl shadow-2xl animate-fade-in-up pointer-events-auto border border-white/10`}
            role="alert"
          >
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                <i className={`fas ${getPriorityIcon(toast.priority)} text-lg`}></i>
            </div>
            <div className="ms-3 text-sm font-semibold leading-tight">{toast.message}</div>
            <button 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="ms-auto p-1 hover:bg-black/10 rounded-lg transition-colors"
            >
                <i className="fas fa-times text-xs opacity-60"></i>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};