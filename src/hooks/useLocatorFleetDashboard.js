'use client';

import { useCallback, useEffect, useState } from 'react';
import axiosInstance from '@/utils/axios';

export function useLocatorFleetDashboard({ enabled = true } = {}) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        if (!enabled) return;

        setLoading(true);
        setError(null);

        try {
            const response = await axiosInstance.get('/locator/fleet-dashboard', { skipToast: true });
            setData(response?.data?.data || null);
        } catch (err) {
            const message =
                err?.response?.data?.message ||
                err?.message ||
                'Failed to load Locator GPS dashboard';
            setData(null);
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [enabled]);

    useEffect(() => {
        void load();
    }, [load]);

    return {
        data,
        loading,
        error,
        reload: load,
    };
}
