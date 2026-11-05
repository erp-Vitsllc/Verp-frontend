'use client';

import { useEffect, useState } from 'react';
import axiosInstance from '@/utils/axios';
import { mapZohoOrganizationOptions } from '@/utils/zohoOrganizations';

let connectionsCache = null;
let connectionsInflight = null;

function inferOrgBrand(name = '') {
    const hay = String(name || '').toLowerCase();
    if (/nnit|neoron|neuron|nexus/.test(hay)) return 'NNIT';
    if (/vega/.test(hay)) return 'VEGA';
    return '';
}

async function loadZohoOrganizationOptions() {
    if (connectionsCache) return connectionsCache;
    if (!connectionsInflight) {
        connectionsInflight = axiosInstance
            .get('/zoho/connections', { skipToast: true, timeout: 30000 })
            .then((response) => {
                connectionsCache = mapZohoOrganizationOptions(response?.data?.data || {});
                return connectionsCache;
            })
            .finally(() => {
                connectionsInflight = null;
            });
    }
    return connectionsInflight;
}

function matchOrganizationId(mapped, companyId, companyName) {
    const id = String(companyId || '').trim();
    if (id) {
        const byCompany = (mapped?.options || []).find((option) =>
            (option.companyIds || []).some((rowId) => String(rowId) === id),
        );
        if (byCompany?.organizationId) return byCompany.organizationId;
    }

    const brand = inferOrgBrand(companyName);
    if (!brand) return '';
    const byBrand = (mapped?.options || []).find((option) => option.brand === brand);
    return byBrand?.organizationId || '';
}

/**
 * Zoho Books organization for an ERP company.
 * Uses the company record's zohoOrganizationId, then the linked VEGA / NNIT org.
 */
export function useCompanyZohoOrganizationId({
    companyId = '',
    companyName = '',
    explicitOrganizationId = '',
    enabled = true,
} = {}) {
    const explicit = String(explicitOrganizationId || '').trim();
    const [resolvedId, setResolvedId] = useState(explicit);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!enabled) return undefined;
        if (explicit) {
            setResolvedId(explicit);
            setLoading(false);
            return undefined;
        }

        const id = String(companyId || '').trim();
        const name = String(companyName || '').trim();
        if (!id && !name) {
            setResolvedId('');
            setLoading(false);
            return undefined;
        }

        let cancelled = false;
        setResolvedId('');
        setLoading(true);
        loadZohoOrganizationOptions()
            .then((mapped) => {
                if (cancelled) return;
                setResolvedId(matchOrganizationId(mapped, id, name));
            })
            .catch(() => {
                if (!cancelled) setResolvedId('');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [enabled, explicit, companyId, companyName]);

    return {
        organizationId: explicit || resolvedId,
        loading: enabled && !explicit && loading,
    };
}
