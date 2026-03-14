'use client';

import React, { useState, useEffect } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { X, FileText } from 'lucide-react';

const AddPaymentModal = ({ isOpen, onClose, onSuccess }) => {
    const { toast } = useToast();
    const [paymentType, setPaymentType] = useState('');
    const [selectedFineId, setSelectedFineId] = useState('');
    const [selectedLoanId, setSelectedLoanId] = useState('');
    const [fines, setFines] = useState([]);
    const [loans, setLoans] = useState([]);
    const [selectedEntity, setSelectedEntity] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [existingPayments, setExistingPayments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [selectedCardIndex, setSelectedCardIndex] = useState(null);
    const [attachment, setAttachment] = useState(null);
    const [attachmentName, setAttachmentName] = useState('');

    // Fetch fines and loans when payment type changes
    useEffect(() => {
        if (!isOpen) {
            // Reset state when modal closes
            setPaymentType('');
            setSelectedFineId('');
            setSelectedLoanId('');
            setSelectedEntity(null);
            setPaymentAmount('');
            setExistingPayments([]);
            setSelectedCardIndex(null);
            setAttachment(null);
            setAttachmentName('');
            return;
        }

        const fetchData = async () => {
            if (paymentType === 'Fine') {
                setFetching(true);
                try {
                    const response = await axiosInstance.get('/Fine', {
                        params: { status: 'Approved', limit: 1000 }
                    });
                    setFines(response.data.fines || []);
                } catch (error) {
                    console.error('Error fetching fines:', error);
                    toast({
                        title: "Error",
                        description: "Failed to fetch fines",
                        variant: "destructive",
                    });
                } finally {
                    setFetching(false);
                }
            } else if (paymentType === 'Loan' || paymentType === 'Advance') {
                setFetching(true);
                try {
                    const response = await axiosInstance.get('/Employee/loans', {
                        params: {
                            type: paymentType,
                            // Note: Loan model uses 'status' field, not 'approvalStatus' for filtering
                        }
                    });
                    // Filter approved loans/advances on frontend
                    const approvedLoans = (response.data.loans || []).filter(
                        loan => loan.status === 'Approved' || loan.approvalStatus === 'Approved'
                    );
                    setLoans(approvedLoans);
                } catch (error) {
                    console.error('Error fetching loans:', error);
                    toast({
                        title: "Error",
                        description: `Failed to fetch ${paymentType.toLowerCase()}s`,
                        variant: "destructive",
                    });
                } finally {
                    setFetching(false);
                }
            }
        };

        if (paymentType) {
            fetchData();
        }
    }, [paymentType, isOpen, toast]);

    // Fetch existing payments when entity is selected
    useEffect(() => {
        if (!selectedEntity || !paymentType) return;

        const fetchExistingPayments = async () => {
            try {
                let params = {
                    relatedEntityType: paymentType === 'Loan' || paymentType === 'Advance' ? 'Loan' : 'Fine',
                };

                // For Fine, filter by fineId (referenceId) to ensure we only get payments for this specific fine
                if (paymentType === 'Fine') {
                    params.referenceId = selectedEntity.fineId;
                } else {
                    // For Loan/Advance, use relatedEntityId
                    params.relatedEntityId = selectedEntity._id || selectedEntity.id;
                }

                const response = await axiosInstance.get('/Payment', { params });
                setExistingPayments(response.data.payments || []);
            } catch (error) {
                console.error('Error fetching existing payments:', error);
            }
        };

        fetchExistingPayments();
    }, [selectedEntity, paymentType]);


    // Helper function to calculate employee share (similar to getEmpShare in fine detail page)
    const calculateEmployeeShare = (fine) => {
        if (!fine) return 0;
        const isCompany = (fine.responsibleFor || '').toLowerCase() === 'company';
        if (isCompany) return 0;

        // Filter out company employees (VEGA-HR-0000) from assignedEmployees
        const realEmployees = (fine.assignedEmployees || []).filter(emp =>
            emp.employeeId !== 'VEGA-HR-0000' &&
            emp.employeeId !== 'VEGA_INTERNAL' &&
            emp.employeeName !== 'Vega Digital IT Solutions'
        );

        const companyAmount = parseFloat(fine.companyAmount || 0);
        const fineAmount = parseFloat(fine.fineAmount || 0);
        const employeeAmount = parseFloat(fine.employeeAmount || 0);

        // PRIORITY: If there's only one real employee and no company share, 
        // employee should pay the full fineAmount (this takes precedence over employeeAmount)
        if (realEmployees.length === 1 && companyAmount === 0) {
            return fineAmount;
        }

        // If employeeAmount is explicitly set and seems correct, use it (for multiple employees)
        if (employeeAmount > 0 && employeeAmount <= fineAmount && realEmployees.length > 1) {
            return employeeAmount / realEmployees.length;
        }

        // For single employee with employeeAmount set (but companyAmount > 0), use employeeAmount
        if (realEmployees.length === 1 && employeeAmount > 0 && employeeAmount <= fineAmount) {
            return employeeAmount;
        }

        // Fallback: calculate from fineAmount - companyAmount
        const calculatedEmpAmount = fineAmount - companyAmount;
        if (realEmployees.length > 1) {
            return calculatedEmpAmount / realEmployees.length;
        }

        return calculatedEmpAmount;
    };

    // Handle fine selection
    const handleFineSelect = (fineId) => {
        setSelectedFineId(fineId);
        const fine = fines.find(f => f.fineId === fineId || f._id === fineId);
        if (fine) {
            setSelectedEntity(fine);
            // Calculate payment amount per month based on employee's share
            const duration = fine.payableDuration || 1;
            const employeeShare = calculateEmployeeShare(fine);
            // setPaymentAmount(monthlyAmount.toFixed(2)); // Removed: will be handled by useEffect
        }
    };

    // Handle loan/advance selection
    const handleLoanSelect = (loanId) => {
        setSelectedLoanId(loanId);
        const loan = loans.find(l => l.loanId === loanId || l._id === loanId || l.id === loanId);
        if (loan) {
            setSelectedEntity(loan);
            // Calculate payment amount per month
            const duration = loan.duration || 1;
            const totalAmount = loan.amount || 0;
            // setPaymentAmount(monthlyAmount.toFixed(2)); // Removed: will be handled by useEffect
        }
    };

    // Generate month boxes
    const generateMonthBoxes = () => {
        if (!selectedEntity) return [];

        let duration, startMonth, totalAmount;

        if (paymentType === 'Fine') {
            duration = selectedEntity.payableDuration || 1;
            startMonth = selectedEntity.monthStart || '';
            // For payment schedule calculation, use employee's share (what they actually owe)
            // But for display purposes, fineAmount is shown as the constant total
            const employeeShare = calculateEmployeeShare(selectedEntity);
            totalAmount = employeeShare > 0 ? employeeShare : (selectedEntity.fineAmount || 0);
        } else if (paymentType === 'Loan' || paymentType === 'Advance') {
            duration = selectedEntity.duration || 1;
            startMonth = selectedEntity.monthStart || '';
            totalAmount = selectedEntity.amount || 0;
        } else {
            return [];
        }

        if (!startMonth) return [];

        // Parse start month (format: "YYYY-MM", "MM-YYYY", "MM/YYYY", or month name)
        let startDate;
        if (startMonth.includes('-')) {
            const parts = startMonth.split('-');
            if (parts[0].length === 4) {
                // YYYY-MM format
                startDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
            } else {
                // MM-YYYY format
                startDate = new Date(parseInt(parts[1]), parseInt(parts[0]) - 1, 1);
            }
        } else if (startMonth.includes('/')) {
            const parts = startMonth.split('/');
            if (parts[0].length === 4) {
                // YYYY/MM format
                startDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
            } else {
                // MM/YYYY format
                startDate = new Date(parseInt(parts[1]), parseInt(parts[0]) - 1, 1);
            }
        } else {
            // Check if it's just a month string (e.g., "June")
            const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
            const normalizedStart = startMonth.trim().toLowerCase();
            const monthIndex = monthNames.findIndex(m => m.startsWith(normalizedStart));

            if (monthIndex !== -1) {
                startDate = new Date();
                startDate.setMonth(monthIndex);
                startDate.setDate(1);
            } else {
                // Try parsing as regular date string
                startDate = new Date(startMonth);
                if (isNaN(startDate.getTime())) {
                    return [];
                }
                startDate.setDate(1); // Set to first day of month
            }
        }

        const monthlyAmount = totalAmount / duration;
        const boxes = [];

        // Sort payments by date (oldest first) to assign them sequentially to months
        const sortedPayments = [...existingPayments].sort((a, b) => {
            const dateA = new Date(a.paymentDate || a.createdAt || 0);
            const dateB = new Date(b.paymentDate || b.createdAt || 0);
            return dateA - dateB;
        });

        let remainingPayments = [...sortedPayments];
        let totalPaidSoFar = 0;

        for (let i = 0; i < duration; i++) {
            const monthDate = new Date(startDate);
            monthDate.setMonth(startDate.getMonth() + i);
            const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

            // Calculate paid amount for this month
            // Assign payments sequentially: each payment fills up months in order until exhausted
            let paidAmount = 0;
            const monthPayments = [];

            while (remainingPayments.length > 0 && paidAmount < monthlyAmount) {
                const nextPayment = remainingPayments[0];
                const paymentAmount = parseFloat(nextPayment.amount || 0);

                // How much is still needed for this month
                const needed = monthlyAmount - paidAmount;

                if (paymentAmount <= needed) {
                    // This payment fully fits in this month
                    paidAmount += paymentAmount;
                    monthPayments.push(nextPayment);
                    remainingPayments.shift(); // Remove from remaining
                } else {
                    // This payment is larger than needed - use only what's needed
                    paidAmount = monthlyAmount;
                    monthPayments.push({ ...nextPayment, amount: needed });
                    // Update the remaining payment amount
                    remainingPayments[0] = { ...nextPayment, amount: paymentAmount - needed };
                    break;
                }
            }

            // Consider a small tolerance for floating point comparison
            const tolerance = 0.01;
            const isPaid = paidAmount >= (monthlyAmount - tolerance);
            const isNotPaid = !isPaid;

            // Debug logging
            console.log(`Month ${i + 1}: ${monthLabel}, Monthly Amount: ${monthlyAmount.toFixed(2)}, Paid: ${paidAmount.toFixed(2)}, IsPaid: ${isPaid}`, monthPayments);

            boxes.push({
                month: monthLabel,
                monthDate,
                monthlyAmount,
                paidAmount,
                isPaid,
                isNotPaid,
                remaining: monthlyAmount - paidAmount
            });
        }

        return boxes;
    };

    const monthBoxes = generateMonthBoxes();

    // Calculate total paid and remaining
    const totalPaid = existingPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    // For display: Total Fine Amount is always fineAmount (constant)
    // For calculation: Use employee's share (what they actually owe)
    const displayTotalAmount = selectedEntity
        ? (paymentType === 'Fine'
            ? (selectedEntity.fineAmount || 0) // Always use fineAmount (original total that never changes)
            : (selectedEntity.amount || 0))
        : 0;
    const employeeShare = selectedEntity && paymentType === 'Fine'
        ? calculateEmployeeShare(selectedEntity)
        : displayTotalAmount;
    const remainingAmount = Math.max(0, employeeShare - totalPaid);

    useEffect(() => {
        if (selectedEntity) {
            setPaymentAmount(remainingAmount.toFixed(2));
            setSelectedCardIndex(null); // Reset card selection when entity or total changes
        }
    }, [remainingAmount, selectedEntity]);

    const handleCardClick = (index, box) => {
        if (box.isPaid) return;

        if (selectedCardIndex === index) {
            // Deselecting - back to total remaining
            setSelectedCardIndex(null);
            setPaymentAmount(remainingAmount.toFixed(2));
        } else {
            // Selecting - set to this card's remaining
            setSelectedCardIndex(index);
            setPaymentAmount(box.remaining.toFixed(2));
        }
    };

    const handleAttachmentChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                toast({
                    title: "Validation Error",
                    description: "File size exceeds 5MB limit",
                    variant: "destructive",
                });
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                setAttachment({
                    data: reader.result,
                    name: file.name,
                    mimeType: file.type
                });
                setAttachmentName(file.name);
            };
            reader.readAsDataURL(file);
        }
    };

    // Handle payment submission
    const handlePayNow = async () => {
        if (!selectedEntity || !paymentAmount || parseFloat(paymentAmount) <= 0) {
            toast({
                title: "Validation Error",
                description: "Please enter a valid payment amount",
                variant: "destructive",
            });
            return;
        }

        if (parseFloat(paymentAmount) > (remainingAmount + 0.01)) {
            toast({
                title: "Validation Error",
                description: `Payment amount cannot exceed the remaining amount (${remainingAmount.toFixed(2)} AED)`,
                variant: "destructive",
            });
            return;
        }

        setLoading(true);
        try {
            // Get employee ID based on payment type
            let employeeId;
            if (paymentType === 'Fine') {
                employeeId = selectedEntity.assignedEmployees?.[0]?.employeeId;
            } else {
                employeeId = selectedEntity.employeeId;
            }

            if (!employeeId) {
                toast({
                    title: "Validation Error",
                    description: "Employee ID not found",
                    variant: "destructive",
                });
                setLoading(false);
                return;
            }

            const paymentData = {
                paymentType: paymentType === 'Loan' || paymentType === 'Advance' ? paymentType : 'Fine',
                paidBy: employeeId,
                amount: parseFloat(paymentAmount),
                status: 'Completed',
                description: `Payment for ${paymentType === 'Fine' ? selectedEntity.fineId : (selectedEntity.loanId || selectedEntity.id)}`,
                referenceId: paymentType === 'Fine' ? selectedEntity.fineId : (selectedEntity.loanId || selectedEntity.id),
                relatedEntityType: paymentType === 'Loan' || paymentType === 'Advance' ? 'Loan' : 'Fine',
                relatedEntityId: selectedEntity._id || selectedEntity.id,
                attachment: attachment || null
            };

            await axiosInstance.post('/Payment', paymentData);

            toast({
                title: "Success",
                description: "Payment recorded successfully",
                variant: "success",
            });

            // Refresh existing payments and entity data to show updated colors and total amount
            try {
                let params = {
                    relatedEntityType: paymentType === 'Loan' || paymentType === 'Advance' ? 'Loan' : 'Fine',
                };

                if (paymentType === 'Fine') {
                    params.referenceId = selectedEntity.fineId;
                } else {
                    params.relatedEntityId = selectedEntity._id || selectedEntity.id;
                }

                const response = await axiosInstance.get('/Payment', { params });
                setExistingPayments(response.data.payments || []);

                // Refresh fine/loan data to get latest paidAmount and status
                if (paymentType === 'Fine') {
                    const fineResponse = await axiosInstance.get(`/Fine/${selectedEntity._id || selectedEntity.fineId}`);
                    if (fineResponse.data) {
                        setSelectedEntity(fineResponse.data);
                    }
                } else {
                    // For loans/advances, refresh to get updated paidAmount and status
                    const loanResponse = await axiosInstance.get(`/Employee/loans/${selectedEntity._id || selectedEntity.id}`);
                    if (loanResponse.data) {
                        setSelectedEntity(loanResponse.data);
                    }
                }
            } catch (error) {
                console.error('Error refreshing payments:', error);
            }

            if (onSuccess) {
                onSuccess();
            }

            // Close modal after successful payment
            onClose();
        } catch (error) {
            console.error('Error creating payment:', error);
            toast({
                title: "Error",
                description: error.response?.data?.message || "Failed to record payment",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-gray-100">
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-teal-50/30 to-white">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Add Payment</h2>
                        <p className="text-sm text-gray-500 mt-1">Record a new payment for fine, loan, or advance.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors bg-white shadow-sm border border-gray-200"
                    >
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-8 py-6">
                    {/* Payment Type Selection */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Payment Type <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={paymentType}
                            onChange={(e) => {
                                setPaymentType(e.target.value);
                                setSelectedFineId('');
                                setSelectedLoanId('');
                                setSelectedEntity(null);
                                setPaymentAmount('');
                                setSelectedCardIndex(null);
                            }}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-gray-50/50 hover:bg-gray-50 transition-colors"
                        >
                            <option value="">Select Payment Type</option>
                            <option value="Fine">Fine</option>
                            <option value="Loan">Loan</option>
                            <option value="Advance">Advance</option>
                        </select>
                    </div>

                    {/* Fine Selection */}
                    {paymentType === 'Fine' && (
                        <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Fine ID <span className="text-red-500">*</span>
                            </label>
                            {fetching ? (
                                <div className="text-gray-500 text-sm flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                    Loading fines...
                                </div>
                            ) : (
                                <select
                                    value={selectedFineId}
                                    onChange={(e) => handleFineSelect(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-gray-50/50 hover:bg-gray-50 transition-colors"
                                >
                                    <option value="">Select Fine ID</option>
                                    {fines.map((fine) => (
                                        <option key={fine._id || fine.fineId} value={fine.fineId || fine._id}>
                                            {fine.fineId} - {fine.assignedEmployees?.[0]?.employeeName || 'N/A'}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}

                    {/* Loan/Advance Selection */}
                    {(paymentType === 'Loan' || paymentType === 'Advance') && (
                        <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {paymentType} ID <span className="text-red-500">*</span>
                            </label>
                            {fetching ? (
                                <div className="text-gray-500 text-sm flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                    Loading {paymentType.toLowerCase()}s...
                                </div>
                            ) : (
                                <select
                                    value={selectedLoanId}
                                    onChange={(e) => handleLoanSelect(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-gray-50/50 hover:bg-gray-50 transition-colors"
                                >
                                    <option value="">Select {paymentType} ID</option>
                                    {loans.map((loan) => (
                                        <option key={loan.id || loan._id} value={loan.loanId || loan.id || loan._id}>
                                            {loan.loanId || loan.id} - {loan.employeeName || 'N/A'} - {loan.amount} AED
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}

                    {/* Entity Details */}
                    {selectedEntity && (
                        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="grid grid-cols-2 gap-4 mb-8 p-6 bg-white border border-gray-100 shadow-sm rounded-2xl">
                                <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Name</span>
                                    <p className="text-sm font-semibold text-gray-800 mt-1">
                                        {paymentType === 'Fine'
                                            ? selectedEntity.assignedEmployees?.[0]?.employeeName || 'N/A'
                                            : selectedEntity.employeeName || 'N/A'}
                                    </p>
                                </div>
                                <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Type</span>
                                    <p className="text-sm font-semibold text-gray-800 mt-1">
                                        {paymentType === 'Fine'
                                            ? selectedEntity.fineType || selectedEntity.category || 'N/A'
                                            : selectedEntity.type || 'N/A'}
                                    </p>
                                </div>
                                <div className="p-4 bg-red-50/50 rounded-xl border border-red-100">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                        {paymentType === 'Fine' ? 'Total Fine Amount' : `Total ${paymentType} Amount`}
                                    </span>
                                    <p className="text-lg font-bold text-red-600 mt-1">
                                        {paymentType === 'Fine'
                                            ? (selectedEntity.fineAmount || 0).toLocaleString()
                                            : (selectedEntity.amount || 0).toLocaleString()} AED
                                    </p>
                                </div>
                                {paymentType === 'Fine' && (() => {
                                    const employeeShare = calculateEmployeeShare(selectedEntity);
                                    const fineAmount = selectedEntity.fineAmount || 0;
                                    if (employeeShare !== fineAmount) {
                                        return (
                                            <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Your Share</span>
                                                <p className="text-lg font-bold text-blue-600 mt-1">
                                                    {employeeShare.toLocaleString()} AED
                                                </p>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                                <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                        {paymentType === 'Fine' ? 'Payment Duration' : 'Loan Duration'}
                                    </span>
                                    <p className="text-sm font-semibold text-gray-800 mt-1">
                                        {paymentType === 'Fine'
                                            ? selectedEntity.payableDuration || 'N/A'
                                            : selectedEntity.duration || 'N/A'} months
                                    </p>
                                </div>
                                <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                        {paymentType === 'Fine' ? 'Applicable Months' : 'Loan Deduction Start'}
                                    </span>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {monthBoxes.length > 0 ? (
                                            monthBoxes.map((box, index) => (
                                                <span
                                                    key={index}
                                                    className={`px-3 py-1 rounded-lg text-sm font-medium border ${box.isPaid
                                                            ? 'bg-green-50 text-green-700 border-green-200'
                                                            : 'bg-red-50 text-red-700 border-red-200'
                                                        }`}
                                                >
                                                    {box.monthDate.toLocaleDateString('en-US', { month: 'long' })}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-sm font-semibold text-gray-800">
                                                {paymentType === 'Fine'
                                                    ? selectedEntity.monthStart || 'N/A'
                                                    : (selectedEntity.monthStart ? new Date(selectedEntity.monthStart + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'N/A')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="p-4 bg-green-50/50 rounded-xl border border-green-100">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Paid Amount</span>
                                    <p className="text-lg font-bold text-green-600 mt-1">
                                        {totalPaid.toFixed(2)} AED
                                    </p>
                                </div>
                                <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Remaining Amount</span>
                                    <p className="text-lg font-bold text-amber-600 mt-1">
                                        {remainingAmount.toFixed(2)} AED
                                    </p>
                                    {paymentType === 'Fine' && (() => {
                                        const empShare = calculateEmployeeShare(selectedEntity);
                                        const fineAmt = selectedEntity.fineAmount || 0;
                                        if (empShare !== fineAmt) {
                                            return (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    (Out of {empShare.toLocaleString()} AED share)
                                                </p>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            </div>

                            {/* Payment Duration Boxes */}
                            {monthBoxes.length > 0 && (
                                <div className="mb-8 p-6 bg-white border border-gray-100 shadow-sm rounded-2xl">
                                    <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-teal-500"></div>
                                        Payment Schedule
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                        {monthBoxes.map((box, index) => (
                                            <div
                                                key={index}
                                                onClick={() => handleCardClick(index, box)}
                                                className={`p-4 rounded-xl border-2 transition-all relative overflow-hidden group hover:shadow-md cursor-pointer ${box.isPaid
                                                        ? 'bg-green-50 border-green-500'
                                                        : selectedCardIndex === index
                                                            ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500/20'
                                                            : 'bg-red-50 border-red-500'
                                                    }`}
                                            >
                                                <div className={`text-[11px] font-bold uppercase tracking-wider mb-2 relative z-10 flex items-center justify-between ${box.isPaid ? 'text-green-700' : 'text-red-700'
                                                    }`}>
                                                    {box.month}
                                                    {box.isPaid && (
                                                        <span className="text-green-600 bg-green-100 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">✓</span>
                                                    )}
                                                    {box.isNotPaid && (
                                                        <span className="text-red-600 bg-red-100 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">✗</span>
                                                    )}
                                                </div>
                                                <div className={`text-sm font-bold mb-1 relative z-10 ${box.isPaid ? 'text-green-700' : 'text-red-700'
                                                    }`}>
                                                    {box.paidAmount.toFixed(2)} <span className="text-xs font-normal text-gray-500">/ {box.monthlyAmount.toFixed(2)} AED</span>
                                                </div>
                                                {box.isNotPaid && (
                                                    <div className="text-[10px] text-red-600/80 font-medium relative z-10 mt-2">
                                                        Remaining: {box.remaining.toFixed(2)} AED
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Payment Amount Input */}
                            <div className="mb-2 p-6 bg-teal-50/30 border border-teal-100 rounded-2xl">
                                <label className="block text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                                    Payment Amount (AED) <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">AED</span>
                                    <input
                                        type="number"
                                        value={paymentAmount}
                                        onChange={(e) => {
                                            setPaymentAmount(e.target.value);
                                            setSelectedCardIndex(null);
                                        }}
                                        min="0"
                                        step="0.01"
                                        className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-lg font-bold text-gray-900 bg-white placeholder-gray-300 shadow-sm transition-all"
                                        placeholder="0.00"
                                    />
                                </div>
                                <p className={`text-xs font-medium mt-2 flex items-center gap-1 ${parseFloat(paymentAmount) > (remainingAmount + 0.01) ? 'text-red-500' : 'text-gray-500'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                    {parseFloat(paymentAmount) > (remainingAmount + 0.01)
                                        ? `Error: Amount exceeds remaining balance (${remainingAmount.toFixed(2)} AED)`
                                        : `Remaining amount: ${remainingAmount.toFixed(2)} AED`}
                                </p>
                            </div>

                            {/* Attachment Field */}
                            <div className="mb-8 p-6 bg-white border border-gray-100 shadow-sm rounded-2xl">
                                <label className="block text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                                    Attachment (Optional)
                                </label>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-200 hover:border-teal-400 rounded-xl cursor-pointer transition-all group flex-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 group-hover:text-teal-500"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                        <span className="text-sm font-semibold text-gray-500 group-hover:text-teal-600">
                                            {attachmentName || "Upload Receipt or Document"}
                                        </span>
                                        <input
                                            type="file"
                                            className="hidden"
                                            onChange={handleAttachmentChange}
                                            accept="image/*,application/pdf"
                                        />
                                    </label>
                                    {attachmentName && (
                                        <button
                                            onClick={() => {
                                                setAttachment(null);
                                                setAttachmentName('');
                                            }}
                                            className="p-3 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                            title="Remove File"
                                        >
                                            <X size={20} />
                                        </button>
                                    )}
                                </div>
                                {attachmentName && (
                                    <div className="mt-3 p-3 bg-teal-50 border border-teal-200 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <FileText size={16} className="text-teal-600" />
                                            <span className="text-sm font-medium text-teal-800">{attachmentName}</span>
                                        </div>
                                    </div>
                                )}
                                <p className="text-[11px] text-gray-400 mt-2">Max file size: 5MB (PDF or Image)</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-gray-100 bg-gray-50/80 mt-auto">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-white hover:shadow-sm hover:text-gray-800 transition-all"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handlePayNow}
                        disabled={loading || !selectedEntity || !paymentAmount || parseFloat(paymentAmount) <= 0 || parseFloat(paymentAmount) > (remainingAmount + 0.01)}
                        className="px-6 py-2.5 bg-teal-500 hover:bg-teal-600 hover:shadow-md hover:shadow-teal-500/20 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading && <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />}
                        {loading ? 'Processing...' : 'Pay Now'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddPaymentModal;
