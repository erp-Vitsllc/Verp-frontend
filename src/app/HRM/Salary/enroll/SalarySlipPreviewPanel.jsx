'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Loader2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import NavButton, { getNavClickHandlers } from '@/components/NavButton';
import { formatAed as formatAedMoney, salarySlipMonthHref } from './salarySlipEdit';

const TH =
    'whitespace-nowrap px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 sm:px-4 sm:text-xs';
const TD = 'whitespace-nowrap px-3 py-2.5 align-middle sm:px-4';

const FIELD =
    'h-11 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';
const FIELD_RO =
    'h-11 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm text-[#0F172A] outline-none';

function formatAed(value) {
    const n = Number(value) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function displayValue(value) {
    if (value == null || value === '') return '';
    return String(value);
}

function typeTone(type) {
    return String(type || '').toUpperCase() === 'WPS'
        ? 'bg-emerald-50 text-emerald-700'
        : 'bg-rose-50 text-rose-700';
}

function FieldLabel({ children }) {
    return <span className="mb-1.5 block text-[12px] font-medium text-[#64748B]">{children}</span>;
}

function SlipField({ label, value, onChange, readOnly, type = 'text' }) {
    const isNumber = type === 'number';
    return (
        <label className="block min-w-0">
            <FieldLabel>{label}</FieldLabel>
            <input
                readOnly={readOnly}
                type={isNumber ? 'number' : 'text'}
                step={isNumber ? '0.01' : undefined}
                value={isNumber ? value ?? '' : displayValue(value)}
                onChange={onChange ? (e) => onChange(e.target.value) : undefined}
                className={readOnly ? FIELD_RO : FIELD}
            />
        </label>
    );
}

function SectionTitle({ children }) {
    return (
        <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748B]">
            {children}
        </h4>
    );
}

