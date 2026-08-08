'use client';

import { companyPayPartyLabel } from '../utils/vehicleInitiatePayValidation';

/** Same borderless select look as employee liability rows. */
export const companyPayPartySelectClassName =
    'min-h-[40px] w-full max-w-[280px] appearance-none border-0 bg-transparent px-0 py-2 text-sm font-semibold text-gray-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:text-gray-500';

/**
 * Single-company selector for Company payment (one company only).
 * Styled like the employee name select under Employee payment.
 */
export default function VehicleCompanyPayPartySelect({
    companies = [],
    value = '',
    onChange,
    disabled = false,
    className = '',
    placeholder = 'Select company',
    error = false,
}) {
    return (
        <select
            className={
                className ||
                `${companyPayPartySelectClassName} ${error ? 'text-amber-700' : ''}`
            }
            value={value || ''}
            disabled={disabled}
            onChange={(event) => {
                const id = String(event.target.value || '').trim();
                const match = (Array.isArray(companies) ? companies : []).find(
                    (row) => String(row?._id || row?.id || '').trim() === id,
                );
                onChange?.({
                    companyPayPartyId: id,
                    companyPayPartyName: companyPayPartyLabel(match),
                });
            }}
        >
            <option value="">{placeholder}</option>
            {(Array.isArray(companies) ? companies : []).map((comp) => {
                const id = String(comp?._id || comp?.id || '').trim();
                if (!id) return null;
                const label = companyPayPartyLabel(comp);
                if (!label) return null;
                return (
                    <option key={id} value={id}>
                        {label}
                    </option>
                );
            })}
        </select>
    );
}
