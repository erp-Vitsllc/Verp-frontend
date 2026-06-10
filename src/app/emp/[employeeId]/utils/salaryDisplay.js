/** Resolve the active salary history entry (open period, or latest by fromDate). */
export function getActiveSalaryHistoryEntry(employee) {
    const history = Array.isArray(employee?.salaryHistory) ? employee.salaryHistory : [];
    if (history.length === 0) return null;

    const active = history.find((entry) => !entry?.toDate);
    if (active) return active;

    return [...history].sort((a, b) => {
        const ta = a?.fromDate ? new Date(a.fromDate).getTime() : 0;
        const tb = b?.fromDate ? new Date(b.fromDate).getTime() : 0;
        return tb - ta;
    })[0];
}

/** Offer letter for the current active salary period (not the oldest history row). */
export function getActiveSalaryOfferLetter(employee) {
    const active = getActiveSalaryHistoryEntry(employee);
    if (active?.offerLetter?.url || active?.offerLetter?.data) {
        return { offerLetter: active.offerLetter, entryId: active._id };
    }
    if (employee?.offerLetter?.url || employee?.offerLetter?.data) {
        return { offerLetter: employee.offerLetter, entryId: null };
    }
    return { offerLetter: null, entryId: null };
}

/** Salary card fields: prefer top-level employee salary, fall back to active history entry. */
export function getEffectiveSalaryFields(employee) {
    const topHasData =
        (Number(employee?.basic) || 0) > 0 ||
        (Number(employee?.monthlySalary) || 0) > 0 ||
        (Number(employee?.totalSalary) || 0) > 0;

    if (topHasData) {
        const vehicleAllowance =
            employee.additionalAllowances?.find((a) => a.type?.toLowerCase().includes('vehicle'))?.amount || 0;
        const fuelAllowance =
            employee.additionalAllowances?.find((a) => a.type?.toLowerCase().includes('fuel'))?.amount || 0;

        return {
            basic: Number(employee.basic) || 0,
            houseRentAllowance: Number(employee.houseRentAllowance) || 0,
            vehicleAllowance: Number(vehicleAllowance) || 0,
            fuelAllowance: Number(fuelAllowance) || 0,
            otherAllowance: Number(employee.otherAllowance) || 0,
            additionalAllowances: employee.additionalAllowances || [],
        };
    }

    const active = getActiveSalaryHistoryEntry(employee);
    if (!active) {
        return {
            basic: 0,
            houseRentAllowance: 0,
            vehicleAllowance: 0,
            fuelAllowance: 0,
            otherAllowance: 0,
            additionalAllowances: [],
        };
    }

    const vehicleAllowance =
        active.vehicleAllowance ??
        active.additionalAllowances?.find((a) => a.type?.toLowerCase().includes('vehicle'))?.amount ??
        0;
    const fuelAllowance =
        active.fuelAllowance ??
        active.additionalAllowances?.find((a) => a.type?.toLowerCase().includes('fuel'))?.amount ??
        0;

    return {
        basic: Number(active.basic) || 0,
        houseRentAllowance: Number(active.houseRentAllowance) || 0,
        vehicleAllowance: Number(vehicleAllowance) || 0,
        fuelAllowance: Number(fuelAllowance) || 0,
        otherAllowance: Number(active.otherAllowance) || 0,
        additionalAllowances: active.additionalAllowances || [],
    };
}

export function hasEmployeeSalaryDetails(employee) {
    if (!employee) return false;

    const fields = getEffectiveSalaryFields(employee);
    if (fields.basic > 0 || fields.otherAllowance > 0 || fields.houseRentAllowance > 0) {
        return true;
    }

    const history = Array.isArray(employee.salaryHistory) ? employee.salaryHistory : [];
    return history.some(
        (entry) => (Number(entry?.basic) || 0) > 0 || (Number(entry?.totalSalary) || 0) > 0,
    );
}
