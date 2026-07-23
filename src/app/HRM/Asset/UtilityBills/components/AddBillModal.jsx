'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Eye, Plus, Upload, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { mapZohoPaymentAccounts } from '@/utils/zohoVendorPayments';
import {
    getLoggedInUtilityUserKey,
    isEntryActive,
    loadUtilityBillDraft,
    saveUtilityBillDraft,
} from '../utils/utilityBillsStorage';
import {
    entryIdsWithOccupiedBillForMonth,
    filterEntriesWithoutOccupiedBill,
    isMonthFullyOccupied,
} from '../utils/utilityBillStats';
import { openUtilityAttachment } from '../utils/openUtilityAttachment';
import UtilityBillTotalsBar, { computeRowPayTotals } from './UtilityBillTotalsBar';
import {
    assignedPartyDefaults,
    payByFieldsFromAssignment,
} from './PayByChoiceModal';
import { usePayByPartyOptions } from './PayByPartySelects';
import AttachmentSourceModal from './AttachmentSourceModal';
import UtilityBillLineItemsModal, {
    createDefaultLineItems,
    lineItemsMatchActual,
} from './UtilityBillLineItemsModal';

const MONTH_SHORT = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];

const PAY_BY_EMPLOYEE = 'employee';
const PAY_BY_COMPANY = 'company';

function pickDefaultExpenseAccount(accounts = [], preferredId = '') {
    const preferred = String(preferredId || '').trim();
    if (preferred) {
        const match = accounts.find((a) => String(a?.id || '') === preferred);
        if (match) return match;
    }
    const expenseLike = accounts.find((a) =>
        /expense/i.test(String(a?.type || a?.account_type || '')),
    );
    return expenseLike || accounts[0] || null;
}

function pickPartyAccountFromList(accounts = [], row = {}) {
    // Only keep an Acc2 already chosen on the row. Do not match Payable to
    // company/employee ids (e.g. EST-001) against Zoho account codes — the
    // Account from Add more / line prices is the Zoho bill debit.
    const existingId = String(row?.partyAccountId || '').trim();
    if (!existingId) {
        return { partyAccountId: '', partyAccountName: '', partyAccountCode: '' };
    }
    const match = accounts.find((a) => String(a?.id || '') === existingId);
    if (match) {
        return {
            partyAccountId: match.id,
            partyAccountName: match.name || row.partyAccountName || '',
            partyAccountCode: match.code || row.partyAccountCode || '',
        };
    }
    return {
        partyAccountId: existingId,
        partyAccountName: String(row?.partyAccountName || '').trim(),
        partyAccountCode: String(row?.partyAccountCode || '').trim(),
    };
}

/** Bill month YYYY-MM + payment day (1–31) → bill date. Clamps to last day of month. */
function billDateFromMonth(billMonth, paymentDay = 16) {
    const month = String(billMonth || '').trim();
    if (!/^\d{4}-\d{2}$/.test(month)) return '';

    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) return '';

    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    let day = Number(paymentDay);
    if (!Number.isInteger(day) || day < 1) day = 16;
    day = Math.min(day, lastDay);

    return `${month}-${String(day).padStart(2, '0')}`;
}

/** Min/max YYYY-MM-DD bounds for a bill month — manual bill dates must stay inside it. */
function billMonthDateBounds(billMonth) {
    const month = String(billMonth || '').trim();
    if (!/^\d{4}-\d{2}$/.test(month)) return { min: '', max: '' };
    const [year, m] = month.split('-').map(Number);
    const lastDay = new Date(year, m, 0).getDate();
    return { min: `${month}-01`, max: `${month}-${String(lastDay).padStart(2, '0')}` };
}

