'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Car, ExternalLink, Receipt, Wallet, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { navHrefProps } from '@/utils/linkContextMenu';
import { getAssetStatusBadgeClass } from '@/utils/assetStatusHelpers';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { fetchUtilityEntries, fetchUtilityEntry } from '@/app/HRM/Asset/UtilityBills/utils/utilityBillsApi';
import { formatBillMoney } from '@/app/HRM/Asset/UtilityBills/utils/utilityBillStats';
import FineCompanyRefundModal from '@/app/HRM/Fine/components/FineCompanyRefundModal';
import FinePayChoiceModal from '@/app/HRM/Fine/components/FinePayChoiceModal';
import UtilityEmployeePayModal from '@/app/HRM/Asset/UtilityBills/components/UtilityEmployeePayModal';
import { isActiveFlowchartAccountsUser } from '@/app/HRM/Fine/utils/fineVendorPaymentPrefill';
import { useToast } from '@/hooks/use-toast';

const MONTH_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Normalize a bill to its `YYYY-MM` month key, falling back to createdAt. */
function billMonthKey(bill) {
    const raw = String(bill?.billMonth || '').trim();
    if (/^\d{4}-\d{2}$/.test(raw)) return raw;
    if (bill?.createdAt) {
        const d = new Date(bill.createdAt);
        if (!Number.isNaN(d.getTime())) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
    }
    return '';
}

/** e.g. 2026-07 → "Jul 2026" */
function monthLabelFromKey(ym) {
    if (!/^\d{4}-\d{2}$/.test(String(ym || ''))) return String(ym || 'Unknown');
    const [y, m] = String(ym).split('-').map(Number);
    return `${MONTH_SHORT[m - 1] || m} ${y}`;
}

/** Day-level date for a bill (used by the day-to-day filter): prefer createdAt. */
function getBillDate(bill) {
    if (bill?.createdAt) {
        const d = new Date(bill.createdAt);
        if (!Number.isNaN(d.getTime())) return d;
    }
    const ym = billMonthKey(bill);
    if (/^\d{4}-\d{2}$/.test(ym)) {
        const [y, m] = ym.split('-').map(Number);
        return new Date(y, m - 1, 1);
    }
    return null;
}

function billSortTime(bill) {
    const d = getBillDate(bill);
    return d ? d.getTime() : 0;
}

function employeeIdCandidates(employee) {
    return new Set(
        [employee?._id, employee?.id, employee?.employeeObjectId, employee?.employeeId]
            .filter(Boolean)
            .map((x) => String(x)),
    );
}

function billPayableToEmployee(bill, employee) {
    const ids = employeeIdCandidates(employee);
    if (!ids.size) return false;
    if ([bill?.payByEmployeeId].filter(Boolean).some((id) => ids.has(String(id)))) {
        return true;
    }
    const lines = Array.isArray(bill?.zohoLineItems) ? bill.zohoLineItems : [];
    return lines.some((line) => {
        const empId = String(line?.payByEmployeeId || '').trim();
        return empId && ids.has(empId);
    });
}

/** This employee's Payable-to share on the bill (line amounts). */
function employeePayableShareAmount(bill, employee) {
    const ids = employeeIdCandidates(employee);
    if (!ids.size) return 0;
    const lines = Array.isArray(bill?.zohoLineItems) ? bill.zohoLineItems : [];
    let sum = 0;
    let matched = false;
    lines.forEach((line) => {
        const empId = String(line?.payByEmployeeId || '').trim();
        if (!empId || !ids.has(empId)) return;
        matched = true;
        sum += Number(line?.amount) || 0;
    });
    if (matched) return sum;
    if (ids.has(String(bill?.payByEmployeeId || '').trim())) {
        return Number(bill?.employeePayAmount) || 0;
    }
    return 0;
}

