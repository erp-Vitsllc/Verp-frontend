'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axiosInstance from '@/utils/axios';
import {
    FALLBACK_WORK_LOCATIONS,
    fetchWorkLocations,
    workLocationStaffTabLabel,
} from '@/utils/workLocations';

export default function useWorkLocations() {
    const [locations, setLocations] = useState(FALLBACK_WORK_LOCATIONS);
    const [loading, setLoading] = useState(true);

    const reload = useCallback(async () => {
        const rows = await fetchWorkLocations(axiosInstance, { force: true });
        setLocations(rows);
        return rows;
    }, []);

    useEffect(() => {
        let cancelled = false;
        fetchWorkLocations(axiosInstance)
            .then((rows) => {
                if (!cancelled) setLocations(rows);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const tabs = useMemo(
        () => locations.map((loc) => ({ key: loc.key, label: workLocationStaffTabLabel(loc) })),
        [locations],
    );

    return { locations, tabs, loading, reload };
}
