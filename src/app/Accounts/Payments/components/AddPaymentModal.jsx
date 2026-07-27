'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Select from 'react-select';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { resolveEmployeeFinePayableAmount } from '@/utils/finePayableAmount';
import { isPaymentCountableTowardPaid } from '@/utils/paymentStatusDisplay';
import { useZohoOrganizations } from '@/hooks/useZohoOrganizations';
import { ERP_ATTACHMENT_ACCEPT, validateErpUploadFile } from '@/utils/uploadFileTypes';
import ZohoOrganizationPicker from '@/components/ZohoOrganizationPicker';
import { mapZohoBankAccounts, mapZohoPaymentAccounts } from '@/utils/zohoVendorPayments';
import { Loader2, RefreshCw, X, FileText, Link2 } from 'lucide-react';

const bankingSelectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: 44,
        borderRadius: '0.75rem',
        borderColor: state.isFocused ? '#14b8a6' : '#e5e7eb',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(20, 184, 166, 0.2)' : 'none',
        backgroundColor: 'rgba(249, 250, 251, 0.5)',
        cursor: 'pointer',
        '&:hover': {
            borderColor: state.isFocused ? '#14b8a6' : '#d1d5db',
        },
    }),
    menuPortal: (base) => ({ ...base, zIndex: 100000 }),
};

