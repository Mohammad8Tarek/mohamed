

import React from 'react';
import { Property } from '../../../../types';
import { useLanguage } from '../../../../context/LanguageContext';
// FIX: Imported User type
import { User } from '../../../../types';

interface PropertyAccessTabProps {
    userForm: {
        username: string;
        fullName: string;
        email: string;
        password?: string;
        roleId: number;
        status: User['status'];
        propertyId: number; // Default Property ID
    };
    setUserForm: React.Dispatch<React.SetStateAction<any>>;
    propertyAccess: number[];
    handleToggleProperty: (propId: number) => void;
    allProperties: Property[];
}

export const PropertyAccessTab: React.FC<PropertyAccessTabProps> = ({
    userForm,
    setUserForm,
    propertyAccess,
    handleToggleProperty,
    allProperties,
}) => {
    const { t } = useLanguage();

    return (
        <div className="animate-fade-in-up space-y-8">
            <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex gap-4 items-center">
                <i className="fas fa-info-circle text-amber-600 text-2xl"></i>
                <p className="text-[11px] text-amber-800 font-bold leading-relaxed uppercase tracking-tight">
                    Select which property data sets this identity can access. One property must be designated as the primary default context.
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allProperties.map(prop => (
                    <div key={prop.id} className={`p-5 rounded-2xl border-2 transition-all flex flex-col gap-4 ${propertyAccess.includes(prop.id) ? 'bg-white border-hotel-gold shadow-lg' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-hotel-gold font-black shadow-inner">
                                    {prop.code.substring(0, 2)}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{prop.displayName || prop.name}</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{prop.code}</span>
                                </div>
                            </div>
                            <input 
                                type="checkbox" 
                                checked={propertyAccess.includes(prop.id)} 
                                onChange={() => handleToggleProperty(prop.id)} 
                                className="w-5 h-5 rounded text-hotel-gold border-slate-300 focus:ring-hotel-gold" 
                            />
                        </div>
                        
                        {propertyAccess.includes(prop.id) && (
                            <label className="flex items-center gap-2 cursor-pointer pt-3 border-t">
                                <input 
                                    type="radio" 
                                    name="defaultProp" 
                                    checked={userForm.propertyId === prop.id} 
                                    onChange={() => setUserForm(p => ({...p, propertyId: prop.id}))} 
                                    className="text-hotel-gold focus:ring-hotel-gold" 
                                />
                                <span className="text-[9px] font-black uppercase text-hotel-gold">Set as Default Entry</span>
                            </label>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};