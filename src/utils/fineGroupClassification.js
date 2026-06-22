export function isCompanyFineParty(emp) {
    if (!emp) return false;
    const id = emp.employeeId;
    const name = String(emp.employeeName || '').trim();
    return id === 'VEGA-HR-0000' || id === 'VEGA_INTERNAL' || name === 'Vega Digital IT Solutions';
}

export function getFineBaseId(fine) {
    const fid = fine?.fineId || '';
    if (fid.includes('-')) {
        const parts = fid.split('-');
        if (parts.length > 3) return parts.slice(0, 3).join('-');
        return fid;
    }
    return fine?._id?.toString()?.slice(-8) || fid || 'N/A';
}

/** True when a fine involves more than one liable party (e.g. employee + company). */
export function isMultiPartyFine(fine) {
    if (!fine || typeof fine !== 'object') return false;

    const rf = String(fine.responsibleFor || '').trim();
    if (rf === 'Employee & Company' || rf === 'Both') return true;

    const assigned = Array.isArray(fine.assignedEmployees) ? fine.assignedEmployees : [];
    const parties = assigned.filter((e) => e?.employeeId || e?.employeeName);
    const companyParties = parties.filter(isCompanyFineParty);
    const employeeParties = parties.filter(
        (e) => !isCompanyFineParty(e) && e.employeeId && e.employeeId !== 'PENDING',
    );

    if (companyParties.length > 0 && employeeParties.length > 0) return true;
    if (employeeParties.length > 1) return true;

    const empAmt = parseFloat(fine.employeeAmount || 0) || 0;
    const compAmt = parseFloat(fine.companyAmount || 0) || 0;
    if (compAmt > 0 && employeeParties.length > 0) return true;
    if (compAmt > 0 && empAmt > 0 && rf !== 'Company') return true;

    return false;
}

import {
    resolveEmployeeFinePayableAmount,
    resolveCompanyFinePayableAmount,
} from './finePayableAmount';
export function buildGroupMembersForFine(fine) {
    const companyId = fine.company?.companyId || fine.company?._id || fine.company;
    const assigned = Array.isArray(fine.assignedEmployees) ? fine.assignedEmployees : [];
    const fineStatus = fine.fineStatus || 'Pending';
    const recordFineId = fine.fineId;
    const recordId = fine._id;

    let entries = assigned
        .filter((e) => e?.employeeId || e?.employeeName)
        .map((e) => ({ ...e }));

    const hasCompanyEntry = entries.some(isCompanyFineParty);
    const hasEmployeeEntry = entries.some(
        (e) => !isCompanyFineParty(e) && e.employeeId && e.employeeId !== 'PENDING',
    );

    const compBase = parseFloat(fine.companyAmount || 0) || 0;
    const rf = String(fine.responsibleFor || '').trim();

    if (!hasCompanyEntry && compBase > 0 && (rf === 'Employee & Company' || rf === 'Company' || rf === 'Both')) {
        entries.push({
            employeeId: 'VEGA-HR-0000',
            employeeName: fine.companyName || 'Vega Digital IT Solutions',
            employeeAmount: compBase,
            individualAmount: compBase,
        });
    }

    if (!hasEmployeeEntry && parseFloat(fine.employeeAmount || 0) > 0 && rf === 'Employee & Company') {
        entries.unshift({
            employeeId: fine.employeeId || '—',
            employeeName: fine.employeeName || assigned[0]?.employeeName || 'Employee',
            employeeAmount: parseFloat(fine.employeeAmount || 0),
            individualAmount: parseFloat(fine.employeeAmount || 0),
        });
    }

    if (entries.length <= 1 && !isMultiPartyFine(fine)) return [];

    return entries.map((emp) => {
        const isCompany = isCompanyFineParty(emp);
        const individual = isCompany
            ? resolveCompanyFinePayableAmount(fine, emp)
            : resolveEmployeeFinePayableAmount(fine, emp.employeeId);

        return {
            employeeId: isCompany ? null : (emp.employeeId || '—'),
            employeeName: emp.employeeName || (isCompany ? (fine.companyName || 'Vega Digital IT Solutions') : 'N/A'),
            isCompany,
            fineAmount: individual,
            fineStatus,
            fineId: emp.fineId || recordFineId,
            fineRecordId: emp._id || recordId,
            companyId,
        };
    });
}

export function buildGroupRowFromMembers(first, groupKey, members, allAssigned, totalGroupAmount) {
    const empCount = allAssigned.filter((e) => !e.isCompany).length;
    const hasCompanyShare = allAssigned.some((e) => e.isCompany);

    return {
        ...first,
        fineId: getFineBaseId(first),
        isGroup: true,
        empCount,
        hasCompanyShare,
        groupMembers: allAssigned.map((emp) => ({
            employeeId: emp.isCompany ? null : (emp.employeeId || '—'),
            employeeName: emp.employeeName || 'N/A',
            isCompany: emp.isCompany,
            fineAmount: emp.individualAmount || emp.fineAmount || 0,
            fineStatus: emp.fineStatus,
            fineId: emp.recordFineId,
            fineRecordId: emp._id,
            companyId: emp.companyId || (first.company?._id || first.company),
        })),
        employeeId: null,
        employeeName: null,
        fineStatus: first.fineStatus || 'Pending',
        displayAmount: totalGroupAmount,
        _uiKey: groupKey,
        _ids: members.map((m) => m._id),
    };
}

/** Detail page URL for one party inside a group fine row. */
export function buildGroupMemberDetailHref(parentFine, member) {
    const baseId = getFineBaseId(parentFine);
    const memberFineId = member?.fineId || baseId;

    if (memberFineId && memberFineId !== baseId && /-[A-Z0-9]+$/i.test(memberFineId)) {
        return `/HRM/Fine/${encodeURIComponent(memberFineId)}`;
    }

    const recordId = parentFine.fineId || baseId;
    if (member?.isCompany) {
        return `/HRM/Fine/${encodeURIComponent(recordId)}?party=company`;
    }
    if (member?.employeeId) {
        return `/HRM/Fine/${encodeURIComponent(recordId)}?party=employee&employeeId=${encodeURIComponent(member.employeeId)}`;
    }
    return `/HRM/Fine/${encodeURIComponent(recordId)}`;
}

export function isViewingSpecificFineParty(searchParams, recordId) {
    const party = searchParams?.get?.('party');
    if (party === 'company' || party === 'employee') return true;
    return Boolean(recordId && /-[A-Z0-9]+$/i.test(recordId));
}

export function resolveActivePartyFromFine(fine, { recordId, party, employeeId } = {}) {
    if (!fine) return null;
    const assigned = fine.assignedEmployees || [];

    const byRecordFineId = assigned.find((ae) => ae.fineId === recordId);
    if (byRecordFineId) return byRecordFineId;

    const suffixMatch = recordId?.match(/-([A-Z0-9]+)$/i);
    if (suffixMatch && assigned.length > 1) {
        const idx = suffixMatch[1].charCodeAt(0) - 65;
        if (idx >= 0 && idx < assigned.length) return assigned[idx];
    }

    if (party === 'company') {
        return (
            assigned.find(isCompanyFineParty) || {
                employeeId: 'VEGA-HR-0000',
                employeeName: fine.companyName || 'Vega Digital IT Solutions',
            }
        );
    }

    if (party === 'employee') {
        if (employeeId) {
            return assigned.find((ae) => ae.employeeId === employeeId) || { employeeId, employeeName: 'Employee' };
        }
        return assigned.find((ae) => !isCompanyFineParty(ae) && ae.employeeId !== 'PENDING') || assigned[0];
    }

    return assigned[0] || null;
}
