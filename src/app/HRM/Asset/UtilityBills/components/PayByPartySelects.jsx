'use client';

import { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import axiosInstance from '@/utils/axios';

function isActiveProfileEmployee(emp) {
    const profile = String(emp?.profileStatus || '').trim().toLowerCase();
    const approval = String(emp?.profileApprovalStatus || '').trim().toLowerCase();
    const workflow = String(emp?.profileWorkflow?.status || '').trim().toLowerCase();
    return profile === 'active' || approval === 'active' || workflow === 'active';
}

function isActiveCompany(row) {
    return String(row?.status || '').trim().toLowerCase() === 'active';
}

export function employeeOptionLabel(emp) {
    const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Employee';
    return emp.employeeId ? `${name} (${emp.employeeId})` : name;
}

/** Short label for allocation badges / compact UI. */
export function employeeShortLabel(emp) {
    return String(emp?.firstName || '').trim() || employeeOptionLabel(emp).split(/\s+/)[0] || 'Employee';
}

export function companyOptionLabel(comp) {
    const nick = String(comp?.nickName || '').trim();
    const name = nick || comp.name || 'Company';
    return comp.companyId ? `${name} (${comp.companyId})` : name;
}

export function companyShortLabel(comp) {
    return (
        String(comp?.nickName || '').trim() ||
        String(comp?.name || '')
            .trim()
            .replace(/\s*\([^)]*\)\s*$/g, '')
            .trim() ||
        'Company'
    );
}

const selectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: 38,
        borderRadius: 8,
        borderColor: state.isFocused ? '#14b8a6' : '#e5e7eb',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(20, 184, 166, 0.25)' : 'none',
        '&:hover': { borderColor: state.isFocused ? '#14b8a6' : '#9ca3af' },
        fontSize: 13,
        backgroundColor: state.isDisabled ? '#f3f4f6' : '#fff',
    }),
    menu: (base) => ({ ...base, zIndex: 9999 }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};

/**
 * Load active companies + employees once for Contract Paid By party dropdowns.
 */
export function usePayByPartyOptions(enabled = true) {
    const [employees, setEmployees] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!enabled) return undefined;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const [empRes, compRes] = await Promise.all([
                    axiosInstance.get('/employee', {
                        params: { profileStatus: 'active', limit: 1000 },
                        skipToast: true,
                    }),
                    axiosInstance.get('/Company', {
                        params: { status: 'Active' },
                        skipToast: true,
                    }),
                ]);
                if (cancelled) return;
                setEmployees(empRes.data?.employees || []);
                setCompanies(compRes.data?.companies || compRes.data || []);
            } catch {
                if (!cancelled) {
                    setEmployees([]);
                    setCompanies([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [enabled]);

    const employeeOptions = useMemo(
        () =>
            (employees || []).filter(isActiveProfileEmployee).map((emp) => {
                const companyRef = emp.company;
                const companyMongoId = String(
                    companyRef?._id || companyRef?.id || companyRef || '',
                ).trim();
                return {
                    value: String(emp._id),
                    label: employeeOptionLabel(emp),
                    employeeId: emp.employeeId || '',
                    firstName: String(emp.firstName || '').trim(),
                    shortLabel: employeeShortLabel(emp),
                    companyMongoId,
                    companyName: String(
                        emp.companyNickName ||
                            companyRef?.nickName ||
                            emp.companyName ||
                            companyRef?.name ||
                            '',
                    ).trim(),
                };
            }),
        [employees],
    );

    const companyOptions = useMemo(
        () =>
            (companies || []).filter(isActiveCompany).map((comp) => ({
                value: String(comp._id),
                label: companyOptionLabel(comp),
                companyId: comp.companyId || '',
                nickName: String(comp.nickName || '').trim(),
                shortLabel: companyShortLabel(comp),
            })),
        [companies],
    );

    return { employeeOptions, companyOptions, loading };
}

/**
 * Under Contract Paid By: searchable Company / Employee name select.
 */
export default function PayByPartySelects({
    payBy = '',
    disabled = false,
    payByCompanyId = '',
    payByEmployeeId = '',
    companyOptions = [],
    employeeOptions = [],
    onChange,
}) {
    const showCompany = payBy === 'company';
    const showEmployee = payBy === 'employee' || payBy === 'employee_balance';

    if (!showCompany && !showEmployee) return null;

    const selectedCompany =
        companyOptions.find((o) => String(o.value) === String(payByCompanyId || '')) || null;
    const selectedEmployee =
        employeeOptions.find((o) => String(o.value) === String(payByEmployeeId || '')) || null;

    return (
        <div className="space-y-3">
            {showCompany ? (
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Company name
                    </label>
                    <Select
                        value={selectedCompany}
                        onChange={(opt) => {
                            onChange?.({
                                payByCompanyId: opt?.value || '',
                                payByCompanyName: opt?.shortLabel || opt?.nickName || opt?.label || '',
                            });
                        }}
                        options={companyOptions}
                        placeholder="Search company..."
                        isClearable
                        isSearchable
                        isDisabled={disabled}
                        styles={selectStyles}
                        menuPortalTarget={
                            typeof document !== 'undefined' ? document.body : null
                        }
                        noOptionsMessage={() => 'No active companies found'}
                    />
                </div>
            ) : null}
            {showEmployee ? (
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Employee name
                    </label>
                    <Select
                        value={selectedEmployee}
                        onChange={(opt) => {
                            onChange?.({
                                payByEmployeeId: opt?.value || '',
                                payByEmployeeName: opt?.shortLabel || opt?.firstName || opt?.label || '',
                            });
                        }}
                        options={employeeOptions}
                        placeholder="Search employee..."
                        isClearable
                        isSearchable
                        isDisabled={disabled}
                        styles={selectStyles}
                        menuPortalTarget={
                            typeof document !== 'undefined' ? document.body : null
                        }
                        noOptionsMessage={() => 'No active employees found'}
                    />
                </div>
            ) : null}
        </div>
    );
}
