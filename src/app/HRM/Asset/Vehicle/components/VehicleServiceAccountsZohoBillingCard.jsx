'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Plus, Trash2, Wallet } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import ZohoVendorSelect from '@/components/ZohoVendorSelect';
import { openAttachmentInNewTab } from '@/utils/attachmentPreview';
import { parseVehicleServiceRemark } from './vehicleServiceUtils';
import VehicleGarageZohoBillRetry from './VehicleGarageZohoBillRetry';
import ZohoPayAccountSelect from './ZohoPayAccountSelect';
import VehicleServiceLockedSection from './VehicleServiceLockedSection';
import { ERP_PDF_ACCEPT, validateErpPdfFile } from '@/utils/uploadFileTypes';
import {
    SHOP_SERVICE_CARD,
    resolveShopServiceCardGate,
} from '../utils/vehicleShopServiceCardGates';
import { isOilServiceAssignmentPending } from '../utils/vehicleOilServiceAccess';
import {
    buildEmployeeNameByIdMap,
    buildVehicleServiceBillingPayables,
    resolveEmployeeDisplayName,
    resolveVehicleServiceBillingTotal,
} from '../utils/vehicleServiceBillingPayables';
import {
    buildAccidentRepairAutoZohoBills,
    resolveAccidentRepairCostBillSources,
    sumAccidentRepairCostBillSources,
    validateAccidentRepairZohoBills,
} from '../utils/vehicleAccidentRepairZohoBills';

