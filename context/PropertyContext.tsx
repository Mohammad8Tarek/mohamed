
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Property } from '../types';
import { propertyApi, setApiPropertyId } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';

interface PropertyContextType {
    currentProperty: Property | null;
    allProperties: Property[];
    switchProperty: (id: number) => Promise<void>;
    loading: boolean;
    // FIX: Updated return type from Promise<void> to Promise<Property[]> to align with implementation
    refreshProperties: () => Promise<Property[]>;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

export const PropertyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, role } = useAuth();
    const [currentProperty, setCurrentProperty] = useState<Property | null>(null);
    const [allProperties, setAllProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);

    const refreshProperties = async () => {
        try {
            const props = await propertyApi.getAll();
            setAllProperties(props);
            return props;
        } catch (e) {
            console.error("Failed to load properties");
            return [];
        }
    };

    // Initial Load based on User
    useEffect(() => {
        const init = async () => {
            if (!user) {
                setLoading(false);
                setCurrentProperty(null);
                return;
            }

            const props = await refreshProperties();
            
            // Authorization logic: Super Admin gets everything, others get assigned list
            const isSuper = role?.id === 1 || (Array.isArray(user.roles) && user.roles.includes('super_admin'));
            const userAllowedIds = isSuper ? props.map(p => p.id) : (user.authorizedProperties || [user.propertyId]);

            let activeId = user.propertyId;
            
            // Check if there is a preferred property from this session
            const storedPropId = sessionStorage.getItem('activePropertyId');
            if (storedPropId) {
                const requestedId = parseInt(storedPropId);
                if (userAllowedIds.includes(requestedId)) {
                    activeId = requestedId;
                }
            }

            const activeProp = props.find(p => p.id === activeId) || props.find(p => userAllowedIds.includes(p.id)) || props[0];
            
            if (activeProp) {
                setCurrentProperty(activeProp);
                setApiPropertyId(activeProp.id);
                sessionStorage.setItem('activePropertyId', activeProp.id.toString());
            }
            setLoading(false);
        };
        init();
    }, [user, role]);

    const switchProperty = async (id: number) => {
        if (!user) return;
        
        const isSuper = role?.id === 1 || (Array.isArray(user.roles) && user.roles.includes('super_admin'));
        const userAllowedIds = isSuper ? allProperties.map(p => p.id) : (user.authorizedProperties || [user.propertyId]);
        
        if (!userAllowedIds.includes(id)) {
            console.error("Switch blocked: Unauthorized property access.");
            return;
        }
        
        const target = allProperties.find(p => p.id === id);
        if (target) {
            setCurrentProperty(target);
            setApiPropertyId(target.id);
            sessionStorage.setItem('activePropertyId', id.toString());
            // Global events to refresh components
            window.dispatchEvent(new CustomEvent('datachanged'));
            window.dispatchEvent(new CustomEvent('settingschanged'));
        }
    };

    return (
        <PropertyContext.Provider value={{ currentProperty, allProperties, switchProperty, loading, refreshProperties }}>
            {children}
        </PropertyContext.Provider>
    );
};

export const useProperty = (): PropertyContextType => {
    const context = useContext(PropertyContext);
    if (context === undefined) {
        throw new Error('useProperty must be used within a PropertyProvider');
    }
    return context;
};
