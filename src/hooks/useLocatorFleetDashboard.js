'use client';

import { useCallback, useEffect, useState } from 'react';
import axiosInstance from '@/utils/axios';

/**
 * Loads Locator GPS fleet dashboard on every mount / tab focus / manual refresh.
 * Backend always fetches live GPS and reconciles ERP vehicles on each request.
 */
export function useLocatorFleetDashboard({ enabled = true } = {}) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        if (!enabled) return;

        setLoading(true);
        setError(null);

        try {
            const response = await axiosInstance.get('/locator/fleet-dashboard', {
                skipToast: true,
                // Bust any intermediary cache so each dashboard view gets a fresh reconcile.
                params: { _t: Date.now() },
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
    }, [enabled]);

    useEffect(() => {
        if (!enabled) return undefined;

        void load();

        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                void load();
            }
        };

        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [enabled, load]);

    return {
        data,
        loading,
        error,
        reload: load,
    };
}
