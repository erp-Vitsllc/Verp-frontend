export function salaryRegisterHref({ employeeId = '', year = '', company = '' } = {}) {
    const params = new URLSearchParams();
    const id = String(employeeId || '').trim();
    const yr = String(year || '').trim();
    const co = String(company || '').trim();
    if (id) params.set('employeeId', id);
    if (/^\d{4}$/.test(yr)) params.set('year', yr);
    if (co) params.set('company', co);
    const qs = params.toString();
    return qs ? `/HRM/Salary?${qs}` : '/HRM/Salary';
}

export function salaryRegisterFiltersFromSearchParams(searchParams) {
    const year = String(searchParams?.get?.('year') || '').trim();
    return {
        year: /^\d{4}$/.test(year) ? year : '',
        company: String(searchParams?.get?.('company') || '').trim(),
        employeeId: String(
            searchParams?.get?.('employeeId') || searchParams?.get?.('employee') || '',
        ).trim(),
    };
}
