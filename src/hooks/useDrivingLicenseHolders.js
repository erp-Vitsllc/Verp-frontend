'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    fetchDrivingLicenseHolders,
    withPreservedEmployee,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleDrivingLicenseHolders';

/**
 * Loads employees who have a driving license on their profile
 * (same source as vehicle assignment).
 */
export function useDrivingLicenseHolders({
    enabled = true,
    preserveEmployeeId = '',
    sourceEmployees = [],
} = {}) {
    const [holders, setHolders] = useState([]);

    useEffect(() => {
        if (!enabled) return undefined;

        let active = true;
        fetchDrivingLicenseHolders()
            .then((list) => {
                if (active) setHolders(list);
            })
            .catch(() => {
                if (active) setHolders([]);
            });

        return () => {
            active = false;
        };
    }, [enabled]);

    return useMemo(
        () => withPreservedEmployee(holders, preserveEmployeeId, sourceEmployees),
        [holders, preserveEmployeeId, sourceEmployees],
    );
}
