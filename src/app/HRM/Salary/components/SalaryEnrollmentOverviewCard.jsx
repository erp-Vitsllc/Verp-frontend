'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { getNavClickHandlers } from '@/components/NavButton';
import { HEADER_PAIR_CARD_DASHBOARD, HEADER_PAIR_CARD_PADDING } from '@/utils/headerPairLayout';

const COLS = 4;
const ROWS = 2;
const MAX_BOXES = COLS * ROWS;

function sameCompanyId(left, right) {
    return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}

function employeesForCompany(employees, company) {
    const companyId = String(company?.companyId || '').trim();
    const companyName = String(company?.name || '').trim().toLowerCase();
    return (employees || []).filter((emp) => {
        if (companyId && emp?.companyId && sameCompanyId(emp.companyId, companyId)) return true;
        if (companyId === 'unassigned') {
            return !emp?.companyId || sameCompanyId(emp.companyId, 'unassigned') || !String(emp?.companyName || '').trim();
        }
        return String(emp?.companyName || '').trim().toLowerCase() === companyName;
    });
}

function StatusBadge({ enrolled }) {
    return (
        <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                enrolled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}
        >
            {enrolled ? 'Enrolled' : 'Pending'}
        </span>
    );
}

function CompanyEmployeesModal({ company, mode, employees, onClose }) {
    const router = useRouter();
    const enrolledOnly = mode === 'enrolled';
    const rows = useMemo(() => {
        const list = employeesForCompany(employees, company);
        const filtered = enrolledOnly ? list.filter((emp) => emp.enrolled) : list;
        return filtered.map((emp, index) => ({
            slNo: index + 1,
            employeeId: emp.employeeId,
            name: emp.name || emp.employeeId,
            enrolled: Boolean(emp.enrolled),
        }));
    }, [company, employees, enrolledOnly]);

    const title = enrolledOnly ? 'Enrolled employees' : 'Active employees';
    const emptyLabel = enrolledOnly
        ? 'No enrolled employees in this company.'
        : 'No active employees in this company.';

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4">
            <button
                type="button"
                className="absolute inset-0 bg-slate-900/30"
                aria-label="Close"
                onClick={onClose}
            />
            <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl bg-white shadow-2xl border border-gray-100">
                <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-gray-100">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                            {company?.name || 'Company'}
                        </p>
                        <h2 className="mt-1 text-base sm:text-lg font-bold text-slate-800">{title}</h2>
                        <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                            {rows.length} {rows.length === 1 ? 'employee' : 'employees'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                    <table className="w-full text-xs sm:text-sm">
                        <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-3 sm:px-4 py-2.5 text-left text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-600 w-14">
                                    SL
                                </th>
                                <th className="px-3 sm:px-4 py-2.5 text-left text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-600">
                                    Name
                                </th>
                                <th className="px-3 sm:px-4 py-2.5 text-left text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-600">
                                    ID
                                </th>
                                <th className="px-3 sm:px-4 py-2.5 text-left text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-600">
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                                        {emptyLabel}
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row) => {
                                    const href = `/HRM/Salary/enroll/${encodeURIComponent(row.employeeId)}`;
                                    return (
                                    <tr
                                        key={row.employeeId}
                                        className="hover:bg-slate-50 cursor-pointer"
                                        {...getNavClickHandlers({
                                            href,
                                            router,
                                            listReturnHref: '/HRM/Salary',
                                        })}
                                    >
                                        <td className="px-3 sm:px-4 py-2.5 tabular-nums text-slate-600">
                                            {row.slNo}
                                        </td>
                                        <td className="px-3 sm:px-4 py-2.5 font-medium text-slate-800">
                                            {row.name}
                                        </td>
                                        <td className="px-3 sm:px-4 py-2.5 tabular-nums text-slate-600">
                                            {row.employeeId}
                                        </td>
                                        <td className="px-3 sm:px-4 py-2.5">
                                            <StatusBadge enrolled={row.enrolled} />
                                        </td>
                                    </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function EnrollmentBox({ company, onOpenList, onSelectCompany, active }) {
    if (!company) {
        return (
            <div
                className="min-w-0 h-full rounded-lg border border-dashed border-gray-200 bg-gray-50/80"
                aria-hidden="true"
            />
        );
    }

    const enrolled = Number(company.enrolled) || 0;
    const total = Number(company.totalActive) || 0;

    return (
        <div
            className={`min-w-0 h-full rounded-lg border px-1.5 sm:px-2 py-2 flex flex-col items-center justify-center text-center overflow-hidden ${
                active
                    ? 'border-teal-200 bg-teal-50/70 ring-1 ring-teal-500/20'
                    : 'border-gray-100 bg-gray-50'
            }`}
        >
            <button
                type="button"
                className="text-[8px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-wide leading-tight w-full px-0.5 line-clamp-2 hover:text-teal-700"
                title={`Filter salary by ${company.name}`}
                onClick={() => onSelectCompany?.(company.name)}
            >
                {company.name}
            </button>
            <span className="mt-1 tabular-nums font-black text-[#0f766e] leading-none whitespace-nowrap text-sm sm:text-base lg:text-lg">
                <button
                    type="button"
                    className="hover:underline underline-offset-2"
                    title={`${company.name} enrolled employees`}
                    onClick={() => onOpenList?.(company, 'enrolled')}
                >
                    {enrolled}
                </button>
                <span className="text-slate-400 font-semibold"> / </span>
                <button
                    type="button"
                    className="text-slate-400 font-semibold hover:text-slate-600 hover:underline underline-offset-2"
                    title={`${company.name} active employees`}
                    onClick={() => onOpenList?.(company, 'active')}
                >
                    {total}
                </button>
            </span>
            <span className="mt-0.5 text-[8px] sm:text-[9px] font-semibold text-slate-400 uppercase tracking-wide">
                Enrolled / Active
            </span>
        </div>
    );
}

export default function SalaryEnrollmentOverviewCard({ overview, activeCompany = '', onSelectCompany }) {
    const companies = Array.isArray(overview?.companies) ? overview.companies : [];
    const employees = Array.isArray(overview?.employees) ? overview.employees : [];
    const boxes = [...companies.slice(0, MAX_BOXES)];
    while (boxes.length < MAX_BOXES) boxes.push(null);
    const [listState, setListState] = useState(null);

    return (
        <>
            <div
                className={`bg-white rounded-xl shadow-sm border border-gray-100 ${HEADER_PAIR_CARD_PADDING} ${HEADER_PAIR_CARD_DASHBOARD}`}
            >
                <div className="grid grid-cols-4 grid-rows-2 gap-2 sm:gap-3 flex-1 min-h-0">
                    {boxes.map((company, index) => (
                        <EnrollmentBox
                            key={company?.companyId || `empty-${index}`}
                            company={company}
                            active={Boolean(
                                company?.name &&
                                    String(company.name).trim().toLowerCase() ===
                                        String(activeCompany || '').trim().toLowerCase(),
                            )}
                            onSelectCompany={onSelectCompany}
                            onOpenList={(row, mode) => setListState({ company: row, mode })}
                        />
                    ))}
                </div>
            </div>
            {listState?.company ? (
                <CompanyEmployeesModal
                    company={listState.company}
                    mode={listState.mode}
                    employees={employees}
                    onClose={() => setListState(null)}
                />
            ) : null}
        </>
    );
}
