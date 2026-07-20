'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axiosInstance from '@/utils/axios';
import {
    mapZohoOrganizationOptions,
    rememberZohoOrganizationId,
    resolveInitialZohoOrganizationId,
} from '@/utils/zohoOrganizations';

/**
 * Load VEGA / NNIT Zoho Books orgs and keep the active organizationId in sync.
 */
export function useZohoOrganizations({
    enabled = true,
    preferredOrganizationId = '',
    preferredCompanyId = '',
} = {}) {
    const [loading, setLoading] = useState(Boolean(enabled));
    const [error, setError] = useState('');
    const [defaultOrganizationId, setDefaultOrganizationId] = useState('');
    const [options, setOptions] = useState([]);
    const [organizationId, setOrganizationIdState] = useState('');

    const load = useCallback(async () => {
        if (!enabled) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError('');
        try {
            const response = await axiosInstance.get('/zoho/connections', {
                skipToast: true,
                timeout: 30000,
            });
            const mapped = mapZohoOrganizationOptions(response?.data?.data || {});
            setDefaultOrganizationId(mapped.defaultOrganizationId);
            setOptions(mapped.options);
            setOrganizationIdState((prev) =>
                resolveInitialZohoOrganizationId({
                    preferredId: preferredOrganizationId || prev,
                    preferredCompanyId,
                    defaultOrganizationId: mapped.defaultOrganizationId,
                    options: mapped.options,
                }),
            );
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                    err?.message ||
                    'Failed to load Zoho organizations',
            );
            setOptions([]);
        } finally {
            setLoading(false);
        }
    }, [enabled, preferredCompanyId, preferredOrganizationId]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (!options.length) return;
        const preferred = String(preferredOrganizationId || '').trim();
        const preferredCompany = String(preferredCompanyId || '').trim();
        if (!preferred && !preferredCompany) return;

        const next = resolveInitialZohoOrganizationId({
            preferredId: preferred,
            preferredCompanyId: preferredCompany,
            defaultOrganizationId,
            options,
        });
        if (!next) return;
        setOrganizationIdState((prev) => {
            if (prev === next) return prev;
            rememberZohoOrganizationId(next);
            return next;
        });
    }, [defaultOrganizationId, options, preferredCompanyId, preferredOrganizationId]);

    const setOrganizationId = useCallback((nextId) => {
        const id = String(nextId || '').trim();
        setOrganizationIdState(id);
        rememberZohoOrganizationId(id);
    }, []);

    const active = useMemo(
        () => options.find((opt) => opt.organizationId === organizationId) || null,
        [options, organizationId],
    );

    const showPicker = options.length > 1;

    return {
        loading,
        error,
        options,
        organizationId,
        setOrganizationId,
        defaultOrganizationId,
        active,
        showPicker,
        reload: load,
    };
}
