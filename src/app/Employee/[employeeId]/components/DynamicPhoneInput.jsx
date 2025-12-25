'use client';

import { useState, useEffect } from 'react';
import { loadPhoneInput } from '../utils/lazyLibraries';

/**
 * Dynamic Phone Input Component
 * 
 * Lazy loads react-phone-input-2 only when component is used
 * Shows fallback input while loading
 */
export default function DynamicPhoneInput(props) {
    const [PhoneInputComponent, setPhoneInputComponent] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        // Load phone input when component mounts
        const loadComponent = async () => {
            try {
                const PhoneInput = await loadPhoneInput();
                if (mounted) {
                    setPhoneInputComponent(() => PhoneInput);
                    setLoading(false);
                }
            } catch (error) {
                console.error('Failed to load phone input:', error);
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        loadComponent();

        return () => {
            mounted = false;
        };
    }, []);

    // Show fallback input while loading
    if (loading || !PhoneInputComponent) {
        return (
            <input
                type="tel"
                {...props}
                className={props.className || 'w-full px-3 py-2 border rounded-lg'}
                placeholder={props.placeholder || 'Phone number'}
            />
        );
    }

    return <PhoneInputComponent {...props} />;
}




