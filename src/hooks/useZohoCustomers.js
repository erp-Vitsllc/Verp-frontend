'use client';

import { useCallback, useEffect, useState } from 'react';
import axiosInstance from '@/utils/axios';

export function useZohoCustomers({ enabled = true } = {}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [needsConnect, setNeedsConnect] = useState(false);

    const connectZoho = useCallback(async () => {
        try {
            const response = await axiosInstance.get('/zoho/auth-url', { skipToast: true });
            const authorizationUrl = response?.data?.data?.authorizationUrl;
            if (!authorizationUrl) {
                throw new Error('Authorization URL was not returned');
            }
            const popup = window.open(authorizationUrl, '_blank', 'noopener,noreferrer');
            if (!popup) {
                window.location.assign(authorizationUrl);
            }
            return authorizationUrl;
        } catch (err) {
            const message =
                err?.response?.data?.message ||
                err?.message ||
                'Failed to start Zoho authorization';
            setError(message);
            setNeedsConnect(true);
            throw new Error(message);
        }
    }, []);

    useEffect(() => {
        if (!enabled) return undefined;

        const handleFocus = () => {
            if (needsConnect) {
                setNeedsConnect(false);
            }
        };

        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [enabled, needsConnect]);

    return {
        loading,
        error,
        needsConnect,
        setNeedsConnect,
        setError,
        connectZoho,
    };
}
