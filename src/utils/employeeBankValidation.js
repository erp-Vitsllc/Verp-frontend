import {
    validateBankName,
    validateAccountNumber,
    validateIBAN,
    validateSWIFT,
} from '@/utils/validation';
import { stripDangerousText } from '@/utils/employeeAddValidation';

export const BANK_PDF_MAX_BYTES = 10 * 1024 * 1024;

const ok = (error = '') => ({ isValid: !error, error });

export function normalizeBankFieldText(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function validateEmployeeAccountName(value) {
    const cleaned = normalizeBankFieldText(value);
    if (!cleaned) return ok('Account Name is required');
    if (cleaned.length < 2) return ok('Account name must be at least 2 characters');
    if (cleaned.length > 100) return ok('Account name must be no more than 100 characters');
    if (!/^[A-Za-z\s'-]+$/.test(cleaned)) {
        return ok("Account name may contain only letters, spaces, apostrophe (') and hyphen (-)");
    }
    return ok();
}

export function validateEmployeeBankOtherDetails(value) {
    const cleaned = stripDangerousText(value);
    if (!cleaned) return ok();
    if (cleaned.length > 500) return ok('Other details must be no more than 500 characters');
    return ok();
}

export function validateEmployeeBankAttachment({
    file,
    fileBase64,
    fileName,
    hasExistingFile = false,
    requireFile = true,
} = {}) {
    const hasFile = Boolean(file || fileBase64 || fileName);
    if (!hasFile) {
        return requireFile && !hasExistingFile
            ? ok('Bank attachment is required')
            : ok();
    }
    if (file) {
        if (file.size === 0) return ok('Empty files are not allowed');
        if (file.size > BANK_PDF_MAX_BYTES) return ok('File size must not exceed 10MB');
        const name = String(file.name || '').toLowerCase();
        const mime = String(file.type || '').toLowerCase();
        if (mime !== 'application/pdf' && !name.endsWith('.pdf')) {
            return ok('Only PDF files are allowed');
        }
    }
    return ok();
}

export function validateEmployeeBankForm(form = {}, options = {}) {
    const { hasExistingAttachment = false, requireAttachment = true } = options;
    const errors = {};
    const set = (field, result) => {
        if (!result.isValid) errors[field] = result.error;
    };

    const bankNameResult = validateBankName(normalizeBankFieldText(form.bankName), true);
    set('bankName', bankNameResult);

    set('accountName', validateEmployeeAccountName(form.accountName));

    const accountNumberResult = validateAccountNumber(String(form.accountNumber ?? '').trim(), true);
    set('accountNumber', accountNumberResult);

    set('ibanNumber', validateIBAN(form.ibanNumber, true));

    if (form.swiftCode && String(form.swiftCode).trim() !== '') {
        set('swiftCode', validateSWIFT(form.swiftCode, false));
    }

    if (form.otherDetails && String(form.otherDetails).trim() !== '') {
        const otherResult = validateEmployeeBankOtherDetails(form.otherDetails);
        set('otherDetails', otherResult);
    }

    set(
        'file',
        validateEmployeeBankAttachment({
            file: form.file,
            fileBase64: form.fileBase64,
            fileName: form.fileName,
            hasExistingFile: hasExistingAttachment,
            requireFile: requireAttachment,
        }),
    );

    return errors;
}

export function validateBankPdfFile(file) {
    return validateEmployeeBankAttachment({ file, requireFile: true });
}
