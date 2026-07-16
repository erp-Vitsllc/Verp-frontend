'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import PayByPartySelects from './PayByPartySelects';

const PAY_BY_EMPLOYEE = 'employee';
const PAY_BY_COMPANY = 'company';
const PAY_BY_BOTH = 'employee_and_company';

export const PAY_BY_OPTIONS = [
    { value: PAY_BY_EMPLOYEE, label: 'Employee' },
    { value: PAY_BY_COMPANY, label: 'Company' },
];

function formatMoney(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '0.00';
    return num.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Short label for table cells — keep the column slim. */
export function payByShortLabel(payBy) {
    if (payBy === PAY_BY_EMPLOYEE) return 'Employee';
    if (payBy === PAY_BY_COMPANY) return 'Company';
    return 'Select';
}

export function resolveRowPayBy(row, { isUnder = false } = {}) {
    if (isUnder) return PAY_BY_COMPANY;
    const payBy = String(row?.payBy || '').trim();
    // Legacy "both" is no longer allowed — treat as unset
    if (payBy === PAY_BY_BOTH) return '';
    return payBy;
}

/** True when Contract Paid By + required party are filled (Company or Employee only). */
export function isPayByComplete(row, { isUnder = false } = {}) {
    const payBy = resolveRowPayBy(row, { isUnder });
    if (!payBy) return false;
    if (payBy === PAY_BY_COMPANY) {
        return Boolean(String(row?.payByCompanyId || '').trim());
    }
    if (payBy === PAY_BY_EMPLOYEE) {
        return Boolean(String(row?.payByEmployeeId || '').trim());
    }
    return false;
}

/** Map utility entry assignment onto Contract Paid By defaults. */
export function assignedPartyDefaults(entryOrRow = {}) {
    const typeRaw = String(entryOrRow?.assignedToType || '').trim();
    const id = String(entryOrRow?.assignedToId || '').trim();
    const name = String(
        entryOrRow?.assignedToName || entryOrRow?.assignedTo || '',
    ).trim();
    if (!id) {
        return {
            assignedToType: '',
            assignedToId: '',
            assignedToName: '',
            defaultPayBy: '',
        };
    }
    const assignedToType =
        typeRaw === 'Company' ? 'Company' : typeRaw === 'Employee' ? 'Employee' : '';
    return {
        assignedToType,
        assignedToId: id,
        assignedToName: name,
        defaultPayBy:
            assignedToType === 'Company'
                ? PAY_BY_COMPANY
                : assignedToType === 'Employee'
                  ? PAY_BY_EMPLOYEE
                  : '',
    };
}

function partyFromAssignment(payBy, assigned) {
    if (payBy === PAY_BY_COMPANY && assigned.assignedToType === 'Company') {
        return {
            payByCompanyId: assigned.assignedToId,
            payByCompanyName: assigned.assignedToName,
            payByEmployeeId: '',
            payByEmployeeName: '',
        };
    }
    if (payBy === PAY_BY_EMPLOYEE && assigned.assignedToType === 'Employee') {
        return {
            payByEmployeeId: assigned.assignedToId,
            payByEmployeeName: assigned.assignedToName,
            payByCompanyId: '',
            payByCompanyName: '',
        };
    }
    return null;
}

/**
 * Pre-fill Contract Paid By fields from the utility entry assignment.
 * Used so assigned company/employee appears by default and stays editable.
 */
export function payByFieldsFromAssignment(entryOrRow = {}) {
    const assigned = assignedPartyDefaults(entryOrRow);
    if (!assigned.defaultPayBy) {
        return {
            payBy: '',
            payByCompanyId: '',
            payByCompanyName: '',
            payByEmployeeId: '',
            payByEmployeeName: '',
        };
    }
    const party = partyFromAssignment(assigned.defaultPayBy, assigned) || {
        payByCompanyId: '',
        payByCompanyName: '',
        payByEmployeeId: '',
        payByEmployeeName: '',
    };
    return {
        payBy: assigned.defaultPayBy,
        payByCompanyId: party.payByCompanyId || '',
        payByCompanyName: party.payByCompanyName || '',
        payByEmployeeId: party.payByEmployeeId || '',
        payByEmployeeName: party.payByEmployeeName || '',
    };
}

function partyDisplayName(name, fallback) {
    const t = String(name || '').trim();
    if (!t) return fallback;
    // Prefer short label before "(ID)" when long
    const cut = t.indexOf(' (');
    return cut > 0 ? t.slice(0, cut) : t;
}

/** Short party name for the Contract Paid By table cell. */
export function payByPartyLabel(row = {}) {
    const payBy = String(row?.payBy || '').trim();
    if (payBy === PAY_BY_COMPANY) {
        return partyDisplayName(
            row?.payByCompanyName ||
                (row?.assignedToType === 'Company' ? row?.assignedToName : ''),
            '',
        );
    }
    if (payBy === PAY_BY_EMPLOYEE) {
        return partyDisplayName(
            row?.payByEmployeeName ||
                (row?.assignedToType === 'Employee' ? row?.assignedToName : ''),
            '',
        );
    }
    return partyDisplayName(row?.assignedToName || row?.assignedTo, '');
}

function PayBySummaryLine({ name, amount }) {
    const label = `${name}: ${formatMoney(amount)}`;
    return (
        <p
            className="text-xs font-semibold text-gray-800 whitespace-nowrap truncate leading-none"
            title={label}
        >
            <span className="font-bold">{name}</span>
            <span className="text-gray-500 font-medium">: </span>
            <span className="tabular-nums font-semibold text-gray-700">
                {formatMoney(amount)}
            </span>
        </p>
    );
}

/**
 * Summary after Contract Paid By is done — one line `{Name}: amount` + Edit.
 */
export function PayByDoneSummary({
    row,
    difference = 0,
    isUnder = false,
    disabled = false,
    onEdit,
}) {
    const payBy = resolveRowPayBy(row, { isUnder });
    const absDiff = Math.abs(Number(difference) || 0);
    const companyAmt = payBy === PAY_BY_COMPANY ? absDiff : 0;
    const employeeAmt = payBy === PAY_BY_EMPLOYEE ? absDiff : 0;

    const showCompany = payBy === PAY_BY_COMPANY;
    const showEmployee = payBy === PAY_BY_EMPLOYEE;
    const lineName = showCompany
        ? partyDisplayName(row?.payByCompanyName, 'Company')
        : showEmployee
          ? partyDisplayName(row?.payByEmployeeName, 'Employee')
          : '';
    const lineAmount = showCompany ? companyAmt : showEmployee ? employeeAmt : 0;

    if (!lineName) return null;

    return (
        <div className="flex flex-col items-center gap-1 w-full max-w-[11rem] mx-auto">
            <PayBySummaryLine name={lineName} amount={lineAmount} />
            {typeof onEdit === 'function' ? (
                <button
                    type="button"
                    disabled={disabled}
                    onClick={onEdit}
                    className="text-xs font-semibold text-teal-600 hover:text-teal-700 hover:underline disabled:opacity-40 disabled:no-underline"
                >
                    Edit
                </button>
            ) : null}
        </div>
    );
}

/**
 * Choose Contract Paid By (and company/employee party) in a modal.
 * Assigned party name is auto-filled when the utility entry is assigned.
 */
export default function PayByChoiceModal({
    isOpen,
    onClose,
    onConfirm,
    accountNo = '',
    differenceAmount = 0,
    initialPayBy = '',
    lockedPayBy = '',
    initialCompanyId = '',
    initialCompanyName = '',
    initialEmployeeId = '',
    initialEmployeeName = '',
    assignedToType = '',
    assignedToId = '',
    assignedToName = '',
    companyOptions = [],
    employeeOptions = [],
}) {
    const [payBy, setPayBy] = useState('');
    const [payByCompanyId, setPayByCompanyId] = useState('');
    const [payByCompanyName, setPayByCompanyName] = useState('');
    const [payByEmployeeId, setPayByEmployeeId] = useState('');
    const [payByEmployeeName, setPayByEmployeeName] = useState('');
    const [error, setError] = useState('');

    const assigned = assignedPartyDefaults({
        assignedToType,
        assignedToId,
        assignedToName,
    });

    const applyPayByChoice = (nextPayBy, { keepExisting = false } = {}) => {
        setPayBy(nextPayBy);
        setError('');
        if (!nextPayBy) return;

        if (nextPayBy === PAY_BY_EMPLOYEE) {
            const fromAssigned = partyFromAssignment(nextPayBy, assigned);
            const hasExisting = keepExisting && String(initialEmployeeId || '').trim();
            if (hasExisting) {
                setPayByEmployeeId(initialEmployeeId || '');
                setPayByEmployeeName(initialEmployeeName || '');
            } else if (fromAssigned) {
                setPayByEmployeeId(fromAssigned.payByEmployeeId);
                setPayByEmployeeName(fromAssigned.payByEmployeeName);
            } else {
                setPayByEmployeeId('');
                setPayByEmployeeName('');
            }
            setPayByCompanyId('');
            setPayByCompanyName('');
            return;
        }

        if (nextPayBy === PAY_BY_COMPANY) {
            const fromAssigned = partyFromAssignment(nextPayBy, assigned);
            const hasExisting = keepExisting && String(initialCompanyId || '').trim();
            if (hasExisting) {
                setPayByCompanyId(initialCompanyId || '');
                setPayByCompanyName(initialCompanyName || '');
            } else if (fromAssigned) {
                setPayByCompanyId(fromAssigned.payByCompanyId);
                setPayByCompanyName(fromAssigned.payByCompanyName);
            } else {
                setPayByCompanyId('');
                setPayByCompanyName('');
            }
            setPayByEmployeeId('');
            setPayByEmployeeName('');
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        const nextPayBy =
            lockedPayBy ||
            initialPayBy ||
            assigned.defaultPayBy ||
            '';
        applyPayByChoice(nextPayBy, { keepExisting: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        isOpen,
        lockedPayBy,
        initialPayBy,
        initialCompanyId,
        initialCompanyName,
        initialEmployeeId,
        initialEmployeeName,
        assignedToType,
        assignedToId,
        assignedToName,
    ]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (!payBy) {
            setError('Please select who pays the contract.');
            return;
        }
        if (payBy === PAY_BY_COMPANY && !String(payByCompanyId || '').trim()) {
            setError('Please select a company.');
            return;
        }
        if (payBy === PAY_BY_EMPLOYEE && !String(payByEmployeeId || '').trim()) {
            setError('Please select an employee.');
            return;
        }
        onConfirm?.({
            payBy,
            payByCompanyId,
            payByCompanyName,
            payByEmployeeId,
            payByEmployeeName,
        });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/45">
            <div
                className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col border border-gray-200"
                role="dialog"
                aria-modal="true"
                aria-labelledby="pay-by-choice-title"
            >
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200 shrink-0">
                    <div className="min-w-0">
                        <h2
                            id="pay-by-choice-title"
                            className="text-lg sm:text-xl font-bold text-gray-800"
                        >
                            Contract Paid By
                        </h2>
                        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                            {accountNo ? `Account ${accountNo}` : 'Select who pays'}
                            {differenceAmount != null
                                ? ` · Diff ${formatMoney(differenceAmount)} AED`
                                : ''}
                        </p>
                        {assigned.assignedToName ? (
                            <p className="text-[11px] text-teal-700 mt-1">
                                Assigned: {assigned.assignedToName}
                                {assigned.assignedToType
                                    ? ` (${assigned.assignedToType})`
                                    : ''}
                            </p>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="px-4 sm:px-5 py-4 space-y-4 overflow-y-auto flex-1">
                    <div className="space-y-2">
                        {PAY_BY_OPTIONS.map((opt) => {
                            const selected = payBy === opt.value;
                            const disabled = Boolean(lockedPayBy) && opt.value !== lockedPayBy;
                            const assignedName =
                                opt.value === PAY_BY_EMPLOYEE &&
                                assigned.assignedToType === 'Employee'
                                    ? assigned.assignedToName
                                    : opt.value === PAY_BY_COMPANY &&
                                        assigned.assignedToType === 'Company'
                                      ? assigned.assignedToName
                                      : '';
                            const selectedPartyName =
                                opt.value === PAY_BY_EMPLOYEE
                                    ? partyDisplayName(
                                          payByEmployeeName || assignedName,
                                          '',
                                      )
                                    : opt.value === PAY_BY_COMPANY
                                      ? partyDisplayName(
                                            payByCompanyName || assignedName,
                                            '',
                                        )
                                      : '';
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => {
                                        if (disabled) return;
                                        applyPayByChoice(opt.value);
                                    }}
                                    className={`w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border text-sm font-medium transition-colors ${
                                        selected
                                            ? 'border-teal-500 bg-teal-50 text-teal-800'
                                            : disabled
                                              ? 'border-gray-100 bg-gray-50 text-gray-500 cursor-not-allowed'
                                              : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
                                    }`}
                                >
                                    <span className="flex items-center justify-between gap-2">
                                        <span>{opt.label}</span>
                                        {selectedPartyName ? (
                                            <span
                                                className={`text-xs font-semibold truncate max-w-[60%] ${
                                                    disabled ? 'text-gray-600' : 'text-teal-700'
                                                }`}
                                                title={selectedPartyName}
                                            >
                                                {selectedPartyName}
                                            </span>
                                        ) : null}
                                    </span>
                                    {disabled ? (
                                        <span className="block text-xs font-normal mt-0.5 text-gray-400">
                                            Locked when actual is under contract
                                            {assignedName
                                                ? ` · assigned ${assignedName}`
                                                : ''}
                                        </span>
                                    ) : assignedName && !selectedPartyName ? (
                                        <span className="block text-xs font-normal mt-0.5 text-teal-600">
                                            Assigned: {assignedName}
                                        </span>
                                    ) : null}
                                </button>
                            );
                        })}
                    </div>

                    {payBy ? (
                        <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-3">
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                                Who
                            </p>
                            <PayByPartySelects
                                payBy={payBy}
                                payByCompanyId={payByCompanyId}
                                payByEmployeeId={payByEmployeeId}
                                companyOptions={companyOptions}
                                employeeOptions={employeeOptions}
                                onChange={(patch) => {
                                    if (patch.payByCompanyId != null) {
                                        setPayByCompanyId(patch.payByCompanyId);
                                        setPayByCompanyName(patch.payByCompanyName || '');
                                    }
                                    if (patch.payByEmployeeId != null) {
                                        setPayByEmployeeId(patch.payByEmployeeId);
                                        setPayByEmployeeName(patch.payByEmployeeName || '');
                                    }
                                    setError('');
                                }}
                            />
                        </div>
                    ) : null}

                    {error ? <p className="text-sm text-red-600">{error}</p> : null}
                </div>

                <div className="px-4 sm:px-5 py-3 border-t border-gray-200 flex justify-end gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-xs sm:text-sm font-medium"
                    >
                        Apply
                    </button>
                </div>
            </div>
        </div>
    );
}