function entryFromPayableBill(bill) {
    const entryId = String(bill?.entryId || '').trim();
    if (!entryId) return null;
    return {
        id: entryId,
        type: String(bill?.utilityType || 'Utility').trim() || 'Utility',
        values: {
            accountNumber: String(bill?.accountNo || '').trim(),
            provider: String(bill?.provider || bill?.utilityType || 'Utility').trim(),
            monthlyRental: Number(bill?.monthlyRental) || 0,
        },
        assignedTo: '',
        assignedToType: '',
        assignedToId: '',
        fromPayable: true,
    };
}

function companyPayDisplay(bill, employeePortion) {
    const stored = Number(bill?.companyPayAmount);
    if (Number.isFinite(stored) && stored > 0.009) return stored;
    const amount = Number(bill?.amount) || 0;
    if (employeePortion > 0.009) return Math.max(0, amount - employeePortion);
    return amount;
}

function fallbackPortion(bill, employee, party) {
    const portion = employeePayableShareAmount(bill, employee);
    const status = String(bill?.status || '');
    if (status === 'Rejected') {
        return { status: 'Rejected', outstanding: 0, portion, canPay: false };
    }
    const partyPaid = String(party?.status || '').toLowerCase() === 'paid';
    if (partyPaid) {
        const employeePaid = String(party?.paymentMode || '') === 'Employee';
        return {
            status: employeePaid ? 'Paid Employee' : 'Paid',
            outstanding: 0,
            portion,
            canPay: false,
        };
    }
    const collectible = status === 'Approved' || status === 'Paid';
    return {
        status: 'Not Paid',
        outstanding: portion,
        portion,
        canPay: collectible && portion > 0.009,
    };
}

function portionStatusClass(status) {
    if (status === 'Paid') return 'font-semibold text-emerald-700';
    if (status === 'Not Paid') return 'font-semibold text-amber-700';
    return 'text-slate-500';
}

/** Status is only whether this employee paid their portion. A zero portion is nothing to collect. */
function employeeUtilityPayView(settlement) {
    const portion = Number(settlement?.portion) || 0;
    if (portion <= 0.009) {
        return { portionText: 'N/A', status: 'Paid', payOk: true };
    }
    const rawStatus = String(settlement?.status || '');
    const outstanding = Number(settlement?.outstanding);
    const employeePaid =
        rawStatus === 'Paid' ||
        rawStatus === 'Paid Employee' ||
        (Number.isFinite(outstanding) && outstanding <= 0.009 && rawStatus !== 'Not Paid');
    if (employeePaid) return { portionText: '', status: 'Paid', payOk: true };
    return { portionText: '', status: 'Not Paid', payOk: false };
}

function simCardNumber(entry, bill) {
    const value = String(
        bill?.accountNo ||
            bill?.simNumber ||
            entry?.values?.accountNumber ||
            entry?.values?.accountNo ||
            entry?.values?.simNumber ||
            '',
    ).trim();
    return value || '—';
}

function assigneeMatchesEmployee(assignedTo, employee) {
    if (!assignedTo || !employee) return false;
    const ids = employeeIdCandidates(employee);
    if (typeof assignedTo === 'object') {
        return [assignedTo._id, assignedTo.id, assignedTo.employeeObjectId, assignedTo.employeeId]
            .filter(Boolean)
            .some((x) => ids.has(String(x)));
    }
    return ids.has(String(assignedTo));
}

function isVehicleAsset(asset) {
    if (!asset) return false;
    if (asset.assignedCompany) return false;
    const typeLower = String(asset?.typeId?.name || asset?.type || '').toLowerCase();
    const catLower = String(asset?.categoryId?.name || asset?.category || '').toLowerCase();
    return (
        typeLower.includes('vehicle') ||
        typeLower.includes('car') ||
        typeLower.includes('fleet') ||
        catLower.includes('vehicle') ||
        catLower.includes('car') ||
        !!(asset.plateNumber && String(asset.plateNumber).trim())
    );
}

function plateLabel(vehicle) {
    const plate = `${vehicle?.plateEmirate || ''} ${vehicle?.plateNumber || ''}`.trim();
    return plate || vehicle?.name || vehicle?.assetId || 'Vehicle';
}

