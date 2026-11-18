'use client';

import { useEffect, useState } from 'react';
import { hasPermission } from '@/utils/permissions';

export function useCrmAccess() {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        setReady(true);
    }, []);

    const allow = (type = 'isView') => ready && hasPermission('crm', type);

    return {
        ready,
        canView: allow('isView'),
        canCreate: allow('isCreate'),
        canEdit: allow('isEdit'),
        canDelete: allow('isDelete'),
    };
}
