'use client';

export function isLossDamageFineType(fine) {
    if (!fine) return false;
    const t = String(fine.fineType || '').toLowerCase();
    if (t.includes('loss') && (t.includes('damage') || t.includes('&'))) return true;
    return Boolean(fine.assetId || fine.assetObjectId);
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function defaultGetEmpShare(f) {
    if (!f) return 0;
    if ((f.responsibleFor || '').toLowerCase() === 'company') return 0;
    const realEmployees = (f.assignedEmployees || []).filter(
        (e) => e.employeeId && !['VEGA-HR-0000', 'VEGA_INTERNAL'].includes(e.employeeId),
    );
    const record = realEmployees[0];
    if (record?.individualAmount > 0) return parseFloat(record.individualAmount);
    const employeeAmount = parseFloat(f.employeeAmount || 0);
    const companyAmount = parseFloat(f.companyAmount || 0);
    const sc = parseFloat(f.serviceCharge || 0);
    const fineAmount = parseFloat(f.fineAmount || f.totalFineAmount || 0);
    const rf = (f.responsibleFor || 'Employee').trim();
    if (realEmployees.length === 1 && companyAmount === 0) return fineAmount || employeeAmount + sc;
    if (rf === 'Employee & Company' && employeeAmount > 0) return employeeAmount + sc / 2;
    return Math.max(0, fineAmount - companyAmount) / (realEmployees.length || 1);
}

function defaultGetCompShare(f) {
    if (!f) return 0;
    const rf = (f.responsibleFor || 'Employee').trim();
    if (rf === 'Employee') return 0;
    const sc = parseFloat(f.serviceCharge || 0) || 0;
    const vegaEntry = f.assignedEmployees?.find((ae) => ae.employeeId === 'VEGA-HR-0000');
    if (vegaEntry?.individualAmount > 0) return parseFloat(vegaEntry.individualAmount);
    const compBase = parseFloat(f.companyAmount || 0) || 0;
    if (rf === 'Company') {
        return parseFloat(f.fineAmount || f.totalFineAmount || 0) || compBase + sc;
    }
    if (rf === 'Employee & Company' && compBase > 0) {
        return compBase + sc / 2;
    }
    return compBase;
}

function computeAssetAging(purchaseDate) {
    if (!purchaseDate) return '—';
    const start = new Date(purchaseDate);
    if (Number.isNaN(start.getTime())) return '—';
    const end = new Date();
    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    if (end.getDate() < start.getDate()) months -= 1;
    if (months < 0) {
        years -= 1;
        months += 12;
    }
    const parts = [];
    if (years > 0) parts.push(`${years} year${years !== 1 ? 's' : ''}`);
    if (months > 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
    return parts.length ? parts.join(' ') : '0 months';
}

function mapPayableType(responsibleFor) {
    const rf = String(responsibleFor || 'Employee').trim();
    if (rf === 'Employee & Company') return 'Employee/Company';
    if (rf === 'Company') return 'Company';
    return 'Employee';
}

export function buildAssetLossFineCardFields(
    fine,
    {
        isCompanyFine,
        employeeName,
        hodName,
        getEmpShare,
        getCompShare,
        fineSummaries = {},
        assetDetails = null,
        formatDate,
    },
) {
    const base = buildLossDamageFormFields(fine, {
        isCompanyFine,
        employeeName,
        hodName,
        getEmpShare,
        getCompShare,
        fineSummaries,
    });

    const purchaseDate = fine.assetPurchaseDate || assetDetails?.purchaseDate || '';
    const depreciation = parseFloat(fine.assetDepreciationAmount || 0) || 0;
    const purchaseCost =
        parseFloat(assetDetails?.assetValue) ||
        Math.max(0, base.actualFineAmount + depreciation) ||
        0;

    const realEmployees = (fine.assignedEmployees || []).filter(
        (e) => e.employeeId && !['VEGA-HR-0000', 'VEGA_INTERNAL'].includes(e.employeeId),
    );
    const isGroupFine = realEmployees.length > 1;

    const yourPayment = base.yourPayable;
    const othersPayment = Math.max(0, base.totalFine - yourPayment);

    const fmt = formatDate || ((d) => (d ? new Date(d).toLocaleDateString() : '—'));

    return {
        ...base,
        fineId: fine.fineId || '—',
        reportDate: fmt(fine.awardedDate || fine.createdAt),
        assetPurchaseDate: purchaseDate ? fmt(purchaseDate) : '—',
        assetPurchaseCost: purchaseCost,
        assetAging: computeAssetAging(purchaseDate),
        fineCategory: isGroupFine ? 'Group Fine' : 'Single Fine',
        payableTypeLabel: mapPayableType(fine.responsibleFor),
        yourFinePayment: yourPayment,
        othersPayment,
        sourceOfDeduction: fine.sourceOfIncome || 'Salary',
        deductionStart: base.deductionStart,
        deductionEnd: base.deductionEnd,
    };
}

export function buildLossDamageFormFields(
    fine,
    {
        isCompanyFine,
        employeeName,
        department,
        hodName,
        getEmpShare,
        getCompShare,
        fineSummaries = {},
    },
) {
    const empShareFn = getEmpShare || defaultGetEmpShare;
    const compShareFn = getCompShare || defaultGetCompShare;
    const serviceCharge = parseFloat(fine.serviceCharge || 0) || 0;
    const totalFine = parseFloat(fine.totalFineAmount || fine.fineAmount || 0) || 0;
    const actualFineAmount = Math.max(0, totalFine - serviceCharge);

    const realEmployees = (fine.assignedEmployees || []).filter(
        (e) => e.employeeId && !['VEGA-HR-0000', 'VEGA_INTERNAL'].includes(e.employeeId),
    );
    const responsibleFor = String(fine.responsibleFor || 'Employee').trim();
    const companyAmount = parseFloat(fine.companyAmount || 0) || 0;
    const hasCompanyShare =
        responsibleFor === 'Company' ||
        responsibleFor === 'Employee & Company' ||
        companyAmount > 0 ||
        Boolean(fine.assignedEmployees?.some((e) => e.employeeId === 'VEGA-HR-0000'));
    const hasEmployeeShare =
        responsibleFor === 'Employee' ||
        responsibleFor === 'Employee & Company' ||
        realEmployees.length > 0;

    let payableType = 'Single';
    if (responsibleFor === 'Employee & Company' || (hasCompanyShare && hasEmployeeShare) || realEmployees.length > 1) {
        payableType = 'Shared';
    }

    const yourPayable = isCompanyFine ? compShareFn(fine) : empShareFn(fine);

    const otherParts = [];
    const companyShare = compShareFn(fine);
    if (!isCompanyFine && companyShare > 0.01) {
        otherParts.push(`Company: AED ${formatMoney(companyShare)}`);
    }
    if (isCompanyFine) {
        realEmployees.forEach((emp) => {
            const amount =
                parseFloat(emp.individualAmount) ||
                parseFloat(emp.employeeAmount) ||
                parseFloat(emp.fineAmount) ||
                0;
            if (amount > 0) {
                otherParts.push(`${emp.employeeName || emp.employeeId}: AED ${formatMoney(amount)}`);
            }
        });
    } else if (realEmployees.length > 1) {
        realEmployees.forEach((emp) => {
            if (emp.employeeName && emp.employeeName !== employeeName) {
                const amount =
                    parseFloat(emp.individualAmount) ||
                    parseFloat(emp.fineAmount) ||
                    parseFloat(emp.employeeAmount) ||
                    0;
                if (amount > 0) {
                    otherParts.push(`${emp.employeeName}: AED ${formatMoney(amount)}`);
                }
            }
        });
    }

    const duration = Math.max(1, parseInt(fine.payableDuration, 10) || 1);
    const monthlyDeduction = yourPayable / duration;

    return {
        title: 'ASSET LOSS AND DAMAGE FINE',
        employeeName: employeeName || '—',
        department: department || '—',
        hodName: hodName || '—',
        fineType: fine.fineType || 'Loss & Damage',
        description: fine.description || '—',
        actualFineAmount,
        serviceCharge,
        totalFine,
        payableType,
        yourPayable,
        otherPayable: otherParts.length ? otherParts.join(' · ') : '—',
        fineReason: fine.category || fine.subCategory || '—',
        monthlyDeduction,
        deductionStart: fineSummaries.startMonthYear || fine.monthStart || '—',
        deductionEnd: fineSummaries.endMonthYear || '—',
    };
}

function FormRow({ label, value, valueClassName = '', blur = false, lastInRow = false }) {
    return (
        <>
            <div className="px-2 py-3 flex items-center font-medium border-r border-b border-black bg-gray-50/30 text-sm">
                {label}
            </div>
            <div
                className={`px-2 py-3 flex items-center border-b border-black break-words text-sm ${lastInRow ? '' : 'border-r'} ${blur ? 'bg-gray-100/80 backdrop-blur-[2px] font-bold text-gray-500 italic' : ''} ${valueClassName}`}
            >
                {value}
            </div>
        </>
    );
}

function EmptyGridCells({ count = 2, bottomBorder = true }) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className={`px-2 py-3 bg-white ${bottomBorder ? 'border-b border-black' : ''} ${i < count - 1 ? 'border-r border-black' : ''}`}
                />
            ))}
        </>
    );
}

