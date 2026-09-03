'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Loader2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import NavButton from '@/components/NavButton';
import { formatAed as formatAedMoney, salarySlipMonthHref } from './salarySlipEdit';

const ROW_GRID =
    'grid w-full min-w-[720px] items-center gap-x-3 ' +
    'grid-cols-[1.5rem_minmax(6.5rem,0.9fr)_4.5rem_minmax(6rem,1fr)_minmax(6rem,1fr)_minmax(6rem,1fr)_minmax(6.5rem,1.1fr)_4.25rem]';

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
        <section className="rounded-[12px] border border-[#E6EAF0] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-5">
            <div className="mb-3">
                <h3 className="text-[15px] font-semibold text-[#0F172A]">Salary months</h3>
                <p className="mt-0.5 text-[12px] text-[#64748B]">
                    Open a month to view and edit that salary slip.
                </p>
            </div>

            {listLoading ? (
                <div className="flex min-h-[240px] items-center justify-center rounded-lg bg-[#F8FAFC]">
                    <Loader2 className="animate-spin text-blue-600" size={28} />
                </div>
            ) : listError ? (
                <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-6 text-sm text-red-600">
                    {listError}
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <div
                        className={`${ROW_GRID} border-b border-[#EEF2F6] px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]`}
                    >
                        <span />
                        <span>Month</span>
                        <span>Year</span>
                        <span className="text-right">Salary</span>
                        <span className="text-right">Deduction</span>
                        <span className="text-right">Extra</span>
                        <span className="text-right">Total salary</span>
                        <span className="text-center">Type</span>
                    </div>
                    {months.length === 0 ? (
                        <div className="px-2 py-8 text-center text-sm text-[#64748B]">
                            No salary months yet for this employee.
                        </div>
                    ) : (
                        <div className="divide-y divide-[#F1F5F9]">
                            {months.map((row) => {
                                const slipHref = salarySlipMonthHref(employeeId, row.monthKey);
                                return (
                                    <NavButton
                                        key={row.monthKey}
                                        href={slipHref}
                                        router={router}
                                        listReturnHref={listReturnHref}
                                        className={`${ROW_GRID} cursor-pointer px-2 py-3 text-left text-[13px] text-[#334155] no-underline hover:bg-slate-50`}
                                    >
                                        <ChevronRight size={16} className="text-[#94A3B8]" />
                                        <span className="font-semibold text-[#0F172A]">{row.month || '—'}</span>
                                        <span className="tabular-nums">{row.year || '—'}</span>
                                        <span className="tabular-nums text-right font-semibold">
                                            {formatAed(row.salary)}
                                        </span>
                                        <span className="tabular-nums text-right text-[#64748B]">
                                            {formatAed(row.deduction)}
                                        </span>
                                        <span className="tabular-nums text-right text-[#64748B]">
                                            {formatAed(row.extra)}
                                        </span>
                                        <span className="tabular-nums text-right font-semibold text-[#0F172A]">
                                            {formatAed(row.totalSalary)}
                                        </span>
                                        <span className="flex justify-center">
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${typeTone(row.type)}`}
                                            >
                                                {row.type || 'Cash'}
                                            </span>
                                        </span>
                                    </NavButton>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
