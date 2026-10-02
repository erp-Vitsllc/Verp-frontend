'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axiosInstance from '@/utils/axios';

/**
 * Loads Locator GPS fleet dashboard on mount / manual refresh.
 * Last result is kept so Running km and Idle time stay on screen while a newer copy loads.
 */
const locatorDashboardMemory = { year: '', data: null };
const STORAGE_PREFIX = 'verp-locator-fleet-dashboard:';

function readStoredDashboard(year) {
    if (locatorDashboardMemory.year === year && locatorDashboardMemory.data) {
        return locatorDashboardMemory.data;
    }
    if (typeof window === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${year}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        locatorDashboardMemory.year = year;
        locatorDashboardMemory.data = parsed;
        return parsed;
    } catch {
        return null;
    }
}

function writeStoredDashboard(year, data) {
    locatorDashboardMemory.year = year;
    locatorDashboardMemory.data = data;
    if (typeof window === 'undefined' || !data) return;
    try {
        const json = JSON.stringify(data);
        if (json.length > 2_500_000) return;
        sessionStorage.setItem(`${STORAGE_PREFIX}${year}`, json);
    } catch {
        /* sessionStorage quota — memory cache still serves this tab */
    }
}

export function useLocatorFleetDashboard({ enabled = true, year } = {}) {
    const periodYear = String(year || new Date().getFullYear());
    const [data, setData] = useState(() => readStoredDashboard(periodYear));
    const [loading, setLoading] = useState(() => !readStoredDashboard(periodYear));
    const [error, setError] = useState(null);
    const officialRetryFor = useRef('');

    const load = useCallback(async ({ silent = false, fresh = false } = {}) => {
        if (!enabled) return;

        const hasCached = locatorDashboardMemory.year === periodYear && locatorDashboardMemory.data;
        if (!silent && !hasCached) setLoading(true);
        if (!silent) setError(null);

        try {
            const response = await axiosInstance.get('/locator/fleet-dashboard', {
                params: { year: periodYear, ...(fresh ? { fresh: 1 } : {}) },
                skipToast: true,
            });
            const next = response?.data?.data || null;
            if (next) writeStoredDashboard(periodYear, next);
            setData(next);
        } catch (err) {
            const message =
                err?.response?.data?.message ||
                err?.message ||
                'Failed to load Locator GPS dashboard';
            if (!silent && !hasCached) {
                setData(null);
                setError(message);
            }
        } finally {
            if (!silent) setLoading(false);
        }
    }, [enabled, periodYear]);

    useEffect(() => {
        if (!enabled) return undefined;
        const cached = readStoredDashboard(periodYear);
        if (cached) {
            setData(cached);
            setLoading(false);
        }
        void load({ silent: Boolean(cached) });
        return undefined;
    }, [enabled, load, periodYear]);

    useEffect(() => {
        if (!enabled || data?.historySource !== 'local_snapshots') return undefined;
        const stamp = `${periodYear}:${data?.generatedAt || ''}`;
        if (officialRetryFor.current === stamp) return undefined;
        const timer = setTimeout(() => {
            officialRetryFor.current = stamp;
            void load({ silent: true });
        }, 12000);
        return () => clearTimeout(timer);
    }, [enabled, data?.historySource, data?.generatedAt, periodYear, load]);

    return {
        data,
        loading,
        error,
        reload: () => load({ fresh: true }),
    };
}
