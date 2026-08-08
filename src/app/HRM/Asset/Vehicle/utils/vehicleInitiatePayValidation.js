import { resolveInitiateAbsolutePayAmounts } from './vehicleShopHrReviewPay';

export function sumEmployeeLiabilityPaidAmounts(rows) {
    return (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
        const amt = Number(row?.paidAmount);
        return sum + (Number.isFinite(amt) ? amt : 0);
    }, 0);
}

export function companyPayPartyLabel(company) {
    if (!company || typeof company !== 'object') return '';
    return String(
        company.nickName ||
            company.companyShortName ||
            company.companyName ||
            company.tradeName ||
            company.name ||
            '',
    ).trim();
}

export function resolveCompanyPayPartyFromForm(formData = {}, companies = []) {
    const id = String(formData.companyPayPartyId || '').trim();
    const name = String(formData.companyPayPartyName || '').trim();
    if (id && Array.isArray(companies) && companies.length) {
        const match = companies.find(
            (row) => String(row?._id || row?.id || '').trim() === id,
        );
        const label = companyPayPartyLabel(match);
        if (label) return { companyPayPartyId: id, companyPayPartyName: label };
    }
    if (name && !/^Company$/i.test(name)) {
        return { companyPayPartyId: id || undefined, companyPayPartyName: name };
    }
    return { companyPayPartyId: id || undefined, companyPayPartyName: name || undefined };
}

/**
 * Strict initiate / HR payment split rules shared by all shop services.
 * @returns {Record<string, string>} error map (empty when valid)
 */
export function validateInitiateServicePaySplit(formData = {}, options = {}) {
    const {
        requirePayable = true,
        requireCompanyParty = true,
        finesTotal = null,
        requireFinesTotalMatch = false,
    } = options;

    const errors = {};
    if (!requirePayable) return errors;

    const paymentByMode = String(formData.paymentByMode || '').toLowerCase();
    if (!paymentByMode) {
        errors.paymentByMode = 'Payment by is required';
        return errors;
    }

    const estimated = Number(formData.estimatedCost);
    if (!Number.isFinite(estimated) || estimated <= 0) {
        errors.estimatedCost = 'Total amount is required';
        return errors;
    }

    if (requireFinesTotalMatch && finesTotal != null) {
        const fines = Math.round(Number(finesTotal) || 0);
        if (fines > 0 && Math.abs(fines - Math.round(estimated)) > 0.01) {
            errors.finesTotalMatch = `TOTAL and TOTAL AMOUNT must be equal (${fines.toLocaleString()} AED)`;
        }
    }

    const absolutePay = resolveInitiateAbsolutePayAmounts({
        estimatedCost: formData.estimatedCost,
        companyPayPercent: formData.companyPayPercent,
        employeePayPercent: formData.employeePayPercent,
        companyPayAmount: formData.companyPayAmount,
        employeePayAmount: formData.employeePayAmount,
    });
    const companyPayAmount = absolutePay.companyPayAmount;
    const employeePayAmount = absolutePay.employeePayAmount;

    if (paymentByMode === 'split') {
        if (Math.abs(companyPayAmount + employeePayAmount - estimated) > 0.01) {
            errors.paySplit = `Company payment + Employee payment must equal TOTAL AMOUNT (${estimated.toLocaleString()} AED)`;
        }
    } else if (paymentByMode === 'person') {
        if (Math.abs(employeePayAmount - estimated) > 0.01) {
            errors.employeePayPercent = `Employee payment must equal TOTAL AMOUNT (${estimated.toLocaleString()} AED)`;
        }
    } else if (paymentByMode === 'company') {
        if (Math.abs(companyPayAmount - estimated) > 0.01) {
            errors.companyPayPercent = `Company payment must equal TOTAL AMOUNT (${estimated.toLocaleString()} AED)`;
        }
    }

    const needsCompany =
        requireCompanyParty &&
        (paymentByMode === 'company' || paymentByMode === 'split') &&
        companyPayAmount > 0;
    if (needsCompany) {
        const partyName = String(formData.companyPayPartyName || '').trim();
        const partyId = String(formData.companyPayPartyId || '').trim();
        if (!partyId && !partyName) {
            errors.companyPayPartyId = 'Select company under Company payment';
        }
    }

    const rows = Array.isArray(formData.employeeLiabilityRows) ? formData.employeeLiabilityRows : [];
    if (paymentByMode === 'person' || paymentByMode === 'split') {
        if (!rows.length) {
            errors.employeeLiabilityRows = 'Add at least one employee row';
        } else {
            rows.forEach((row, idx) => {
                if (!String(row.employeeId || '').trim()) {
                    errors.employeeLiabilityRows = `Employee name is required on row ${idx + 1}`;
                }
                const amt = Number(row.paidAmount);
                if (!Number.isFinite(amt) || amt < 0) {
                    errors.employeeLiabilityRows = `Paid amount is required on row ${idx + 1}`;
                }
            });
            const seenEmployeeIds = new Set();
            for (let idx = 0; idx < rows.length; idx += 1) {
                const id = String(rows[idx]?.employeeId || '').trim();
                if (!id) continue;
                if (seenEmployeeIds.has(id)) {
                    errors.employeeLiabilityRows = 'Each employee can only be selected once';
                    break;
                }
                seenEmployeeIds.add(id);
            }
            const liabilitySum = sumEmployeeLiabilityPaidAmounts(rows);
            if (Math.abs(liabilitySum - employeePayAmount) > 0.01) {
                errors.employeeLiabilityRows = `Employee amounts must total Employee payment (${employeePayAmount.toLocaleString()} AED)`;
            }
        }
    }

    if (paymentByMode === 'person') {
        delete errors.companyPayPercent;
        delete errors.companyPayPartyId;
    }
    if (paymentByMode === 'company') {
        delete errors.employeePayPercent;
        delete errors.employeeLiabilityRows;
    }

    return errors;
}

/** UI / toast helper from the same rules used on submit. */
export function getInitiatePayValidationMessage(formData = {}, options = {}) {
    const errors = validateInitiateServicePaySplit(formData, options);
    return (
        errors.finesTotalMatch ||
        errors.paySplit ||
        errors.companyPayPercent ||
        errors.employeePayPercent ||
        errors.employeeLiabilityRows ||
        errors.companyPayPartyId ||
        errors.paymentByMode ||
        errors.estimatedCost ||
        ''
    );
}