function money(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function emptyPayableLine() {
    return {
        partyType: '',
        partyName: '',
        description: '',
        payableTo: '',
        payAccountId: '',
        amount: '',
    };
}

function resolveCompanyPartyName(asset, remark = {}, companies = []) {
    const fromRemark = String(remark.companyPayPartyName || remark.companyName || '').trim();
    if (fromRemark && !/^Company$/i.test(fromRemark)) return fromRemark;

    const c = asset?.assignedCompany;
    if (c && typeof c === 'object') {
        const fromAssigned = String(
            c.nickName ||
                c.companyShortName ||
                c.companyName ||
                c.tradeName ||
                c.name ||
                '',
        ).trim();
        if (fromAssigned) return fromAssigned;
    }

    const companyId = String(
        (c && typeof c === 'object' ? c._id || c.id : c) ||
            asset?.assignedCompanyId ||
            remark.companyId ||
            '',
    ).trim();
    if (companyId && Array.isArray(companies) && companies.length) {
        const match = companies.find(
            (row) =>
                String(row?._id || row?.id || '').trim() === companyId ||
                String(row?._id || '').trim() === companyId,
        );
        const fromList = String(
            match?.nickName ||
                match?.companyShortName ||
                match?.companyName ||
                match?.tradeName ||
                match?.name ||
                '',
        ).trim();
        if (fromList) return fromList;
    }

    return (
        String(asset?.companyName || asset?.organizationName || asset?.ownerCompany || '').trim() ||
        'Company'
    );
}

function buildEmployeeNameMap(employees = [], asset = null) {
    const nameById = buildEmployeeNameByIdMap(employees);
    const assignee = asset?.assignedTo;
    if (assignee && typeof assignee === 'object') {
        const label =
            `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() ||
            String(assignee.employeeId || '').trim();
        const id = String(assignee._id || assignee.id || '').trim();
        if (label && id) {
            nameById[id] = label;
            nameById[id.toLowerCase()] = label;
        }
    }
    return nameById;
}

function buildInitialBillingState(service, { asset = null, employees = [], companies = [] } = {}) {
    const remark = parseVehicleServiceRemark(service) || {};
    const companyName = resolveCompanyPartyName(asset, remark, companies);
    const seedAmount = resolveVehicleServiceBillingTotal(service, remark);
    const nameById = buildEmployeeNameMap(employees, asset);
    const lines = buildVehicleServiceBillingPayables(service, remark, {
        employeeNameById: nameById,
        companyName,
    });

    const existingGarageAttachmentUrl = String(
        remark.garageAttachmentUrl ||
            remark.garageBillAttachmentUrl ||
            service?.shopInvoice ||
            remark.garageInvoiceUrl ||
            '',
    ).trim();
    const existingGarageAttachmentName = String(
        remark.garageAttachmentName ||
            remark.garageInvoiceName ||
            remark.shopInvoiceName ||
            '',
    ).trim();

    return {
        garageName: String(remark.garageName || remark.vendorName || '').trim(),
        zohoVendorId: String(remark.zohoVendorId || '').trim(),
        garageBillAmount: seedAmount > 0 ? String(seedAmount) : '',
        payAccountId: String(remark.payAccountId || remark.garagePayAccountId || '').trim(),
        payAccountName: String(remark.payAccountName || remark.garagePayAccountName || '').trim(),
        garageAttachment: null,
        existingGarageAttachmentUrl,
        existingGarageAttachmentName:
            existingGarageAttachmentName ||
            (existingGarageAttachmentUrl ? 'Garage invoice (from service details)' : ''),
        billingPayables: lines.length ? lines : [emptyPayableLine()],
    };
}

function buildInitialZohoBills(service, opts = {}) {
    const remark = parseVehicleServiceRemark(service) || {};
    const companyName = resolveCompanyPartyName(opts.asset, remark, opts.companies || []);
    const nameById = buildEmployeeNameMap(opts.employees || [], opts.asset);
    const payableTemplateLines = buildVehicleServiceBillingPayables(service, remark, {
        employeeNameById: nameById,
        companyName,
    });

    const existingGarageAttachmentUrl = String(
        remark.garageAttachmentUrl ||
            remark.garageBillAttachmentUrl ||
            service?.shopInvoice ||
            remark.garageInvoiceUrl ||
            '',
    ).trim();
    const existingGarageAttachmentName = String(
        remark.garageAttachmentName ||
            remark.garageInvoiceName ||
            remark.shopInvoiceName ||
            '',
    ).trim();

    return buildAccidentRepairAutoZohoBills({
        service,
        remark,
        payableTemplateLines,
        garageName: String(remark.garageName || remark.vendorName || '').trim(),
        zohoVendorId: String(remark.zohoVendorId || '').trim(),
        existingAttachmentUrl: existingGarageAttachmentUrl,
        existingAttachmentName:
            existingGarageAttachmentName ||
            (existingGarageAttachmentUrl ? 'Garage invoice (from service details)' : ''),
    });
}

function normalizePayableLines(rows = []) {
    return (rows || [])
        .map((row) => {
            const partyName = String(row.partyName || row.description || '').trim();
            return {
                partyType: String(row.partyType || '').trim() || undefined,
                partyName: partyName || undefined,
                description: partyName || undefined,
                employeeId: String(row.employeeId || '').trim() || undefined,
                payableTo: String(row.payableTo || '').trim(),
                payAccountId: String(row.payAccountId || '').trim(),
                amount: money(row.amount),
            };
        })
        .filter((row) => row.payableTo || row.payAccountId || row.amount > 0 || row.partyName);
}

function billSubtotal(bill) {
    return (bill?.billingPayables || []).reduce((sum, row) => sum + money(row.amount), 0);
}

function resolvePayableNames(lines, { companyName, nameById }) {
    return (lines || []).map((row) => {
        const isCompany =
            String(row.partyType || '') === 'company' ||
            (!row.employeeId && String(row.partyType || '') !== 'employee');
        if (isCompany) {
            const current = String(row.partyName || row.description || '').trim();
            if (
                companyName &&
                companyName !== 'Company' &&
                (!current || /^Company$/i.test(current))
            ) {
                return {
                    ...row,
                    partyType: 'company',
                    partyName: companyName,
                    description: companyName,
                };
            }
            return row;
        }
        const resolved = resolveEmployeeDisplayName(
            {
                employeeId: row.employeeId,
                partyName: row.partyName,
                employeeName: row.employeeName,
            },
            nameById,
        );
        if (!resolved) return row;
        const current = String(row.partyName || row.description || '').trim();
        if (current && !/^Employee\b/i.test(current) && current !== resolved) return row;
        return {
            ...row,
            partyType: 'employee',
            partyName: resolved,
            description: resolved,
        };
    });
}

/**
 * Shared Accounts Zoho billing card (same UI as Oil cash Accounts).
 * Accident Repair: auto Zoho bills from Insurance Excess / Police Fine / Other Fine(s);
 * payables equalized per bill amount and editable; totals must match before Zoho create.
 * Tire / Mechanical / Body Work: single-bill layout.
 */
export default function VehicleServiceAccountsZohoBillingCard({
    asset = null,
    service,
    vehicleId,
    serviceId,
    canActAccounts = false,
    workflowStage = '',
    serviceTypeLabel = 'Vehicle Service',
    onUpdated,
    className = '',
}) {
    const { toast } = useToast();
    const [busy, setBusy] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [companies, setCompanies] = useState([]);
    const remark = parseVehicleServiceRemark(service) || {};
    const isAccidentMultiBill = String(serviceTypeLabel || '').trim() === 'Accident Repair';

    const [billing, setBilling] = useState(() =>
        buildInitialBillingState(service, { asset, employees: [], companies: [] }),
    );
    const [zohoBills, setZohoBills] = useState(() =>
        buildInitialZohoBills(service, { asset, employees: [], companies: [] }),
    );

    useEffect(() => {
        let active = true;
        Promise.all([axiosInstance.get('/employee'), axiosInstance.get('/Company')])
            .then(([empRes, companyRes]) => {
                if (!active) return;
                const list = Array.isArray(empRes.data)
                    ? empRes.data
                    : empRes.data?.employees || empRes.data?.data || [];
                setEmployees(list);
                setCompanies(companyRes.data?.companies || companyRes.data || []);
            })
            .catch(() => {
                if (active) {
                    setEmployees([]);
                    setCompanies([]);
                }
            });
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        setBilling(buildInitialBillingState(service, { asset, employees, companies }));
        setZohoBills(buildInitialZohoBills(service, { asset, employees, companies }));
    }, [
        service?._id,
        service?.updatedAt,
        service?.remark,
        service?.shopInvoice,
        service?.value,
        asset,
        employees,
        companies,
    ]);

    useEffect(() => {
        if (!employees.length && !companies.length && !asset?.assignedTo) return;
        const nameById = buildEmployeeNameMap(employees, asset);
        const companyName = resolveCompanyPartyName(
            asset,
            parseVehicleServiceRemark(service) || {},
            companies,
        );
        setBilling((prev) => ({
            ...prev,
            billingPayables: resolvePayableNames(prev.billingPayables, { companyName, nameById }),
        }));
        setZohoBills((prev) =>
            prev.map((bill) => ({
                ...bill,
                billingPayables: resolvePayableNames(bill.billingPayables, { companyName, nameById }),
            })),
        );
    }, [employees, companies, asset, service]);

    const totalFromLines = useMemo(
        () => (billing.billingPayables || []).reduce((sum, row) => sum + money(row.amount), 0),
        [billing.billingPayables],
    );

    const accidentCostSources = useMemo(
        () => (isAccidentMultiBill ? resolveAccidentRepairCostBillSources(remark) : []),
        // remark object identity changes with service; depend on raw fields used by resolver
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            isAccidentMultiBill,
            remark.insuranceFineAmount,
            remark.policeFineAmount,
            remark.otherFineAmount,
            JSON.stringify(remark.otherFineRows || []),
        ],
    );
    const expectedAccidentCostTotal = useMemo(
        () => sumAccidentRepairCostBillSources(accidentCostSources),
        [accidentCostSources],
    );
    const grandTotalFromBills = useMemo(
        () =>
            (zohoBills || []).reduce(
                (sum, bill) => sum + money(bill.garageBillAmount || billSubtotal(bill)),
                0,
            ),
        [zohoBills],
    );
    const payablesGrandTotal = useMemo(
        () => (zohoBills || []).reduce((sum, bill) => sum + billSubtotal(bill), 0),
        [zohoBills],
    );

    const stageProp = String(workflowStage || '').toLowerCase();
    const stageFromRemark = String(remark.workflowStage || '').toLowerCase();
    const stage =
        stageProp === 'pending_billing' || stageProp === 'pending_accounts'
            ? stageProp
            : stageFromRemark === 'pending_billing' || stageFromRemark === 'pending_accounts'
              ? stageFromRemark
              : stageProp || stageFromRemark;

    const awaitingBilling = stage === 'pending_billing' || stage === 'pending_accounts';
    const multiBillIds = Array.isArray(remark.zohoBills)
        ? remark.zohoBills.map((b) => String(b?.zohoBillId || '').trim()).filter(Boolean)
        : [];
    const allMultiBillsDone =
        Array.isArray(remark.zohoBills) &&
        remark.zohoBills.length > 0 &&
        remark.zohoBills.every((b) => String(b?.zohoBillId || '').trim());
    const isBilled =
        !awaitingBilling &&
        (stage === 'billed' ||
            String(remark.billingStatus || '').toLowerCase() === 'billed' ||
            Boolean(String(remark.zohoBillId || '').trim()) ||
            allMultiBillsDone);

    const canAct = Boolean(canActAccounts) && awaitingBilling && !isBilled;

    const assignmentPending = isOilServiceAssignmentPending(remark);
    const paymentGate = resolveShopServiceCardGate({
        assignmentPending,
        workflowStage: stage,
        service,
        cardKey: SHOP_SERVICE_CARD.PAYMENT,
    });

    const setLine = (index, patch) => {
        setBilling((prev) => {
            const next = [...(prev.billingPayables || [])];
            next[index] = { ...next[index], ...patch };
            const updated = { ...prev, billingPayables: next };
            if (index === 0 && (patch.payAccountId !== undefined || patch.payableTo !== undefined)) {
                updated.payAccountId =
                    patch.payAccountId !== undefined ? patch.payAccountId : next[0]?.payAccountId || '';
                updated.payAccountName =
                    patch.payableTo !== undefined ? patch.payableTo : next[0]?.payableTo || '';
            }
            return updated;
        });
    };

    const addLine = () => {
        setBilling((prev) => ({
            ...prev,
            billingPayables: [...(prev.billingPayables || []), emptyPayableLine()],
        }));
    };

    const removeLine = (index) => {
        setBilling((prev) => {
            const next = [...(prev.billingPayables || [])];
            if (next.length <= 1) return prev;
            next.splice(index, 1);
            return { ...prev, billingPayables: next };
        });
    };

    const setBillField = (billId, patch) => {
        setZohoBills((prev) => prev.map((bill) => (bill.id === billId ? { ...bill, ...patch } : bill)));
    };

    const setBillLine = (billId, index, patch) => {
        setZohoBills((prev) =>
            prev.map((bill) => {
                if (bill.id !== billId) return bill;
                const next = [...(bill.billingPayables || [])];
                next[index] = { ...next[index], ...patch };
                const updated = { ...bill, billingPayables: next };
                if (index === 0 && (patch.payAccountId !== undefined || patch.payableTo !== undefined)) {
                    updated.payAccountId =
                        patch.payAccountId !== undefined ? patch.payAccountId : next[0]?.payAccountId || '';
                    updated.payAccountName =
                        patch.payableTo !== undefined ? patch.payableTo : next[0]?.payableTo || '';
                }
                return updated;
            }),
        );
    };

    const addBillLine = (billId) => {
        setZohoBills((prev) =>
            prev.map((bill) =>
                bill.id === billId
                    ? { ...bill, billingPayables: [...(bill.billingPayables || []), emptyPayableLine()] }
                    : bill,
            ),
        );
    };

    const removeBillLine = (billId, index) => {
        setZohoBills((prev) =>
            prev.map((bill) => {
                if (bill.id !== billId) return bill;
                const next = [...(bill.billingPayables || [])];
                if (next.length <= 1) return bill;
                next.splice(index, 1);
                return { ...bill, billingPayables: next };
            }),
        );
    };

    const handleGarageInvoice = async (file) => {
        if (!file) return;
        const check = validateErpPdfFile(file);
        if (!check.ok) {
            toast({ variant: 'destructive', title: 'Invalid file', description: check.message });
            return;
        }
        const data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        setBilling((prev) => ({
            ...prev,
            garageAttachment: { name: file.name, data, mime: file.type || 'application/pdf' },
            existingGarageAttachmentName: file.name,
        }));
    };

    const handleBillGarageInvoice = async (billId, file) => {
        if (!file) return;
        const check = validateErpPdfFile(file);
        if (!check.ok) {
            toast({ variant: 'destructive', title: 'Invalid file', description: check.message });
            return;
        }
        const data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        setBillField(billId, {
            garageAttachment: { name: file.name, data, mime: file.type || 'application/pdf' },
            existingGarageAttachmentName: file.name,
        });
    };

    const garageInvoicePreview = useMemo(() => {
        if (billing.garageAttachment?.data) {
            return {
                url: billing.garageAttachment.data,
                name:
                    billing.garageAttachment.name ||
                    billing.existingGarageAttachmentName ||
                    'garage-invoice.pdf',
            };
        }
        const url = String(billing.existingGarageAttachmentUrl || '').trim();
        if (!url) return null;
        return {
            url,
            name: billing.existingGarageAttachmentName || 'garage-invoice.pdf',
        };
    }, [billing.garageAttachment, billing.existingGarageAttachmentUrl, billing.existingGarageAttachmentName]);

    const handleViewGarageInvoice = async (preview, mime) => {
        if (!preview?.url) return;
        const result = await openAttachmentInNewTab(preview.url, {
            name: preview.name,
            mimeType: mime || 'application/pdf',
        });
        if (!result.ok) {
            toast({
                variant: 'destructive',
                title: 'Cannot open file',
                description: result.error || 'File unavailable.',
            });
        }
    };

    const billInvoicePreview = (bill) => {
        if (bill.garageAttachment?.data) {
            return {
                url: bill.garageAttachment.data,
                name: bill.garageAttachment.name || bill.existingGarageAttachmentName || 'garage-invoice.pdf',
            };
        }
        const url = String(bill.existingGarageAttachmentUrl || '').trim();
        if (!url) return null;
        return {
            url,
            name: bill.existingGarageAttachmentName || 'garage-invoice.pdf',
        };
    };

    const buildServiceUpdatesSingle = () => {
        const lines = normalizePayableLines(billing.billingPayables);
        const total = lines.reduce((s, r) => s + r.amount, 0) || money(billing.garageBillAmount);
        const primary = lines[0] || {};
        const nextRemark = {
            ...remark,
            garageName: String(billing.garageName || '').trim() || remark.garageName,
            vendorName: String(billing.garageName || '').trim() || remark.vendorName,
            zohoVendorId: String(billing.zohoVendorId || '').trim() || remark.zohoVendorId,
            billingPayables: lines,
            billingTotalAmount: total,
            garageBillAmount: total,
            totalServiceCharge: total,
            payAccountId: primary.payAccountId || billing.payAccountId || remark.payAccountId,
            payAccountName: primary.payableTo || billing.payAccountName || remark.payAccountName,
            garagePayAccountId: primary.payAccountId || billing.payAccountId || remark.garagePayAccountId,
            garagePayAccountName: primary.payableTo || billing.payAccountName || remark.garagePayAccountName,
        };

        const existingUrl = String(
            billing.existingGarageAttachmentUrl ||
                service?.shopInvoice ||
                remark.garageAttachmentUrl ||
                remark.garageBillAttachmentUrl ||
                '',
        ).trim();
        if (existingUrl && !billing.garageAttachment?.data) {
            nextRemark.garageAttachmentUrl = existingUrl;
            nextRemark.garageBillAttachmentUrl = existingUrl;
            nextRemark.garageAttachmentName =
                String(
                    billing.existingGarageAttachmentName ||
                        remark.garageAttachmentName ||
                        remark.garageInvoiceName ||
                        remark.shopInvoiceName ||
                        '',
                ).trim() || 'garage-invoice.pdf';
        }

        const body = { remark: JSON.stringify(nextRemark) };
        if (billing.garageAttachment?.data) {
            body.garageBillAttachment = billing.garageAttachment;
        }
        if (Number.isFinite(total) && total > 0) {
            body.value = total;
        }
        return body;
    };

    const buildServiceUpdatesMulti = () => {
        const garageBillAttachments = [];
        const serializedBills = (zohoBills || []).map((bill, index) => {
            const lines = normalizePayableLines(bill.billingPayables);
            const fixedAmount = money(bill.garageBillAmount);
            const linesTotal = lines.reduce((s, r) => s + r.amount, 0);
            const total = fixedAmount > 0 ? fixedAmount : linesTotal;
            const primary = lines[0] || {};
            const existingUrl = String(bill.existingGarageAttachmentUrl || '').trim();
            const entry = {
                id: bill.id || `bill-${index + 1}`,
                costKey: String(bill.costKey || '').trim() || undefined,
                costLabel: String(bill.costLabel || '').trim() || undefined,
                autoGenerated: Boolean(bill.autoGenerated),
                garageName: String(bill.garageName || '').trim(),
                vendorName: String(bill.garageName || '').trim(),
                zohoVendorId: String(bill.zohoVendorId || '').trim(),
                billingPayables: lines,
                billingTotalAmount: total,
                garageBillAmount: total,
                payAccountId: primary.payAccountId || bill.payAccountId || '',
                payAccountName: primary.payableTo || bill.payAccountName || '',
                garageAttachmentName:
                    String(bill.garageAttachment?.name || bill.existingGarageAttachmentName || '').trim() ||
                    undefined,
                zohoBillId: String(bill.zohoBillId || '').trim() || undefined,
                zohoBillNumber: String(bill.zohoBillNumber || '').trim() || undefined,
                zohoSyncError: String(bill.zohoSyncError || '').trim() || undefined,
            };
            if (existingUrl && !bill.garageAttachment?.data) {
                entry.garageAttachmentUrl = existingUrl;
                entry.garageBillAttachmentUrl = existingUrl;
            }
            if (bill.garageAttachment?.data) {
                garageBillAttachments.push({
                    billId: entry.id,
                    name: bill.garageAttachment.name,
                    data: bill.garageAttachment.data,
                    mime: bill.garageAttachment.mime || 'application/pdf',
                });
            }
            return entry;
        });

        const first = serializedBills[0] || {};
        const grandTotal = serializedBills.reduce((s, b) => s + money(b.billingTotalAmount), 0);
        const nextRemark = {
            ...remark,
            zohoBills: serializedBills,
            garageName: first.garageName || remark.garageName,
            vendorName: first.garageName || remark.vendorName,
            zohoVendorId: first.zohoVendorId || remark.zohoVendorId,
            billingPayables: first.billingPayables || [],
            billingTotalAmount: grandTotal,
            garageBillAmount: grandTotal,
            totalServiceCharge: grandTotal,
            payAccountId: first.payAccountId || remark.payAccountId,
            payAccountName: first.payAccountName || remark.payAccountName,
            garagePayAccountId: first.payAccountId || remark.garagePayAccountId,
            garagePayAccountName: first.payAccountName || remark.garagePayAccountName,
        };
        if (first.garageAttachmentUrl) {
            nextRemark.garageAttachmentUrl = first.garageAttachmentUrl;
            nextRemark.garageBillAttachmentUrl = first.garageAttachmentUrl;
            nextRemark.garageAttachmentName = first.garageAttachmentName || 'garage-invoice.pdf';
        }

        const body = { remark: JSON.stringify(nextRemark) };
        if (garageBillAttachments.length) {
            body.garageBillAttachments = garageBillAttachments;
            // First attachment also on legacy key so older merge paths still work.
            if (garageBillAttachments[0]) {
                body.garageBillAttachment = {
                    name: garageBillAttachments[0].name,
                    data: garageBillAttachments[0].data,
                    mime: garageBillAttachments[0].mime,
                };
            }
        }
        if (Number.isFinite(grandTotal) && grandTotal > 0) {
            body.value = grandTotal;
        }
        return body;
    };

    const validateSingleBeforeSubmit = (parsedRemark) => {
        const total = money(parsedRemark.billingTotalAmount);
        const payableLines = (Array.isArray(parsedRemark.billingPayables)
            ? parsedRemark.billingPayables
            : []
        ).filter((row) => String(row.payAccountId || '').trim() && money(row.amount) > 0);
        if (!(total > 0) || !payableLines.length) {
            return 'Add at least one Chart of Accounts line with amount before submitting to Zoho.';
        }
        if (payableLines.length !== (parsedRemark.billingPayables || []).length) {
            return 'Every payable-from line needs a Chart of Accounts and amount.';
        }
        return '';
    };

    const validateMultiBeforeSubmit = (parsedRemark) =>
        validateAccidentRepairZohoBills(parsedRemark.zohoBills || [], parsedRemark);

    const handleSubmit = async () => {
        if (!vehicleId || !canAct || busy) return;
        setBusy(true);
        try {
            const serviceUpdates = isAccidentMultiBill
                ? buildServiceUpdatesMulti()
                : buildServiceUpdatesSingle();
            const parsedRemark = JSON.parse(serviceUpdates.remark || '{}');
            const validationError = isAccidentMultiBill
                ? validateMultiBeforeSubmit(parsedRemark)
                : validateSingleBeforeSubmit(parsedRemark);
            if (validationError) {
                toast({
                    variant: 'destructive',
                    title: 'Payable from required',
                    description: validationError,
                });
                setBusy(false);
                return;
            }

            const { data } = await axiosInstance.post(`/AssetItem/${vehicleId}/service-workflow/respond`, {
                action: 'approve',
                comment: `${serviceTypeLabel} — Accounts submitted billing — create Zoho bill (Billed)`,
                serviceUpdates,
                ...(serviceId ? { serviceRecordId: serviceId } : {}),
            });
            toast({
                title: 'Billed',
                description: data?.message || data?.zohoBillMessage || 'Zoho bill created — Billed.',
            });
            if (typeof onUpdated === 'function') onUpdated(data?.asset || null);
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Accounts approval blocked',
                description:
                    err.response?.data?.message ||
                    'Zoho bill must succeed before status becomes Billed.',
            });
        } finally {
            setBusy(false);
        }
    };

    const renderPayableTable = ({
        lines,
        onAdd,
        onRemove,
        onChangeLine,
        subtotal,
        canEdit,
    }) => (
        <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    Payable from
                </span>
                {canEdit ? (
                    <button
                        type="button"
                        onClick={onAdd}
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700"
                    >
                        <Plus size={12} /> Add line
                    </button>
                ) : null}
            </div>
            <div className="mb-1.5 hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_140px_36px] gap-2 px-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-400 sm:grid">
                <span>Company / Employee</span>
                <span>Chart of Accounts</span>
                <span>Amount</span>
                <span />
            </div>
            <div className="space-y-2">
                {(lines || []).map((row, index) => (
                    <div
                        key={`payable-${index}`}
                        className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_140px_36px] items-start"
                    >
                        <input
                            type="text"
                            className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-sm font-semibold text-gray-900 placeholder:text-gray-400"
                            placeholder={
                                row.partyType === 'employee'
                                    ? 'Employee name'
                                    : row.partyType === 'company'
                                      ? 'Company name'
                                      : 'Company / Employee name'
                            }
                            value={row.partyName || row.description || ''}
                            disabled={!canEdit || busy}
                            onChange={(e) =>
                                onChangeLine(index, {
                                    partyName: e.target.value,
                                    description: e.target.value,
                                })
                            }
                        />
                        <ZohoPayAccountSelect
                            value={row.payAccountId || ''}
                            name={row.payableTo || ''}
                            disabled={!canEdit || busy}
                            placeholder="Select Chart of Accounts"
                            onChange={({ id, name }) => {
                                onChangeLine(index, {
                                    payAccountId: id,
                                    payableTo: name,
                                });
                            }}
                        />
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="min-h-[44px] rounded-lg border border-gray-200 px-2.5 text-sm font-semibold"
                            placeholder="Amount"
                            value={row.amount || ''}
                            disabled={!canEdit || busy}
                            onChange={(e) => onChangeLine(index, { amount: e.target.value })}
                        />
                        {canEdit ? (
                            <button
                                type="button"
                                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-red-100 text-red-600 disabled:opacity-40"
                                disabled={busy || (lines || []).length <= 1}
                                onClick={() => onRemove(index)}
                                title="Remove line"
                            >
                                <Trash2 size={14} />
                            </button>
                        ) : (
                            <span />
                        )}
                    </div>
                ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 text-sm">
                <span className="font-semibold text-gray-500">Total amount</span>
                <span className="font-bold text-gray-900">
                    AED {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
            </div>
        </div>
    );

    const renderVendorInvoice = ({
        garageName,
        onVendorChange,
        preview,
        onPickFile,
        onView,
        hasFileHint,
        fileLabel,
        canEdit,
    }) => (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-gray-500">
                Garage vendor
                <div className="mt-1">
                    <ZohoVendorSelect
                        className="w-full"
                        value={garageName || ''}
                        onChange={onVendorChange}
                        disabled={!canEdit || busy}
                        placeholder="Select vendor"
                    />
                </div>
            </label>
            <div className="block text-xs font-semibold text-gray-500">
                <span>Garage invoice (PDF)</span>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                    <input
                        type="file"
                        accept={ERP_PDF_ACCEPT}
                        className="block min-w-0 flex-1 text-sm"
                        disabled={!canEdit || busy}
                        onChange={(e) => {
                            void onPickFile(e.target.files?.[0]);
                            e.target.value = '';
                        }}
                    />
                    {preview ? (
                        <button
                            type="button"
                            onClick={() => void onView()}
                            className="inline-flex shrink-0 items-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                        >
                            View
                        </button>
                    ) : null}
                </div>
                {hasFileHint ? (
                    <span className="mt-1 block text-[11px] font-medium text-emerald-700">
                        {fileLabel}
                    </span>
                ) : (
                    <span className="mt-1 block text-[11px] font-medium text-amber-700">
                        No garage invoice yet — upload here or from garage / return details
                    </span>
                )}
            </div>
        </div>
    );

    return (
        <div className={`w-full ${className}`.trim()}>
            <VehicleServiceLockedSection
                locked={paymentGate.locked}
                message={paymentGate.message || 'Complete Service first — then Make Payment unlocks'}
            >
                <FineFormCard
                    title="Make Payment"
                    icon={Wallet}
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-700"
                    className="w-full"
                    subtitle={
                        isBilled
                            ? 'Zoho bill already created — payment done'
                            : awaitingBilling
                              ? 'Edit billing below and submit to Zoho'
                              : 'Complete Service first — then Make Payment unlocks'
                    }
                >
                    <VehicleGarageZohoBillRetry
                        vehicleId={vehicleId}
                        serviceId={serviceId}
                        service={service}
                        serviceTypeLabel={serviceTypeLabel}
                        onUpdated={onUpdated}
                    />

                    <div className="space-y-4">
                        {isBilled ? (
                            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                                Zoho billing is complete for this {serviceTypeLabel.toLowerCase()}.
                                {multiBillIds.length ? (
                                    <span className="font-semibold">
                                        {' '}
                                        Bill ID{multiBillIds.length > 1 ? 's' : ''}:{' '}
                                        {multiBillIds.join(', ')}
                                    </span>
                                ) : remark.zohoBillId ? (
                                    <span className="font-semibold"> Bill ID: {remark.zohoBillId}</span>
                                ) : null}
                            </p>
                        ) : !awaitingBilling ? (
                            <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                                Accounts billing unlocks after garage / return steps reach the Accounts
                                billing stage.
                            </p>
                        ) : (
                            <p className="text-sm text-gray-600">
                                {serviceTypeLabel} work is{' '}
                                <span className="font-semibold text-gray-800">complete</span>. Edit
                                billing below and submit — status becomes{' '}
                                <span className="font-semibold text-gray-800">Billed</span> only if Zoho
                                bill create succeeds.
                            </p>
                        )}

                        {awaitingBilling || isBilled ? (
                            isAccidentMultiBill ? (
                                <>
                                    <div className="space-y-1">
                                        <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                                            Zoho Bills (from cost payments)
                                        </span>
                                        <p className="text-[11px] text-slate-500">
                                            One Zoho bill per cost line (Insurance Excess, Police Fine,
                                            Other Fine). Payable parties are the same on every bill;
                                            amounts start equalized and stay editable. Each bill&apos;s
                                            payables must equal that payment, and all payments must equal
                                            the cost total before Zoho create.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        {zohoBills.map((bill, billIndex) => {
                                            const preview = billInvoicePreview(bill);
                                            const hasFile =
                                                Boolean(bill.garageAttachment?.name) ||
                                                Boolean(bill.existingGarageAttachmentName) ||
                                                Boolean(bill.existingGarageAttachmentUrl);
                                            const billAmount = money(bill.garageBillAmount);
                                            const payableSum = billSubtotal(bill);
                                            const payableMatches =
                                                billAmount > 0 &&
                                                Math.abs(payableSum - billAmount) <= 0.01;
                                            const title =
                                                String(bill.costLabel || '').trim() ||
                                                `Zoho Bill #${billIndex + 1}`;
                                            return (
                                                <div
                                                    key={bill.id}
                                                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                                                >
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <h4 className="text-sm font-bold text-slate-800">
                                                            {title}
                                                            {bill.zohoBillNumber ? (
                                                                <span className="ml-2 text-xs font-semibold text-emerald-700">
                                                                    {bill.zohoBillNumber}
                                                                </span>
                                                            ) : null}
                                                        </h4>
                                                        <span
                                                            className={`text-sm font-bold ${
                                                                payableMatches
                                                                    ? 'text-emerald-700'
                                                                    : 'text-amber-700'
                                                            }`}
                                                        >
                                                            AED{' '}
                                                            {billAmount.toLocaleString(undefined, {
                                                                minimumFractionDigits: 2,
                                                            })}
                                                        </span>
                                                    </div>
                                                    {!payableMatches && canAct ? (
                                                        <p className="text-[11px] font-medium text-amber-700">
                                                            Payable total (AED{' '}
                                                            {payableSum.toLocaleString(undefined, {
                                                                minimumFractionDigits: 2,
                                                            })}
                                                            ) must equal this payment.
                                                        </p>
                                                    ) : null}

                                                    {renderVendorInvoice({
                                                        garageName: bill.garageName,
                                                        onVendorChange: (nextValue, vendor) => {
                                                            setBillField(bill.id, {
                                                                garageName: nextValue,
                                                                zohoVendorId: String(
                                                                    vendor?.id ||
                                                                        vendor?.zohoContactId ||
                                                                        vendor?.value ||
                                                                        '',
                                                                ).trim(),
                                                            });
                                                        },
                                                        preview,
                                                        onPickFile: (file) =>
                                                            void handleBillGarageInvoice(bill.id, file),
                                                        onView: () =>
                                                            void handleViewGarageInvoice(
                                                                preview,
                                                                bill.garageAttachment?.mime,
                                                            ),
                                                        hasFileHint: hasFile,
                                                        fileLabel: `${
                                                            bill.garageAttachment?.name ||
                                                            bill.existingGarageAttachmentName ||
                                                            'Garage invoice from service details'
                                                        }${
                                                            !bill.garageAttachment?.data &&
                                                            bill.existingGarageAttachmentUrl
                                                                ? ' — will attach to Zoho bill'
                                                                : ''
                                                        }`,
                                                        canEdit: canAct,
                                                    })}

                                                    {renderPayableTable({
                                                        lines: bill.billingPayables,
                                                        onAdd: () => addBillLine(bill.id),
                                                        onRemove: (index) =>
                                                            removeBillLine(bill.id, index),
                                                        onChangeLine: (index, patch) =>
                                                            setBillLine(bill.id, index, patch),
                                                        subtotal: payableSum,
                                                        canEdit: canAct,
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="space-y-1 border-t border-gray-100 pt-3 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-gray-500">
                                                Cost total (Initiate)
                                            </span>
                                            <span className="font-bold text-gray-900">
                                                AED{' '}
                                                {expectedAccidentCostTotal.toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                })}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-gray-500">
                                                Bill totals
                                            </span>
                                            <span className="font-bold text-gray-900">
                                                AED{' '}
                                                {grandTotalFromBills.toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                })}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-gray-500">
                                                Payables total
                                            </span>
                                            <span
                                                className={`font-bold ${
                                                    Math.abs(
                                                        payablesGrandTotal - grandTotalFromBills,
                                                    ) <= 0.01 &&
                                                    Math.abs(
                                                        grandTotalFromBills -
                                                            expectedAccidentCostTotal,
                                                    ) <= 0.01
                                                        ? 'text-emerald-700'
                                                        : 'text-amber-700'
                                                }`}
                                            >
                                                AED{' '}
                                                {payablesGrandTotal.toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {renderVendorInvoice({
                                        garageName: billing.garageName,
                                        onVendorChange: (nextValue, vendor) => {
                                            setBilling((prev) => ({
                                                ...prev,
                                                garageName: nextValue,
                                                zohoVendorId: String(
                                                    vendor?.id ||
                                                        vendor?.zohoContactId ||
                                                        vendor?.value ||
                                                        '',
                                                ).trim(),
                                            }));
                                        },
                                        preview: garageInvoicePreview,
                                        onPickFile: (file) => void handleGarageInvoice(file),
                                        onView: () =>
                                            void handleViewGarageInvoice(
                                                garageInvoicePreview,
                                                billing.garageAttachment?.mime,
                                            ),
                                        hasFileHint: Boolean(
                                            billing.existingGarageAttachmentName ||
                                                billing.garageAttachment?.name ||
                                                billing.existingGarageAttachmentUrl,
                                        ),
                                        fileLabel: `${
                                            billing.garageAttachment?.name ||
                                            billing.existingGarageAttachmentName ||
                                            'Garage invoice from service details'
                                        }${
                                            !billing.garageAttachment?.data &&
                                            billing.existingGarageAttachmentUrl
                                                ? ' — will attach to Zoho bill'
                                                : ''
                                        }`,
                                        canEdit: canAct,
                                    })}

                                    {renderPayableTable({
                                        lines: billing.billingPayables,
                                        onAdd: addLine,
                                        onRemove: removeLine,
                                        onChangeLine: setLine,
                                        subtotal: totalFromLines,
                                        canEdit: canAct,
                                    })}
                                </>
                            )
                        ) : null}
                    </div>

                    {canAct ? (
                        <div className="mt-4 flex justify-end">
                            <button
                                type="button"
                                onClick={() => void handleSubmit()}
                                disabled={busy}
                                className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {busy ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <CheckCircle2 size={16} />
                                )}
                                {busy ? 'Working…' : 'Submit to Zoho (Billed)'}
                            </button>
                        </div>
                    ) : awaitingBilling ? (
                        <p className="mt-3 text-xs text-amber-800">
                            Waiting for flowchart Accounts to submit billing to Zoho.
                        </p>
                    ) : null}
                </FineFormCard>
            </VehicleServiceLockedSection>
        </div>
    );
}
