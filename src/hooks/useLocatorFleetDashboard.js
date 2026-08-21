'use client';

import { useCallback, useEffect, useState } from 'react';
import axiosInstance from '@/utils/axios';

/**
 * Loads Locator GPS fleet dashboard on mount / manual refresh.
 * Backend caches the heavy snapshot aggregation (~5 min) — avoid refetching on every tab focus.
 */
export function useLocatorFleetDashboard({ enabled = true, year } = {}) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const periodYear = String(year || new Date().getFullYear());

    const load = useCallback(async () => {
        if (!enabled) return;

        setLoading(true);
        setError(null);

        try {
            const response = await axiosInstance.get('/locator/fleet-dashboard', {
                params: { year: periodYear },
                skipToast: true,
            });
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
    }, [enabled, periodYear]);

    useEffect(() => {
        if (!enabled) return undefined;
        void load();
        return undefined;
    }, [enabled, load]);

    return {
        data,
        loading,
        error,
        reload: load,
    };
}
