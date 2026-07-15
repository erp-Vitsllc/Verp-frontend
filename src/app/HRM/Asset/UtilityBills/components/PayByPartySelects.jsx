'use client';

import { useEffect, useMemo, useState } from 'react';
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

export function companyOptionLabel(comp) {
    const name = comp.name || 'Company';
    return comp.companyId ? `${name} (${comp.companyId})` : name;
}

/**
 * Load active companies + employees once for Pay By party dropdowns.
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
            (employees || []).filter(isActiveProfileEmployee).map((emp) => ({
                value: String(emp._id),
                label: employeeOptionLabel(emp),
                employeeId: emp.employeeId || '',
            })),
        [employees],
    );

    const companyOptions = useMemo(
        () =>
            (companies || []).filter(isActiveCompany).map((comp) => ({
                value: String(comp._id),
                label: companyOptionLabel(comp),
                companyId: comp.companyId || '',
            })),
        [companies],
    );

    return { employeeOptions, companyOptions, loading };
}

/**
 * Under Pay By: show Company name and/or Employee name select.
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

    const selectClass =
        'mt-1 w-full block rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs sm:text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500/40 disabled:bg-gray-100';

    return (
        <div className="space-y-3">
            {showCompany ? (
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Company name
                    </label>
                    <select
                        value={payByCompanyId || ''}
                        disabled={disabled}
                        onChange={(e) => {
                            const id = e.target.value;
                            const opt = companyOptions.find((o) => o.value === id);
                            onChange?.({
                                payByCompanyId: id,
                                payByCompanyName: opt?.label || '',
                            });
                        }}
                        className={selectClass}
                    >
                        <option value="">Select company</option>
                        {companyOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
            ) : null}
            {showEmployee ? (
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Employee name
                    </label>
                    <select
                        value={payByEmployeeId || ''}
                        disabled={disabled}
                        onChange={(e) => {
                            const id = e.target.value;
                            const opt = employeeOptions.find((o) => o.value === id);
                            onChange?.({
                                payByEmployeeId: id,
                                payByEmployeeName: opt?.label || '',
                            });
                        }}
                        className={selectClass}
                    >
                        <option value="">Select employee</option>
                        {employeeOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
            ) : null}
        </div>
    );
}
