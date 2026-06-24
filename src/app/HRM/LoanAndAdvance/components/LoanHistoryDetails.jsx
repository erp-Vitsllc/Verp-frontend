'use client';

import { FileText } from 'lucide-react';
import { DETAIL_PAIR_COLUMN, DETAIL_PAIR_GRID } from '@/utils/headerPairLayout';
import { formatMoney } from '../../Fine/components/FineFormCardShared';
import LoanWorkflowHistoryPanel from './LoanWorkflowHistoryPanel';

export default function LoanHistoryDetails({ loan, employee, formatDate, typeLabel }) {
    if (!loan) return null;

    const status = loan.approvalStatus || loan.status;
    const paidAmount = Number(loan.paidAmount || 0);
    const totalAmount = Number(loan.amount || 0);
    const remainingAmount = Math.max(0, totalAmount - paidAmount);

    return (
        <div className={`${DETAIL_PAIR_GRID} print:hidden`}>
            <div className={`${DETAIL_PAIR_COLUMN} gap-6`}>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
                    <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-4">
                        <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h4 className="text-lg font-bold text-gray-800">{typeLabel} Details</h4>
                            <p className="text-xs text-gray-500">Overview of the logged {typeLabel.toLowerCase()} record</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                        <div>
                            <span className="text-xs text-gray-400 block font-medium">{typeLabel} ID</span>
                            <span className="font-semibold text-gray-800">{loan.loanId || '—'}</span>
                        </div>
                        <div>
                            <span className="text-xs text-gray-400 block font-medium">Type</span>
                            <span className="font-semibold text-gray-800">{loan.type}</span>
                        </div>
                        <div>
                            <span className="text-xs text-gray-400 block font-medium">Applicant</span>
                            <span className="font-semibold text-gray-800">{loan.applicantName}</span>
                        </div>
                        <div>
                            <span className="text-xs text-gray-400 block font-medium">Department</span>
                            <span className="font-semibold text-gray-800">{loan.department}</span>
                        </div>
                        <div>
                            <span className="text-xs text-gray-400 block font-medium">Applied Date</span>
                            <span className="font-semibold text-gray-800">{formatDate(loan.appliedDate || loan.createdAt)}</span>
                        </div>
                        <div>
                            <span className="text-xs text-gray-400 block font-medium">Amount</span>
                            <span className="font-bold text-blue-600">{formatMoney(totalAmount)} AED</span>
                        </div>
                        <div>
                            <span className="text-xs text-gray-400 block font-medium">Duration</span>
                            <span className="font-semibold text-gray-800">
                                {loan.duration} Month{loan.duration !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div>
                            <span className="text-xs text-gray-400 block font-medium">Status</span>
                            <span className="font-semibold text-gray-800">{status}</span>
                        </div>
                        {['Approved', 'Paid'].includes(status) && (
                            <>
                                <div>
                                    <span className="text-xs text-gray-400 block font-medium">Paid</span>
                                    <span className="font-semibold text-green-600">{formatMoney(paidAmount)} AED</span>
                                </div>
                                <div>
                                    <span className="text-xs text-gray-400 block font-medium">Remaining</span>
                                    <span className="font-semibold text-amber-600">{formatMoney(remainingAmount)} AED</span>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <span className="text-xs text-gray-400 block font-medium mb-1">Reason</span>
                        <p className="text-sm text-gray-600 italic bg-gray-50 p-3 rounded-lg border border-gray-100">
                            {loan.reason || 'No reason provided.'}
                        </p>
                    </div>
                </div>

                {employee && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
                        <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-4">
                            <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600">
                                <FileText size={24} />
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-gray-800">Employee Records</h4>
                                <p className="text-xs text-gray-500">HR and compliance information</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                            <div>
                                <span className="text-xs text-gray-400 block font-medium">Employee ID</span>
                                <span className="font-semibold text-gray-800">{employee.employeeId || loan.employeeId}</span>
                            </div>
                            <div>
                                <span className="text-xs text-gray-400 block font-medium">Designation</span>
                                <span className="font-semibold text-gray-800">{loan.designation}</span>
                            </div>
                            <div>
                                <span className="text-xs text-gray-400 block font-medium">Labour Card Expiry</span>
                                <span className="font-semibold text-gray-800">
                                    {formatDate(employee.labourCardDetails?.expiryDate)}
                                </span>
                            </div>
                            <div>
                                <span className="text-xs text-gray-400 block font-medium">Visa Expiry</span>
                                <span className="font-semibold text-gray-800">
                                    {formatDate(
                                        employee.visaDetails?.employment?.expiryDate ||
                                            employee.visaDetails?.spouse?.expiryDate
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className={`${DETAIL_PAIR_COLUMN} bg-white rounded-2xl border border-gray-100 shadow-sm p-6`}>
                <LoanWorkflowHistoryPanel loan={loan} typeLabel={typeLabel} />
            </div>
        </div>
    );
}
