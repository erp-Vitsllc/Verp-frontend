'use client';

import { useMemo } from 'react';
import Select from 'react-select';
import { useZohoVendors } from '@/hooks/useZohoVendors';
import { mergeVendorOptionLabels } from '@/utils/zohoVendors';

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
    valueContainer: (base) => ({
        ...base,
        padding: '2px 12px',
    }),
    input: (base) => ({
        ...base,
        margin: 0,
        padding: 0,
        fontSize: '0.875rem',
    }),
    placeholder: (base) => ({
        ...base,
        color: '#94a3b8',
        fontSize: '0.875rem',
    }),
    singleValue: (base) => ({
        ...base,
        fontSize: '0.875rem',
        fontWeight: 600,
        color: '#334155',
    }),
    menu: (base) => ({
        ...base,
        zIndex: 9999,
        borderRadius: '0.75rem',
        overflow: 'hidden',
    }),
    menuPortal: (base) => ({
        ...base,
        zIndex: 9999,
    }),
    option: (base, state) => ({
        ...base,
        fontSize: '0.875rem',
        backgroundColor: state.isSelected ? '#00B5AD' : state.isFocused ? '#f0fdfa' : '#fff',
        color: state.isSelected ? '#fff' : '#334155',
        cursor: 'pointer',
    }),
    indicatorSeparator: () => ({
        display: 'none',
    }),
    dropdownIndicator: (base, state) => ({
        ...base,
        color: state.isDisabled ? '#cbd5e1' : '#64748b',
        paddingRight: 12,
        '&:hover': {
            color: state.isDisabled ? '#cbd5e1' : '#0f766e',
        },
    }),
    clearIndicator: (base) => ({
        ...base,
        paddingRight: 4,
    }),
};

function filterVendorOption(option, inputValue) {
    const query = String(inputValue || '').trim().toLowerCase();
    if (!query) return true;

    const label = String(option?.label || '').toLowerCase();
    const email = String(option?.data?.email || '').toLowerCase();
    return label.includes(query) || email.includes(query);
}

export default function ZohoVendorSelect({
    value,
    onChange,
    disabled = false,
    className = '',
    placeholder = 'Select vendor...',
    emptyLabel = 'No vendors found',
    showConnectHint = true,
    enabled = true,
    extraOptions = [],
}) {
    const { vendors, loading, error, needsConnect, reload, connectZoho } = useZohoVendors({ enabled });

    const optionLabels = useMemo(
        () => mergeVendorOptionLabels(vendors, extraOptions, value),
        [vendors, extraOptions, value],
    );

    const vendorMetaByLabel = useMemo(
        () => new Map(vendors.map((vendor) => [vendor.label, vendor])),
        [vendors],
    );

    const selectOptions = useMemo(
        () =>
            optionLabels.map((label) => {
                const vendor = vendorMetaByLabel.get(label);
                return {
                    value: label,
                    label,
                    email: vendor?.email || '',
                    data: vendor || null,
                };
            }),
        [optionLabels, vendorMetaByLabel],
    );

    const selectedOption = useMemo(() => {
        const current = String(value || '').trim();
        if (!current) return null;
        return selectOptions.find((option) => option.value === current) || {
            value: current,
            label: current,
            email: '',
            data: null,
        };
    }, [value, selectOptions]);

    const isDisabled = disabled || loading;

    const handleChange = (option) => {
        const label = option?.value || '';
        const vendor = option?.data || vendorMetaByLabel.get(label) || null;
        // First arg stays a string for existing callers; second arg is full vendor when available
        onChange?.(label, vendor);
    };

    return (
        <div className={`space-y-1 ${className}`.trim()}>
            <Select
                classNamePrefix="zoho-vendor"
                value={selectedOption}
                onChange={handleChange}
                options={selectOptions}
                isDisabled={isDisabled}
                isClearable
                isSearchable
                placeholder={loading ? 'Loading vendors...' : placeholder}
                noOptionsMessage={() => (loading ? 'Loading vendors...' : emptyLabel)}
                styles={selectStyles}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                menuPosition="fixed"
                filterOption={filterVendorOption}
            />

            {showConnectHint && needsConnect ? (
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-amber-700">
                    <span>Zoho Books is not connected.</span>
                    <button
                        type="button"
                        onClick={() => void connectZoho()}
                        className="font-bold underline"
                    >
                        Connect Zoho
                    </button>
                    <button
                        type="button"
                        onClick={() => void reload()}
                        className="font-bold underline"
                    >
                        Retry
                    </button>
                </div>
            ) : null}

            {error && !needsConnect ? (
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-red-600">
                    <span>{error}</span>
                    <button
                        type="button"
                        onClick={() => void reload()}
                        className="font-bold underline"
                    >
                        Retry
                    </button>
                </div>
            ) : null}
        </div>
    );
}