export function SalarySlipFields({ slip, onPatch }) {
    const att = slip?.attendance || {};
    const earnings = Array.isArray(slip?.earnings) ? slip.earnings : [];
    const deductions = Array.isArray(slip?.deductions) ? slip.deductions : [];
    const attendanceDeductions = Array.isArray(slip?.attendanceDeductions) ? slip.attendanceDeductions : [];
    const loans = Array.isArray(slip?.loanSchedule) ? slip.loanSchedule : [];
    const fines = Array.isArray(slip?.fines) ? slip.fines : [];
    const utilities = Array.isArray(slip?.utilities) ? slip.utilities : [];
    const recon = slip?.reconciliation || {};

    return (
        <div className="space-y-5 rounded-lg border border-[#E6EAF0] bg-white p-4">
            <div>
                <SectionTitle>Employee & attendance summary</SectionTitle>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <SlipField
                        label="Slip ref"
                        value={slip.slipRef}
                        onChange={(value) => onPatch('payment', (draft) => ({ ...draft, slipRef: value }))}
                    />
                    <SlipField
                        label="Calendar days"
                        value={att.calendarDays}
                        onChange={(value) =>
                            onPatch('attendance', (draft) => ({
                                ...draft,
                                attendance: { ...draft.attendance, calendarDays: value },
                            }))
                        }
                    />
                    <SlipField
                        label="Holidays"
                        value={att.holidays}
                        onChange={(value) =>
                            onPatch('attendance', (draft) => ({
                                ...draft,
                                attendance: { ...draft.attendance, holidays: value },
                            }))
                        }
                    />
                    <SlipField
                        label="Working day leaves"
                        value={att.workingDayLeaves}
                        onChange={(value) =>
                            onPatch('attendance', (draft) => ({
                                ...draft,
                                attendance: { ...draft.attendance, workingDayLeaves: value },
                            }))
                        }
                    />
                    <SlipField
                        label="Present days"
                        value={att.presentDays}
                        onChange={(value) =>
                            onPatch('attendance', (draft) => ({
                                ...draft,
                                attendance: { ...draft.attendance, presentDays: value },
                            }))
                        }
                    />
                    <SlipField
                        label="Holidays worked"
                        value={att.holidaysWorked}
                        onChange={(value) =>
                            onPatch('attendance', (draft) => ({
                                ...draft,
                                attendance: { ...draft.attendance, holidaysWorked: value },
                            }))
                        }
                    />
                    <SlipField
                        label="Overtime hours"
                        value={att.overtimeHours}
                        onChange={(value) =>
                            onPatch('attendance', (draft) => ({
                                ...draft,
                                attendance: { ...draft.attendance, overtimeHours: value },
                            }))
                        }
                    />
                    <SlipField
                        label="Comp off leave"
                        value={att.compOffLeave}
                        onChange={(value) =>
                            onPatch('attendance', (draft) => ({
                                ...draft,
                                attendance: { ...draft.attendance, compOffLeave: value },
                            }))
                        }
                    />
                </div>
            </div>

            <div>
                <SectionTitle>Earnings</SectionTitle>
                <div className="space-y-3">
                    {earnings.map((row, index) => (
                        <div key={`earn-${index}`} className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <SlipField
                                label="Component"
                                value={row.component}
                                onChange={(value) =>
                                    onPatch('earnings', (draft) => {
                                        const next = [...(draft.earnings || [])];
                                        next[index] = { ...next[index], component: value };
                                        return { ...draft, earnings: next };
                                    })
                                }
                            />
                            <SlipField
                                label="Basis"
                                value={row.basis}
                                onChange={(value) =>
                                    onPatch('earnings', (draft) => {
                                        const next = [...(draft.earnings || [])];
                                        next[index] = { ...next[index], basis: value };
                                        return { ...draft, earnings: next };
                                    })
                                }
                            />
                            <SlipField
                                label="Amount (AED)"
                                type="number"
                                value={row.amount}
                                onChange={(value) =>
                                    onPatch('earnings', (draft) => {
                                        const next = [...(draft.earnings || [])];
                                        next[index] = { ...next[index], amount: value };
                                        return { ...draft, earnings: next };
                                    })
                                }
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <SectionTitle>Deductions</SectionTitle>
                <div className="space-y-3">
                    {deductions.map((row, index) => (
                        <div key={`ded-${index}`} className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <SlipField
                                label="Component"
                                value={row.component}
                                onChange={(value) =>
                                    onPatch('deductions', (draft) => {
                                        const next = [...(draft.deductions || [])];
                                        next[index] = { ...next[index], component: value };
                                        return { ...draft, deductions: next };
                                    })
                                }
                            />
                            <SlipField
                                label="Basis"
                                value={row.basis}
                                onChange={(value) =>
                                    onPatch('deductions', (draft) => {
                                        const next = [...(draft.deductions || [])];
                                        next[index] = { ...next[index], basis: value };
                                        return { ...draft, deductions: next };
                                    })
                                }
                            />
                            <SlipField
                                label="Amount (AED)"
                                type="number"
                                value={row.amount}
                                onChange={(value) =>
                                    onPatch('deductions', (draft) => {
                                        const next = [...(draft.deductions || [])];
                                        next[index] = { ...next[index], amount: value };
                                        return { ...draft, deductions: next };
                                    })
                                }
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <SectionTitle>Salary totals</SectionTitle>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <SlipField label="Gross earnings" readOnly value={formatAedMoney(slip.grossEarnings)} />
                    <SlipField label="Total deductions" readOnly value={formatAedMoney(slip.totalDeductions)} />
                    <SlipField label="Net salary" readOnly value={formatAedMoney(slip.netSalary)} />
                    <SlipField label="Amount in words" readOnly value={slip.amountInWords} />
                    <SlipField
                        label="Payment method"
                        value={slip.paymentMethod}
                        onChange={(value) => onPatch('payment', (draft) => ({ ...draft, paymentMethod: value }))}
                    />
                    <SlipField
                        label="Payment date"
                        value={slip.paymentDate}
                        onChange={(value) => onPatch('payment', (draft) => ({ ...draft, paymentDate: value }))}
                    />
                    <SlipField
                        label="Currency"
                        value={slip.currency}
                        onChange={(value) => onPatch('payment', (draft) => ({ ...draft, currency: value }))}
                    />
                </div>
            </div>

            <div>
                <SectionTitle>Attendance-based deductions</SectionTitle>
                <div className="space-y-3">
                    {attendanceDeductions.map((row, index) => (
                        <div key={`att-ded-${index}`} className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
                            <SlipField
                                label="Category"
                                value={row.category}
                                onChange={(value) =>
                                    onPatch('attendanceDeductions', (draft) => {
                                        const next = [...(draft.attendanceDeductions || [])];
                                        next[index] = { ...next[index], category: value };
                                        return { ...draft, attendanceDeductions: next };
                                    })
                                }
                            />
                            <SlipField
                                label="Qty"
                                value={row.qty}
                                onChange={(value) =>
                                    onPatch('attendanceDeductions', (draft) => {
                                        const next = [...(draft.attendanceDeductions || [])];
                                        next[index] = { ...next[index], qty: value };
                                        return { ...draft, attendanceDeductions: next };
                                    })
                                }
                            />
                            <SlipField
                                label="Rate / unit"
                                value={row.rate}
                                onChange={(value) =>
                                    onPatch('attendanceDeductions', (draft) => {
                                        const next = [...(draft.attendanceDeductions || [])];
                                        next[index] = { ...next[index], rate: value };
                                        return { ...draft, attendanceDeductions: next };
                                    })
                                }
                            />
                            <SlipField
                                label="Calculation / reason"
                                value={row.calculation}
                                onChange={(value) =>
                                    onPatch('attendanceDeductions', (draft) => {
                                        const next = [...(draft.attendanceDeductions || [])];
                                        next[index] = { ...next[index], calculation: value };
                                        return { ...draft, attendanceDeductions: next };
                                    })
                                }
                            />
                            <SlipField
                                label="Total (AED)"
                                type="number"
                                value={row.total}
                                onChange={(value) =>
                                    onPatch('attendanceDeductions', (draft) => {
                                        const next = [...(draft.attendanceDeductions || [])];
                                        next[index] = { ...next[index], total: value };
                                        return { ...draft, attendanceDeductions: next };
                                    })
                                }
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <SectionTitle>Salary advance & loan schedule</SectionTitle>
                <div className="space-y-3">
                    {loans.map((row, index) => (
                        <div key={`loan-${index}`} className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                            <SlipField
                                label="Type"
                                value={row.type}
                                onChange={(value) =>
                                    onPatch('loans', (draft) => {
                                        const next = [...(draft.loanSchedule || [])];
                                        next[index] = { ...next[index], type: value };
                                        return { ...draft, loanSchedule: next };
                                    })
                                }
                            />
                            <SlipField
                                label="Original amount"
                                value={row.original}
                                onChange={(value) =>
                                    onPatch('loans', (draft) => {
                                        const next = [...(draft.loanSchedule || [])];
                                        next[index] = { ...next[index], original: value };
                                        return { ...draft, loanSchedule: next };
                                    })
                                }
                            />
                            <SlipField
                                label="This month"
                                type="number"
                                value={row.thisMonthAmount}
                                onChange={(value) =>
                                    onPatch('loans', (draft) => {
                                        const next = [...(draft.loanSchedule || [])];
                                        next[index] = { ...next[index], thisMonthAmount: value, thisMonth: value };
                                        return { ...draft, loanSchedule: next };
                                    })
                                }
                            />
                            <SlipField
                                label="Paid to date"
                                value={row.paidToDate}
                                onChange={(value) =>
                                    onPatch('loans', (draft) => {
                                        const next = [...(draft.loanSchedule || [])];
                                        next[index] = { ...next[index], paidToDate: value };
                                        return { ...draft, loanSchedule: next };
                                    })
                                }
                            />
                            <SlipField
                                label="Remaining"
                                value={row.remaining}
                                onChange={(value) =>
                                    onPatch('loans', (draft) => {
                                        const next = [...(draft.loanSchedule || [])];
                                        next[index] = { ...next[index], remaining: value };
                                        return { ...draft, loanSchedule: next };
                                    })
                                }
                            />
                            <SlipField
                                label="Deduction schedule"
                                value={row.schedule}
                                onChange={(value) =>
                                    onPatch('loans', (draft) => {
                                        const next = [...(draft.loanSchedule || [])];
                                        next[index] = { ...next[index], schedule: value };
                                        return { ...draft, loanSchedule: next };
                                    })
                                }
                            />
                        </div>
                    ))}
                </div>
            </div>

            {fines.length ? (
                <div>
                    <SectionTitle>Fine details</SectionTitle>
                    <div className="space-y-3">
                        {fines.map((row, index) => (
                            <div key={`fine-${index}`} className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                                <SlipField
                                    label="Fine type"
                                    value={row.type}
                                    onChange={(value) =>
                                        onPatch('fines', (draft) => {
                                            const next = [...(draft.fines || [])];
                                            next[index] = { ...next[index], type: value };
                                            return { ...draft, fines: next };
                                        })
                                    }
                                />
                                <SlipField
                                    label="Fine amount"
                                    value={row.amount}
                                    onChange={(value) =>
                                        onPatch('fines', (draft) => {
                                            const next = [...(draft.fines || [])];
                                            next[index] = { ...next[index], amount: value };
                                            return { ...draft, fines: next };
                                        })
                                    }
                                />
                                <SlipField
                                    label="Deduction schedule"
                                    value={row.schedule}
                                    onChange={(value) =>
                                        onPatch('fines', (draft) => {
                                            const next = [...(draft.fines || [])];
                                            next[index] = { ...next[index], schedule: value };
                                            return { ...draft, fines: next };
                                        })
                                    }
                                />
                                <SlipField
                                    label="This month"
                                    type="number"
                                    value={row.thisMonthAmount}
                                    onChange={(value) =>
                                        onPatch('fines', (draft) => {
                                            const next = [...(draft.fines || [])];
                                            next[index] = { ...next[index], thisMonthAmount: value, thisMonth: value };
                                            return { ...draft, fines: next };
                                        })
                                    }
                                />
                                <SlipField
                                    label="Paid"
                                    value={row.paid}
                                    onChange={(value) =>
                                        onPatch('fines', (draft) => {
                                            const next = [...(draft.fines || [])];
                                            next[index] = { ...next[index], paid: value };
                                            return { ...draft, fines: next };
                                        })
                                    }
                                />
                                <SlipField
                                    label="Unpaid / status"
                                    value={row.unpaidStatus}
                                    onChange={(value) =>
                                        onPatch('fines', (draft) => {
                                            const next = [...(draft.fines || [])];
                                            next[index] = { ...next[index], unpaidStatus: value };
                                            return { ...draft, fines: next };
                                        })
                                    }
                                />
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {utilities.length ? (
                <div>
                    <SectionTitle>Utility excess details</SectionTitle>
                    <div className="space-y-3">
                        {utilities.map((row, index) => (
                            <div key={`util-${index}`} className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                                <SlipField
                                    label="Utility details"
                                    value={row.details}
                                    onChange={(value) =>
                                        onPatch('utilities', (draft) => {
                                            const next = [...(draft.utilities || [])];
                                            next[index] = { ...next[index], details: value };
                                            return { ...draft, utilities: next };
                                        })
                                    }
                                />
                                <SlipField
                                    label="Amount"
                                    value={row.amount}
                                    onChange={(value) =>
                                        onPatch('utilities', (draft) => {
                                            const next = [...(draft.utilities || [])];
                                            next[index] = { ...next[index], amount: value };
                                            return { ...draft, utilities: next };
                                        })
                                    }
                                />
                                <SlipField
                                    label="Deduction reason"
                                    value={row.reason}
                                    onChange={(value) =>
                                        onPatch('utilities', (draft) => {
                                            const next = [...(draft.utilities || [])];
                                            next[index] = { ...next[index], reason: value };
                                            return { ...draft, utilities: next };
                                        })
                                    }
                                />
                                <SlipField
                                    label="Total (AED)"
                                    type="number"
                                    value={row.total}
                                    onChange={(value) =>
                                        onPatch('utilities', (draft) => {
                                            const next = [...(draft.utilities || [])];
                                            next[index] = { ...next[index], total: value };
                                            return { ...draft, utilities: next };
                                        })
                                    }
                                />
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            <div>
                <SectionTitle>Deduction reconciliation</SectionTitle>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <SlipField label="Attendance" readOnly value={formatAedMoney(recon.attendance)} />
                    <SlipField label="Salary advance" readOnly value={formatAedMoney(recon.salaryAdvance)} />
                    <SlipField label="Loan" readOnly value={formatAedMoney(recon.loan)} />
                    <SlipField label="Fine" readOnly value={formatAedMoney(recon.fine)} />
                    <SlipField label="Utility excess" readOnly value={formatAedMoney(recon.utilityExcess)} />
                    <SlipField label="Verified total deductions" readOnly value={formatAedMoney(recon.verifiedTotal)} />
                </div>
            </div>
        </div>
    );
}

export default function SalarySlipPreviewPanel({ employeeId }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [months, setMonths] = useState([]);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState('');
    const query = searchParams?.toString() || '';
    const currentHref = `${pathname}${query ? `?${query}` : ''}`;
    const enrollSlipHref = `/HRM/Salary/enroll/${encodeURIComponent(employeeId)}?tab=slip`;
    const listReturnHref = /\/HRM\/Salary\/enroll\//.test(pathname || '') ? enrollSlipHref : currentHref;

    useEffect(() => {
        if (!employeeId) return undefined;
        let cancelled = false;

        async function loadMonths() {
            setListLoading(true);
            setListError('');
            setMonths([]);
            try {
                const res = await axiosInstance.get(
                    `/Employee/salary-enroll/${encodeURIComponent(employeeId)}/historical/salary-slips`,
                    { skipToast: true },
                );
                if (cancelled) return;
                setMonths(Array.isArray(res.data?.months) ? res.data.months : []);
            } catch (err) {
                if (!cancelled) {
                    setListError(err?.response?.data?.message || 'Could not load salary months.');
                }
            } finally {
                if (!cancelled) setListLoading(false);
            }
        }

        loadMonths();
        return () => {
            cancelled = true;
        };
    }, [employeeId]);

    return (
        <section className="w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-[#0F172A]">Salary months</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                    Open a month to view and edit that salary slip.
                </p>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] table-auto text-xs sm:text-sm">
                    <thead className="sticky top-0 border-b border-gray-200 bg-gray-50">
                        <tr>
                            <th className={`${TH} text-left`}>Month</th>
                            <th className={`${TH} text-left`}>Year</th>
                            <th className={`${TH} text-right`}>Monthly Salary</th>
                            <th className={`${TH} text-right`}>Deduction</th>
                            <th className={`${TH} text-right`}>Extra</th>
                            <th className={`${TH} text-right`}>Net Salary</th>
                            <th className={`${TH} text-center`}>Type</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {listLoading ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-16 text-center text-slate-500">
                                    <Loader2 size={20} className="inline animate-spin text-blue-600" />
                                </td>
                            </tr>
                        ) : listError ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-10 text-center text-sm text-red-600">
                                    {listError}
                                </td>
                            </tr>
                        ) : months.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-16 text-center text-slate-500">
                                    No salary months yet for this employee.
                                </td>
                            </tr>
                        ) : (
                            months.map((row) => {
                                const slipHref = salarySlipMonthHref(employeeId, row.monthKey);
                                return (
                                    <tr
                                        key={row.monthKey}
                                        className="cursor-pointer text-[#334155] hover:bg-slate-50"
                                        {...getNavClickHandlers({
                                            href: slipHref,
                                            router,
                                            listReturnHref,
                                        })}
                                    >
                                        <td className={`${TD} font-semibold text-[#0F172A]`}>
                                            <NavButton
                                                href={slipHref}
                                                router={router}
                                                listReturnHref={listReturnHref}
                                                className="inline-flex items-center gap-1 text-inherit no-underline"
                                            >
                                                {row.month || '—'}
                                                <ChevronRight size={14} className="text-slate-300" />
                                            </NavButton>
                                        </td>
                                        <td className={`${TD} tabular-nums text-slate-500`}>
                                            {row.year || '—'}
                                        </td>
                                        <td className={`${TD} text-right tabular-nums text-[#0F172A]`}>
                                            {formatAed(row.salary)}
                                        </td>
                                        <td className={`${TD} text-right tabular-nums text-slate-500`}>
                                            {formatAed(row.deduction)}
                                        </td>
                                        <td className={`${TD} text-right tabular-nums text-slate-500`}>
                                            {formatAed(row.extra)}
                                        </td>
                                        <td className={`${TD} text-right tabular-nums font-semibold text-[#0F172A]`}>
                                            {formatAed(row.totalSalary)}
                                        </td>
                                        <td className={`${TD} text-center`}>
                                            <span
                                                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${typeTone(row.type)}`}
                                            >
                                                {row.type || 'Cash'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
