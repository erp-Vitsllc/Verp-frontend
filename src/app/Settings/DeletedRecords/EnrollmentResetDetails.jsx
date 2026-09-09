'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, Eye } from 'lucide-react';

const LEAVE_LABELS = {
    sick: 'Sick Leave',
    authorized: 'Authorized',
    unauthorized: 'Unauthorized',
    annual: 'Annual Leave',
};

function prettyDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return '—';
    const iso = raw.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) return raw;
        return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    }
    const date = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function prettyMonth(value) {
    const raw = String(value || '').trim();
    const month = /^\d{4}-\d{2}/.test(raw) ? raw.slice(0, 7) : '';
    if (!month) return '—';
    const date = new Date(`${month}-01T00:00:00`);
    if (Number.isNaN(date.getTime())) return month;
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function money(amount, currency = 'AED') {
    const n = Number(amount);
    if (!Number.isFinite(n)) return `${currency} 0`;
    return `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function leaveLabel(type) {
    const key = String(type || '').toLowerCase();
    return LEAVE_LABELS[key] || (key ? key.replace(/_/g, ' ') : 'Leave');
}

function leaveSource(row) {
    const raw = String(row?.source || 'manual').toLowerCase();
    return raw === 'system' || raw === 'erp' ? 'System' : 'Manual';
}

function profileOf(snapshot) {
    if (snapshot?.profile && typeof snapshot.profile === 'object') return snapshot.profile;
    return snapshot || {};
}

function combinedLeaves(snapshot) {
    const leave = Array.isArray(snapshot?.leaveRecords) ? snapshot.leaveRecords : [];
    const annual = (Array.isArray(snapshot?.annualLeaveRecords) ? snapshot.annualLeaveRecords : []).map((row) => ({
        ...row,
        leaveType: row?.leaveType || 'annual',
        fromDate: row?.fromDate || row?.startDate || '',
        toDate: row?.toDate || row?.endDate || '',
    }));
    return [...leave, ...annual];
}

function hasLeaveSalary(cycle) {
    if (cycle && typeof cycle.includeLeave === 'boolean') return cycle.includeLeave;
    return Number(cycle?.leaveSalaryAmount ?? cycle?.leaveSalary) > 0;
}

function hasTicket(cycle) {
    if (cycle && typeof cycle.includeTicket === 'boolean') return cycle.includeTicket;
    return Number(cycle?.ticketAmount) > 0;
}

function DetailRows({ rows }) {
    return (
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {rows.map((row) => (
                <div key={row.label} className={row.wide ? 'sm:col-span-2' : ''}>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{row.label}</dt>
                    <dd className="mt-0.5 text-sm text-slate-800">{row.value || '—'}</dd>
                </div>
            ))}
        </dl>
    );
}

function RowTable({ columns, rows, empty, onOpen }) {
    if (!rows.length) {
        return <p className="px-3 py-6 text-center text-sm text-slate-400">{empty}</p>;
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {columns.map((col) => (
                            <th key={col} className="px-3 py-2 font-semibold">
                                {col}
                            </th>
                        ))}
                        <th className="px-3 py-2 font-semibold" />
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr
                            key={row.key}
                            className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer"
                            onClick={() => onOpen(row)}
                        >
                            {row.cells.map((cell, index) => (
                                <td key={`${row.key}-${index}`} className="px-3 py-2.5 text-slate-700">
                                    {cell}
                                </td>
                            ))}
                            <td className="px-3 py-2.5 text-right">
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onOpen(row);
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
                                >
                                    <Eye className="h-3.5 w-3.5" />
                                    Details
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function EnrollmentResetDetails({ snapshot }) {
    const [openRow, setOpenRow] = useState(null);
    const profile = profileOf(snapshot);
    const leaves = useMemo(() => combinedLeaves(snapshot), [snapshot]);
    const cycles = Array.isArray(snapshot?.paymentCycles) ? snapshot.paymentCycles : [];
    const slipMonths = Array.isArray(snapshot?.salarySlipMonths) ? snapshot.salarySlipMonths : [];

    const leaveRows = leaves.map((row, index) => ({
        key: `leave-${row._id || index}`,
        kind: 'leave',
        data: row,
        cells: [
            leaveLabel(row.leaveType),
            row.fromDate || row.toDate ? `${prettyDate(row.fromDate)} — ${prettyDate(row.toDate)}` : '—',
            `${Number(row.actualDays || row.eligibleWorkingDays || row.calendarDays) || 0} days`,
            leaveSource(row),
        ],
    }));

    const salaryRows = cycles.filter(hasLeaveSalary).map((row, index) => {
        const date = row.leaveSalaryPaymentDate || row.paymentDate || '';
        return {
            key: `salary-${row._id || index}`,
            kind: 'salary',
            data: row,
            cells: [
                prettyMonth(date),
                prettyDate(date),
                money(row.leaveSalaryAmount ?? row.leaveSalary, row.currency),
            ],
        };
    });

    const ticketRows = cycles.filter(hasTicket).map((row, index) => {
        const date = row.ticketPaymentDate || row.leaveSalaryPaymentDate || row.paymentDate || '';
        return {
            key: `ticket-${row._id || index}`,
            kind: 'ticket',
            data: row,
            cells: [
                prettyMonth(date),
                prettyDate(date),
                money(row.ticketAmount, row.currency),
            ],
        };
    });

    const monthRows = slipMonths.map((row, index) => ({
        key: `month-${row.monthKey || index}`,
        kind: 'month',
        data: row,
        cells: [prettyMonth(row.monthKey), row.monthKey || '—'],
    }));

    if (openRow) {
        const row = openRow.data || {};
        const titles = {
            leave: 'Leave details',
            salary: 'Leave salary details',
            ticket: 'Ticket payment details',
            month: 'Salary month details',
        };
        const fields =
            openRow.kind === 'leave'
                ? [
                      { label: 'Leave type', value: leaveLabel(row.leaveType) },
                      { label: 'Source', value: leaveSource(row) },
                      { label: 'From', value: prettyDate(row.fromDate || row.startDate) },
                      { label: 'To', value: prettyDate(row.toDate || row.endDate) },
                      { label: 'Actual days', value: String(row.actualDays || row.eligibleWorkingDays || row.calendarDays || 0) },
                      { label: 'Deduction days', value: String(row.deductionDays || row.deduction || 0) },
                      { label: 'Rule', value: `x ${row.multiplier ?? row.rule ?? 1}` },
                      { label: 'Status', value: row.status || '—' },
                      { label: 'Leave salary', value: money(row.leaveSalaryAmount, row.currency) },
                      { label: 'Ticket amount', value: money(row.ticketAmount, row.currency) },
                      { label: 'Remarks', value: row.remarks || '—', wide: true },
                  ]
                : openRow.kind === 'salary' || openRow.kind === 'ticket'
                  ? [
                        { label: 'Month', value: prettyMonth(row.leaveSalaryPaymentDate || row.ticketPaymentDate || row.paymentDate) },
                        { label: 'Cycle', value: row.cycleNumber ? String(row.cycleNumber) : '—' },
                        { label: 'Leave salary date', value: prettyDate(row.leaveSalaryPaymentDate || row.paymentDate) },
                        { label: 'Leave salary amount', value: money(row.leaveSalaryAmount ?? row.leaveSalary, row.currency) },
                        { label: 'Ticket payment date', value: prettyDate(row.ticketPaymentDate) },
                        { label: 'Ticket amount', value: money(row.ticketAmount, row.currency) },
                        { label: 'Eligibility', value: `${prettyDate(row.eligibilityStartDate)} — ${prettyDate(row.eligibilityEndDate)}` },
                        { label: 'Status', value: row.paymentStatus || row.status || '—' },
                        { label: 'Reference', value: row.paymentReference || '—' },
                        { label: 'Remarks', value: row.remarks || '—', wide: true },
                    ]
                  : [
                        { label: 'Month', value: prettyMonth(row.monthKey) },
                        { label: 'Month key', value: row.monthKey || '—' },
                        {
                            label: 'Net salary',
                            value: row.slip?.netSalary != null ? money(row.slip.netSalary, row.slip.currency) : '—',
                        },
                    ];
        return (
            <div className="space-y-4">
                <button
                    type="button"
                    onClick={() => setOpenRow(null)}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Back to enrolment details
                </button>
                <h3 className="text-base font-semibold text-slate-900">{titles[openRow.kind]}</h3>
                <DetailRows rows={fields} />
            </div>
        );
    }

    const period = snapshot?.period;
    const joining = profile.contractJoiningDate || snapshot?.contractJoiningDate || '';
    const verp = profile.verpStartDate || snapshot?.verpStartDate || '';

    return (
        <div className="space-y-5">
            <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Enrolment details</h3>
                <DetailRows
                    rows={[
                        { label: 'Employee', value: snapshot?.employeeName || snapshot?.employeeId },
                        { label: 'Employee ID', value: snapshot?.employeeId },
                        { label: 'Contract joining date', value: prettyDate(joining) },
                        { label: 'VERP salary start', value: prettyDate(verp) },
                        {
                            label: 'Historical period',
                            value:
                                period?.start && period?.end
                                    ? `${prettyDate(period.start)} — ${prettyDate(period.end)}`
                                    : '—',
                        },
                        { label: 'Company MOL code', value: profile.companyMolCode || '—' },
                        { label: 'Employee MOL ID', value: profile.employeeMolId || '—' },
                        { label: 'Salary slip', value: profile.salarySlip ? 'Checked' : 'Unchecked' },
                    ]}
                />
            </section>

            <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Leaves</h3>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                    <RowTable
                        columns={['Leave type', 'Period', 'Days', 'Source']}
                        rows={leaveRows}
                        empty="No leave records in this archive."
                        onOpen={setOpenRow}
                    />
                </div>
            </section>

            <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Leave salary</h3>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                    <RowTable
                        columns={['Month', 'Payment date', 'Amount']}
                        rows={salaryRows}
                        empty="No leave salary payments in this archive."
                        onOpen={setOpenRow}
                    />
                </div>
            </section>

            <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Ticket payments</h3>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                    <RowTable
                        columns={['Month', 'Payment date', 'Amount']}
                        rows={ticketRows}
                        empty="No ticket payments in this archive."
                        onOpen={setOpenRow}
                    />
                </div>
            </section>

            {monthRows.length ? (
                <section>
                    <h3 className="mb-2 text-sm font-semibold text-slate-900">Salary months</h3>
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                        <RowTable
                            columns={['Month', 'Key']}
                            rows={monthRows}
                            empty="No salary months in this archive."
                            onOpen={setOpenRow}
                        />
                    </div>
                </section>
            ) : null}
        </div>
    );
}
