'use client';

import { useCallback, useEffect, useState } from 'react';
import axiosInstance from '@/utils/axios';
import { mapZohoVendors } from '@/utils/zohoVendors';

export function useZohoVendors({ enabled = true, sync = false } = {}) {
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [needsConnect, setNeedsConnect] = useState(false);

    const load = useCallback(async ({ sync: syncOverride } = {}) => {
        if (!enabled) return;

        const shouldSync = syncOverride ?? sync;
        setLoading(true);
        setError(null);

        try {
            const response = await axiosInstance.get('/zoho/vendors', {
                skipToast: true,
                timeout: shouldSync ? 120000 : 30000,
                params: shouldSync ? { sync: 'true' } : { sync: 'false' },
            });
            const list = mapZohoVendors(response?.data?.data);
            setVendors(list);
            setNeedsConnect(false);
        } catch (err) {
            const message =
                err?.response?.data?.message ||
                err?.message ||
                'Failed to load vendors from Zoho Books';
            setVendors([]);
            setError(message);
            setNeedsConnect(/not connected|re-authorize|not configured/i.test(message));
        } finally {
            setLoading(false);
        }
    }, [enabled, sync]);

    const connectZoho = useCallback(async () => {
        try {
            const response = await axiosInstance.get('/zoho/auth-url', { skipToast: true });
            const authorizationUrl = response?.data?.data?.authorizationUrl;
            if (!authorizationUrl) {
                throw new Error('Authorization URL was not returned');
            }
            window.open(authorizationUrl, '_blank', 'noopener,noreferrer');
        } catch (err) {
            const message =
                err?.response?.data?.message ||
                err?.message ||
                'Failed to start Zoho authorization';
            setError(message);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (!needsConnect) return undefined;

        const handleFocus = () => {
            void load();
        };

        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [load, needsConnect]);

    return {
        vendors,
        loading,
        error,
        needsConnect,
        reload: load,
        connectZoho,
    };
}