export default function LossDamageFineDetailsSection({
    fields,
    showGroupPlaceholder = false,
    variant = 'detail',
}) {
    const f = fields;
    const blurValue = showGroupPlaceholder ? 'GROUP REQUEST' : null;
    const headerClass =
        variant === 'print'
            ? 'bg-[#b3d9ff] border border-black font-bold text-center py-1 border-b-0 text-xs uppercase tracking-wide'
            : 'bg-[#9bc4e9] border-b border-black text-center py-2 text-base font-semibold';

    const gridClass =
        variant === 'print'
            ? 'grid grid-cols-[28%_22%_28%_22%] border border-black border-t-0'
            : 'grid grid-cols-[140px_minmax(0,1fr)_140px_minmax(0,1fr)] text-sm';

    return (
        <div className={variant === 'print' ? 'w-full mb-4' : 'border border-black bg-white/90'}>
            <div className={headerClass}>{f.title}</div>
            <div className={gridClass}>
                <FormRow label="Employee Name" value={blurValue || f.employeeName} blur={!!blurValue} />
                <FormRow label="Department" value={blurValue || f.department} blur={!!blurValue} />

                <FormRow label="HOD Name" value={blurValue || f.hodName} blur={!!blurValue} />
                <FormRow label="Fine Type" value={f.fineType} />

                <div className="px-2 py-3 flex items-start font-medium border-r border-b border-black bg-gray-50/30 text-sm">
                    Fine Description
                </div>
                <div className="px-2 py-3 flex items-start border-r border-b border-black break-words text-sm min-h-[48px] leading-relaxed whitespace-pre-wrap">
                    {f.description}
                </div>
                <FormRow label="Actual Fine Amount" value={`AED ${formatMoney(f.actualFineAmount)}`} valueClassName="font-bold" />

                <FormRow label="Service Charge" value={`AED ${formatMoney(f.serviceCharge)}`} />
                <FormRow label="Total Fine" value={`AED ${formatMoney(f.totalFine)}`} valueClassName="font-bold" />

                <FormRow label="Payable Type" value={f.payableType} />
                <FormRow
                    label="Your Payable Fine"
                    value={`AED ${formatMoney(f.yourPayable)}`}
                    valueClassName="font-bold text-red-700"
                />

                <FormRow label="Other Payable" value={f.otherPayable} />
                <FormRow label="Fine Reason" value={f.fineReason} />

                <div className="col-span-4 border-t-2 border-black" />

                <FormRow
                    label="Amount Deduct Per Month"
                    value={`AED ${formatMoney(f.monthlyDeduction)}`}
                    valueClassName="font-bold"
                />
                <FormRow label="Deduction Start Date" value={f.deductionStart} />

                <FormRow label="Deduction End Date" value={f.deductionEnd} lastInRow />
                <EmptyGridCells count={2} />
            </div>
        </div>
    );
}
