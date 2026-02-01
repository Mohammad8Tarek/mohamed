
import React from 'react';
import { SystemPermission } from '../../../../types';
import { useLanguage } from '../../../../context/LanguageContext';

interface PermissionOverrideControlProps {
  permission: SystemPermission;
  propertyId: number;
  currentState: 'inherit' | 'grant' | 'deny';
  baseRoleHasPermission: boolean;
  onChange: (state: 'inherit' | 'grant' | 'deny') => void;
}

export const PermissionOverrideControl: React.FC<PermissionOverrideControlProps> = ({
  permission,
  propertyId,
  currentState,
  baseRoleHasPermission,
  onChange
}) => {
  const { t } = useLanguage();

  const getEffectiveState = () => {
    if (currentState === 'grant') return { has: true, source: 'override' };
    if (currentState === 'deny') return { has: false, source: 'override' };
    return { has: baseRoleHasPermission, source: 'role' };
  };
  
  const effective = getEffectiveState();
  
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border-2 transition-all hover:shadow-md"
         style={{
           borderColor: currentState === 'grant' ? '#10b981' : 
                        currentState === 'deny' ? '#ef4444' : '#e5e7eb',
           backgroundColor: effective.has ? '#f0fdf4' : '#fef2f2' // Light green/red based on effective permission
         }}>
      <div className="flex items-center gap-3">
        {/* Permission Status Indicator */}
        <div className={`w-3 h-3 rounded-full ${
          effective.has ? 'bg-emerald-500' : 'bg-rose-500'
        }`} />
        
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {permission.replace(/\./g, ' • ')}
            </span>
            {currentState !== 'inherit' && (
              <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: currentState === 'grant' ? '#10b981' : '#ef4444',
                      color: 'white'
                    }}>
                OVERRIDE
              </span>
            )}
          </div>
          
          <p className="text-[9px] text-slate-400 mt-0.5">
            {effective.source === 'role' ? (
              baseRoleHasPermission ? 
                'Granted by role' : 
                'Denied by role'
            ) : (
              currentState === 'grant' ? 
                'Explicitly granted (overrides role)' : 
                'Explicitly denied (overrides role)'
            )}
          </p>
        </div>
      </div>
      
      {/* Override Controls */}
      <div className="flex gap-1 bg-white dark:bg-slate-800 rounded-lg p-1 border dark:border-slate-700 shadow-inner">
        <button
          type="button"
          onClick={() => onChange('inherit')}
          className={`px-3 py-1.5 text-[9px] font-black uppercase rounded transition-all ${
            currentState === 'inherit' 
              ? 'bg-slate-200 text-slate-700 shadow-sm' 
              : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <i className="fas fa-sync-alt mr-1"></i>
          Role
        </button>
        
        <button
          type="button"
          onClick={() => onChange('grant')}
          className={`px-3 py-1.5 text-[9px] font-black uppercase rounded transition-all ${
            currentState === 'grant' 
              ? 'bg-emerald-500 text-white shadow-sm' 
              : 'text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
          }`}
        >
          <i className="fas fa-check mr-1"></i>
          Allow
        </button>
        
        <button
          type="button"
          onClick={() => onChange('deny')}
          className={`px-3 py-1.5 text-[9px] font-black uppercase rounded transition-all ${
            currentState === 'deny' 
              ? 'bg-rose-500 text-white shadow-sm' 
              : 'text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/20'
          }`}
        >
          <i className="fas fa-times mr-1"></i>
          Deny
        </button>
      </div>
    </div>
  );
};