function isDateWithinBillMonth(dateStr, billMonth) {
    const value = String(dateStr || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && value.slice(0, 7) === String(billMonth || '');
}

function resolvePayShares(payBy, difference) {
    // Never use a negative share — under/over both allocate as a positive amount
    const diff = Math.abs(Number(difference) || 0);
    if (payBy === PAY_BY_COMPANY) {
        return { companyAmount: diff, employeeAmount: 0 };
    }
    if (payBy === PAY_BY_EMPLOYEE) {
        return { companyAmount: 0, employeeAmount: diff };
    }
    return { companyAmount: 0, employeeAmount: 0 };
}

/**
 * Auto company for Company name column:
 * assigned Company → that company; else employee's company from Contract Paid By / assignment.
 */
function resolveAutoCompany(row = {}, employeeOptions = [], companyOptions = []) {
    const existingId = String(row?.payByCompanyId || '').trim();
    if (existingId) {
        const match = companyOptions.find((o) => String(o.value) === existingId);
        return {
            payByCompanyId: existingId,
            payByCompanyName:
                String(row?.payByCompanyName || '').trim() || match?.label || '',
        };
    }

    if (row?.assignedToType === 'Company' && row?.assignedToId) {
        const id = String(row.assignedToId).trim();
        const match = companyOptions.find((o) => String(o.value) === id);
        return {
            payByCompanyId: id,
            payByCompanyName: match?.label || String(row.assignedToName || '').trim(),
        };
    }

    const empRef = String(
        row?.payByEmployeeId ||
            (row?.assignedToType === 'Employee' ? row?.assignedToId : '') ||
            '',
    ).trim();
    if (!empRef) {
        return { payByCompanyId: '', payByCompanyName: '' };
    }

    const emp = employeeOptions.find(
        (o) => String(o.value) === empRef || String(o.employeeId || '') === empRef,
    );
    const companyId = String(emp?.companyMongoId || '').trim();
    if (!companyId) {
        return { payByCompanyId: '', payByCompanyName: '' };
    }
    const match = companyOptions.find((o) => String(o.value) === companyId);
    return {
        payByCompanyId: companyId,
        payByCompanyName: match?.label || String(emp?.companyName || '').trim(),
    };
}

const MAX_ATTACHMENT_BYTES = 1.5 * 1024 * 1024;

function currentMonthTitle(date = new Date()) {
    return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function currentBillMonthValue(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

function nextBillMonthValue(billMonth) {
    if (!/^\d{4}-\d{2}$/.test(String(billMonth || ''))) {
        return currentBillMonthValue();
    }
    const [y, m] = String(billMonth).split('-').map(Number);
    const d = new Date(y, m, 1); // next month (day 1 of month index m)
    return currentBillMonthValue(d);
}

function titleFromBillMonth(billMonth) {
    if (!billMonth || !/^\d{4}-\d{2}$/.test(String(billMonth))) return currentMonthTitle();
    const [y, m] = String(billMonth).split('-').map(Number);
    return currentMonthTitle(new Date(y, m - 1, 1));
}

function filterUnbilledEntries(entries, existingBills, billMonth) {
    return filterEntriesWithoutOccupiedBill(entries, existingBills, billMonth);
}

/** Past calendar months cannot be selected for Add Bills. */
function isMonthBeforeCurrent(ym, currentYm = currentBillMonthValue()) {
    const a = String(ym || '');
    const b = String(currentYm || '');
    if (!/^\d{4}-\d{2}$/.test(a) || !/^\d{4}-\d{2}$/.test(b)) return false;
    return a < b;
}

/**
 * Earliest incomplete month from the current calendar month forward.
 * Past months are out of scope; later months stay locked until this one is full.
 */
function findFirstOpenMonth(entries, bills, preferredMonth) {
    const currentYm = currentBillMonthValue();
    if (!Array.isArray(entries) || !entries.length) {
        return preferredMonth &&
            /^\d{4}-\d{2}$/.test(String(preferredMonth)) &&
            !isMonthBeforeCurrent(preferredMonth, currentYm)
            ? String(preferredMonth)
            : currentYm;
    }

    let ym = currentYm;
    for (let i = 0; i < 48; i++) {
        if (!isMonthFullyOccupied(entries, bills, ym)) return ym;
        ym = nextBillMonthValue(ym);
    }
    return currentYm;
}

/** Future months locked until the first open (current+) month is fully billed. */
function isMonthSequenceLocked(ym, firstOpenMonth) {
    const a = String(ym || '');
    const b = String(firstOpenMonth || '');
    if (!/^\d{4}-\d{2}$/.test(a) || !/^\d{4}-\d{2}$/.test(b)) return false;
    return a > b;
}

function isMonthSelectable(ym, entries, bills, firstOpenMonth, currentYm = currentBillMonthValue()) {
    if (!/^\d{4}-\d{2}$/.test(String(ym || ''))) return false;
    if (isMonthBeforeCurrent(ym, currentYm)) return false;
    if (entries?.length && isMonthFullyOccupied(entries, bills, ym)) return false;
    if (entries?.length && isMonthSequenceLocked(ym, firstOpenMonth)) return false;
    return true;
}

/** Prefer draft/current month when allowed; otherwise the first open month from today forward. */
function resolveWorkingMonth(entries, existingBills, preferredMonth) {
    const currentYm = currentBillMonthValue();
    const firstOpen = findFirstOpenMonth(entries, existingBills, preferredMonth);
    const preferred =
        preferredMonth && /^\d{4}-\d{2}$/.test(String(preferredMonth))
            ? String(preferredMonth)
            : '';

    if (preferred && isMonthSelectable(preferred, entries, existingBills, firstOpen, currentYm)) {
        return {
            billMonth: preferred,
            unbilledEntries: filterUnbilledEntries(entries, existingBills, preferred),
            firstOpenMonth: firstOpen,
        };
    }

    return {
        billMonth: firstOpen,
        unbilledEntries: filterUnbilledEntries(entries, existingBills, firstOpen),
        firstOpenMonth: firstOpen,
    };
}

function yearFromBillMonth(billMonth) {
    const y = Number(String(billMonth || '').slice(0, 4));
    return Number.isFinite(y) && y > 1900 ? y : new Date().getFullYear();
}

function monthKeyForYearMonth(year, monthIndex0) {
    return `${year}-${String(monthIndex0 + 1).padStart(2, '0')}`;
}

function formatMoney(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '0.00';
    return num.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
    });
}

function entryAccountNo(entry) {
    return String(entry?.values?.accountNumber || '').trim() || '—';
}

function entryProvider(entry) {
    return String(entry?.values?.provider || '').trim() || '—';
}

function entryPaymentDay(entry) {
    const day = Number(entry?.values?.paymentDay ?? entry?.values?.paymentDate);
    if (Number.isInteger(day) && day >= 1 && day <= 31) return day;
    return null;
}

function entryContractAmount(entry) {
    const n = Number(entry?.values?.monthlyRental);
    return Number.isFinite(n) ? n : 0;
}

function resolveRowAttachment(rows, index, utilityAttachment) {
    if (index < 0 || index >= rows.length) return null;
    const row = rows[index];
    if (row.attachmentMode === 'new') {
        return row.attachment || null;
    }
    if (row.attachmentMode === 'above') {
        if (index === 0) {
            return utilityAttachment?.name ? utilityAttachment : null;
        }
        return resolveRowAttachment(rows, index - 1, utilityAttachment);
    }
    return null;
}

function buildRowsFromEntries(entries, draftRows = []) {
    const draftByEntry = new Map(
        (draftRows || []).map((r) => [String(r.entryId || ''), r]),
    );
    return (entries || []).map((entry) => {
        const draft = draftByEntry.get(String(entry.id));
        const assigned = assignedPartyDefaults(entry);
        const assignedPay = payByFieldsFromAssignment(entry);
        const useDraftPayBy = Boolean(String(draft?.payBy || '').trim());
        return {
            entryId: entry.id,
            selected: draft ? draft.selected !== false : true,
            accountNo: entryAccountNo(entry),
            provider: entryProvider(entry),
            paymentDay: entryPaymentDay(entry),
            billDate: draft?.billDate ? String(draft.billDate) : '',
            expenseAccountId: draft?.expenseAccountId ? String(draft.expenseAccountId) : '',
            expenseAccountName: draft?.expenseAccountName
                ? String(draft.expenseAccountName)
                : '',
            partyAccountId: draft?.partyAccountId ? String(draft.partyAccountId) : '',
            partyAccountName: draft?.partyAccountName
                ? String(draft.partyAccountName)
                : '',
            partyAccountCode: draft?.partyAccountCode
                ? String(draft.partyAccountCode)
                : '',
            assignedToType: assigned.assignedToType,
            assignedToId: assigned.assignedToId,
            assignedToName: assigned.assignedToName,
            contractAmount: entryContractAmount(entry),
            billNumber: draft?.billNumber != null ? String(draft.billNumber) : '',
            actualAmount:
                draft?.actualAmount != null && draft.actualAmount !== ''
                    ? String(draft.actualAmount)
                    : '',
            payBy: useDraftPayBy ? draft.payBy : assignedPay.payBy,
            companyDiffAmount: draft?.companyDiffAmount ?? '',
            employeeDiffAmount: draft?.employeeDiffAmount ?? '',
            payByCompanyId: useDraftPayBy
                ? draft?.payByCompanyId || ''
                : assignedPay.payByCompanyId,
            payByCompanyName: useDraftPayBy
                ? draft?.payByCompanyName || ''
                : assignedPay.payByCompanyName,
            payByEmployeeId: useDraftPayBy
                ? draft?.payByEmployeeId || ''
                : assignedPay.payByEmployeeId,
            payByEmployeeName: useDraftPayBy
                ? draft?.payByEmployeeName || ''
                : assignedPay.payByEmployeeName,
            attachmentMode: draft?.attachmentMode || null,
            attachment: draft?.attachment || null,
            lineItems: Array.isArray(draft?.lineItems) ? draft.lineItems : null,
        };
    });
}

/** Clear edits when a row is unchecked — excluded from totals/submit. */
function resetUncheckedRow(row) {
    return {
        ...row,
        selected: false,
        billNumber: '',
        billDate: '',
        expenseAccountId: '',
        expenseAccountName: '',
        partyAccountId: '',
        partyAccountName: '',
        partyAccountCode: '',
        actualAmount: '',
        payBy: '',
        companyDiffAmount: '',
        employeeDiffAmount: '',
        payByCompanyId: '',
        payByCompanyName: '',
        payByEmployeeId: '',
        payByEmployeeName: '',
        attachmentMode: null,
        attachment: null,
        lineItems: null,
    };
}

function restoreAssignedPayBy(row) {
    const assignedPay = payByFieldsFromAssignment(row);
    return {
        ...row,
        selected: true,
        ...assignedPay,
    };
}

function openAttachmentView(file, toast) {
    openUtilityAttachment(file, {
        onError: (message) => {
            toast?.({
                variant: 'destructive',
                title: 'Attachment',
                description: message,
            });
        },
    });
}

function collectPayloadRows(
    rows,
    utilityAttachment,
    {
        defaultExpenseAccountId,
        defaultExpenseAccountName,
        billMonth,
        expenseAccounts = [],
        employeeOptions = [],
        companyOptions = [],
    } = {},
) {
    const payloadRows = [];
    const defaultExpense = pickDefaultExpenseAccount(
        expenseAccounts,
        defaultExpenseAccountId,
    );

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.selected) continue;
        const accountId =
            String(row.expenseAccountId || '').trim() ||
            String(defaultExpense?.id || defaultExpenseAccountId || '').trim();
        const accountName =
            String(row.expenseAccountId || '').trim()
                ? String(row.expenseAccountName || '').trim()
                : String(
                      defaultExpense?.name || defaultExpenseAccountName || '',
                  ).trim();
        const billNumber = String(row.billNumber || '').trim();
        if (!billNumber) {
            return {
                error: `Enter a bill number for account ${row.accountNo}.`,
                payloadRows: null,
            };
        }
        if (!String(row.provider || '').trim()) {
            return {
                error: `Provider is missing for account ${row.accountNo} (maps to Zoho vendor).`,
                payloadRows: null,
            };
        }
        const paymentDay = row.paymentDay;
        const manualBillDate = String(row.billDate || '').trim();
        if (manualBillDate && !isDateWithinBillMonth(manualBillDate, billMonth)) {
            return {
                error: `Bill date for account ${row.accountNo} must be within ${titleFromBillMonth(billMonth)}.`,
                payloadRows: null,
            };
        }
        if (
            !manualBillDate &&
            (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31)
        ) {
            return {
                error: `Pick a bill date for account ${row.accountNo}, or set Payment Day on the utility entry.`,
                payloadRows: null,
            };
        }
        const rowBillDate = manualBillDate || billDateFromMonth(billMonth, paymentDay);
        if (!rowBillDate) {
            return {
                error: `Could not build bill date for account ${row.accountNo}.`,
                payloadRows: null,
            };
        }
        const actual = Number(row.actualAmount);
        if (!Number.isFinite(actual) || row.actualAmount === '' || actual <= 0) {
            return {
                error: `Enter an actual amount greater than 0 for account ${row.accountNo}.`,
                payloadRows: null,
            };
        }
        const contract = Number(row.contractAmount) || 0;
        const difference = contract - actual;
        const absDifference = Math.abs(difference);

        const assignedPay = payByFieldsFromAssignment(row);
        const autoCompany = resolveAutoCompany(row, employeeOptions, companyOptions);
        let payByCompanyId =
            String(row.payByCompanyId || '').trim() || autoCompany.payByCompanyId || '';
        let payByCompanyName =
            String(row.payByCompanyName || '').trim() ||
            autoCompany.payByCompanyName ||
            '';
        let payByEmployeeId =
            String(row.payByEmployeeId || '').trim() ||
            assignedPay.payByEmployeeId ||
            '';
        let payByEmployeeName =
            String(row.payByEmployeeName || '').trim() ||
            assignedPay.payByEmployeeName ||
            '';

        const lineWithParty = Array.isArray(row.lineItems)
            ? row.lineItems.find(
                  (line) =>
                      String(line?.payByEmployeeId || '').trim() ||
                      String(line?.payByCompanyId || '').trim(),
              )
            : null;

        // Prefer Payable to from Add more lines (Company or Employee).
        let payBy = '';
        if (lineWithParty) {
            const lineIsCompany =
                lineWithParty.payBy === PAY_BY_COMPANY ||
                (String(lineWithParty.payByCompanyId || '').trim() &&
                    !String(lineWithParty.payByEmployeeId || '').trim());
            if (lineIsCompany) {
                payBy = PAY_BY_COMPANY;
                payByCompanyId =
                    String(lineWithParty.payByCompanyId || '').trim() || payByCompanyId;
                payByCompanyName =
                    String(lineWithParty.payByCompanyName || '').trim() ||
                    payByCompanyName;
            } else {
                payBy = PAY_BY_EMPLOYEE;
                payByEmployeeId = String(lineWithParty.payByEmployeeId || '').trim();
                payByEmployeeName = String(lineWithParty.payByEmployeeName || '').trim();
                payByCompanyId =
                    String(lineWithParty.payByCompanyId || '').trim() || payByCompanyId;
                payByCompanyName =
                    String(lineWithParty.payByCompanyName || '').trim() ||
                    payByCompanyName;
                if (!payByCompanyId && payByEmployeeId) {
                    const fromEmp = resolveAutoCompany(
                        {
                            payByEmployeeId,
                            assignedToType: 'Employee',
                            assignedToId: payByEmployeeId,
                        },
                        employeeOptions,
                        companyOptions,
                    );
                    payByCompanyId = fromEmp.payByCompanyId || '';
                    payByCompanyName = fromEmp.payByCompanyName || '';
                }
            }
        } else if (actual < contract) {
            // Under contract → company pay-by when no Add more party set
            payBy = PAY_BY_COMPANY;
        } else if (row.payBy === PAY_BY_COMPANY || row.payBy === PAY_BY_EMPLOYEE) {
            payBy = row.payBy;
        } else if (assignedPay.payBy) {
            payBy = assignedPay.payBy;
            if (payBy === PAY_BY_EMPLOYEE) {
                payByEmployeeId = payByEmployeeId || assignedPay.payByEmployeeId || '';
                payByEmployeeName =
                    payByEmployeeName || assignedPay.payByEmployeeName || '';
            }
            if (payBy === PAY_BY_COMPANY) {
                payByCompanyId = payByCompanyId || assignedPay.payByCompanyId || '';
                payByCompanyName =
                    payByCompanyName || assignedPay.payByCompanyName || '';
            }
        } else if (row.assignedToType === 'Employee' && row.assignedToId) {
            payBy = PAY_BY_EMPLOYEE;
            payByEmployeeId = payByEmployeeId || String(row.assignedToId);
            payByEmployeeName = payByEmployeeName || String(row.assignedToName || '');
        } else if (row.assignedToType === 'Company' && row.assignedToId) {
            payBy = PAY_BY_COMPANY;
            payByCompanyId = payByCompanyId || String(row.assignedToId);
            payByCompanyName = payByCompanyName || String(row.assignedToName || '');
        } else if (absDifference <= 0.009) {
            payBy = PAY_BY_COMPANY;
            if (!payByCompanyId && companyOptions.length === 1) {
                payByCompanyId = String(companyOptions[0].value || '');
                payByCompanyName = String(companyOptions[0].label || '');
            }
        }

        if (
            !payBy &&
            Array.isArray(row.lineItems) &&
            row.lineItems.length > 0 &&
            !lineWithParty
        ) {
            return {
                error: `Account ${row.accountNo} (${row.provider || 'provider'}): Add more lines are saved, but Payable to is empty. Open Lines, pick Company or Employee on every line, Save lines, then Submit.`,
                payloadRows: null,
            };
        }

        if (!payBy) {
            return {
                error: `Account ${row.accountNo} (${row.provider || 'provider'}): open Add more on that row and set Payable to (Company or Employee) for each line, then Save lines and Submit.`,
                payloadRows: null,
            };
        }
        if (payBy === PAY_BY_COMPANY && !payByCompanyId) {
            if (companyOptions.length === 1) {
                payByCompanyId = String(companyOptions[0].value || '');
                payByCompanyName = String(companyOptions[0].label || '');
            }
        }
        if (payBy === PAY_BY_COMPANY && !payByCompanyId) {
            return {
                error: `Account ${row.accountNo}: pick a Company in Add more → Payable to, then Save lines.`,
                payloadRows: null,
            };
        }
        if (payBy === PAY_BY_EMPLOYEE && !payByEmployeeId) {
            return {
                error: `Account ${row.accountNo}: pick an Employee in Add more → Payable to, then Save lines.`,
                payloadRows: null,
            };
        }

        const party = pickPartyAccountFromList(expenseAccounts, {
            ...row,
            payBy,
            payByCompanyId,
            payByEmployeeId,
        });
        // Acc2 is optional — Zoho bill debit uses Account from Add more (line prices).
        const shares = resolvePayShares(payBy, difference);
        const attachment = resolveRowAttachment(rows, i, utilityAttachment);
        if (row.attachmentMode === 'new' && !row.attachment?.name) {
            return {
                error: `Upload an attachment for account ${row.accountNo}, or choose Use above.`,
                payloadRows: null,
            };
        }

        let lineItems = Array.isArray(row.lineItems) ? row.lineItems : null;
        if (!lineItems?.length) {
            // Auto one line: amount = actual (Zoho bill needs COA lines)
            lineItems = createDefaultLineItems({
                contractAmount: actual,
                actualAmount: actual,
                accountId,
                accountName,
                payByEmployeeId:
                    payBy === PAY_BY_EMPLOYEE ? payByEmployeeId : '',
                payByEmployeeName:
                    payBy === PAY_BY_EMPLOYEE ? payByEmployeeName : '',
                itemLabel: [row.provider, row.accountNo ? `Acc ${row.accountNo}` : '']
                    .filter(Boolean)
                    .join(' · '),
            }).map((line) => ({
                ...line,
                quantity: 1,
                amount: actual,
                rate: actual,
                description: line.item,
                payByEmployeeId:
                    payBy === PAY_BY_EMPLOYEE ? payByEmployeeId : '',
                payByEmployeeName:
                    payBy === PAY_BY_EMPLOYEE ? payByEmployeeName : '',
                payByCompanyId,
                payByCompanyName,
            }));
        } else if (!lineItemsMatchActual(lineItems, actual)) {
            return {
                error: `Item amounts for account ${row.accountNo} must total Actual (${actual.toFixed(2)}). Open Add more to fix.`,
                payloadRows: null,
            };
        }

        const primaryLine = lineItems[0];
        const resolvedExpenseId =
            accountId || String(primaryLine?.accountId || '').trim();
        const resolvedExpenseName =
            accountName || String(primaryLine?.accountName || '').trim();
        if (!resolvedExpenseId) {
            return {
                error: `Select an account in Add more (item table) for ${row.accountNo}.`,
                payloadRows: null,
            };
        }

        const payTotals = computeRowPayTotals({
            ...row,
            payBy,
            contractAmount: contract,
            actualAmount: actual,
            companyDiffAmount: shares.companyAmount,
            employeeDiffAmount: shares.employeeAmount,
        });
        payloadRows.push({
            entryId: row.entryId,
            accountNo: row.accountNo,
            provider: String(row.provider || '').trim(),
            paymentDay: row.paymentDay,
            billNumber,
            billDate: rowBillDate,
            contractAmount: contract,
            actualAmount: actual,
            difference,
            payBy,
            companyDiffAmount: shares.companyAmount,
            employeeDiffAmount: shares.employeeAmount,
            companyPayAmount: payTotals.companyPayAmount,
            employeePayAmount: payTotals.employeePayAmount,
            payByCompanyId,
            payByCompanyName,
            payByEmployeeId: payBy === PAY_BY_EMPLOYEE ? payByEmployeeId : '',
            payByEmployeeName: payBy === PAY_BY_EMPLOYEE ? payByEmployeeName : '',
            expenseAccountId: resolvedExpenseId,
            expenseAccountName: resolvedExpenseName,
            partyAccountId: absDifference > 0.009 ? party.partyAccountId : '',
            partyAccountName: absDifference > 0.009 ? party.partyAccountName : '',
            partyAccountCode: absDifference > 0.009 ? party.partyAccountCode : '',
            attachment: attachment || null,
            lineItems,
            sendForHr: actual > contract,
        });
    }
    return { error: null, payloadRows };
}

