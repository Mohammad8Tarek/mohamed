
import React from 'react';
import { useLanguage } from '../../../context/LanguageContext';

export const PermissionExplainer: React.FC = () => {
    const { t } = useLanguage();

    return (
        <div className="bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 rounded-2xl p-5 flex gap-4 items-center animate-fade-in-up">
            <i className="fas fa-info-circle text-blue-600 text-2xl"></i>
            <div>
                <h4 className="text-[11px] text-blue-800 dark:text-blue-400 font-black uppercase tracking-tight mb-1">How Atomic Overrides Work</h4>
                <p className="text-[10px] text-blue-700 dark:text-blue-300 leading-relaxed">
                    Overrides allow you to fine-tune a user's permissions for specific properties, overriding their default role permissions.
                    "Grant" gives explicit access, "Deny" explicitly blocks access, and "Inherit" reverts to the role's default setting.
                    Deny overrides always take precedence over grants or role permissions.
                </p>
            </div>
        </div>
    );
};
