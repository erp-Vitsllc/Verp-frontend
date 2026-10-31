'use client';

import { useEffect, useMemo, useState } from 'react';
import axiosInstance from '@/utils/axios';

function idsKey(requestIds) {
    const raw = Array.isArray(requestIds) ? requestIds : [requestIds];
    return [...new Set(raw.map((item) => String(item || '').trim()).filter(Boolean))].join(',');
}

/**
 * True when this user is the current reassignee of an open task for these records.
 * That person can use the original assignee's approve, reject, and entry actions.
 */
export function useInheritedTaskAction(requestIds, {
    serviceId = '',
    requestType = '',
    metaField = '',
    metaValue = '',
} = {}) {
    const key = idsKey(requestIds);
    const [matches, setMatches] = useState([]);

    useEffect(() => {
        if (!key) {
            setMatches([]);
            return undefined;
        }
        let cancelled = false;
        axiosInstance
            .get('/Employee/task-manager/inherited-action', {
                params: {
                    requestId: key,
                    serviceId: serviceId || undefined,
                    requestType: requestType || undefined,
                    metaField: metaField || undefined,
                    metaValue: metaValue || undefined,
                },
                skipToast: true,
            })
            .then((res) => {
                if (!cancelled) setMatches(Array.isArray(res.data?.matches) ? res.data.matches : []);
            })
            .catch(() => {
                if (!cancelled) setMatches([]);
            });
        return () => {
            cancelled = true;
        };
    }, [key, serviceId, requestType, metaField, metaValue]);

    const matchedIds = useMemo(
        () => new Set(matches.map((row) => String(row.requestId || ''))),
        [matches],
    );

    return {
        canAct: matches.length > 0,
        matches,
        has: (id) => matchedIds.has(String(id || '')),
    };
}