/**
 * Add Bills — Cancel / Draft (per logged-in user) / Submit.
 */
export default function AddBillModal({
    isOpen,
    onClose,
    entries = [],
    existingBills = [],
    utilityType = '',
    utilityAttachment = null,
    monthlyRental = 0,
    onSubmit,
    saving = false,
}) {
    const [rows, setRows] = useState([]);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [attachMenuIndex, setAttachMenuIndex] = useState(null);
    const [lineItemsRowIndex, setLineItemsRowIndex] = useState(null);
    const [billMonth, setBillMonth] = useState(currentBillMonthValue());
    const [draftLoaded, setDraftLoaded] = useState(false);
    /** Bills submitted in this modal session (entryId+month) until parent prop refreshes. */
    const [sessionBilled, setSessionBilled] = useState([]);
    const [monthPickerOpen, setMonthPickerOpen] = useState(false);
    const [pickerYear, setPickerYear] = useState(() => yearFromBillMonth(currentBillMonthValue()));
    const [expenseAccounts, setExpenseAccounts] = useState([]);
    const [expenseAccountId, setExpenseAccountId] = useState('');
    const fileInputRefs = useRef({});
    const monthPickerRef = useRef(null);
    const { toast } = useToast();
    const { employeeOptions, companyOptions } = usePayByPartyOptions(isOpen);

    const expenseAccountName = useMemo(() => {
        const match = expenseAccounts.find((a) => a.id === expenseAccountId);
        return match?.name || pickDefaultExpenseAccount(expenseAccounts)?.name || '';
    }, [expenseAccountId, expenseAccounts]);

    const expenseAccountOptions = useMemo(() => {
        const groups = new Map();
        expenseAccounts.forEach((account) => {
            const label = account.type || 'Other';
            if (!groups.has(label)) groups.set(label, []);
            const nameLabel = account.code
                ? `${account.name} (${account.code})`
                : account.name;
            groups.get(label).push({
                value: account.id,
                label: nameLabel,
                code: account.code || '',
                name: account.name || '',
            });
        });
        return [...groups.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([label, options]) => ({
                label,
                options: options.sort((a, b) => a.label.localeCompare(b.label)),
            }));
    }, [expenseAccounts]);

    const companySelectOptions = useMemo(
        () =>
            (companyOptions || []).map((opt) => ({
                value: String(opt.value || ''),
                label: String(opt.label || ''),
            })),
        [companyOptions],
    );

    // Auto-fill Company from assignment / employee's company when empty.
    useEffect(() => {
        if (!isOpen) return;
        if (!companySelectOptions.length && !employeeOptions.length) return;
        setRows((prev) => {
            let changed = false;
            const next = prev.map((row) => {
                if (!row.selected) return row;
                if (String(row.payByCompanyId || '').trim()) return row;
                const auto = resolveAutoCompany(row, employeeOptions, companySelectOptions);
                if (!auto.payByCompanyId) return row;
                changed = true;
                return {
                    ...row,
                    payByCompanyId: auto.payByCompanyId,
                    payByCompanyName: auto.payByCompanyName,
                };
            });
            return changed ? next : prev;
        });
    }, [isOpen, companySelectOptions, employeeOptions, rows.length]);

    useEffect(() => {
        if (!isOpen) {
            setExpenseAccounts([]);
            setExpenseAccountId('');
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const response = await axiosInstance.get('/zoho/bills/support', {
                    skipToast: true,
                    timeout: 45000,
                });
                if (cancelled) return;
                const mapped = mapZohoPaymentAccounts(response?.data?.data?.accounts);
                setExpenseAccounts(mapped);
                if (mapped.length) {
                    setExpenseAccountId(
                        (prev) => prev || pickDefaultExpenseAccount(mapped)?.id || '',
                    );
                }
            } catch {
                if (!cancelled) {
                    setExpenseAccounts([]);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    /** Add Bills shows Active (approved) records only — deactivated are excluded. */
    const listEntries = useMemo(() => {
        if (!Array.isArray(entries) || !entries.length) return [];
        return entries.filter((e) => isEntryActive(e));
    }, [entries]);

    const mergedBills = useMemo(
        () => [...(existingBills || []), ...(sessionBilled || [])],
        [existingBills, sessionBilled],
    );

    const monthTitle = useMemo(() => titleFromBillMonth(billMonth), [billMonth]);

    const billMonthBounds = useMemo(() => billMonthDateBounds(billMonth), [billMonth]);

    const currentYm = useMemo(() => currentBillMonthValue(), []);

    const firstOpenMonth = useMemo(
        () => findFirstOpenMonth(listEntries, mergedBills, billMonth || currentYm),
        [listEntries, mergedBills, billMonth, currentYm],
    );

    const monthOccupancy = useMemo(() => {
        const map = new Map();
        for (let m = 0; m < 12; m++) {
            const ym = monthKeyForYearMonth(pickerYear, m);
            const occupied = entryIdsWithOccupiedBillForMonth(mergedBills, ym);
            const unbilledCount = listEntries.filter(
                (e) => !occupied.has(String(e?.id || '')),
            ).length;
            const full =
                listEntries.length > 0 && unbilledCount === 0
                    ? true
                    : isMonthFullyOccupied(listEntries, mergedBills, ym);
            const past = isMonthBeforeCurrent(ym, currentYm);
            const sequenceLocked =
                !past &&
                listEntries.length > 0 &&
                isMonthSequenceLocked(ym, firstOpenMonth);
            map.set(ym, {
                full,
                past,
                partial: !full && !past && occupied.size > 0 && unbilledCount > 0,
                unbilledCount,
                sequenceLocked,
                disabled: Boolean(past || full || sequenceLocked),
            });
        }
        return map;
    }, [pickerYear, listEntries, mergedBills, firstOpenMonth, currentYm]);

    const applyBillMonth = (ym, { preserveDraft = false, draftRows = [] } = {}) => {
        if (!/^\d{4}-\d{2}$/.test(String(ym || ''))) return;
        if (isMonthBeforeCurrent(ym, currentYm)) {
            setError('Past months cannot be selected — use the current month or later.');
            return;
        }
        if (listEntries.length && isMonthFullyOccupied(listEntries, mergedBills, ym)) {
            setError(
                `${titleFromBillMonth(ym)} is complete — every active account already has an Approved / Paid bill.`,
            );
            return;
        }
        if (listEntries.length && isMonthSequenceLocked(ym, firstOpenMonth)) {
            setError(
                `Finish ${titleFromBillMonth(firstOpenMonth)} first — later months stay disabled until it is fully billed.`,
            );
            return;
        }
        const unbilled = filterUnbilledEntries(listEntries, mergedBills, ym);
        setBillMonth(ym);
        setPickerYear(yearFromBillMonth(ym));
        setMonthPickerOpen(false);
        setError('');

        if (!listEntries.length) {
            setInfo('');
            return;
        }

        const unbilledIds = new Set(unbilled.map((e) => String(e.id)));
        const scopedDraft = preserveDraft
            ? (draftRows || []).filter((r) => unbilledIds.has(String(r.entryId || '')))
            : [];
        setRows(buildRowsFromEntries(unbilled, scopedDraft));

        const occupiedCount = listEntries.length - unbilled.length;
        if (unbilled.length === 0) {
            setInfo(
                `All active accounts already have an Approved / Paid bill for ${titleFromBillMonth(ym)}.`,
            );
        } else if (occupiedCount > 0) {
            setInfo(
                `Showing ${unbilled.length} of ${listEntries.length} accounts without an Approved / Paid bill for ${titleFromBillMonth(ym)}.`,
            );
        } else {
            setInfo('');
        }
    };

    useEffect(() => {
        if (!monthPickerOpen) return;
        const onDoc = (e) => {
            if (monthPickerRef.current && !monthPickerRef.current.contains(e.target)) {
                setMonthPickerOpen(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [monthPickerOpen]);

    useEffect(() => {
        if (!isOpen) {
            setMonthPickerOpen(false);
            return;
        }

        const userKey = getLoggedInUtilityUserKey();
        const draft = userKey ? loadUtilityBillDraft(utilityType) : null;
        const draftRows = Array.isArray(draft?.rows) ? draft.rows : [];
        const preferred = draft?.billMonth || currentBillMonthValue();
        if (draft?.expenseAccountId) {
            setExpenseAccountId(String(draft.expenseAccountId));
        }

        setSessionBilled([]);
        setMonthPickerOpen(false);

        if (listEntries.length) {
            const { billMonth: workingMonth, unbilledEntries } = resolveWorkingMonth(
                listEntries,
                existingBills || [],
                preferred,
            );
            setBillMonth(workingMonth);
            setPickerYear(yearFromBillMonth(workingMonth));

            const draftForMonth =
                draft?.billMonth && String(draft.billMonth) === String(workingMonth)
                    ? draftRows
                    : [];
            const unbilledIds = new Set(unbilledEntries.map((e) => String(e.id)));
            const scopedDraft = draftForMonth.filter((r) =>
                unbilledIds.has(String(r.entryId || '')),
            );
            setRows(buildRowsFromEntries(unbilledEntries, scopedDraft));

            if (draft?.billMonth && String(draft.billMonth) === String(workingMonth)) {
                setDraftLoaded(true);
                setInfo(
                    `Draft restored for ${titleFromBillMonth(workingMonth)} (only you can see this).`,
                );
            } else if (preferred && preferred !== workingMonth) {
                setDraftLoaded(false);
                setInfo(
                    isMonthBeforeCurrent(preferred)
                        ? `Past months are not available. Showing ${titleFromBillMonth(workingMonth)}.`
                        : preferred > workingMonth
                          ? `Finish ${titleFromBillMonth(workingMonth)} first — later months stay locked until it is fully billed.`
                          : `${titleFromBillMonth(preferred)} is complete. Showing ${titleFromBillMonth(workingMonth)}.`,
                );
            } else if (unbilledEntries.length < listEntries.length) {
                setDraftLoaded(false);
                setInfo(
                    `Showing ${unbilledEntries.length} of ${listEntries.length} accounts without an Approved / Paid bill for ${titleFromBillMonth(workingMonth)}.`,
                );
            } else {
                setDraftLoaded(false);
                setInfo('');
            }
        } else {
            const draftRow = draftRows[0];
            setBillMonth(draft?.billMonth || currentBillMonthValue());
            setPickerYear(yearFromBillMonth(draft?.billMonth || currentBillMonthValue()));
            setRows([
                {
                    entryId: draftRow?.entryId || '',
                    selected: draftRow ? draftRow.selected !== false : true,
                    accountNo: '—',
                    provider: '—',
                    billDate: draftRow?.billDate || '',
                    expenseAccountId: draftRow?.expenseAccountId || '',
                    expenseAccountName: draftRow?.expenseAccountName || '',
                    partyAccountId: draftRow?.partyAccountId || '',
                    partyAccountName: draftRow?.partyAccountName || '',
                    partyAccountCode: draftRow?.partyAccountCode || '',
                    assignedToType: '',
                    assignedToId: '',
                    assignedToName: '',
                    contractAmount: Number(monthlyRental) || 0,
                    actualAmount:
                        draftRow?.actualAmount != null && draftRow.actualAmount !== ''
                            ? String(draftRow.actualAmount)
                            : '',
                    payBy: draftRow?.payBy || '',
                    companyDiffAmount: draftRow?.companyDiffAmount ?? '',
                    employeeDiffAmount: draftRow?.employeeDiffAmount ?? '',
                    payByCompanyId: draftRow?.payByCompanyId || '',
                    payByCompanyName: draftRow?.payByCompanyName || '',
                    payByEmployeeId: draftRow?.payByEmployeeId || '',
                    payByEmployeeName: draftRow?.payByEmployeeName || '',
                    attachmentMode: draftRow?.attachmentMode || null,
                    attachment: draftRow?.attachment || null,
                },
            ]);
            if (draft?.billMonth) {
                setDraftLoaded(true);
                setInfo(
                    `Draft restored for ${titleFromBillMonth(draft.billMonth)} (only you can see this).`,
                );
            } else {
                setDraftLoaded(false);
                setInfo('');
            }
        }

        setError('');
        setAttachMenuIndex(null);
        setLineItemsRowIndex(null);
        // intentionally only re-init when modal opens / entry list type changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, listEntries, monthlyRental, utilityType]);

    const allSelected = rows.length > 0 && rows.every((r) => r.selected);
    const someSelected = rows.some((r) => r.selected);
    const selectedCount = rows.filter((r) => r.selected).length;

    const toggleAll = (checked) => {
        setRows((prev) =>
            prev.map((r) => (checked ? restoreAssignedPayBy(r) : resetUncheckedRow(r))),
        );
        if (!checked) {
            setAttachMenuIndex(null);
            setLineItemsRowIndex(null);
            setError('');
        }
    };

    const setRowSelected = (index, checked) => {
        setRows((prev) => {
            if (!checked) {
                const next = prev.map((r, i) =>
                    i === index ? resetUncheckedRow(r) : r,
                );
                const [moved] = next.splice(index, 1);
                next.push(moved);
                return next;
            }
            return prev.map((r, i) => (i === index ? restoreAssignedPayBy(r) : r));
        });
        if (!checked) {
            setAttachMenuIndex(null);
            setLineItemsRowIndex(null);
            setError('');
        }
    };

    const updateRow = (index, patch) => {
        setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    };

    const handleAttachmentFile = async (index, fileList) => {
        const file = fileList?.[0];
        if (!file) return;
        const isPdf =
            file.type === 'application/pdf' ||
            String(file.name || '').toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            setError('Only PDF attachments are allowed.');
            return;
        }
        if (file.size > MAX_ATTACHMENT_BYTES) {
            setError('Attachment must be 1.5 MB or smaller.');
            return;
        }
        try {
            const dataUrl = await readFileAsDataUrl(file);
            updateRow(index, {
                attachmentMode: 'new',
                attachment: {
                    name: file.name,
                    mime: 'application/pdf',
                    dataUrl,
                },
            });
            setAttachMenuIndex(null);
            setError('');
        } catch {
            setError('Could not read the selected file.');
        }
    };

    const chooseUseAbove = (index) => {
        updateRow(index, { attachmentMode: 'above', attachment: null });
        setAttachMenuIndex(null);
        setError('');
    };

    const chooseNewUpload = (index) => {
        updateRow(index, { attachmentMode: 'new' });
        setAttachMenuIndex(null);
        requestAnimationFrame(() => {
            fileInputRefs.current[index]?.click();
        });
    };

    const buildDraftSnapshot = () => ({
        billMonth,
        billMonthLabel: monthTitle,
        utilityType,
        expenseAccountId,
        expenseAccountName,
        rows: rows.map((r) => ({
            entryId: r.entryId,
            selected: r.selected,
            accountNo: r.accountNo,
            provider: r.provider,
            billNumber: r.billNumber,
            billDate: r.billDate || '',
            expenseAccountId: r.expenseAccountId || '',
            expenseAccountName: r.expenseAccountName || '',
            partyAccountId: r.partyAccountId || '',
            partyAccountName: r.partyAccountName || '',
            partyAccountCode: r.partyAccountCode || '',
            contractAmount: r.contractAmount,
            actualAmount: r.actualAmount,
            payBy: r.payBy,
            companyDiffAmount: r.companyDiffAmount,
            employeeDiffAmount: r.employeeDiffAmount,
            payByCompanyId: r.payByCompanyId || '',
            payByCompanyName: r.payByCompanyName || '',
            payByEmployeeId: r.payByEmployeeId || '',
            payByEmployeeName: r.payByEmployeeName || '',
            attachmentMode: r.attachmentMode,
            attachment: r.attachment,
            lineItems: Array.isArray(r.lineItems) ? r.lineItems : null,
        })),
    });

    const handleDraft = () => {
        const userKey = getLoggedInUtilityUserKey();
        if (!userKey) {
            setError('Please log in again to save a draft.');
            return;
        }
        if (!utilityType) {
            setError('Utility type is missing.');
            return;
        }
        if (!rows.some((r) => r.selected)) {
            setError('Select at least one account to draft.');
            return;
        }
        const ok = saveUtilityBillDraft(utilityType, buildDraftSnapshot());
        if (!ok) {
            setError('Could not save draft on this device.');
            return;
        }
        setDraftLoaded(true);
        setError('');
        toast({
            title: 'Draft saved',
            description: `Only you will see this ${monthTitle} draft when you open Add Bills again.`,
        });
        onClose?.();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!rows.some((r) => r.selected)) {
            setError('Select at least one account.');
            return;
        }
        const snapshotMonth = billMonth;
        const { error: rowError, payloadRows } = collectPayloadRows(rows, utilityAttachment, {
            defaultExpenseAccountId: expenseAccountId,
            defaultExpenseAccountName: expenseAccountName,
            billMonth: snapshotMonth,
            expenseAccounts,
            employeeOptions,
            companyOptions: companySelectOptions,
        });
        if (rowError) {
            setError(rowError);
            return;
        }

        try {
            const result = await onSubmit?.({
                billMonth: snapshotMonth,
                billMonthLabel: titleFromBillMonth(snapshotMonth),
                utilityType,
                expenseAccountId: payloadRows[0]?.expenseAccountId || expenseAccountId,
                expenseAccountName: payloadRows[0]?.expenseAccountName || expenseAccountName,
                rows: payloadRows,
                amount: payloadRows[0]?.actualAmount,
                notes: '',
                sendForHr: payloadRows[0]?.sendForHr,
                attachment: payloadRows[0]?.attachment || null,
                monthlyRental: payloadRows[0]?.contractAmount,
                clearDraftOnSuccess: true,
                keepOpen: false,
            });
            if (result === false || result?.ok === false) return;

            toast({
                title: 'Completed',
                description: `${titleFromBillMonth(snapshotMonth)} bills submitted.`,
            });
            onClose?.();
        } catch {
            // Parent toasts errors
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-[72rem] max-h-[95vh] overflow-hidden flex flex-col border border-gray-200">
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200 shrink-0 bg-white">
                    <div className="min-w-0 relative" ref={monthPickerRef}>
                        <button
                            type="button"
                            onClick={() => {
                                setPickerYear(yearFromBillMonth(billMonth));
                                setMonthPickerOpen((o) => !o);
                            }}
                            className="group text-left rounded-lg -ml-1 px-1 py-0.5 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
                            aria-expanded={monthPickerOpen}
                            aria-haspopup="dialog"
                            title="Choose bill month"
                        >
                            <h2 className="text-lg sm:text-xl font-bold text-gray-800 inline-flex items-center gap-1.5">
                                <span>
                                    {monthTitle} Bill
                                </span>
                                <ChevronDown
                                    size={18}
                                    className={`text-gray-400 group-hover:text-teal-600 transition-transform ${
                                        monthPickerOpen ? 'rotate-180 text-teal-600' : ''
                                    }`}
                                />
                            </h2>
                        </button>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            {utilityType ? (
                                <p className="text-xs font-medium text-teal-700">{utilityType}</p>
                            ) : null}
                            {draftLoaded ? (
                                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                    Draft
                                </span>
                            ) : null}
                        </div>

                        {monthPickerOpen ? (
                            <div className="absolute left-0 top-full mt-2 z-30 w-[min(100vw-2rem,18.5rem)] rounded-xl border border-gray-200 bg-white shadow-xl p-3">
                                <div className="flex items-center justify-between mb-3">
                                    <button
                                        type="button"
                                        onClick={() => setPickerYear((y) => y - 1)}
                                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
                                        aria-label="Previous year"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="text-sm font-bold text-gray-800 tabular-nums">
                                        {pickerYear}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setPickerYear((y) => y + 1)}
                                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
                                        aria-label="Next year"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {MONTH_SHORT.map((label, monthIndex) => {
                                        const ym = monthKeyForYearMonth(pickerYear, monthIndex);
                                        const occ = monthOccupancy.get(ym) || {
                                            full: false,
                                            past: false,
                                            partial: false,
                                            sequenceLocked: false,
                                            disabled: false,
                                        };
                                        const selected = ym === billMonth;
                                        const disabled = Boolean(occ.disabled);
                                        return (
                                            <button
                                                key={ym}
                                                type="button"
                                                disabled={disabled}
                                                title={
                                                    occ.past
                                                        ? 'Past months cannot be selected'
                                                        : occ.full
                                                          ? 'All active accounts already have Approved / Paid for this month'
                                                          : occ.sequenceLocked
                                                            ? `Finish ${titleFromBillMonth(firstOpenMonth)} first before selecting later months`
                                                            : occ.partial
                                                              ? 'Some accounts already billed — only remaining will show'
                                                              : `Select ${label} ${pickerYear}`
                                                }
                                                onClick={() => applyBillMonth(ym)}
                                                className={`relative rounded-lg px-2 py-2.5 text-xs font-semibold transition-colors ${
                                                    disabled
                                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                        : selected
                                                          ? 'bg-teal-500 text-white shadow-sm'
                                                          : 'bg-gray-50 text-gray-700 hover:bg-teal-50 hover:text-teal-800'
                                                }`}
                                            >
                                                {label}
                                                {occ.partial && !disabled ? (
                                                    <span
                                                        className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${
                                                            selected ? 'bg-white/90' : 'bg-amber-500'
                                                        }`}
                                                        aria-hidden
                                                    />
                                                ) : null}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="mt-2.5 text-[10px] text-gray-500 leading-relaxed">
                                    Only current and future months. Past months are disabled. Later
                                    months stay locked until the open month is fully billed.
                                </p>
                            </div>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors shrink-0"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
                    <div className="px-5 pt-3 pb-1 flex items-center justify-between gap-2 shrink-0">
                        {info ? (
                            <p className="text-xs text-amber-700">{info}</p>
                        ) : (
                            <span />
                        )}
                        <span className="text-xs text-gray-500 tabular-nums shrink-0">
                            {selectedCount} of {rows.length} selected
                        </span>
                    </div>

                    <div className="overflow-auto flex-1 min-h-0 px-4 sm:px-5 pb-3">
                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                            <table className="min-w-[56rem] w-full text-sm table-fixed">
                                <thead className="sticky top-0 z-10 bg-gray-50">
                                    <tr className="border-b border-gray-200 text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        <th className="w-12 px-3 py-3 text-center font-semibold">
                                            <input
                                                type="checkbox"
                                                checked={allSelected}
                                                ref={(el) => {
                                                    if (el) el.indeterminate = someSelected && !allSelected;
                                                }}
                                                onChange={(e) => toggleAll(e.target.checked)}
                                                className="accent-teal-600 w-4 h-4"
                                                title="Select all"
                                                aria-label="Select all"
                                            />
                                        </th>
                                        <th className="w-[12%] px-3 py-3 text-center font-semibold whitespace-nowrap">
                                            Account No
                                        </th>
                                        <th className="w-[12%] px-3 py-3 text-center font-semibold whitespace-nowrap">
                                            Provider
                                        </th>
                                        <th className="w-[12%] px-3 py-3 text-center font-semibold whitespace-nowrap">
                                            Bill #
                                        </th>
                                        <th className="w-[14%] px-3 py-3 text-center font-semibold whitespace-nowrap">
                                            Bill Date
                                        </th>
                                        <th className="w-[12%] px-3 py-3 text-center font-semibold whitespace-nowrap">
                                            Contract Amount
                                        </th>
                                        <th className="w-[12%] px-3 py-3 text-center font-semibold whitespace-nowrap">
                                            Actual Amount
                                        </th>
                                        <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">
                                            Attachment
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {rows.map((row, index) => {
                                        const resolved = resolveRowAttachment(
                                            rows,
                                            index,
                                            utilityAttachment,
                                        );

                                        return (
                                            <tr
                                                key={row.entryId || `row-${index}`}
                                                className={
                                                    row.selected
                                                        ? 'hover:bg-teal-50/30'
                                                        : 'bg-gray-50/80 opacity-60'
                                                }
                                            >
                                                <td className="px-3 py-3.5 text-center align-middle">
                                                    <input
                                                        type="checkbox"
                                                        checked={row.selected}
                                                        onChange={(e) =>
                                                            setRowSelected(index, e.target.checked)
                                                        }
                                                        className="accent-teal-600 w-4 h-4"
                                                    />
                                                </td>
                                                <td className="px-3 py-3.5 text-center align-middle font-semibold text-gray-800 tabular-nums">
                                                    {row.accountNo}
                                                </td>
                                                <td
                                                    className="px-3 py-3.5 text-center align-middle text-gray-700 font-medium truncate max-w-[8rem]"
                                                    title={row.provider}
                                                >
                                                    {row.provider || '—'}
                                                </td>
                                                <td className="px-2 py-3.5 text-center align-middle">
                                                    <input
                                                        type="text"
                                                        value={row.billNumber || ''}
                                                        disabled={!row.selected}
                                                        onChange={(e) =>
                                                            setRows((prev) =>
                                                                prev.map((r, i) =>
                                                                    i === index
                                                                        ? {
                                                                              ...r,
                                                                              billNumber: e.target.value,
                                                                          }
                                                                        : r,
                                                                ),
                                                            )
                                                        }
                                                        placeholder="Bill #"
                                                        className="w-full min-w-[5.5rem] h-9 rounded-lg border border-gray-200 bg-white px-2 text-center text-sm text-gray-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 disabled:bg-gray-50 disabled:opacity-60"
                                                    />
                                                </td>
                                                <td
                                                    className="px-2 py-3.5 text-center align-middle"
                                                    title={`Pick a date within ${monthTitle}`}
                                                >
                                                    <input
                                                        type="date"
                                                        value={
                                                            row.billDate ||
                                                            (row.paymentDay
                                                                ? billDateFromMonth(
                                                                      billMonth,
                                                                      row.paymentDay,
                                                                  )
                                                                : '')
                                                        }
                                                        min={billMonthBounds.min}
                                                        max={billMonthBounds.max}
                                                        disabled={!row.selected}
                                                        onChange={(e) => {
                                                            const next = e.target.value;
                                                            if (
                                                                next &&
                                                                !isDateWithinBillMonth(next, billMonth)
                                                            ) {
                                                                setError(
                                                                    `Bill date must be within ${monthTitle}.`,
                                                                );
                                                                return;
                                                            }
                                                            updateRow(index, { billDate: next });
                                                            setError('');
                                                        }}
                                                        className="w-full min-w-[8rem] h-9 rounded-lg border border-gray-200 bg-white px-2 text-center text-xs tabular-nums text-gray-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 disabled:bg-gray-50 disabled:opacity-60"
                                                    />
                                                </td>
                                                <td className="px-3 py-3.5 text-center align-middle tabular-nums text-gray-700">
                                                    {formatMoney(row.contractAmount)}
                                                </td>
                                                <td className="px-4 py-3.5 text-center align-middle">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={row.actualAmount}
                                                        disabled={!row.selected}
                                                        onChange={(e) => {
                                                            const nextActual = e.target.value;
                                                            const actualN = Number(nextActual);
                                                            const has =
                                                                nextActual !== '' &&
                                                                Number.isFinite(actualN);
                                                            const contractN = Number(
                                                                row.contractAmount || 0,
                                                            );
                                                            const diff = has
                                                                ? contractN - actualN
                                                                : 0;
                                                            const patch = { actualAmount: nextActual };
                                                            if (!has || Math.abs(diff) < 0.01) {
                                                                patch.partyAccountId = '';
                                                                patch.partyAccountName = '';
                                                                patch.partyAccountCode = '';
                                                            }
                                                            if (has && actualN < contractN) {
                                                                const shares = resolvePayShares(
                                                                    PAY_BY_COMPANY,
                                                                    diff,
                                                                );
                                                                patch.companyDiffAmount =
                                                                    shares.companyAmount;
                                                                patch.employeeDiffAmount =
                                                                    shares.employeeAmount;
                                                                if (
                                                                    row.assignedToType ===
                                                                        'Company' &&
                                                                    row.assignedToId
                                                                ) {
                                                                    patch.payBy = PAY_BY_COMPANY;
                                                                    patch.payByCompanyId =
                                                                        row.assignedToId;
                                                                    patch.payByCompanyName =
                                                                        row.assignedToName || '';
                                                                    patch.payByEmployeeId = '';
                                                                    patch.payByEmployeeName = '';
                                                                } else if (
                                                                    row.payBy === PAY_BY_COMPANY
                                                                ) {
                                                                    patch.payBy = PAY_BY_COMPANY;
                                                                } else if (
                                                                    !String(row.payBy || '').trim() &&
                                                                    row.assignedToType ===
                                                                        'Employee' &&
                                                                    row.assignedToId
                                                                ) {
                                                                    const assignedPay =
                                                                        payByFieldsFromAssignment(
                                                                            row,
                                                                        );
                                                                    Object.assign(patch, assignedPay);
                                                                }
                                                            } else if (
                                                                !String(row.payBy || '').trim() &&
                                                                row.assignedToId
                                                            ) {
                                                                const assignedPay =
                                                                    payByFieldsFromAssignment(row);
                                                                if (assignedPay.payBy) {
                                                                    const shares = resolvePayShares(
                                                                        assignedPay.payBy,
                                                                        diff,
                                                                    );
                                                                    Object.assign(patch, assignedPay, {
                                                                        companyDiffAmount:
                                                                            shares.companyAmount,
                                                                        employeeDiffAmount:
                                                                            shares.employeeAmount,
                                                                    });
                                                                }
                                                            } else if (
                                                                row.payBy === PAY_BY_COMPANY ||
                                                                row.payBy === PAY_BY_EMPLOYEE
                                                            ) {
                                                                const shares = resolvePayShares(
                                                                    row.payBy,
                                                                    diff,
                                                                );
                                                                patch.companyDiffAmount =
                                                                    shares.companyAmount;
                                                                patch.employeeDiffAmount =
                                                                    shares.employeeAmount;
                                                            }
                                                            updateRow(index, patch);
                                                            setError('');
                                                        }}
                                                        className="w-28 mx-auto block rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-center text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-400 disabled:bg-gray-100"
                                                        placeholder="0.00"
                                                    />
                                                </td>
                                                <td className="px-4 py-3.5 text-center align-middle relative">
                                                    <input
                                                        ref={(el) => {
                                                            fileInputRefs.current[index] = el;
                                                        }}
                                                        type="file"
                                                        accept=".pdf,application/pdf"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            handleAttachmentFile(index, e.target.files);
                                                            e.target.value = '';
                                                        }}
                                                    />

                                                    <div className="inline-flex flex-col items-center gap-1.5 min-w-[7.5rem]">
                                                        <button
                                                            type="button"
                                                            disabled={!row.selected}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setAttachMenuIndex(index);
                                                            }}
                                                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold disabled:opacity-40 transition-colors shadow-sm"
                                                        >
                                                            <Upload size={13} strokeWidth={2.25} />
                                                            Upload
                                                        </button>

                                                        {resolved?.name ? (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    openAttachmentView(resolved, toast)
                                                                }
                                                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                                                                title={resolved.name}
                                                            >
                                                                <Eye size={12} />
                                                                View
                                                            </button>
                                                        ) : null}

                                                        {row.attachmentMode === 'above' &&
                                                        !resolved?.name ? (
                                                            <span className="text-[10px] text-gray-400">
                                                                No file above
                                                            </span>
                                                        ) : null}

                                                        <button
                                                            type="button"
                                                            disabled={!row.selected || saving}
                                                            onClick={() => {
                                                                const actualN = Number(
                                                                    row.actualAmount,
                                                                );
                                                                if (
                                                                    !(
                                                                        row.actualAmount !== '' &&
                                                                        Number.isFinite(actualN) &&
                                                                        actualN > 0
                                                                    )
                                                                ) {
                                                                    setError(
                                                                        'Enter Actual Amount first, then open item lines.',
                                                                    );
                                                                    return;
                                                                }
                                                                setLineItemsRowIndex(index);
                                                                setError('');
                                                            }}
                                                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-40"
                                                            title="Zoho-style item table"
                                                        >
                                                            <Plus size={12} />
                                                            {Array.isArray(row.lineItems) &&
                                                            row.lineItems.length
                                                                ? `Lines (${row.lineItems.length})`
                                                                : 'Add more'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {rows.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-10">
                                {listEntries.length
                                    ? `All active accounts already have an Approved / Paid bill for ${monthTitle}. Pick another month.`
                                    : 'No accounts to bill.'}
                            </p>
                        ) : (
                            <div className="pt-3">
                                <button
                                    type="button"
                                    disabled={saving || !rows.some((r) => r.selected)}
                                    onClick={() => {
                                        const withActual = rows.findIndex(
                                            (r) =>
                                                r.selected &&
                                                Number(r.actualAmount) > 0 &&
                                                r.actualAmount !== '',
                                        );
                                        const fallback = rows.findIndex((r) => r.selected);
                                        const target =
                                            withActual >= 0 ? withActual : fallback;
                                        if (target < 0) {
                                            setError('Select an account first.');
                                            return;
                                        }
                                        const row = rows[target];
                                        const actualN = Number(row.actualAmount);
                                        if (
                                            !(
                                                row.actualAmount !== '' &&
                                                Number.isFinite(actualN) &&
                                                actualN > 0
                                            )
                                        ) {
                                            setError(
                                                'Enter Actual Amount first, then click Add more.',
                                            );
                                            return;
                                        }
                                        setLineItemsRowIndex(target);
                                        setError('');
                                    }}
                                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-40"
                                >
                                    <Plus size={16} strokeWidth={2.25} />
                                    Add more
                                    {rows.some(
                                        (r) =>
                                            r.selected &&
                                            Array.isArray(r.lineItems) &&
                                            r.lineItems.length,
                                    ) ? (
                                        <span className="text-[10px] font-medium text-emerald-600 normal-case">
                                            (lines set)
                                        </span>
                                    ) : null}
                                </button>
                            </div>
                        )}
                    </div>

                    <UtilityBillTotalsBar rows={rows} />

                    {error ? (
                        <p className="px-5 pb-2 text-sm text-red-600 shrink-0">{error}</p>
                    ) : null}

                    <div className="px-5 py-3.5 border-t border-gray-100 flex flex-wrap justify-end gap-2 shrink-0 bg-white">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleDraft}
                            disabled={saving || !rows.length}
                            className="px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-sm font-semibold disabled:opacity-50"
                        >
                            Draft
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !rows.length}
                            className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold disabled:opacity-50 shadow-sm"
                        >
                            {saving ? 'Submitting…' : 'Submit'}
                        </button>
                    </div>
                </form>
            </div>

            <UtilityBillLineItemsModal
                isOpen={lineItemsRowIndex != null}
                onClose={() => setLineItemsRowIndex(null)}
                accountNo={
                    lineItemsRowIndex != null
                        ? rows[lineItemsRowIndex]?.accountNo || ''
                        : ''
                }
                provider={
                    lineItemsRowIndex != null
                        ? rows[lineItemsRowIndex]?.provider || ''
                        : ''
                }
                contractAmount={
                    lineItemsRowIndex != null
                        ? Number(rows[lineItemsRowIndex]?.contractAmount || 0)
                        : 0
                }
                actualAmount={
                    lineItemsRowIndex != null
                        ? Number(rows[lineItemsRowIndex]?.actualAmount || 0)
                        : 0
                }
                initialLines={
                    lineItemsRowIndex != null
                        ? rows[lineItemsRowIndex]?.lineItems || null
                        : null
                }
                accountOptions={expenseAccountOptions}
                employeeOptions={employeeOptions}
                companyOptions={companySelectOptions}
                defaultAccountId={
                    lineItemsRowIndex != null
                        ? rows[lineItemsRowIndex]?.expenseAccountId ||
                          expenseAccountId ||
                          ''
                        : expenseAccountId
                }
                defaultAccountName={
                    lineItemsRowIndex != null
                        ? rows[lineItemsRowIndex]?.expenseAccountName ||
                          expenseAccountName ||
                          ''
                        : expenseAccountName
                }
                defaultPayBy={
                    lineItemsRowIndex != null
                        ? rows[lineItemsRowIndex]?.payBy ||
                          (rows[lineItemsRowIndex]?.assignedToType === 'Employee'
                              ? PAY_BY_EMPLOYEE
                              : rows[lineItemsRowIndex]?.assignedToType === 'Company'
                                ? PAY_BY_COMPANY
                                : '') ||
                          ''
                        : ''
                }
                defaultPayByEmployeeId={
                    lineItemsRowIndex != null
                        ? rows[lineItemsRowIndex]?.payByEmployeeId ||
                          (rows[lineItemsRowIndex]?.assignedToType === 'Employee'
                              ? rows[lineItemsRowIndex]?.assignedToId
                              : '') ||
                          ''
                        : ''
                }
                defaultPayByEmployeeName={
                    lineItemsRowIndex != null
                        ? rows[lineItemsRowIndex]?.payByEmployeeName ||
                          (rows[lineItemsRowIndex]?.assignedToType === 'Employee'
                              ? rows[lineItemsRowIndex]?.assignedToName
                              : '') ||
                          ''
                        : ''
                }
                defaultPayByCompanyId={
                    lineItemsRowIndex != null
                        ? rows[lineItemsRowIndex]?.payByCompanyId ||
                          (rows[lineItemsRowIndex]?.assignedToType === 'Company'
                              ? rows[lineItemsRowIndex]?.assignedToId
                              : '') ||
                          ''
                        : ''
                }
                defaultPayByCompanyName={
                    lineItemsRowIndex != null
                        ? rows[lineItemsRowIndex]?.payByCompanyName ||
                          (rows[lineItemsRowIndex]?.assignedToType === 'Company'
                              ? rows[lineItemsRowIndex]?.assignedToName
                              : '') ||
                          ''
                        : ''
                }
                itemLabel={
                    lineItemsRowIndex != null
                        ? [
                              utilityType,
                              rows[lineItemsRowIndex]?.provider,
                              rows[lineItemsRowIndex]?.accountNo
                                  ? `Acc ${rows[lineItemsRowIndex].accountNo}`
                                  : '',
                          ]
                              .filter(Boolean)
                              .join(' · ')
                        : utilityType
                }
                onSave={(lines) => {
                    if (lineItemsRowIndex == null) return;
                    const first = lines[0];
                    const payBy =
                        first?.payBy === PAY_BY_COMPANY || first?.payBy === PAY_BY_EMPLOYEE
                            ? first.payBy
                            : String(first?.payByCompanyId || '').trim()
                              ? PAY_BY_COMPANY
                              : String(first?.payByEmployeeId || '').trim()
                                ? PAY_BY_EMPLOYEE
                                : '';
                    const empId = String(first?.payByEmployeeId || '').trim();
                    const empName = String(first?.payByEmployeeName || '').trim();
                    let companyId = String(first?.payByCompanyId || '').trim();
                    let companyName = String(first?.payByCompanyName || '').trim();
                    if (payBy === PAY_BY_EMPLOYEE && empId && !companyId) {
                        const auto = resolveAutoCompany(
                            {
                                payByEmployeeId: empId,
                                assignedToType: 'Employee',
                                assignedToId: empId,
                            },
                            employeeOptions,
                            companySelectOptions,
                        );
                        companyId = auto.payByCompanyId || '';
                        companyName = auto.payByCompanyName || '';
                    }
                    updateRow(lineItemsRowIndex, {
                        lineItems: lines,
                        expenseAccountId:
                            first?.accountId ||
                            rows[lineItemsRowIndex]?.expenseAccountId ||
                            expenseAccountId ||
                            '',
                        expenseAccountName:
                            first?.accountName ||
                            rows[lineItemsRowIndex]?.expenseAccountName ||
                            expenseAccountName ||
                            '',
                        ...(payBy
                            ? {
                                  payBy,
                                  payByEmployeeId:
                                      payBy === PAY_BY_EMPLOYEE ? empId : '',
                                  payByEmployeeName:
                                      payBy === PAY_BY_EMPLOYEE ? empName : '',
                                  payByCompanyId: companyId,
                                  payByCompanyName: companyName,
                              }
                            : {}),
                    });
                    setLineItemsRowIndex(null);
                    setError('');
                }}
            />

            <AttachmentSourceModal
                isOpen={attachMenuIndex != null}
                accountNo={
                    attachMenuIndex != null ? rows[attachMenuIndex]?.accountNo || '' : ''
                }
                previousAvailable={
                    attachMenuIndex == null
                        ? false
                        : attachMenuIndex === 0
                          ? Boolean(utilityAttachment?.name)
                          : Boolean(
                                resolveRowAttachment(
                                    rows,
                                    attachMenuIndex - 1,
                                    utilityAttachment,
                                )?.name,
                            )
                }
                previousLabel={
                    attachMenuIndex == null
                        ? ''
                        : attachMenuIndex === 0
                          ? utilityAttachment?.name
                              ? `Use type attachment (${utilityAttachment.name})`
                              : 'No type attachment available'
                          : resolveRowAttachment(
                                  rows,
                                  attachMenuIndex - 1,
                                  utilityAttachment,
                              )?.name
                            ? `Use file from previous row (${
                                  resolveRowAttachment(
                                      rows,
                                      attachMenuIndex - 1,
                                      utilityAttachment,
                                  ).name
                              })`
                            : 'No file on previous row'
                }
                onClose={() => setAttachMenuIndex(null)}
                onUsePrevious={() => {
                    if (attachMenuIndex == null) return;
                    chooseUseAbove(attachMenuIndex);
                }}
                onUseNew={() => {
                    if (attachMenuIndex == null) return;
                    chooseNewUpload(attachMenuIndex);
                }}
            />
        </div>
    );
}
