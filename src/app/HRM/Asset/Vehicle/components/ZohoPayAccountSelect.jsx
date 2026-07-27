'use client';

import { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import axiosInstance from '@/utils/axios';

const selectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: 44,
        borderRadius: '0.75rem',
        borderColor: state.isFocused ? '#00B5AD' : '#e2e8f0',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(0, 181, 173, 0.15)' : 'none',
        backgroundColor: state.isDisabled ? '#f8fafc' : '#fff',
        cursor: state.isDisabled ? 'not-allowed' : 'pointer',
        '&:hover': {
            borderColor: state.isDisabled ? '#e2e8f0' : '#00B5AD',
        },
    }),
    menu: (base) => ({ ...base, zIndex: 9999, borderRadius: '0.75rem' }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    option: (base, state) => ({
        ...base,
        fontSize: '0.875rem',
        backgroundColor: state.isSelected ? '#00B5AD' : state.isFocused ? '#f0fdfa' : '#fff',
        color: state.isSelected ? '#fff' : '#334155',
    }),
    singleValue: (base) => ({ ...base, fontSize: '0.875rem', fontWeight: 600 }),
    placeholder: (base) => ({ ...base, fontSize: '0.875rem', color: '#94a3b8' }),
    indicatorSeparator: () => ({ display: 'none' }),
};

/**
 * Zoho Chart of Accounts dropdown (same source as Bills → Account column).
 */
export default function ZohoPayAccountSelect({
    value = '',
    name = '',
    onChange,
    disabled = false,
    className = '',
    placeholder = 'Select pay account',
    organizationId = '',
}) {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const params = {};
                if (organizationId) params.organizationId = organizationId;
                const res = await axiosInstance.get('/zoho/bills/support', {
                    params,
                    skipToast: true,
                });
                if (cancelled) return;
                setAccounts(Array.isArray(res.data?.accounts) ? res.data.accounts : []);
            } catch (err) {
                if (cancelled) return;
                setAccounts([]);
                setError(err?.response?.data?.message || err?.message || 'Could not load accounts');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [organizationId]);

    const groupedOptions = useMemo(() => {
        const groups = new Map();
        accounts.forEach((account) => {
            const groupLabel = account.type || 'Other';
            if (!groups.has(groupLabel)) groups.set(groupLabel, []);
            groups.get(groupLabel).push({
                value: String(account.id || ''),
                label: String(account.name || ''),
            });
        });
        return [...groups.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([label, options]) => ({
                label,
                options: options
                    .filter((o) => o.value)
                    .sort((a, b) => a.label.localeCompare(b.label)),
            }));
    }, [accounts]);

    const flatOptions = useMemo(
        () => groupedOptions.flatMap((g) => g.options || []),
        [groupedOptions],
    );

    const selected = useMemo(() => {
        const id = String(value || '').trim();
        if (!id) return null;
        return (
            flatOptions.find((o) => o.value === id) || {
                value: id,
                label: String(name || id),
            }
        );
    }, [value, name, flatOptions]);

    return (
        <div className={className}>
            <Select
                styles={selectStyles}
                isDisabled={disabled || loading}
                isClearable
                isSearchable
                placeholder={loading ? 'Loading accounts…' : placeholder}
                options={groupedOptions}
                value={selected}
                onChange={(option) => {
                    onChange?.({
                        id: option?.value || '',
                        name: option?.label || '',
                    });
                }}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                menuPosition="fixed"
                noOptionsMessage={() => (error ? error : 'No accounts found')}
            />
            {error ? <p className="mt-1 text-[10px] text-amber-700">{error}</p> : null}
        </div>
    );
}
