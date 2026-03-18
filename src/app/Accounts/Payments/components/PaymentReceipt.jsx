'use client';

import React, { useState, useEffect } from 'react';
import axiosInstance from '@/utils/axios';

// Receipt Component for Row Expansion
const PaymentReceipt = ({ payment }) => {
    const [relatedData, setRelatedData] = useState(null);
    const [otherDebts, setOtherDebts] = useState([]);
    const [totalRemainingAll, setTotalRemainingAll] = useState(0);
    const [existingPayments, setExistingPayments] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!payment.paidBy) return;
            setLoading(true);
            try {
                // 1. Fetch current related item
                let url = '';
                const refId = payment.relatedEntityId || payment.referenceId;
                if (payment.relatedEntityType === 'Fine') {
                    url = `/Fine/${refId}`;
                } else if (payment.relatedEntityType === 'Loan') {
                    url = `/Employee/loans/${refId}`;
                }

                if (url) {
                    const res = await axiosInstance.get(url);
                    setRelatedData(res.data);
                }

                // 2. Fetch all other debts for this employee
                const empId = typeof payment.paidBy === 'object' ? payment.paidBy.employeeId : payment.paidBy;
                if (empId) {
                    const [finesRes, loansRes] = await Promise.all([
                        axiosInstance.get('/Fine', { params: { employeeId: empId, status: 'Approved' } }),
                        axiosInstance.get('/Employee/loans', { params: { employeeId: empId } })
                    ]);

                    const allFines = finesRes.data.fines || [];
                    const allLoans = (loansRes.data.loans || []).filter(l => ['Approved', 'Paid'].includes(l.status || l.approvalStatus));

                    let total = 0;
                    const debts = [];

                    allFines.forEach(f => {
                        const share = calculateEmployeeShareLogic(f, empId);
                        const rem = Math.max(0, share - (f.paidAmount || 0));
                        if (rem > 0.01) {
                            total += rem;
                            if (f._id !== payment.relatedEntityId && f.fineId !== payment.referenceId) {
                                debts.push({ type: 'Fine', id: f.fineId, balance: rem });
                            }
                        }
                    });

                    allLoans.forEach(l => {
                        const rem = Math.max(0, (l.amount || 0) - (l.paidAmount || 0));
                        if (rem > 0.01 && (l.status !== 'Paid' && l.approvalStatus !== 'Paid')) {
                            total += rem;
                            if (l._id !== payment.relatedEntityId && l.loanId !== payment.referenceId) {
                                debts.push({ type: l.type || 'Loan', id: l.loanId || 'N/A', balance: rem });
                            }
                        }
                    });

                    setTotalRemainingAll(total);
                    setOtherDebts(debts);
                }

                // 3. Fetch specific payments for this entity
                const refIdForQuery = payment.relatedEntityId || payment.referenceId;
                const payParams = {
                    relatedEntityType: payment.relatedEntityType === 'Loan' ? 'Loan' : 'Fine',
                };
                
                if (payment.relatedEntityType === 'Fine') {
                    payParams.referenceId = payment.referenceId || refIdForQuery; 
                } else {
                    payParams.relatedEntityId = payment.relatedEntityId || refIdForQuery;
                }

                const payRes = await axiosInstance.get('/Payment', { params: payParams });
                const fetchedPayments = payRes.data.payments || (Array.isArray(payRes.data) ? payRes.data : []);
                setExistingPayments(fetchedPayments);

            } catch (e) {
                console.error("Error fetching receipt data:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [payment]);

    const calculateEmployeeShareLogic = (fine, targetEmpId) => {
        if (!fine) return 0;
        if (targetEmpId && fine.assignedEmployees?.length > 0) {
            const record = fine.assignedEmployees.find(e => e.employeeId === targetEmpId);
            if (record && record.individualAmount > 0) return parseFloat(record.individualAmount);
        }
        const isCo = (fine.responsibleFor || '').toLowerCase() === 'company';
        if (isCo) return 0;
        const realEmps = (fine.assignedEmployees || []).filter(e => !['VEGA-HR-0000', 'VEGA_INTERNAL'].includes(e.employeeId));
        const coAmt = parseFloat(fine.companyAmount || 0);
        const fAmt = parseFloat(fine.fineAmount || 0);
        const eAmt = parseFloat(fine.employeeAmount || 0);
        if (realEmps.length === 1 && coAmt === 0) return fAmt;
        if (eAmt > 0 && eAmt <= fAmt && realEmps.length > 1) return eAmt / realEmps.length;
        if (realEmps.length === 1 && eAmt > 0 && eAmt <= fAmt) return eAmt;
        return (fAmt - coAmt) / (realEmps.length || 1);
    };

    if (loading) return <div className="p-8 text-center text-gray-400">Loading receipt details...</div>;

    let targetEmpId = typeof payment.paidBy === 'object' ? payment.paidBy.employeeId : payment.paidBy;
    if (payment.relatedEntityType === 'Fine' && relatedData?.assignedEmployees) {
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(targetEmpId);
        if (isObjectId) {
            const empRec = relatedData.assignedEmployees.find(e => 
                (e.empObjectId && e.empObjectId._id === targetEmpId) || 
                (e.empObjectId === targetEmpId) ||
                (e._id === targetEmpId)
            );
            if (empRec) targetEmpId = empRec.employeeId;
        }
    }

    const share = payment.relatedEntityType === 'Fine' 
        ? calculateEmployeeShareLogic(relatedData, targetEmpId) 
        : parseFloat(relatedData?.amount || relatedData?.loanAmount || 0);

    const duration = parseInt(
        (payment.relatedEntityType === 'Fine' 
            ? relatedData?.payableDuration 
            : (relatedData?.duration || relatedData?.months || relatedData?.totalInstallments)) || 1
    );

    const getHistoricalContext = () => {
        const currentRefTime = new Date(payment.paymentDate || payment.createdAt || new Date()).getTime();
        const currentId = payment._id || payment.paymentId;

        // Start with all theoretical payments
        let all = [...existingPayments];
        const isCurrentSuccessful = ['Completed', 'Paid', 'Success', 'Approved', 'Active'].includes(payment.status);
        if (isCurrentSuccessful && !all.some(p => (p._id || p.paymentId) === currentId)) {
            all.push(payment);
        }

        // Filter to what existed at "that time"
        const historical = all.filter(p => {
            const pStatus = (p.status || p.approvalStatus || '').toLowerCase();
            const isOk = ['completed', 'paid', 'success', 'approved', 'active'].includes(pStatus);
            if (!isOk) return false;

            const pTime = new Date(p.paymentDate || p.createdAt || 0).getTime();
            if (pTime < currentRefTime) return true;
            if (pTime === currentRefTime) {
                // If same time, we only include the current one (to avoid showing "future" same-day payments)
                // or payments that might have been processed before it (hard to know without sequence, but currentId match is key)
                return (p._id === payment._id || p.paymentId === payment.paymentId);
            }
            return false;
        });

        const totalPaidAtTime = historical.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        const paidNow = parseFloat(payment.amount || 0);
        const earlierAtTime = Math.max(0, totalPaidAtTime - (isCurrentSuccessful ? paidNow : 0));

        return { historical, totalPaidAtTime, earlierAtTime };
    };

    const { historical, totalPaidAtTime, earlierAtTime } = getHistoricalContext();

    const paidByNow = parseFloat(payment.amount || 0);
    const earlier = earlierAtTime;
    const balanceNow = Math.max(0, share - totalPaidAtTime);
    const empName = payment.paidBy?.firstName ? `${payment.paidBy.firstName} ${payment.paidBy.lastName}` : (payment.paidByName || 'Employee');

    const generateMonthBoxes = () => {
        if (!relatedData) return [];
        const startMonth = relatedData.monthStart || relatedData.startDate || '';
        if (!startMonth) return [];
        let startDate;
        try {
            if (startMonth.includes('-')) {
                const parts = startMonth.split('-');
                if (parts[0].length === 4) startDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
                else startDate = new Date(parseInt(parts[1]), parseInt(parts[0]) - 1, 1);
            } else if (startMonth.includes('/')) {
                const parts = startMonth.split('/');
                if (parts[0].length === 4) startDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
                else startDate = new Date(parseInt(parts[1]), parseInt(parts[0]) - 1, 1);
            } else {
                startDate = new Date(startMonth);
                if (isNaN(startDate.getTime())) {
                    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
                    const normalizedStart = startMonth.trim().toLowerCase();
                    const monthIndex = monthNames.findIndex(m => m.startsWith(normalizedStart));
                    if (monthIndex !== -1) {
                        startDate = new Date();
                        startDate.setMonth(monthIndex);
                        startDate.setDate(1);
                    } else return [];
                }
                startDate.setDate(1);
            }
        } catch (e) { return []; }
        
        const monthlyAmount = duration > 0 ? (share / duration) : share;
        if (isNaN(monthlyAmount)) return [];

        const sortedPayments = [...historical].sort((a, b) => {
            const dateA = new Date(a.paymentDate || a.createdAt || 0).getTime();
            const dateB = new Date(b.paymentDate || b.createdAt || 0).getTime();
            return dateA - dateB;
        });

        let remainingPayments = [...sortedPayments];
        const boxes = [];
        for (let i = 0; i < duration; i++) {
            const monthDate = new Date(startDate);
            monthDate.setMonth(startDate.getMonth() + i);
            const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            let paidAmount = 0;
            while (remainingPayments.length > 0 && paidAmount < (monthlyAmount - 0.01)) {
                const nextPayment = remainingPayments[0];
                const pAmt = parseFloat(nextPayment.amount || 0);
                const needed = monthlyAmount - paidAmount;
                if (pAmt <= (needed + 0.01)) {
                    paidAmount += pAmt;
                    remainingPayments.shift();
                } else {
                    paidAmount = monthlyAmount;
                    remainingPayments[0] = { ...nextPayment, amount: pAmt - needed };
                    break;
                }
            }
            const isPaid = paidAmount >= (monthlyAmount - 0.5);
            boxes.push({ month: monthLabel, isPaid, paidAmount, monthlyAmount });
        }
        return boxes;
    };

    const monthBoxes = generateMonthBoxes();

    return (
        <div className="p-10 bg-white border border-gray-200 rounded-2xl m-4 shadow-xl max-w-4xl mx-auto">
            <div className="flex justify-between items-start mb-8 border-b-2 border-blue-600 pb-6">
                <div>
                    <h1 className="text-3xl font-black text-blue-700 tracking-tighter">RECEIPT</h1>
                    <p className="text-sm text-gray-400 mt-1 font-medium">Reference: <span className="text-gray-900 font-bold">{payment.paymentId}</span></p>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-black text-gray-800 tracking-tighter">VERP</h2>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Digital Payment Confirmation</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-12 mb-10">
                <div>
                    <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-3">BILL TO</h3>
                    <p className="text-lg font-bold text-gray-900">{empName}</p>
                    <p className="text-sm text-gray-500 mt-1">Employee ID: <span className="font-semibold text-gray-700">{payment.paidBy?.employeeId || 'N/A'}</span></p>
                    <p className="text-sm text-blue-600 underline font-medium mt-1">{payment.paidBy?.companyEmail || 'n/a@company.com'}</p>
                </div>
                <div className="text-right">
                    <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-3">DETAILS</h3>
                    <p className="text-sm text-gray-600">Date: <span className="font-bold text-gray-900">{new Date(payment.paymentDate || new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span></p>
                    <p className="text-sm text-gray-600 mt-1">Ref Type: <span className="font-bold text-blue-600">{payment.paymentType || payment.relatedEntityType}</span></p>
                    <p className="text-sm text-gray-600 mt-1">Ref ID: <span className="font-bold text-gray-900">{payment.referenceId || 'N/A'}</span></p>
                </div>
            </div>

            <div className="bg-gray-50/50 rounded-xl overflow-hidden border border-gray-100 mb-8">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                            <th className="px-6 py-3 text-left">Item Description</th>
                            <th className="px-6 py-3 text-right">Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-t border-gray-100">
                            <td className="px-6 py-5">
                                <p className="font-bold text-gray-800 text-base">{(payment.paymentType || payment.relatedEntityType)} Payment</p>
                                <p className="text-xs text-gray-500 mt-1 italic">{payment.description || `Payment for ${payment.referenceId}`}</p>
                            </td>
                            <td className="px-6 py-5 text-right">
                                <p className="text-xs text-gray-600 font-medium">Applied Month: <span className="font-bold text-gray-900">{relatedData?.monthStart || 'N/A'}</span></p>
                                <p className="text-xs text-gray-600 mt-1 font-medium">Plan Duration: <span className="font-bold text-gray-900">{duration} Month(s)</span></p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {monthBoxes.length > 0 && (
                <div className="mb-10">
                    <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-4">Payment Schedule Status</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {monthBoxes.map((box, i) => (
                            <div 
                                key={i} 
                                className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
                                    box.isPaid 
                                        ? 'bg-green-50 border-green-500/50 text-green-700' 
                                        : 'bg-red-50 border-red-500/50 text-red-700'
                                }`}
                            >
                                <span className="text-[10px] font-black uppercase tracking-tight mb-1">{box.month}</span>
                                <span className="text-xs font-bold">{box.isPaid ? 'PAID' : `${box.paidAmount.toFixed(0)} / ${box.monthlyAmount.toFixed(0)}`}</span>
                                {box.isPaid && <div className="mt-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-[8px] text-white">✓</div>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex justify-end mb-10">
                <div className="w-72 space-y-3">
                    <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
                        <span>Total Amount:</span>
                        <span className="text-gray-900">{share.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
                        <span>Paid Earlier:</span>
                        <span className="text-gray-900">{earlier.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>
                    </div>
                    <div className="flex justify-between py-4 border-y-2 border-blue-600">
                        <span className="font-black text-gray-800 text-sm">PAID NOW:</span>
                        <span className="font-black text-blue-700 text-xl">{paidByNow.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>
                    </div>
                    <div className="flex justify-between pt-2">
                        <span className="font-black text-red-500 text-xs">BALANCE:</span>
                        <span className="font-black text-red-600 text-lg">{balanceNow.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>
                    </div>
                </div>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-600 p-6 rounded-r-xl mb-8">
                <p className="text-sm text-blue-900 leading-relaxed">
                    <span className="font-bold italic">Note:</span> {empName} has successfully paid <span className="font-bold">{paidByNow.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>.
                    The current outstanding balance for this item is <span className="font-bold">{balanceNow.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>.
                    {duration > 1 && ` Estimated Monthly Installment: ${(share / duration).toLocaleString(undefined, { minimumFractionDigits: 2 })} AED`}
                </p>
            </div>

            {totalRemainingAll > balanceNow && (
                <div className="mt-8 p-6 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/30">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Total Financial Snapshot</h4>
                    <div className="flex justify-between items-baseline mb-4">
                        <span className="text-sm font-bold text-gray-500">Global Outstanding Balance:</span>
                        <span className="text-xl font-black text-red-500">{totalRemainingAll.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>
                    </div>
                    {otherDebts.length > 0 && (
                        <div className="grid grid-cols-2 gap-y-2 gap-x-8 pt-3 border-t border-gray-200/50">
                            {otherDebts.map((d, i) => (
                                <div key={i} className="flex justify-between text-[11px] font-medium text-gray-500">
                                    <span>• {d.type} ({d.id})</span>
                                    <span className="font-bold text-gray-700">{d.balance.toLocaleString()} AED</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="mt-12 pt-6 border-t border-gray-100 text-center">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Generated by VeRP System • Automated Information Only</p>
            </div>
        </div>
    );
};

export default PaymentReceipt;