function normalizeZohoAccountType(type) {
    return String(type || '')
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Zoho Expense "From Account" / account_id — P&L expense only (not bank/cash/AP). */
function isValidFineCompanyFromAccount(type, name = '') {
    const t = normalizeZohoAccountType(type);
    const n = String(name || '').toLowerCase();
    if (
        t === 'cash' ||
        t === 'bank' ||
        t === 'credit card' ||
        t === 'undeposited funds' ||
        t.includes('accounts payable') ||
        t.includes('accounts receivable') ||
        t.includes('payment clearing') ||
        /\bcash\b/.test(t) ||
        /\bbank\b/.test(t) ||
        t.includes('credit card') ||
        /accounts\s*payable/i.test(n) ||
        /accounts\s*receivable/i.test(n)
    ) {
        return false;
    }
    if (
        t.includes('expense') ||
        t.includes('cost of goods') ||
        t.includes('cost of sales') ||
        t === 'other expense'
    ) {
        return true;
    }
    // Allow unknown P&L types; Zoho will still validate on post.
    return Boolean(t) && !/asset|liability|equity|income|revenue/.test(t);
}

/** Base64 data URLs above this size freeze the tab on JSON.stringify / re-render. */
const MAX_INLINE_ATTACHMENT_CHARS = 350_000;

function attachmentForApi(attachment, { includeData = true } = {}) {
    if (!attachment) return null;
    const payload = {
        name: attachment.name || '',
        mimeType: attachment.mimeType || '',
    };
    if (
        includeData &&
        typeof attachment.data === 'string' &&
        attachment.data.length > 0 &&
        attachment.data.length <= MAX_INLINE_ATTACHMENT_CHARS
    ) {
        payload.data = attachment.data;
    }
    return payload;
}

const AddPaymentModal = ({ isOpen, onClose, onSuccess, prefill = null }) => {
    const prefillAppliedKeyRef = useRef('');
    const { toast } = useToast();
    const [paymentType, setPaymentType] = useState('');
    const [selectedFineId, setSelectedFineId] = useState('');
    const [selectedLoanId, setSelectedLoanId] = useState('');
    const [fines, setFines] = useState([]);
    const [bulkFines, setBulkFines] = useState([]);
    const [utilityBills, setUtilityBills] = useState([]);
    const [loans, setLoans] = useState([]);
    const [selectedEntity, setSelectedEntity] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [existingPayments, setExistingPayments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [selectedCardIndex, setSelectedCardIndex] = useState(null);
    const [attachment, setAttachment] = useState(null);
    const [attachmentName, setAttachmentName] = useState('');
    const [paymentSource, setPaymentSource] = useState('');
    const [rewardCompanyId, setRewardCompanyId] = useState('');
    const [zohoAccounts, setZohoAccounts] = useState([]);
    const [zohoBankAccounts, setZohoBankAccounts] = useState([]);
    const [expenseAccountId, setExpenseAccountId] = useState('');
    const [paidThroughAccountId, setPaidThroughAccountId] = useState('');
    const [zohoAccountsLoading, setZohoAccountsLoading] = useState(false);
    const [zohoBanksLoading, setZohoBanksLoading] = useState(false);
    const [zohoBankingNeedsReconnect, setZohoBankingNeedsReconnect] = useState(false);
    const [zohoReconnectLoading, setZohoReconnectLoading] = useState(false);

    const preferredRewardOrgId = String(
        prefill?.organizationId ||
            prefill?.reward?.zohoOrganizationId ||
            prefill?.loan?.zohoOrganizationId ||
            prefill?.fines?.[0]?.zohoOrganizationId ||
            '',
    ).trim();
    const preferredRewardCompanyId = String(
        rewardCompanyId || prefill?.companyId || '',
    ).trim();
    const isRewardPayment = paymentType === 'Reward' || Boolean(prefill?.reward);
    const isLoanPayment =
        paymentType === 'Loan' ||
        paymentType === 'Advance' ||
        Boolean(prefill?.loan);
    const isUtilityEmployeeBalance =
        paymentType === 'UtilityBill' &&
        String(prefill?.mode || '').toLowerCase() === 'employee_balance';
    const isFineCompanyPayment =
        paymentType === 'Fine' || Boolean(prefill?.fines?.length);
    const isZohoStaffPayout =
        isRewardPayment || isLoanPayment || isUtilityEmployeeBalance || isFineCompanyPayment;

    const {
        options: zohoOrgOptions,
        organizationId: zohoOrganizationId,
        setOrganizationId: setZohoOrganizationId,
        active: activeZohoOrg,
        showPicker: showZohoOrgPicker,
        loading: zohoOrgLoading,
    } = useZohoOrganizations({
        enabled: isOpen && isZohoStaffPayout,
        preferredOrganizationId: preferredRewardOrgId,
        preferredCompanyId: preferredRewardCompanyId,
    });

    const expenseAccountOptions = useMemo(() => {
        const rows = zohoAccounts.map((a) => ({
            id: a.id,
            value: a.id,
            label: a.label || a.name || a.id,
            name: a.name || a.label || '',
            type: a.type || '',
        }));
        if (!isFineCompanyPayment) return rows;
        return rows.filter((a) => isValidFineCompanyFromAccount(a.type, a.name || a.label));
    }, [zohoAccounts, isFineCompanyPayment]);

    const bankAccountOptions = useMemo(
        () =>
            zohoBankAccounts.map((a) => ({
                value: a.id,
                label: a.label || a.name || a.id,
                name: a.name || a.label || '',
                type: a.type || '',
            })),
        [zohoBankAccounts],
    );

    const paidThroughCoaOptions = useMemo(
        () =>
            expenseAccountOptions.map((a) => ({
                value: a.id,
                label: a.label,
                name: a.name,
            })),
        [expenseAccountOptions],
    );

    const paymentSourceOptions = useMemo(
        () => [
            { value: 'Salary', label: 'Salary' },
            { value: 'End of Benefits', label: 'End of Benefits' },
            { value: 'Cash', label: 'Cash' },
        ],
        [],
    );

    const paymentTypeOptions = useMemo(
        () => [
            { value: 'Fine', label: 'Fine' },
            { value: 'Loan', label: 'Loan' },
            { value: 'Advance', label: 'Advance' },
            { value: 'Reward', label: 'Reward' },
            { value: 'UtilityBill', label: 'Utility Bill' },
        ],
        [],
    );

    const fineSelectOptions = useMemo(
        () =>
            fines.map((fine) => {
                const value = fine.fineId || fine._id;
                const emp = fine.assignedEmployees?.[0]?.employeeName || 'N/A';
                return {
                    value,
                    label: `${fine.fineId || value} - ${emp}`,
                };
            }),
        [fines],
    );

    const loanSelectOptions = useMemo(
        () =>
            loans.map((loan) => {
                const value = loan.loanId || loan.id || loan._id;
                return {
                    value,
                    label: `${loan.loanId || loan.id || value} - ${loan.employeeName || 'N/A'} - ${loan.amount} AED`,
                };
            }),
        [loans],
    );

    const selectedExpenseAccount = expenseAccountOptions.find((a) => a.id === expenseAccountId);
    const selectedPaidThrough = (
        isFineCompanyPayment ? bankAccountOptions : paidThroughCoaOptions
    ).find((a) => a.value === paidThroughAccountId);
    const selectedPaymentSource =
        paymentSourceOptions.find((o) => o.value === paymentSource) || null;
    const selectedPaymentType =
        paymentTypeOptions.find((o) => o.value === paymentType) || null;
    const selectedFineOption =
        fineSelectOptions.find((o) => o.value === selectedFineId) || null;
    const selectedLoanOption =
        loanSelectOptions.find((o) => o.value === selectedLoanId) || null;

    // Fetch fines and loans when payment type changes (or apply prefill once)
    useEffect(() => {
        if (!isOpen) {
            prefillAppliedKeyRef.current = '';
            setPaymentType('');
            setSelectedFineId('');
            setSelectedLoanId('');
            setSelectedEntity(null);
            setPaymentAmount('');
            setExistingPayments([]);
            setSelectedCardIndex(null);
            setAttachment(null);
            setAttachmentName('');
            setPaymentSource('');
            setBulkFines([]);
            setUtilityBills([]);
            setRewardCompanyId('');
            setZohoAccounts([]);
            setExpenseAccountId('');
            setPaidThroughAccountId('');
            setLoading(false);
            return;
        }

        if (prefill?.utilityBills?.length) {
            const key = `utility:${prefill.batchId || ''}:${prefill.utilityBills.map((b) => b._id).join(',')}`;
            if (prefillAppliedKeyRef.current === key) return;
            prefillAppliedKeyRef.current = key;
            setPaymentType('UtilityBill');
            // Checkboxes in payment: default selected unless prefill marks selected:false
            const billsWithSelect = prefill.utilityBills.map((b) => ({
                ...b,
                selected: b.selected !== false,
            }));
            setUtilityBills(billsWithSelect);
            const first = billsWithSelect.find((b) => b.selected) || billsWithSelect[0];
            setSelectedEntity(first);
            const totalBalance = billsWithSelect
                .filter((b) => b.selected)
                .reduce((sum, b) => sum + (parseFloat(b.balance) || 0), 0);
            setPaymentAmount(totalBalance.toFixed(2));
            setPaymentSource(prefill.paymentSource || 'Cash');
            return;
        }

        if (prefill?.fines?.length) {
            const key = `fines:${prefill.fines.map((f) => f._id || f.fineId).join(',')}`;
            if (prefillAppliedKeyRef.current === key) return;
            prefillAppliedKeyRef.current = key;
            setPaymentType('Fine');
            setBulkFines(prefill.fines);
            setFines(prefill.fines);
            const firstFine = prefill.fines[0];
            setSelectedEntity(firstFine);
            setSelectedFineId(firstFine.fineId || firstFine._id || '');
            const totalBalance = prefill.fines.reduce((sum, f) => sum + (parseFloat(f.balance) || 0), 0);
            setPaymentAmount(totalBalance.toFixed(2));
            const defaultSource =
                prefill.paymentSource ||
                (firstFine.sourceOfIncome === 'End of Service' ? 'End of Benefits' : 'Salary');
            setPaymentSource(defaultSource);
            return;
        }

        if (prefill?.loan) {
            const loan = prefill.loan;
            const loanType = loan.type === 'Advance' ? 'Advance' : 'Loan';
            const key = `loan:${loan._id || loan.loanId || loan.id}`;
            if (prefillAppliedKeyRef.current === key) return;
            prefillAppliedKeyRef.current = key;
            setPaymentType(loanType);
            setLoans([loan]);
            setSelectedEntity(loan);
            setSelectedLoanId(loan.loanId || loan._id || loan.id || '');
            const balance =
                prefill.balance != null
                    ? parseFloat(prefill.balance)
                    : Math.max(0, (parseFloat(loan.amount) || 0) - (parseFloat(loan.paidAmount) || 0));
            setPaymentAmount(balance.toFixed(2));
            const prefillExpenseId =
                prefill.expenseAccountId || loan.expenseAccountId || '';
            if (prefillExpenseId) {
                setExpenseAccountId(String(prefillExpenseId));
            }
            const prefillPaidThroughId =
                prefill.paidThroughAccountId || loan.paidThroughAccountId || '';
            if (prefillPaidThroughId) {
                setPaidThroughAccountId(String(prefillPaidThroughId));
            }
            return;
        }

        if (prefill?.reward) {
            const reward = prefill.reward;
            const key = `reward:${reward._id || reward.rewardId}`;
            if (prefillAppliedKeyRef.current === key) return;
            prefillAppliedKeyRef.current = key;
            setPaymentType('Reward');
            setSelectedEntity(reward);
            setSelectedLoanId(reward.rewardId || reward._id || '');
            const balance =
                prefill.balance != null
                    ? parseFloat(prefill.balance)
                    : Math.max(0, (parseFloat(reward.amount) || 0) - (parseFloat(reward.paidAmount) || 0));
            setPaymentAmount(balance.toFixed(2));
            setPaymentSource(prefill.paymentSource || 'Cash');
            const prefillExpenseId =
                prefill.expenseAccountId || reward.expenseAccountId || '';
            if (prefillExpenseId) {
                setExpenseAccountId(String(prefillExpenseId));
            }
            const prefillPaidThroughId =
                prefill.paidThroughAccountId || reward.paidThroughAccountId || '';
            if (prefillPaidThroughId) {
                setPaidThroughAccountId(String(prefillPaidThroughId));
            }
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
                        }
                    });
                    const approvedLoans = (response.data.loans || []).filter(
                        (loan) =>
                            loan.status === 'Approved' ||
                            loan.approvalStatus === 'Approved' ||
                            loan.status === 'Pending Payment to Employee' ||
                            loan.approvalStatus === 'Pending Payment to Employee'
                    );
                    setLoans(approvedLoans);
                } catch (error) {
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

        if (paymentType && paymentType !== 'UtilityBill') {
            fetchData();
        }
        // toast omitted from deps on purpose — unstable identity caused freeze loops
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paymentType, isOpen, prefill]);

    // Resolve employee company → VEGA / NNIT Zoho org for cash reward / loan / advance pay
    useEffect(() => {
        if (!isOpen || !isZohoStaffPayout) return;
        const empId = String(
            selectedEntity?.employeeId ||
                prefill?.employeeId ||
                prefill?.reward?.employeeId ||
                prefill?.loan?.employeeId ||
                '',
        ).trim();
        if (!empId) return;

        let cancelled = false;
        (async () => {
            try {
                const res = await axiosInstance.get(`/Employee/${encodeURIComponent(empId)}`, {
                    skipToast: true,
                    validateStatus: (s) => s === 200 || s === 404,
                });
                if (cancelled || res.status !== 200) return;
                const emp = res.data?.employee || res.data;
                const companyId = String(
                    emp?.company?._id || emp?.company || emp?.companyId || '',
                ).trim();
                if (companyId) setRewardCompanyId(companyId);
            } catch {
                /* ignore — org picker still works manually */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen, isZohoStaffPayout, selectedEntity, prefill]);

    // Load Zoho Chart of Accounts for From Account / Paid Through
    useEffect(() => {
        if (!isOpen || !isZohoStaffPayout || !zohoOrganizationId) {
            return undefined;
        }

        let cancelled = false;
        setZohoAccountsLoading(true);
        (async () => {
            try {
                // Fine company: same Expense Account list as Zoho → Expenses → Add Expense
                // (not full CoA / not Banking cash like Petty Cash - Raseel)
                const endpoint = isFineCompanyPayment
                    ? '/zoho/expenses/support'
                    : '/zoho/bills/support';
                const response = await axiosInstance.get(endpoint, {
                    params: { organizationId: zohoOrganizationId },
                    skipToast: true,
                    timeout: 90000,
                });
                if (cancelled) return;
                const mapped = mapZohoPaymentAccounts(response?.data?.data?.accounts);
                setZohoAccounts(mapped);
                setExpenseAccountId((prev) =>
                    prev && mapped.some((a) => a.id === prev) ? prev : '',
                );
                if (!isFineCompanyPayment) {
                    setPaidThroughAccountId((prev) =>
                        prev && mapped.some((a) => a.id === prev) ? prev : '',
                    );
                }
                if (!mapped.length) {
                    toast({
                        variant: 'destructive',
                        title: 'No Chart of Accounts loaded',
                        description: isFineCompanyPayment
                            ? 'Could not load Zoho expense accounts for From Account. Reconnect Zoho or retry.'
                            : 'Could not load Zoho Chart of Accounts.',
                    });
                }
            } catch (err) {
                if (!cancelled) {
                    setZohoAccounts([]);
                    toast({
                        variant: 'destructive',
                        title: 'Chart of Accounts failed',
                        description:
                            err?.response?.data?.message ||
                            err?.message ||
                            'Could not load Zoho accounts.',
                    });
                }
            } finally {
                if (!cancelled) setZohoAccountsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
        // toast omitted — unstable identity
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, isZohoStaffPayout, zohoOrganizationId, isFineCompanyPayment]);

    const loadZohoBankAccounts = useCallback(async () => {
        if (!zohoOrganizationId) return;
        setZohoBanksLoading(true);
        setZohoBankingNeedsReconnect(false);
        try {
            const response = await axiosInstance.get('/zoho/bankaccounts', {
                params: { organizationId: zohoOrganizationId },
                skipToast: true,
                timeout: 60000,
            });
            const mapped = mapZohoBankAccounts(response?.data?.data?.accounts);
            setZohoBankAccounts(mapped);
            setPaidThroughAccountId((prev) =>
                prev && mapped.some((a) => a.id === prev) ? prev : '',
            );
            if (!mapped.length) {
                toast({
                    variant: 'destructive',
                    title: 'No Zoho bank accounts',
                    description:
                        'Zoho Banking returned no accounts. Reconnect Zoho with banking.READ scope if the list exists in Zoho Books → Banking.',
                });
            }
        } catch (err) {
            setZohoBankAccounts([]);
            const msg =
                err?.response?.data?.message ||
                err?.message ||
                'Could not load Zoho Banking accounts.';
            const needsReconnect = /banking\.READ|not authorized|unauthorized|permission missing/i.test(
                msg,
            );
            setZohoBankingNeedsReconnect(needsReconnect);
            toast({
                variant: 'destructive',
                title: needsReconnect
                    ? 'Zoho Banking permission missing'
                    : 'Bank list failed',
                description: needsReconnect
                    ? 'Click “Reconnect Zoho” next to Banking, approve banking.READ, then Refresh.'
                    : msg,
            });
        } finally {
            setZohoBanksLoading(false);
        }
    }, [zohoOrganizationId, toast]);

    const reconnectZohoForBanking = useCallback(async () => {
        if (!zohoOrganizationId) {
            toast({
                variant: 'destructive',
                title: 'Select organization',
                description: 'Pick VEGA or NNIT first, then reconnect Zoho.',
            });
            return;
        }
        setZohoReconnectLoading(true);
        try {
            const response = await axiosInstance.get('/zoho/auth-url', {
                params: { organizationId: zohoOrganizationId },
                skipToast: true,
            });
            const authorizationUrl = response?.data?.data?.authorizationUrl;
            if (!authorizationUrl) {
                throw new Error('Authorization URL was not returned');
            }
            const popup = window.open(authorizationUrl, '_blank', 'noopener,noreferrer');
            if (!popup) {
                window.location.assign(authorizationUrl);
                return;
            }
            toast({
                title: 'Approve Zoho access',
                description:
                    'In the Zoho window, Accept (includes Banking). Then return here and click Refresh.',
            });
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Could not start Zoho reconnect',
                description:
                    err?.response?.data?.message ||
                    err?.message ||
                    'Failed to open Zoho authorization.',
            });
        } finally {
            setZohoReconnectLoading(false);
        }
    }, [zohoOrganizationId, toast]);

    // Load full Zoho Banking list for Payment to company Banking dropdown
    useEffect(() => {
        if (!isOpen || !isFineCompanyPayment || !zohoOrganizationId) {
            return undefined;
        }
        void loadZohoBankAccounts();
        return undefined;
    }, [isOpen, isFineCompanyPayment, zohoOrganizationId, loadZohoBankAccounts]);

    // Fetch existing payments when entity is selected (not for utility bills)
    useEffect(() => {
        if (!selectedEntity || !paymentType || paymentType === 'UtilityBill') return;

        const fetchExistingPayments = async () => {
            try {
                let params = {
                    relatedEntityType:
                        paymentType === 'Loan' || paymentType === 'Advance'
                            ? paymentType
                            : paymentType === 'Reward'
                              ? 'Reward'
                              : 'Fine',
                };

                if (paymentType === 'Fine') {
                    params.referenceId = selectedEntity.fineId;
                } else if (paymentType === 'Reward') {
                    params.referenceId = selectedEntity.rewardId;
                } else {
                    params.relatedEntityId = selectedEntity._id || selectedEntity.id;
                }

                const response = await axiosInstance.get('/Payment', { params });
                setExistingPayments(response.data.payments || []);
            } catch (error) {
            }
        };

        fetchExistingPayments();
    }, [selectedEntity, paymentType, isOpen]);


    const resolveFineEmployeeShare = (fine) => {
        if (!fine) return 0;
        const empId =
            prefill?.employeeId ||
            fine.assignedEmployees?.find(
                (emp) => emp.employeeId && !['VEGA-HR-0000', 'VEGA_INTERNAL'].includes(emp.employeeId),
            )?.employeeId;
        if (!empId) return 0;
        return resolveEmployeeFinePayableAmount(fine, empId);
    };

    // Handle fine selection
    const handleFineSelect = (fineId) => {
        setSelectedFineId(fineId);
        const fine = fines.find(f => f.fineId === fineId || f._id === fineId);
        if (fine) {
            setSelectedEntity(fine);
            // Calculate payment amount per month based on employee's share
            const duration = fine.payableDuration || 1;
            const employeeShare = resolveFineEmployeeShare(fine);
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
            const employeeShare = resolveFineEmployeeShare(selectedEntity);
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

        const countablePayments = existingPayments.filter((p) =>
            isPaymentCountableTowardPaid(p.status)
        );

        // Sort completed payments by date (oldest first) to assign them sequentially to months
        const sortedPayments = [...countablePayments].sort((a, b) => {
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
                // Skip empty/invalid payments so this loop can never spin forever
                if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
                    remainingPayments.shift();
                    continue;
                }

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
            const isPartial = paidAmount > tolerance && !isPaid;
            const isNotPaid = !isPaid && !isPartial;

            boxes.push({
                month: monthLabel,
                monthDate,
                monthlyAmount,
                paidAmount,
                isPaid,
                isPartial,
                isNotPaid,
                remaining: monthlyAmount - paidAmount
            });
        }

        return boxes;
    };

    const monthBoxes = generateMonthBoxes();

    // Calculate total paid and remaining
    const totalPaid = existingPayments
        .filter((p) => isPaymentCountableTowardPaid(p.status))
        .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    // For display: Total Fine Amount is always fineAmount (constant)
    // For calculation: Use employee's share (what they actually owe)
    const displayTotalAmount = selectedEntity
        ? (paymentType === 'Fine'
            ? resolveFineEmployeeShare(selectedEntity)
            : (selectedEntity.amount || 0))
        : 0;
    const employeeShare = selectedEntity && paymentType === 'Fine'
        ? (parseFloat(selectedEntity.employeeShare) || resolveFineEmployeeShare(selectedEntity))
        : displayTotalAmount;
    const remainingAmount = selectedEntity && paymentType === 'Fine' && selectedEntity.balance != null
        ? Math.max(0, parseFloat(selectedEntity.balance) || 0)
        : Math.max(0, employeeShare - totalPaid);

    const bulkFinesTotalBalance = bulkFines.reduce((sum, f) => sum + (parseFloat(f.balance) || 0), 0);
    const selectedUtilityBills = utilityBills.filter((b) => b.selected);
    const utilityBillsTotalBalance = selectedUtilityBills.reduce(
        (sum, b) => sum + (parseFloat(b.balance) || 0),
        0,
    );
    const allUtilityBillsSelected =
        utilityBills.length > 0 && selectedUtilityBills.length === utilityBills.length;
    const isBulkFinePayment = paymentType === 'Fine' && bulkFines.length > 0;
    const isUtilityBillPayment = paymentType === 'UtilityBill' && utilityBills.length > 0;
    const activeRemainingAmount = isUtilityBillPayment
        ? utilityBillsTotalBalance
        : isBulkFinePayment
          ? bulkFinesTotalBalance
          : remainingAmount;

    const setUtilityBillSelected = (billId, checked) => {
        setUtilityBills((prev) =>
            prev.map((b) =>
                String(b._id) === String(billId) ? { ...b, selected: checked } : b,
            ),
        );
    };

    const setAllUtilityBillsSelected = (checked) => {
        setUtilityBills((prev) => prev.map((b) => ({ ...b, selected: checked })));
    };

    useEffect(() => {
        // Don't fight the user while a submit is in flight (was contributing to freeze loops)
        if (loading) return;
        if (isUtilityBillPayment) {
            setPaymentAmount(utilityBillsTotalBalance.toFixed(2));
            setSelectedCardIndex(null);
            return;
        }
        if (isBulkFinePayment) {
            setPaymentAmount(bulkFinesTotalBalance.toFixed(2));
            setSelectedCardIndex(null);
            return;
        }
        if (selectedEntity) {
            setPaymentAmount(remainingAmount.toFixed(2));
            setSelectedCardIndex(null);
        }
    }, [
        loading,
        remainingAmount,
        selectedEntity,
        isBulkFinePayment,
        bulkFinesTotalBalance,
        isUtilityBillPayment,
        utilityBillsTotalBalance,
    ]);

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
        const file = e.target.files?.[0];
        if (!file) return;

        const check = validateErpUploadFile(file);
        if (!check.ok) {
            toast({
                title: 'Validation Error',
                description: check.message,
                variant: 'destructive',
            });
            e.target.value = '';
            return;
        }

        setAttachmentName(file.name);

        // Utility bills + large PDFs: keep filename only. Full base64 in React state freezes the tab.
        const metadataOnly =
            paymentType === 'UtilityBill' || file.size > 250 * 1024;

        if (metadataOnly) {
            setAttachment({
                name: file.name,
                mimeType: file.type || '',
                size: file.size,
            });
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const data = reader.result;
            if (typeof data === 'string' && data.length > MAX_INLINE_ATTACHMENT_CHARS) {
                setAttachment({
                    name: file.name,
                    mimeType: file.type || '',
                    size: file.size,
                });
                toast({
                    title: 'Attachment note',
                    description: 'File is large — only the filename will be saved with this payment.',
                });
                return;
            }
            setAttachment({
                data,
                name: file.name,
                mimeType: file.type || '',
            });
        };
        reader.readAsDataURL(file);
    };

    // Handle payment submission
    const handlePayNow = async () => {
        if (
            (!selectedEntity && !isBulkFinePayment && !isUtilityBillPayment) ||
            !paymentAmount ||
            parseFloat(paymentAmount) <= 0
        ) {
            toast({
                title: "Validation Error",
                description: "Please enter a valid payment amount",
                variant: "destructive",
            });
            return;
        }

        if (parseFloat(paymentAmount) > (activeRemainingAmount + 0.01)) {
            toast({
                title: "Validation Error",
                description: `Payment amount cannot exceed the remaining amount (${activeRemainingAmount.toFixed(2)} AED)`,
                variant: "destructive",
            });
            return;
        }

        if (!paymentSource) {
            toast({
                title: "Validation Error",
                description: "Please select a payment source",
                variant: "destructive",
            });
            return;
        }

        if (paymentSource === 'Cash' && !attachment) {
            toast({
                title: "Validation Error",
                description: "Attachment is required when payment source is Cash",
                variant: "destructive",
            });
            return;
        }

        if (
            paymentType === 'Reward' ||
            paymentType === 'Loan' ||
            paymentType === 'Advance' ||
            isUtilityEmployeeBalance ||
            isFineCompanyPayment
        ) {
            if (!zohoOrganizationId) {
                toast({
                    title: 'Validation Error',
                    description: 'Select the Zoho organization (VEGA or NNIT) for this employee/company.',
                    variant: 'destructive',
                });
                return;
            }
            if (!expenseAccountId || !paidThroughAccountId) {
                toast({
                    title: 'Validation Error',
                    description: isFineCompanyPayment
                        ? 'Select Banking (Zoho bank) and From Account from Chart of Accounts.'
                        : 'Select Expense account and Paid Through from Zoho Chart of Accounts.',
                    variant: 'destructive',
                });
                return;
            }
            if (expenseAccountId === paidThroughAccountId) {
                toast({
                    title: 'Validation Error',
                    description: isFineCompanyPayment
                        ? 'Banking and From Account must be different.'
                        : 'Expense account and Paid Through must be different.',
                    variant: 'destructive',
                });
                return;
            }
            if (isFineCompanyPayment) {
                const fromOpt = expenseAccountOptions.find((a) => a.id === expenseAccountId);
                if (
                    fromOpt &&
                    !isValidFineCompanyFromAccount(fromOpt.type, fromOpt.name || fromOpt.label)
                ) {
                    toast({
                        title: 'Invalid From Account',
                        description:
                            'From Account must be a Zoho Expense / P&L account (e.g. Fine Expense). Do not use Accounts Payable, Cash, or Bank.',
                        variant: 'destructive',
                    });
                    return;
                }
            }
        }

        // Drop any huge base64 from state before re-render / network (letterhead PDFs etc.)
        if (typeof attachment?.data === 'string' && attachment.data.length > MAX_INLINE_ATTACHMENT_CHARS) {
            setAttachment({
                name: attachment.name,
                mimeType: attachment.mimeType || '',
                size: attachment.size,
            });
        }

        setLoading(true);
        // Let the UI paint "Processing..." before any JSON work / posts
        await new Promise((r) => setTimeout(r, 0));

        try {
            const submitSinglePayment = async (
                fineOrLoan,
                amount,
                type = paymentType,
                { includeAttachment = true } = {},
            ) => {
                let employeeId;
                if (type === 'Fine') {
                    employeeId = prefill?.employeeId || fineOrLoan.assignedEmployees?.[0]?.employeeId;
                } else if (type === 'UtilityBill') {
                    employeeId =
                        prefill?.employeeId ||
                        fineOrLoan.payByEmployeeBusinessId ||
                        'VEGA-HR-0000';
                } else {
                    employeeId = fineOrLoan.employeeId || prefill?.employeeId;
                }

                if (!employeeId) {
                    throw new Error('Employee ID not found');
                }

                const entityRef =
                    type === 'Fine'
                        ? fineOrLoan.fineId
                        : type === 'Reward'
                          ? fineOrLoan.rewardId
                          : type === 'UtilityBill'
                            ? fineOrLoan.referenceId || fineOrLoan.accountNo || fineOrLoan._id
                            : (fineOrLoan.loanId || fineOrLoan.id);

                // Never send multi‑MB base64 — freezes the browser (axios + dedupe guard).
                const includeData = type !== 'UtilityBill';
                const paymentData = {
                    paymentType:
                        type === 'Loan' || type === 'Advance' || type === 'Reward'
                            ? type
                            : type === 'UtilityBill'
                              ? 'UtilityBill'
                              : 'Fine',
                    paidBy: employeeId,
                    amount: parseFloat(amount),
                    status: 'Completed',
                    description:
                        type === 'UtilityBill'
                            ? isUtilityEmployeeBalance
                                ? `Utility employee balance · ${prefill?.utilityType || ''} ${prefill?.billMonth || ''} · ${fineOrLoan.accountNo || ''}`.trim()
                                : `Utility bill payment · ${prefill?.utilityType || ''} ${prefill?.billMonth || ''} · ${fineOrLoan.accountNo || ''}`.trim()
                            : `Payment for ${entityRef}`,
                    referenceId: entityRef,
                    relatedEntityType:
                        type === 'Loan' || type === 'Advance'
                            ? type
                            : type === 'Reward'
                              ? 'Reward'
                              : type === 'UtilityBill'
                                ? 'UtilityBill'
                                : 'Fine',
                    relatedEntityId: fineOrLoan._id || fineOrLoan.id,
                    paymentSource,
                    attachment: includeAttachment
                        ? attachmentForApi(attachment, { includeData })
                        : null,
                    ...(type === 'Reward' ||
                    type === 'Loan' ||
                    type === 'Advance' ||
                    type === 'Fine' ||
                    (type === 'UtilityBill' && isUtilityEmployeeBalance)
                        ? {
                              zohoOrganizationId,
                              expenseAccountId,
                              expenseAccountName: selectedExpenseAccount?.name || '',
                              paidThroughAccountId,
                              paidThroughAccountName: selectedPaidThrough?.name || '',
                              ...(type === 'Fine'
                                  ? {
                                        description: `Expense Refund · Fine ${entityRef}`,
                                        remarks: 'Expense Refund · Tax inclusive',
                                        paymentMode: 'Cash',
                                        isInclusiveTax: true,
                                    }
                                  : {}),
                          }
                        : {}),
                };

                return axiosInstance.post('/Payment', paymentData);
            };

            if (isUtilityBillPayment) {
                // One grouped payment for checked rows; unchecked stay Approved (pending pay)
                const checkedBills = utilityBills.filter((b) => b.selected);
                if (!checkedBills.length) {
                    toast({
                        title: 'Validation Error',
                        description: 'Select at least one utility bill to pay.',
                        variant: 'destructive',
                    });
                    setLoading(false);
                    return;
                }
                const payAmt = parseFloat(paymentAmount);
                const accounts = checkedBills
                    .map((b) => b.accountNo)
                    .filter(Boolean)
                    .join(', ');
                const first = checkedBills[0];
                const utilRes = await submitSinglePayment(
                    {
                        ...first,
                        _id: first._id || first.id,
                        referenceId: isUtilityEmployeeBalance
                            ? first._id || first.id || prefill?.batchId
                            : prefill?.batchId || first.referenceId || first._id,
                        accountNo: isUtilityEmployeeBalance
                            ? first.accountNo || accounts
                            : accounts
                              ? `${checkedBills.length} bill(s) · Acc ${accounts}`
                              : `${checkedBills.length} bill(s)`,
                    },
                    payAmt,
                    'UtilityBill',
                    { includeAttachment: Boolean(attachment) },
                );
                // Full vendor-side pay only. Employee balance uses Zoho journal credit — do not mark utility Paid.
                if (prefill?.batchId && !isUtilityEmployeeBalance) {
                    const billIds = checkedBills.map((b) => b._id).filter(Boolean);
                    await axiosInstance.put(`/UtilityBill/batch/${prefill.batchId}/pay`, {
                        billIds,
                    });
                }
                const utilZoho = utilRes?.data?.zohoSync;
                toast({
                    title: utilZoho && utilZoho.ok === false ? 'Saved in ERP only' : 'Success',
                    description:
                        utilZoho && utilZoho.ok === false
                            ? utilRes?.data?.message || utilZoho.message
                            : isUtilityEmployeeBalance
                              ? 'Utility employee balance paid (Zoho credit posted)'
                              : 'Utility bill payment recorded for selected rows',
                    variant: utilZoho && utilZoho.ok === false ? 'destructive' : 'success',
                });
            } else if (isBulkFinePayment) {
                let remainingPay = parseFloat(paymentAmount);
                let lastZoho = null;
                let lastMessage = '';
                for (const fine of bulkFines) {
                    if (remainingPay <= 0) break;
                    const fineBalance = parseFloat(fine.balance) || 0;
                    if (fineBalance <= 0) continue;
                    const payAmt = Math.min(fineBalance, remainingPay);
                    const res = await submitSinglePayment(fine, payAmt, 'Fine');
                    lastZoho = res?.data?.zohoSync || lastZoho;
                    lastMessage = res?.data?.message || lastMessage;
                    remainingPay -= payAmt;
                }
                toast({
                    title: lastZoho && lastZoho.ok === false ? 'Saved in ERP only' : 'Success',
                    description:
                        lastZoho && lastZoho.ok === false
                            ? lastMessage || lastZoho.message
                            : 'Payments recorded successfully for selected fines',
                    variant: lastZoho && lastZoho.ok === false ? 'destructive' : 'success',
                });
            } else {
                const res = await submitSinglePayment(selectedEntity, paymentAmount, paymentType);
                const zohoSync = res?.data?.zohoSync;
                const apiMessage = res?.data?.message;
                if (zohoSync && zohoSync.ok === false) {
                    toast({
                        title: 'Saved in ERP — not in Zoho',
                        description:
                            apiMessage ||
                            zohoSync.message ||
                            'Payment saved in ERP, but Zoho posting failed.',
                        variant: 'destructive',
                    });
                } else {
                    toast({
                        title: 'Success',
                        description:
                            apiMessage ||
                            (zohoSync?.expenseId
                                ? `Payment recorded and Zoho Expense ${zohoSync.expenseNumber || zohoSync.expenseId} created.`
                                : 'Payment recorded successfully'),
                        variant: 'success',
                    });
                }
            }

            if (!isBulkFinePayment && !isUtilityBillPayment) {
                // Refresh existing payments and entity data to show updated colors and total amount
                try {
                    let params = {
                        relatedEntityType:
                            paymentType === 'Loan' || paymentType === 'Advance'
                                ? 'Loan'
                                : paymentType === 'Reward'
                                  ? 'Reward'
                                  : 'Fine',
                    };

                    if (paymentType === 'Fine') {
                        params.referenceId = selectedEntity.fineId;
                    } else if (paymentType === 'Reward') {
                        params.referenceId = selectedEntity.rewardId;
                    } else {
                        params.relatedEntityId = selectedEntity._id || selectedEntity.id;
                    }

                    const response = await axiosInstance.get('/Payment', { params });
                    setExistingPayments(response.data.payments || []);

                    if (paymentType === 'Fine') {
                        const fineResponse = await axiosInstance.get(`/Fine/${selectedEntity._id || selectedEntity.fineId}`);
                        if (fineResponse.data) {
                            setSelectedEntity(fineResponse.data);
                        }
                    } else {
                        const loanResponse = await axiosInstance.get(`/Employee/loans/${selectedEntity._id || selectedEntity.id}`);
                        if (loanResponse.data) {
                            setSelectedEntity(loanResponse.data);
                        }
                    }
                } catch (error) {
                }
            }

            if (onSuccess) {
                onSuccess();
            }

            onClose();
        } catch (error) {
            toast({
                title: "Error",
                description: error.response?.data?.message || error.message || "Failed to record payment",
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
                        <p className="text-sm text-gray-500 mt-1">
                            {isUtilityBillPayment
                                ? 'Pay selected utility bills.'
                                : 'Record a new payment for fine, loan, or advance.'}
                        </p>
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
                        <Select
                            classNamePrefix="payment-type"
                            instanceId="payment-type"
                            value={selectedPaymentType}
                            onChange={(option) => {
                                setPaymentType(option?.value || '');
                                setSelectedFineId('');
                                setSelectedLoanId('');
                                setSelectedEntity(null);
                                setPaymentAmount('');
                                setSelectedCardIndex(null);
                                setBulkFines([]);
                            }}
                            options={paymentTypeOptions}
                            isClearable
                            isSearchable
                            isDisabled={
                                isBulkFinePayment ||
                                isUtilityBillPayment ||
                                Boolean(
                                    prefill?.loan ||
                                        prefill?.reward ||
                                        prefill?.fines?.length ||
                                        prefill?.utilityBills?.length,
                                )
                            }
                            placeholder="Search payment type…"
                            noOptionsMessage={() => 'No payment type found'}
                            styles={bankingSelectStyles}
                            menuPortalTarget={
                                typeof document !== 'undefined' ? document.body : null
                            }
                            menuPosition="fixed"
                            menuPlacement="auto"
                        />
                    </div>

                    {isUtilityBillPayment && (
                        <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Utility Bills
                                <span className="ml-2 text-xs font-normal text-gray-500">
                                    {[prefill?.utilityType, prefill?.billMonth].filter(Boolean).join(' · ')}
                                    {utilityBills.length
                                        ? ` · ${selectedUtilityBills.length}/${utilityBills.length} selected`
                                        : ''}
                                </span>
                            </label>
                            <p className="text-xs text-gray-500 mb-2">
                                One payment for checked rows. Unchecked bills stay pending for Accounts.
                            </p>
                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                        <tr>
                                            <th className="w-10 px-3 py-2">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                                    checked={allUtilityBillsSelected}
                                                    ref={(el) => {
                                                        if (el) {
                                                            el.indeterminate =
                                                                selectedUtilityBills.length > 0 &&
                                                                !allUtilityBillsSelected;
                                                        }
                                                    }}
                                                    onChange={(e) =>
                                                        setAllUtilityBillsSelected(e.target.checked)
                                                    }
                                                    aria-label="Select all utility bills"
                                                />
                                            </th>
                                            <th className="text-left px-4 py-2">Account</th>
                                            <th className="text-right px-4 py-2">Contract</th>
                                            <th className="text-right px-4 py-2">Actual</th>
                                            <th className="text-right px-4 py-2">Company</th>
                                            <th className="text-right px-4 py-2">Employee</th>
                                            <th className="text-right px-4 py-2">Pay total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {utilityBills.map((bill) => (
                                            <tr
                                                key={bill._id || bill.accountNo}
                                                className={`border-t border-gray-100 ${
                                                    bill.selected ? 'bg-white' : 'bg-gray-50/80 opacity-70'
                                                }`}
                                            >
                                                <td className="px-3 py-3">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                                        checked={Boolean(bill.selected)}
                                                        onChange={(e) =>
                                                            setUtilityBillSelected(
                                                                bill._id,
                                                                e.target.checked,
                                                            )
                                                        }
                                                        aria-label={`Select account ${bill.accountNo || bill._id}`}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 font-semibold text-gray-800">
                                                    <span className="tabular-nums">
                                                        {bill.accountNo || '—'}
                                                    </span>
                                                    {bill.payByEmployeeName || bill.payByCompanyName ? (
                                                        <p className="text-xs font-semibold text-gray-700 mt-0.5 whitespace-nowrap truncate max-w-[14rem]" title={bill.payByEmployeeName || bill.payByCompanyName}>
                                                            {bill.payByEmployeeName
                                                                ? `${bill.payByEmployeeName}: ${(parseFloat(bill.employeePayAmount) || 0).toFixed(2)}`
                                                                : null}
                                                            {bill.payByEmployeeName && bill.payByCompanyName
                                                                ? ' · '
                                                                : ''}
                                                            {bill.payByCompanyName
                                                                ? `${bill.payByCompanyName}: ${(parseFloat(bill.companyPayAmount) || 0).toFixed(2)}`
                                                                : null}
                                                        </p>
                                                    ) : null}
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                                                    {(parseFloat(bill.contractAmount) || 0).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                                                    {(parseFloat(bill.actualAmount) || 0).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold text-emerald-600 tabular-nums">
                                                    {(parseFloat(bill.companyPayAmount) || 0).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold text-emerald-600 tabular-nums">
                                                    {(parseFloat(bill.employeePayAmount) || 0).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-rose-600 tabular-nums">
                                                    AED {(parseFloat(bill.balance) || 0).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-emerald-50 border-t border-emerald-100">
                                        <tr>
                                            <td colSpan={6} className="px-4 py-3 font-bold text-gray-700">
                                                Total to pay ({selectedUtilityBills.length} bill
                                                {selectedUtilityBills.length === 1 ? '' : 's'})
                                            </td>
                                            <td className="px-4 py-3 text-right font-black text-emerald-700">
                                                AED {utilityBillsTotalBalance.toFixed(2)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}

                    {isBulkFinePayment && (
                        <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Selected Fines
                            </label>
                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                        <tr>
                                            <th className="text-left px-4 py-2">Fine ID</th>
                                            <th className="text-left px-4 py-2">Type</th>
                                            <th className="text-right px-4 py-2">Paid</th>
                                            <th className="text-right px-4 py-2">Outstanding</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bulkFines.map((fine) => (
                                            <tr key={fine.fineId || fine._id} className="border-t border-gray-100">
                                                <td className="px-4 py-3 font-semibold text-gray-800">{fine.fineId}</td>
                                                <td className="px-4 py-3 text-gray-600">{fine.fineType || fine.category || 'Fine'}</td>
                                                <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                                                    AED {(parseFloat(fine.paidAmount) || 0).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-rose-600">
                                                    AED {(parseFloat(fine.balance) || 0).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-emerald-50 border-t border-emerald-100">
                                        <tr>
                                            <td colSpan={3} className="px-4 py-3 font-bold text-gray-700">Total Outstanding</td>
                                            <td className="px-4 py-3 text-right font-black text-emerald-700">
                                                AED {bulkFinesTotalBalance.toFixed(2)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Fine Selection */}
                    {paymentType === 'Fine' && !isBulkFinePayment && (
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
                                <Select
                                    classNamePrefix="payment-fine-id"
                                    instanceId="payment-fine-id"
                                    value={selectedFineOption}
                                    onChange={(option) =>
                                        handleFineSelect(option?.value || '')
                                    }
                                    options={fineSelectOptions}
                                    isClearable
                                    isSearchable
                                    placeholder="Search Fine ID…"
                                    noOptionsMessage={() => 'No fines found'}
                                    styles={bankingSelectStyles}
                                    menuPortalTarget={
                                        typeof document !== 'undefined'
                                            ? document.body
                                            : null
                                    }
                                    menuPosition="fixed"
                                    menuPlacement="auto"
                                />
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
                                <Select
                                    classNamePrefix="payment-loan-id"
                                    instanceId="payment-loan-id"
                                    value={selectedLoanOption}
                                    onChange={(option) =>
                                        handleLoanSelect(option?.value || '')
                                    }
                                    options={loanSelectOptions}
                                    isClearable
                                    isSearchable
                                    isDisabled={Boolean(prefill?.loan)}
                                    placeholder={`Search ${paymentType} ID…`}
                                    noOptionsMessage={() => `No ${paymentType.toLowerCase()}s found`}
                                    styles={bankingSelectStyles}
                                    menuPortalTarget={
                                        typeof document !== 'undefined'
                                            ? document.body
                                            : null
                                    }
                                    menuPosition="fixed"
                                    menuPlacement="auto"
                                />
                            )}
                        </div>
                    )}

                    {/* Reward Selection (prefill from reward details) */}
                    {paymentType === 'Reward' && selectedEntity && (
                        <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Reward ID <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={selectedEntity.rewardId || ''}
                                disabled
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50/50 opacity-70"
                            />
                        </div>
                    )}

                    {/* Entity Details */}
                    {selectedEntity &&
                        !isUtilityBillPayment &&
                        !(isBulkFinePayment && bulkFines.length > 1) && (
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
                                            : paymentType === 'Reward'
                                              ? selectedEntity.rewardType || 'Reward'
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
                                    const employeeShare = resolveFineEmployeeShare(selectedEntity);
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
                                        {paymentType === 'Fine'
                                            ? 'Payment Duration'
                                            : paymentType === 'Reward'
                                              ? 'Disbursement'
                                              : 'Loan Duration'}
                                    </span>
                                    <p className="text-sm font-semibold text-gray-800 mt-1">
                                        {paymentType === 'Reward'
                                            ? 'Lump sum'
                                            : `${paymentType === 'Fine'
                                                ? selectedEntity.payableDuration || 'N/A'
                                                : selectedEntity.duration || 'N/A'} months`}
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
                                                            : box.isPartial
                                                                ? 'bg-amber-50 text-amber-700 border-amber-200'
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
                                        const empShare = resolveFineEmployeeShare(selectedEntity);
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
                                                        : box.isPartial
                                                            ? 'bg-amber-50 border-amber-500'
                                                            : selectedCardIndex === index
                                                                ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500/20'
                                                                : 'bg-red-50 border-red-500'
                                                    }`}
                                            >
                                                <div className={`text-[11px] font-bold uppercase tracking-wider mb-2 relative z-10 flex items-center justify-between ${box.isPaid ? 'text-green-700' : box.isPartial ? 'text-amber-700' : 'text-red-700'
                                                    }`}>
                                                    {box.month}
                                                    {box.isPaid && (
                                                        <span className="text-green-600 bg-green-100 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">✓</span>
                                                    )}
                                                    {box.isPartial && (
                                                        <span className="text-amber-600 bg-amber-100 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">~</span>
                                                    )}
                                                    {box.isNotPaid && (
                                                        <span className="text-red-600 bg-red-100 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">✗</span>
                                                    )}
                                                </div>
                                                <div className={`text-sm font-bold mb-1 relative z-10 ${box.isPaid ? 'text-green-700' : box.isPartial ? 'text-amber-700' : 'text-red-700'
                                                    }`}>
                                                    {box.paidAmount.toFixed(2)} <span className="text-xs font-normal text-gray-500">/ {box.monthlyAmount.toFixed(2)} AED</span>
                                                </div>
                                                {!box.isPaid && (
                                                    <div className={`text-[10px] font-medium relative z-10 mt-2 ${box.isPartial ? 'text-amber-600/80' : 'text-red-600/80'}`}>
                                                        Remaining: {box.remaining.toFixed(2)} AED
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {(selectedEntity || isBulkFinePayment) && paymentType && (
                        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                            {paymentType === 'Reward' ||
                            paymentType === 'Loan' ||
                            paymentType === 'Advance' ||
                            isUtilityEmployeeBalance ||
                            isFineCompanyPayment ? (
                                <div className="mb-8 p-6 bg-white border border-indigo-100 shadow-sm rounded-2xl space-y-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-800">
                                                {isFineCompanyPayment
                                                    ? 'Payment to company · Zoho Expense Refund'
                                                    : 'Zoho Books · Chart of Accounts'}
                                            </h3>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {isFineCompanyPayment
                                                    ? 'Posts Zoho Banking Expense Refund (Money In). From Account + Tax fields · Bank receives the funds.'
                                                    : isUtilityEmployeeBalance
                                                      ? 'Pay employee utility balance. Org follows employee company (VEGA / NNIT). Paid Through is posted as credit.'
                                                      : 'Org follows employee company (VEGA / NNIT). Paid Through is posted as credit.'}
                                            </p>
                                        </div>
                                        {(showZohoOrgPicker || activeZohoOrg) && (
                                            <ZohoOrganizationPicker
                                                options={zohoOrgOptions}
                                                value={zohoOrganizationId}
                                                onChange={setZohoOrganizationId}
                                                loading={zohoOrgLoading || zohoAccountsLoading}
                                                size="sm"
                                            />
                                        )}
                                    </div>
                                    {isFineCompanyPayment && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-800 mb-2">
                                                    Transaction
                                                </label>
                                                <input
                                                    type="text"
                                                    value="Expense Refund"
                                                    readOnly
                                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-100 text-gray-700 cursor-not-allowed"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-800 mb-2">
                                                    Tax
                                                </label>
                                                <input
                                                    type="text"
                                                    value="Inclusive"
                                                    readOnly
                                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-100 text-gray-700 cursor-not-allowed"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-800 mb-2">
                                                {isFineCompanyPayment ? (
                                                    <>
                                                        From Account{' '}
                                                        <span className="text-red-500">*</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        Expense account{' '}
                                                        <span className="text-red-500">*</span>
                                                    </>
                                                )}
                                            </label>
                                            {isFineCompanyPayment ? (
                                                <p className="text-xs text-gray-400 mb-1.5">
                                                    Expense / P&amp;L only (same as Zoho Add Expense).
                                                    Petty Cash / banks → use Banking on the right.
                                                </p>
                                            ) : null}
                                            <Select
                                                classNamePrefix="payment-from-account"
                                                instanceId="payment-from-account"
                                                value={selectedExpenseAccount || null}
                                                onChange={(option) =>
                                                    setExpenseAccountId(option?.value || '')
                                                }
                                                options={expenseAccountOptions}
                                                isLoading={zohoAccountsLoading}
                                                isDisabled={
                                                    zohoAccountsLoading || !zohoAccounts.length
                                                }
                                                isClearable
                                                isSearchable
                                                placeholder={
                                                    zohoAccountsLoading
                                                        ? 'Loading Chart of Accounts…'
                                                        : isFineCompanyPayment
                                                          ? 'Search expense account (not bank/cash)…'
                                                          : 'Search expense account…'
                                                }
                                                noOptionsMessage={({ inputValue }) => {
                                                    if (zohoAccountsLoading) return 'Loading…';
                                                    if (!expenseAccountOptions.length) {
                                                        return 'No expense accounts loaded from Zoho';
                                                    }
                                                    const q = String(inputValue || '').trim();
                                                    if (
                                                        isFineCompanyPayment &&
                                                        /rasee|petty|cash|emirates|nbd|bank|clearing/i.test(
                                                            q,
                                                        )
                                                    ) {
                                                        return 'Bank/Cash accounts go in Banking (right) — not From Account';
                                                    }
                                                    return q
                                                        ? `No expense account matching "${q}"`
                                                        : 'No accounts found';
                                                }}
                                                styles={bankingSelectStyles}
                                                menuPortalTarget={
                                                    typeof document !== 'undefined'
                                                        ? document.body
                                                        : null
                                                }
                                                menuPosition="fixed"
                                                menuPlacement="auto"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-800 mb-2">
                                                {isFineCompanyPayment ? (
                                                    <>
                                                        Banking{' '}
                                                        <span className="text-red-500">*</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        Paid Through (credit){' '}
                                                        <span className="text-red-500">*</span>
                                                    </>
                                                )}
                                            </label>
                                            {isFineCompanyPayment ? (
                                                <div className="space-y-2">
                                                    {zohoBankingNeedsReconnect ||
                                                    (!zohoBanksLoading &&
                                                        !bankAccountOptions.length) ? (
                                                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                                            Banking list needs a fresh Zoho login
                                                            with <strong>banking.READ</strong>.
                                                            Click <strong>Reconnect Zoho</strong>,
                                                            Accept, then <strong>Refresh</strong>.
                                                        </div>
                                                    ) : null}
                                                    <div className="flex items-start gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <Select
                                                            classNamePrefix="zoho-banking"
                                                            instanceId="zoho-banking-select"
                                                            value={selectedPaidThrough || null}
                                                            onChange={(option) =>
                                                                setPaidThroughAccountId(
                                                                    option?.value || '',
                                                                )
                                                            }
                                                            options={bankAccountOptions}
                                                            isLoading={zohoBanksLoading}
                                                            isClearable
                                                            isSearchable
                                                            placeholder={
                                                                zohoBanksLoading
                                                                    ? 'Loading Zoho Banking…'
                                                                    : 'Search Zoho bank accounts…'
                                                            }
                                                            noOptionsMessage={() =>
                                                                zohoBanksLoading
                                                                    ? 'Loading…'
                                                                    : zohoBankingNeedsReconnect
                                                                      ? 'Reconnect Zoho first (banking.READ)'
                                                                      : 'No bank accounts found in Zoho Banking'
                                                            }
                                                            styles={bankingSelectStyles}
                                                            menuPortalTarget={
                                                                typeof document !== 'undefined'
                                                                    ? document.body
                                                                    : null
                                                            }
                                                            menuPosition="fixed"
                                                            menuPlacement="auto"
                                                        />
                                                        <p className="text-xs text-gray-400 mt-1">
                                                            Full list from Zoho Books → Banking
                                                            {bankAccountOptions.length
                                                                ? ` · ${bankAccountOptions.length} accounts`
                                                                : ''}
                                                            . Type to search.
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        disabled={
                                                            zohoReconnectLoading ||
                                                            !zohoOrganizationId
                                                        }
                                                        onClick={() => void reconnectZohoForBanking()}
                                                        title="Reconnect Zoho with banking.READ"
                                                        className="shrink-0 inline-flex items-center justify-center gap-1.5 h-11 px-3 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold disabled:opacity-50"
                                                    >
                                                        {zohoReconnectLoading ? (
                                                            <Loader2
                                                                size={14}
                                                                className="animate-spin"
                                                            />
                                                        ) : (
                                                            <Link2 size={14} />
                                                        )}
                                                        Reconnect
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={zohoBanksLoading || !zohoOrganizationId}
                                                        onClick={() => void loadZohoBankAccounts()}
                                                        title="Refresh bank list from Zoho"
                                                        className="shrink-0 inline-flex items-center justify-center h-11 w-11 rounded-xl border border-gray-200 bg-white hover:bg-teal-50 text-teal-700 disabled:opacity-50"
                                                    >
                                                        {zohoBanksLoading ? (
                                                            <Loader2 size={16} className="animate-spin" />
                                                        ) : (
                                                            <RefreshCw size={16} />
                                                        )}
                                                    </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <Select
                                                    classNamePrefix="payment-paid-through"
                                                    instanceId="payment-paid-through"
                                                    value={selectedPaidThrough || null}
                                                    onChange={(option) =>
                                                        setPaidThroughAccountId(option?.value || '')
                                                    }
                                                    options={paidThroughCoaOptions}
                                                    isLoading={zohoAccountsLoading}
                                                    isDisabled={
                                                        zohoAccountsLoading || !zohoAccounts.length
                                                    }
                                                    isClearable
                                                    isSearchable
                                                    placeholder={
                                                        zohoAccountsLoading
                                                            ? 'Loading Chart of Accounts…'
                                                            : 'Search Paid Through account…'
                                                    }
                                                    noOptionsMessage={() =>
                                                        zohoAccountsLoading
                                                            ? 'Loading…'
                                                            : 'No Paid Through accounts found'
                                                    }
                                                    styles={bankingSelectStyles}
                                                    menuPortalTarget={
                                                        typeof document !== 'undefined'
                                                            ? document.body
                                                            : null
                                                    }
                                                    menuPosition="fixed"
                                                    menuPlacement="auto"
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-6 bg-white border border-gray-100 shadow-sm rounded-2xl">
                                    <label className="block text-sm font-bold text-gray-800 mb-2">
                                        Payment Source <span className="text-red-500">*</span>
                                    </label>
                                    <Select
                                        classNamePrefix="payment-source"
                                        instanceId="payment-source"
                                        value={selectedPaymentSource}
                                        onChange={(option) =>
                                            setPaymentSource(option?.value || '')
                                        }
                                        options={paymentSourceOptions}
                                        isClearable
                                        isSearchable
                                        placeholder="Search payment source…"
                                        noOptionsMessage={() => 'No payment source found'}
                                        styles={bankingSelectStyles}
                                        menuPortalTarget={
                                            typeof document !== 'undefined'
                                                ? document.body
                                                : null
                                        }
                                        menuPosition="fixed"
                                        menuPlacement="auto"
                                    />
                                </div>

                                <div className="p-6 bg-white border border-gray-100 shadow-sm rounded-2xl">
                                    <label className="block text-sm font-bold text-gray-800 mb-3">
                                        Attachment
                                        {paymentSource === 'Cash' ? (
                                            <span className="text-red-500"> *</span>
                                        ) : (
                                            <span className="text-gray-400 font-normal"> (Optional)</span>
                                        )}
                                    </label>
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-200 hover:border-teal-400 rounded-xl cursor-pointer transition-all group flex-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 group-hover:text-teal-500"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                            <span className="text-sm font-semibold text-gray-500 group-hover:text-teal-600 truncate">
                                                {attachmentName || "Upload receipt or document"}
                                            </span>
                                            <input
                                                type="file"
                                                className="hidden"
                                                onChange={handleAttachmentChange}
                                                accept={ERP_ATTACHMENT_ACCEPT}
                                            />
                                        </label>
                                        {attachmentName && (
                                            <button
                                                type="button"
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
                                    <p className="text-[11px] text-gray-400 mt-2">
                                        {isUtilityBillPayment
                                            ? 'Filename is recorded with the payment (large PDFs are not embedded — that froze the browser).'
                                            : paymentSource === 'Cash'
                                              ? 'Required for cash payments. Max 5MB (PDF or image).'
                                              : 'Max file size: 5MB (PDF or image)'}
                                    </p>
                                </div>
                            </div>

                            <div className="mb-2 p-6 bg-teal-50/30 border border-teal-100 rounded-2xl">
                                <label className="block text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                                    Payment Amount (AED) <span className="text-red-500">*</span>
                                </label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <div className="relative flex-1">
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
                                            max={activeRemainingAmount}
                                            className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-lg font-bold text-gray-900 bg-white placeholder-gray-300 shadow-sm transition-all"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    {isFineCompanyPayment && activeRemainingAmount > 0.01 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPaymentAmount(activeRemainingAmount.toFixed(2));
                                                setSelectedCardIndex(null);
                                            }}
                                            className="shrink-0 px-4 py-3 rounded-xl border border-teal-200 bg-white hover:bg-teal-50 text-teal-700 text-sm font-bold transition-colors"
                                            title="Fill remaining fine balance"
                                        >
                                            Complete
                                        </button>
                                    )}
                                </div>
                                <p className={`text-xs font-medium mt-2 flex items-center gap-1 ${parseFloat(paymentAmount) > (activeRemainingAmount + 0.01) ? 'text-red-500' : 'text-gray-500'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                    {parseFloat(paymentAmount) > (activeRemainingAmount + 0.01)
                                        ? `Error: Amount exceeds remaining balance (${activeRemainingAmount.toFixed(2)} AED)`
                                        : isBulkFinePayment
                                            ? `Partial payment allowed. Max ${activeRemainingAmount.toFixed(2)} AED — applied to selected fines in order until amount is used.`
                                            : `Partial payment allowed. Remaining balance: ${activeRemainingAmount.toFixed(2)} AED`}
                                </p>
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
                        disabled={
                            loading ||
                            (!selectedEntity && !isBulkFinePayment && !isUtilityBillPayment) ||
                            !paymentAmount ||
                            parseFloat(paymentAmount) <= 0 ||
                            parseFloat(paymentAmount) > (activeRemainingAmount + 0.01) ||
                            !paymentSource ||
                            (paymentSource === 'Cash' && !attachment)
                        }
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
