'use client';

import { Check, X, Download, Edit, Lock, Send, Trash2, Wallet } from 'lucide-react';
import {
    LOAN_PENDING_PAYMENT_STATUS,
    isLoanAwaitingEmployeePayment,
    isLoanFullyDisbursed,
    isLoanPostManagementStatus,
} from '../utils/loanStatusConstants';

export default function LoanActionPanel({
    loan,
    typeLabel,
    isProcessing,
    canApproveLoan,
    canSubmitDraft,
    canResubmit,
    canPayLoan = false,
    onDownload,
    onApprove,
    onReject,
    onSubmit,
    onCancel,
    onResubmit,
    onPay,
}) {
    if (!loan) return null;

    const status = loan.approvalStatus || loan.status;
    const isDraft = status === 'Draft';
    const awaitingPayment = isLoanAwaitingEmployeePayment(loan);
    const isPaid = isLoanFullyDisbursed(loan);
    const isPostManagement = isLoanPostManagementStatus(status);
    const isFinalized = isPostManagement || status === 'Rejected';
    const totalAmount = Number(loan.amount || 0);
    const paidAmount = Number(loan.paidAmount || 0);
    const remainingAmount = Math.max(0, totalAmount - paidAmount);
    const compactBox =
        'p-2 rounded-lg border flex items-center justify-between px-4 min-h-[44px] transition-all break-words gap-2';

    const statusBoxClass =
        isPaid
            ? 'bg-green-50 border-green-100 text-green-700'
            : awaitingPayment
              ? 'bg-amber-50 border-amber-100 text-amber-800'
              : status === 'Rejected'
                ? 'bg-red-50 border-red-100 text-red-700'
                : 'bg-yellow-50 border-yellow-100 text-yellow-700';

    const statusLabel = isPaid
        ? 'Approved'
        : status === LOAN_PENDING_PAYMENT_STATUS
          ? 'Pending Payment'
          : status || 'Unknown';

    const cells = [];

    cells.push(
        <div key="status" className={`${compactBox} ${statusBoxClass}`}>
            <span className="text-[10px] font-medium uppercase tracking-wide truncate opacity-80">
                Current Status
            </span>
            <span className="text-sm sm:text-lg font-bold truncate ml-2">{statusLabel}</span>
        </div>
    );

    cells.push(
        <button
            key="download"
            type="button"
            onClick={onDownload}
            disabled={isProcessing}
            className={`${compactBox} border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50`}
        >
            <span className="text-[10px] font-medium uppercase tracking-wide truncate">Download PDF</span>
            <Download className="w-5 h-5 shrink-0" />
        </button>
    );

    if (isPostManagement) {
        cells.push(
            <div key="total" className={`${compactBox} bg-red-50 border-red-100`}>
                <span className="text-[10px] text-red-600 font-medium uppercase tracking-wide truncate">
                    Total {typeLabel}
                </span>
                <span className="text-lg font-bold text-red-800 tabular-nums ml-2">
                    {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            </div>,
            <div key="paidAmt" className={`${compactBox} bg-green-50 border-green-100`}>
                <span className="text-[10px] text-green-600 font-medium uppercase tracking-wide truncate">
                    Amount Paid
                </span>
                <span className="text-lg font-bold text-green-800 tabular-nums ml-2">
                    {paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            </div>,
            <div key="remaining" className={`${compactBox} bg-amber-50 border-amber-100`}>
                <span className="text-[10px] text-amber-600 font-medium uppercase tracking-wide truncate">
                    Remaining
                </span>
                <span className="text-lg font-bold text-amber-800 tabular-nums ml-2">
                    {remainingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            </div>,
        );

        if (canPayLoan && remainingAmount > 0.01) {
            cells.push(
                <button
                    key="pay"
                    type="button"
                    onClick={onPay}
                    disabled={isProcessing}
                    className={`${compactBox} border-teal-100 bg-teal-50 text-teal-700 hover:bg-teal-100 disabled:opacity-50`}
                >
                    <span className="text-[10px] font-medium uppercase tracking-wide truncate">Paid</span>
                    <Wallet className="w-5 h-5 shrink-0" />
                </button>,
            );
        } else if (isPaid || remainingAmount <= 0.01) {
            cells.push(
                <div key="done" className={`${compactBox} bg-gray-50 border-gray-100 text-gray-400 opacity-70`}>
                    <span className="text-[10px] font-medium uppercase tracking-wide truncate">Workflow</span>
                    <span className="text-lg font-bold flex items-center gap-1 ml-2">
                        <Check className="w-4 h-4" /> Completed
                    </span>
                </div>
            );
        }
    } else if (status === 'Rejected' && canResubmit) {
        cells.push(
            <button
                key="resubmit"
                type="button"
                onClick={onResubmit}
                className={`${compactBox} border-orange-100 bg-orange-50 text-orange-600 hover:bg-orange-100`}
            >
                <span className="text-[10px] font-medium uppercase tracking-wide">Edit & Resubmit</span>
                <Edit className="w-5 h-5 shrink-0" />
            </button>
        );
        while (cells.length < 6) {
            cells.push(
                <div
                    key={`pad-${cells.length}`}
                    className={`${compactBox} bg-gray-50 border-gray-100 text-gray-300 opacity-40`}
                >
                    <span className="text-[10px]">—</span>
                    <span>—</span>
                </div>
            );
        }
    } else if (isDraft && canSubmitDraft()) {
        cells.push(
            <button
                key="submit"
                type="button"
                onClick={onSubmit}
                disabled={isProcessing}
                className={`${compactBox} border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50`}
            >
                <span className="text-[10px] font-medium uppercase tracking-wide truncate">Submit</span>
                <Send className="w-5 h-5 shrink-0" />
            </button>,
            <button
                key="cancel"
                type="button"
                onClick={onCancel}
                disabled={isProcessing}
                className={`${compactBox} border-red-100 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50`}
            >
                <span className="text-[10px] font-medium uppercase tracking-wide truncate">Cancel</span>
                <Trash2 className="w-5 h-5 shrink-0" />
            </button>
        );
        while (cells.length < 6) {
            cells.push(
                <div key={`lock-${cells.length}`} className={`${compactBox} bg-gray-50 border-gray-100 text-gray-400 opacity-50`}>
                    <span className="text-[10px] font-medium uppercase tracking-wide truncate">Pending</span>
                    <Lock className="w-4 h-4 shrink-0" />
                </div>
            );
        }
    } else if (canApproveLoan()) {
        cells.push(
            <button
                key="approve"
                type="button"
                onClick={onApprove}
                disabled={isProcessing}
                className={`${compactBox} border-green-100 bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50`}
            >
                <span className="text-[10px] font-medium uppercase tracking-wide truncate">Approve</span>
                <Check className="w-5 h-5 shrink-0" />
            </button>,
            <button
                key="reject"
                type="button"
                onClick={onReject}
                disabled={isProcessing}
                className={`${compactBox} border-red-100 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50`}
            >
                <span className="text-[10px] font-medium uppercase tracking-wide truncate">Reject</span>
                <X className="w-5 h-5 shrink-0" />
            </button>
        );
        while (cells.length < 6) {
            cells.push(
                <div key={`lock-${cells.length}`} className={`${compactBox} bg-gray-50 border-gray-100 text-gray-400 opacity-50`}>
                    <span className="text-[10px] font-medium uppercase tracking-wide truncate">Pending</span>
                    <Lock className="w-4 h-4 shrink-0" />
                </div>
            );
        }
    } else if (isFinalized) {
        cells.push(
            <div key="done-a" className={`${compactBox} bg-gray-50 border-gray-100 text-gray-400 opacity-70`}>
                <span className="text-[10px] font-medium uppercase tracking-wide">Workflow</span>
                <span className="text-lg font-bold flex items-center gap-1">
                    <Check className="w-4 h-4" /> Completed
                </span>
            </div>
        );
        while (cells.length < 6) {
            cells.push(
                <div key={`pad-f-${cells.length}`} className={`${compactBox} bg-gray-50 border-gray-100 opacity-30`}>
                    <span className="text-[10px]">—</span>
                </div>
            );
        }
    } else {
        while (cells.length < 6) {
            cells.push(
                <div key={`lock-all-${cells.length}`} className={`${compactBox} bg-gray-50 border-gray-100 text-gray-400 opacity-50`}>
                    <span className="text-[10px] font-medium uppercase tracking-wide truncate">Locked</span>
                    <Lock className="w-4 h-4 shrink-0" />
                </div>
            );
        }
    }

    return (
        <div className="bg-white rounded-lg shadow-sm p-4 w-full h-full flex flex-col overflow-hidden">
            <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full min-w-0 shrink-0">{cells.slice(0, 6)}</div>
        </div>
    );
}
