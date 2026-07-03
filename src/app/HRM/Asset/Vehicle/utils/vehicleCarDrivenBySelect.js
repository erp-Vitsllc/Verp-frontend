export const CAR_DRIVEN_BY_EMPLOYEE_PREFIX = 'employee:';
export const CAR_DRIVEN_BY_COMPANY_PREFIX = 'company:';

export function decodeCarDrivenByValue(value) {
    const raw = String(value || '').trim();
    if (!raw) {
        return { type: '', employeeId: '', companyId: '' };
    }
    if (raw.startsWith(CAR_DRIVEN_BY_COMPANY_PREFIX)) {
        return {
            type: 'company',
            employeeId: '',
            companyId: raw.slice(CAR_DRIVEN_BY_COMPANY_PREFIX.length),
        };
    }
    if (raw.startsWith(CAR_DRIVEN_BY_EMPLOYEE_PREFIX)) {
        return {
            type: 'employee',
            employeeId: raw.slice(CAR_DRIVEN_BY_EMPLOYEE_PREFIX.length),
            companyId: '',
        };
    }
    return { type: 'employee', employeeId: raw, companyId: '' };
}

export function encodeCarDrivenByValue(formData = {}) {
    const type = String(formData.carDrivenByType || '').toLowerCase();
    const companyId = String(formData.carDrivenByCompanyId || '').trim();
    const employeeId = String(formData.carDrivenByEmployeeId || '').trim();

    if (type === 'company' || (!employeeId && companyId)) {
        return companyId ? `${CAR_DRIVEN_BY_COMPANY_PREFIX}${companyId}` : '';
    }
    return employeeId ? `${CAR_DRIVEN_BY_EMPLOYEE_PREFIX}${employeeId}` : '';
}

export function applyCarDrivenBySelection(formData, selection, { companies = [] } = {}) {
    const type = String(selection?.type || '').toLowerCase();
    if (type === 'company') {
        const companyId = String(selection.companyId || '').trim();
        const match = (Array.isArray(companies) ? companies : []).find(
            (comp) => String(comp?._id || comp?.id || '') === companyId,
        );
        return {
            ...formData,
            carDrivenByType: 'company',
            carDrivenByCompanyId: companyId,
            carDrivenByCompanyName: match?.name || '',
            carDrivenByEmployeeId: '',
        };
    }
    if (type === 'employee') {
        return {
            ...formData,
            carDrivenByType: 'employee',
            carDrivenByEmployeeId: String(selection.employeeId || '').trim(),
            carDrivenByCompanyId: '',
            carDrivenByCompanyName: '',
        };
    }
    return {
        ...formData,
        carDrivenByType: '',
        carDrivenByEmployeeId: '',
        carDrivenByCompanyId: '',
        carDrivenByCompanyName: '',
    };
}

export function isCarDrivenBySelected(formData = {}) {
    const type = String(formData.carDrivenByType || '').toLowerCase();
    if (type === 'company') {
        return Boolean(String(formData.carDrivenByCompanyId || '').trim());
    }
    return Boolean(String(formData.carDrivenByEmployeeId || '').trim());
}

function employeeLabel(emp) {
    const name = `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim();
    const code = emp?.employeeId ? ` (${emp.employeeId})` : '';
    return `${name || emp?.employeeId || 'Employee'}${code}`;
}

function companyLabel(comp) {
    const name = comp?.name || comp?.companyId || 'Company';
    const code = comp?.companyId && comp?.name ? ` (${comp.companyId})` : '';
    return `${name}${code}`;
}

export function resolveCarDrivenByLabel(formDataOrRemark = {}, employees = [], companies = []) {
    const type = String(formDataOrRemark.carDrivenByType || '').toLowerCase();
    const companyId = String(formDataOrRemark.carDrivenByCompanyId || '').trim();

    if (type === 'company' || companyId) {
        const match = (Array.isArray(companies) ? companies : []).find(
            (comp) => String(comp?._id || comp?.id || '') === companyId,
        );
        return match ? companyLabel(match) : formDataOrRemark.carDrivenByCompanyName || companyId || '—';
    }

    const employeeId = String(formDataOrRemark.carDrivenByEmployeeId || '').trim();
    if (!employeeId) return '—';

    const match = (Array.isArray(employees) ? employees : []).find(
        (emp) =>
            String(emp?._id || emp?.id || '') === employeeId ||
            String(emp?.employeeId || '').trim().toLowerCase() === employeeId.toLowerCase(),
    );
    return match ? employeeLabel(match) : employeeId;
}

export function normalizeCarDrivenByRemarkFields(formData = {}) {
    const type = String(formData.carDrivenByType || '').toLowerCase();
    const companyId = String(formData.carDrivenByCompanyId || '').trim();
    const employeeId = String(formData.carDrivenByEmployeeId || '').trim();

    if (type === 'company' || (!employeeId && companyId)) {
        return {
            carDrivenByType: 'company',
            carDrivenByCompanyId: companyId || undefined,
            carDrivenByCompanyName: String(formData.carDrivenByCompanyName || '').trim() || undefined,
            carDrivenByEmployeeId: undefined,
        };
    }

    return {
        carDrivenByType: employeeId ? 'employee' : undefined,
        carDrivenByEmployeeId: employeeId || undefined,
        carDrivenByCompanyId: undefined,
        carDrivenByCompanyName: undefined,
    };
}

export { employeeLabel, companyLabel };