/**
 * Salary tab panels: vehicles assigned to this employee, or utility entries grouped by type.
 * @param {'Vehicle'|'Utility Bills'} mode
 */
export default function EmployeeSalaryVehicleUtilityPanel({
    mode = 'Vehicle',
    employee,
    assets = [],
    formatDate,
    currentUser = null,
    accountsFlowchartRows = [],
    onUtilityRefundSuccess = null,
}) {
    const router = useRouter();
    const { toast } = useToast();
    const [fleetVehicles, setFleetVehicles] = useState([]);
    const [loadingFleet, setLoadingFleet] = useState(false);
    const [utilityEntries, setUtilityEntries] = useState([]);
    const [loadingUtilities, setLoadingUtilities] = useState(false);
    const [billsByEntry, setBillsByEntry] = useState({});
    const [loadingBills, setLoadingBills] = useState(false);
    /** utilityBillId → server settlement (status, outstanding, canPay) */
    const [portionByBillId, setPortionByBillId] = useState({});
    /** utilityBillId → PartyExpense Not Paid / Paid for difference */
    const [differencePayByBillId, setDifferencePayByBillId] = useState({});
    /** 'day' | 'month' | 'year' */
    const [filterMode, setFilterMode] = useState('month');
    const [dayStart, setDayStart] = useState('');
    const [dayEnd, setDayEnd] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [utilityRefundOpen, setUtilityRefundOpen] = useState(false);
    const [utilityRefundBills, setUtilityRefundBills] = useState([]);
    const [payChoiceOpen, setPayChoiceOpen] = useState(false);
    const [payChoiceBill, setPayChoiceBill] = useState(null);
    const [utilityEmployeePayOpen, setUtilityEmployeePayOpen] = useState(false);

    const isAccountsUser = useMemo(() => {
        if (!currentUser) return false;
        if (currentUser.isAdmin || currentUser.role === 'admin' || currentUser.isSystemSuperUser) {
            return true;
        }
        return isActiveFlowchartAccountsUser(currentUser, accountsFlowchartRows);
    }, [currentUser, accountsFlowchartRows]);

    const businessEmployeeId = String(employee?.employeeId || '').trim();
    const loadFleet = useCallback(async () => {
        if (!employee?._id) return;
        setLoadingFleet(true);
        try {
            const fleetRes = await axiosInstance.get('/AssetItem/vehicle-fleet-dashboard', {
                params: { scope: 'list' },
                timeout: 30000,
                skipToast: true,
            });
            const list = Array.isArray(fleetRes.data?.vehicles) ? fleetRes.data.vehicles : [];
            setFleetVehicles(
                list.filter(
                    (v) =>
                        !v?.assignedCompany &&
                        assigneeMatchesEmployee(v?.assignedTo, employee),
                ),
            );
        } catch {
            setFleetVehicles([]);
        } finally {
            setLoadingFleet(false);
        }
    }, [employee]);

    const loadBillsForEntries = useCallback(async (entries, payableBills = []) => {
        const list = Array.isArray(entries) ? entries : [];
        const payable = Array.isArray(payableBills) ? payableBills : [];
        if (!list.length && !payable.length) {
            setBillsByEntry({});
            setDifferencePayByBillId({});
            setPortionByBillId({});
            return;
        }
        setLoadingBills(true);
        try {
            const entryIds = list.map((entry) => String(entry?.id || '').trim()).filter(Boolean);
            const map = {};
            entryIds.forEach((id) => {
                map[id] = [];
            });

            const entryById = new Map(list.map((entry) => [String(entry.id), entry]));
            const entryByAccount = new Map();
            list.forEach((entry) => {
                const acc = String(
                    entry?.values?.accountNumber ||
                        entry?.values?.accountNo ||
                        entry?.accountNo ||
                        '',
                ).trim();
                if (acc && !entryByAccount.has(acc)) entryByAccount.set(acc, entry);
            });

            const placeBill = (bill) => {
                if (!bill) return;
                let entryId = String(bill.entryId || '').trim();
                if (!entryById.has(entryId)) {
                    const acc = String(bill.accountNo || '').trim();
                    const byAcc = acc ? entryByAccount.get(acc) : null;
                    if (byAcc) entryId = String(byAcc.id);
                }
                if (!entryId) return;
                const existing = Array.isArray(map[entryId]) ? map[entryId] : [];
                const billId = String(bill._id || bill.id || '');
                if (billId && existing.some((row) => String(row._id || row.id) === billId)) return;
                map[entryId] = [...existing, bill];
            };

            if (entryIds.length) {
                try {
                    const res = await axiosInstance.get('/UtilityBill', {
                        params: { overview: 1, entryIds: entryIds.join(',') },
                        skipToast: true,
                    });
                    (Array.isArray(res.data?.bills) ? res.data.bills : []).forEach(placeBill);
                } catch {
                    /* still merge payable bills below */
                }
            }

            payable.forEach(placeBill);
            setBillsByEntry(map);

            const billIds = Object.values(map)
                .flat()
                .map((bill) => String(bill?._id || bill?.id || '').trim())
                .filter(Boolean);
            const profileEmployeeId = String(employee?.employeeId || '').trim();
            if (profileEmployeeId && billIds.length) {
                try {
                    const statusRes = await axiosInstance.post(
                        '/UtilityBill/employee-portion-status',
                        { employeeId: profileEmployeeId, billIds },
                        { skipToast: true },
                    );
                    const rows = Array.isArray(statusRes.data?.rows) ? statusRes.data.rows : [];
                    const byId = {};
                    rows.forEach((row) => {
                        const id = String(row?.billId || '').trim();
                        if (id) byId[id] = row;
                    });
                    setPortionByBillId(byId);
                } catch {
                    setPortionByBillId({});
                }
            } else {
                setPortionByBillId({});
            }

            // Party balance paid/unpaid, used until the portion status request returns.
            if (profileEmployeeId) {
                try {
                    const expRes = await axiosInstance.get('/Expense', {
                        params: { employeeId: profileEmployeeId },
                        skipToast: true,
                    });
                    const rows = Array.isArray(expRes.data?.rows) ? expRes.data.rows : [];
                    const byBill = {};
                    rows.forEach((row) => {
                        const billId = String(row.utilityBillId || '').trim();
                        if (!billId) return;
                        if (String(row.kind || '').toLowerCase() !== 'balance') return;
                        byBill[billId] = {
                            id: row.id,
                            status: row.status || 'Not Paid',
                            paymentMode: row.paymentMode || '',
                            amount: Number(row.amount) || 0,
                            partyAccountId: row.partyAccountId || '',
                            partyAccountName: row.partyAccountName || '',
                            partyAccountCode: row.partyAccountCode || '',
                            zohoBillId: row.zohoBillId || '',
                            zohoOrganizationId: row.zohoOrganizationId || '',
                            utilityBatchId: row.utilityBatchId || '',
                            accountNo: row.accountNo || '',
                            utilityType: row.utilityType || '',
                            billMonth: row.billMonth || '',
                        };
                    });
                    setDifferencePayByBillId(byBill);
                } catch {
                    setDifferencePayByBillId({});
                }
            } else {
                setDifferencePayByBillId({});
            }
        } finally {
            setLoadingBills(false);
        }
    }, [employee?.employeeId]);

    const loadUtilities = useCallback(async () => {
        const empOid = String(employee?._id || '').trim();
        const empBusinessId = String(employee?.employeeId || '').trim();
        if (!empOid && !empBusinessId) {
            setUtilityEntries([]);
            setBillsByEntry({});
            return;
        }
        setLoadingUtilities(true);
        try {
            const [assignedEntries, payableRes] = await Promise.all([
                empOid || empBusinessId
                    ? fetchUtilityEntries({
                          assignedToId: empOid || empBusinessId,
                          assignedToType: 'Employee',
                      }).catch(() => [])
                    : Promise.resolve([]),
                axiosInstance
                    .get('/UtilityBill', {
                        params: {
                            overview: 1,
                            payByEmployeeId: empBusinessId || empOid,
                        },
                        skipToast: true,
                    })
                    .catch(() => ({ data: { bills: [] } })),
            ]);

            const assigned = Array.isArray(assignedEntries) ? assignedEntries : [];
            const payableBills = Array.isArray(payableRes.data?.bills)
                ? payableRes.data.bills.filter((b) => billPayableToEmployee(b, employee))
                : [];

            const byId = new Map();
            assigned.forEach((e) => {
                if (e?.id) byId.set(String(e.id), e);
            });

            // Resolve entry shells for payable bills not already assigned to this employee.
            const missingEntryIds = [
                ...new Set(
                    payableBills
                        .map((b) => String(b.entryId || '').trim())
                        .filter((id) => id && !byId.has(id)),
                ),
            ];
            await Promise.all(
                missingEntryIds.map(async (id) => {
                    try {
                        const { entry } = await fetchUtilityEntry(id);
                        if (entry?.id) {
                            byId.set(String(entry.id), { ...entry, fromPayable: true });
                            return;
                        }
                    } catch {
                        /* fall through to bill-derived shell */
                    }
                    const bill = payableBills.find((b) => String(b.entryId) === id);
                    const shell = entryFromPayableBill(bill);
                    if (shell) byId.set(id, shell);
                }),
            );

            const list = [...byId.values()];
            setUtilityEntries(list);
            await loadBillsForEntries(list, payableBills);
        } catch {
            setUtilityEntries([]);
            setBillsByEntry({});
        } finally {
            setLoadingUtilities(false);
        }
    }, [employee, loadBillsForEntries]);

    useEffect(() => {
        if (mode === 'Vehicle') loadFleet();
    }, [mode, loadFleet]);

    useEffect(() => {
        if (mode === 'Utility Bills') loadUtilities();
    }, [mode, loadUtilities]);

    const portionFor = useCallback(
        (bill) => {
            const saved = portionByBillId[String(bill?._id || '')];
            if (saved) return saved;
            return fallbackPortion(
                bill,
                employee,
                differencePayByBillId[String(bill?._id || '')],
            );
        },
        [portionByBillId, employee, differencePayByBillId],
    );

    const openExpenseRefund = useCallback((bill) => {
        const outstanding = Number(bill?.employeePortionOutstanding);
        const amount = Number.isFinite(outstanding) && outstanding > 0.009 ? outstanding : 0;
        if (amount <= 0.009) return;
        const expenseMeta = differencePayByBillId[String(bill?._id || '')] || {};
        setUtilityRefundBills([
            {
                ...bill,
                differenceAmount: amount,
                employeePortionOutstanding: amount,
                zohoOrganizationId: bill.zohoOrganizationId || expenseMeta.zohoOrganizationId || '',
                partyAccountId: bill.partyAccountId || expenseMeta.partyAccountId || '',
                partyAccountName: bill.partyAccountName || expenseMeta.partyAccountName || '',
                partyAccountCode: bill.partyAccountCode || expenseMeta.partyAccountCode || '',
                expenseAccountId: bill.expenseAccountId || expenseMeta.partyAccountId || '',
            },
        ]);
        setUtilityRefundOpen(true);
    }, [differencePayByBillId]);

    const openUtilityPayChoice = useCallback(
        (bill) => {
            const settlement = portionFor(bill);
            if (!settlement?.canPay) return;
            if (!isAccountsUser) {
                toast({
                    variant: 'destructive',
                    title: 'Accounts only',
                    description: 'Only Accounts can record utility payment from this profile.',
                });
                return;
            }
            setPayChoiceBill({
                ...bill,
                employeePortionOutstanding: Number(settlement.outstanding) || 0,
            });
            setPayChoiceOpen(true);
        },
        [isAccountsUser, portionFor, toast],
    );

    // Profile `employee.assets` is already scoped to this employee.
    const vehiclesFromAssets = useMemo(
        () => (Array.isArray(assets) ? assets : []).filter((a) => isVehicleAsset(a)),
        [assets],
    );

    const vehicles = useMemo(() => {
        const map = new Map();
        [...fleetVehicles, ...vehiclesFromAssets].forEach((v) => {
            const key = String(v?._id || v?.id || `${v?.assetId || ''}-${v?.plateNumber || ''}`);
            if (!key || key === '-') return;
            if (!map.has(key)) map.set(key, v);
        });
        return Array.from(map.values());
    }, [fleetVehicles, vehiclesFromAssets]);

    const availableYears = useMemo(() => {
        const set = new Set();
        Object.values(billsByEntry).forEach((list) =>
            (list || []).forEach((b) => {
                const y = billMonthKey(b).slice(0, 4);
                if (y) set.add(y);
            }),
        );
        return Array.from(set).sort((a, b) => b.localeCompare(a));
    }, [billsByEntry]);

    const hasActiveFilter =
        (filterMode === 'day' && (dayStart || dayEnd)) ||
        (filterMode === 'month' && filterMonth) ||
        (filterMode === 'year' && filterYear);

    const billMatchesFilter = useCallback(
        (bill) => {
            if (filterMode === 'year') {
                if (!filterYear) return true;
                return billMonthKey(bill).slice(0, 4) === String(filterYear);
            }
            if (filterMode === 'month') {
                if (!filterMonth) return true;
                return billMonthKey(bill) === filterMonth;
            }
            if (!dayStart && !dayEnd) return true;
            const d = getBillDate(bill);
            if (!d) return false;
            const t = d.getTime();
            if (dayStart && t < new Date(`${dayStart}T00:00:00`).getTime()) return false;
            if (dayEnd && t > new Date(`${dayEnd}T23:59:59`).getTime()) return false;
            return true;
        },
        [filterMode, filterYear, filterMonth, dayStart, dayEnd],
    );

    const billsForEntry = useCallback(
        (entryId) => {
            const entry = (utilityEntries || []).find((e) => String(e.id) === String(entryId));
            let list = (billsByEntry[entryId] || []).filter(billMatchesFilter);
            // Payable-only utilities: show only this employee's Payable-to bills.
            if (entry?.fromPayable) {
                list = list.filter((b) => billPayableToEmployee(b, employee));
            }
            return list.sort((a, b) => billSortTime(b) - billSortTime(a));
        },
        [billsByEntry, billMatchesFilter, utilityEntries, employee],
    );

    const utilityBillRows = useMemo(() => {
        const rows = [];
        (utilityEntries || []).forEach((entry) => {
            billsForEntry(entry.id).forEach((bill) => {
                const settlement = portionFor(bill);
                const payView = employeeUtilityPayView(settlement);
                rows.push({
                    entry,
                    bill,
                    unpaid: payView.status === 'Not Paid',
                    employeePortion: Number(settlement?.portion) || 0,
                });
            });
        });
        rows.sort((a, b) => {
            if (a.unpaid !== b.unpaid) return a.unpaid ? -1 : 1;
            if (a.unpaid && a.employeePortion !== b.employeePortion) {
                return b.employeePortion - a.employeePortion;
            }
            return billSortTime(b.bill) - billSortTime(a.bill);
        });
        return rows;
    }, [utilityEntries, billsForEntry, portionFor]);

    const clearFilter = useCallback(() => {
        setDayStart('');
        setDayEnd('');
        setFilterMonth('');
        setFilterYear('');
    }, []);

    if (mode === 'Vehicle') {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-600">
                    <Car size={18} className="text-teal-600" />
                    <p className="text-sm font-medium">
                        Vehicles currently assigned to this employee
                    </p>
                </div>

                {loadingFleet && vehicles.length === 0 ? (
                    <p className="py-12 text-center text-sm text-gray-400">Loading vehicles…</p>
                ) : vehicles.length === 0 ? (
                    <p className="py-12 text-center text-sm text-gray-400">No vehicles assigned</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] table-auto">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                        Vehicle
                                    </th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                        Asset ID
                                    </th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                        Type
                                    </th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                        Assigned Date
                                    </th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                        Status
                                    </th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {vehicles.map((vehicle) => {
                                    const href = `/HRM/Asset/Vehicle/details/${vehicle._id || vehicle.id}`;
                                    const assignedDate =
                                        vehicle.assignedDate || vehicle.updatedAt || vehicle.createdAt;
                                    return (
                                        <tr
                                            key={vehicle._id || vehicle.id || plateLabel(vehicle)}
                                            className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                                            {...navHrefProps(href)}
                                            onClick={() => router.push(href)}
                                        >
                                            <td className="py-3 px-4 text-sm font-semibold text-slate-800">
                                                {plateLabel(vehicle)}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                {vehicle.assetId || '—'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                {vehicle.typeId?.name || vehicle.type || 'Vehicle'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                {assignedDate && formatDate
                                                    ? formatDate(assignedDate)
                                                    : assignedDate
                                                      ? new Date(assignedDate).toLocaleDateString('en-GB')
                                                      : '—'}
                                            </td>
                                            <td className="py-3 px-4 text-sm">
                                                <span
                                                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getAssetStatusBadgeClass(vehicle.status)}`}
                                                >
                                                    {vehicle.status || 'Assigned'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    onClick={() => router.push(href)}
                                                    className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 text-xs font-semibold"
                                                >
                                                    View <ExternalLink size={12} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    }

    const filterModes = [
        { id: 'day', label: 'Day to Day' },
        { id: 'month', label: 'Month' },
        { id: 'year', label: 'Year' },
    ];

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                    <Receipt size={18} className="text-teal-600" />
                    <p className="text-sm font-medium">
                        Utility bills for this employee. Status is whether the employee paid their portion.
                    </p>
                </div>
            </div>

            {/* Bill filter: day-to-day / month / year */}
            <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Filter bills
                </span>
                <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
                    {filterModes.map((m) => (
                        <button
                            key={m.id}
                            type="button"
                            onClick={() => setFilterMode(m.id)}
                            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                                filterMode === m.id
                                    ? 'bg-teal-500 text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>

                {filterMode === 'day' ? (
                    <DateRangePicker
                        startValue={dayStart}
                        endValue={dayEnd}
                        onStartChange={setDayStart}
                        onEndChange={setDayEnd}
                        placeholder="Select day range"
                        className="h-9 text-sm"
                    />
                ) : null}

                {filterMode === 'month' ? (
                    <MonthYearPicker
                        value={filterMonth || undefined}
                        onChange={(v) => setFilterMonth(v ? String(v).slice(0, 7) : '')}
                        valueFormat="yyyy-MM"
                        placeholder="Pick a month"
                        className="w-48 h-9 text-sm"
                    />
                ) : null}

                {filterMode === 'year' ? (
                    <select
                        value={filterYear}
                        onChange={(e) => setFilterYear(e.target.value)}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                    >
                        <option value="">All years</option>
                        {availableYears.map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                ) : null}

                {hasActiveFilter ? (
                    <button
                        type="button"
                        onClick={clearFilter}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-white hover:text-slate-700"
                    >
                        <X size={12} />
                        Clear
                    </button>
                ) : null}
            </div>

            {loadingUtilities || loadingBills ? (
                <p className="py-12 text-center text-sm text-gray-400">Loading utilities…</p>
            ) : utilityBillRows.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-400">
                    {hasActiveFilter
                        ? 'No bills match this filter.'
                        : 'No utility bills assigned or payable to this employee'}
                </p>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
                    <table className="w-full min-w-[860px] table-auto">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/80">
                                {['Month', 'SIM card no', 'Bill amount', 'Company pay', 'Employee portion', 'Status', 'Pay'].map((heading) => (
                                    <th
                                        key={heading}
                                        className={`px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 ${
                                            heading === 'Bill amount' || heading === 'Company pay' || heading === 'Employee portion'
                                                ? 'text-right'
                                                : 'text-left'
                                        }`}
                                    >
                                        {heading}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {utilityBillRows.map(({ entry, bill }) => {
                                const settlement = portionFor(bill);
                                const employeePortion = Number(settlement.portion) || 0;
                                const companyPay = companyPayDisplay(bill, employeePortion);
                                const payView = employeeUtilityPayView(settlement);
                                const showPay =
                                    payView.status === 'Not Paid' &&
                                    Boolean(settlement.canPay) &&
                                    isAccountsUser;
                                return (
                                    <tr key={bill._id || `${entry.id}-${billMonthKey(bill)}`} className="border-b border-slate-50 last:border-0">
                                        <td className="px-3 py-2.5">
                                            <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                                                <Calendar size={13} className="shrink-0 text-slate-400" />
                                                {monthLabelFromKey(billMonthKey(bill))}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs font-semibold text-slate-700">
                                            {simCardNumber(entry, bill)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-700">
                                            {formatBillMoney(Number(bill.amount) || 0)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-700">
                                            {formatBillMoney(companyPay)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-700">
                                            {payView.portionText === 'N/A' ? 'N/A' : formatBillMoney(employeePortion)}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            <span className={portionStatusClass(payView.status)}>{payView.status}</span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            {payView.payOk ? (
                                                <span className="text-xs font-semibold text-emerald-700">OK</span>
                                            ) : showPay ? (
                                                <button
                                                    type="button"
                                                    onClick={() => openUtilityPayChoice(bill)}
                                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-white hover:bg-emerald-700"
                                                    title="Accounts only. Collects the unpaid employee portion."
                                                >
                                                    <Wallet size={12} />
                                                    Pay
                                                </button>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <FinePayChoiceModal
                isOpen={payChoiceOpen}
                title="Pay Utility"
                fineId={
                    payChoiceBill
                        ? [payChoiceBill.utilityType, payChoiceBill.billMonth, payChoiceBill.accountNo]
                              .filter(Boolean)
                              .join(' · ')
                        : ''
                }
                showVendorCredit={false}
                showEmployeePay
                employeePayLabel="Employee Pay"
                employeePayHint="Salary or cash. Marks Paid Employee. Emails the receipt to the employee. No Zoho entry."
                onClose={() => {
                    setPayChoiceOpen(false);
                    setPayChoiceBill(null);
                }}
                onExpenseRefund={() => {
                    const selected = payChoiceBill;
                    setPayChoiceOpen(false);
                    if (selected) openExpenseRefund(selected);
                }}
                onEmployeePay={() => {
                    setPayChoiceOpen(false);
                    setUtilityEmployeePayOpen(true);
                }}
            />

            <UtilityEmployeePayModal
                isOpen={utilityEmployeePayOpen}
                bill={payChoiceBill}
                employeeId={businessEmployeeId}
                employee={employee}
                outstanding={Number(payChoiceBill?.employeePortionOutstanding) || 0}
                onClose={() => {
                    setUtilityEmployeePayOpen(false);
                    setPayChoiceBill(null);
                }}
                onSuccess={() => {
                    setUtilityEmployeePayOpen(false);
                    setPayChoiceBill(null);
                    if (mode === 'Utility Bills') void loadUtilities();
                    onUtilityRefundSuccess?.();
                }}
            />

            <FineCompanyRefundModal
                isOpen={utilityRefundOpen}
                employee={employee}
                employeeId={businessEmployeeId}
                fines={[]}
                utilityBills={utilityRefundBills}
                getUtilityBalance={(row) => Number(row?.employeePortionOutstanding) || 0}
                onClose={() => {
                    setUtilityRefundOpen(false);
                    setUtilityRefundBills([]);
                }}
                onSuccess={() => {
                    setUtilityRefundOpen(false);
                    setUtilityRefundBills([]);
                    if (mode === 'Utility Bills') {
                        void loadUtilities();
                    }
                    onUtilityRefundSuccess?.();
                }}
            />
        </div>
    );
}
