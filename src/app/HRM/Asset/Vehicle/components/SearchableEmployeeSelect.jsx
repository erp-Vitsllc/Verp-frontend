'use client';

import { useMemo } from 'react';
import Select from 'react-select';

function employeeLabel(emp) {
    const name = `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim();
    const code = String(emp?.employeeId || '').trim();
    if (name && code) return `${name} (${code})`;
    return name || code || 'Employee';
}

const compactSelectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: 36,
        height: 36,
        borderRadius: '0.5rem',
        borderColor: state.isFocused ? '#93c5fd' : '#e5e7eb',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.15)' : 'none',
        backgroundColor: state.isDisabled ? '#f9fafb' : '#fff',
        cursor: state.isDisabled ? 'not-allowed' : 'pointer',
        fontSize: '0.875rem',
        '&:hover': {
            borderColor: state.isDisabled ? '#e5e7eb' : '#93c5fd',
        },
    }),
    valueContainer: (base) => ({
        ...base,
        padding: '0 8px',
        height: 34,
    }),
    input: (base) => ({
        ...base,
        margin: 0,
        padding: 0,
        fontSize: '0.875rem',
    }),
    indicatorsContainer: (base) => ({
        ...base,
        height: 34,
    }),
    dropdownIndicator: (base) => ({
        ...base,
        padding: 4,
    }),
    clearIndicator: (base) => ({
        ...base,
        padding: 4,
    }),
    placeholder: (base) => ({
        ...base,
        color: '#9ca3af',
        fontSize: '0.875rem',
    }),
    singleValue: (base) => ({
        ...base,
        fontSize: '0.875rem',
        fontWeight: 600,
        color: '#1f2937',
    }),
    menu: (base) => ({
        ...base,
        zIndex: 9999,
        borderRadius: '0.5rem',
        overflow: 'hidden',
    }),
    menuPortal: (base) => ({
        ...base,
        zIndex: 9999,
    }),
    option: (base, state) => ({
        ...base,
        fontSize: '0.875rem',
        backgroundColor: state.isSelected ? '#2563eb' : state.isFocused ? '#eff6ff' : '#fff',
        color: state.isSelected ? '#fff' : '#1f2937',
        cursor: 'pointer',
    }),
    indicatorSeparator: () => ({
        display: 'none',
    }),
};

/**
 * Searchable employee dropdown (react-select). Value is Mongo employee `_id`.
 */
export default function SearchableEmployeeSelect({
    employees = [],
    value = '',
    onChange,
    disabled = false,
    placeholder = 'Select employee',
    className = '',
}) {
    const options = useMemo(
        () =>
            (employees || [])
                .map((emp) => {
                    const id = String(emp?._id || emp?.id || '').trim();
                    if (!id) return null;
                    return {
                        value: id,
                        label: employeeLabel(emp),
                    };
                })
                .filter(Boolean),
        [employees],
    );

    const selected = useMemo(
        () => options.find((opt) => opt.value === String(value || '')) || null,
        [options, value],
    );

    return (
        <div className={`min-w-0 flex-1 ${className}`.trim()}>
            <Select
                options={options}
                value={selected}
                onChange={(opt) => onChange?.(opt?.value || '')}
                isDisabled={disabled}
                isClearable
                isSearchable
                placeholder={placeholder}
                styles={compactSelectStyles}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                menuPosition="fixed"
                noOptionsMessage={() => 'No employees found'}
            />
        </div>
    );
}
