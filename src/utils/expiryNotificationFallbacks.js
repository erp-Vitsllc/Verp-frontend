/**
 * Calendar days until expiry — matches backend documentExpiryReminderStages (start-of-day, rounded).
 */
export function getCalendarDaysUntilExpiry(expiryDate) {
    if (!expiryDate) return null;
    const startOfDay = (d) => {
        const x = new Date(d);
        if (Number.isNaN(x.getTime())) return null;
        x.setHours(0, 0, 0, 0);
        return x;
    };
    const today = startOfDay(new Date());
    const exp = startOfDay(expiryDate);
    if (!today || !exp) return null;
    return Math.round((exp - today) / (1000 * 60 * 60 * 24));
}

/** Dashboard / bell: surface follow-ups within 10 days or overdue */
export function isExpiryNotificationWindow(days) {
    return days != null && days <= 10;
}

/** Synthetic items when DashboardAction cron rows are delayed; merged with `/Employee/dashboard/user-stats`. */
export function collectCompanyLiveExpiryNotifications(companies = []) {
    const list = [];
    const pushIfDue = (company, label, expiryDate) => {
        if (!company || !expiryDate) return;
        const daysRemaining = getCalendarDaysUntilExpiry(expiryDate);
        if (!isExpiryNotificationWindow(daysRemaining)) return;
        const d = new Date(expiryDate);
        if (Number.isNaN(d.getTime())) return;
        const expLabel = d.toLocaleDateString('en-GB');
        list.push({
            id: company._id,
            actionId: null,
            type: 'Document Expiry Reminder',
            requestedBy: 'System',
            requestedDate: d.toISOString(),
            status: 'Pending',
            extra1: `Expiry follow-up required: ${label} (Exp: ${expLabel})`,
            extra2: `${company?.name || ''} (${company?.companyId || ''})`,
            scope: 'inbox',
        });
    };

    (companies || []).forEach((company) => {
        pushIfDue(company, 'Trade License', company?.tradeLicenseExpiry);
        pushIfDue(company, 'Establishment Card', company?.establishmentCardExpiry);
        (company?.documents || []).forEach((doc) =>
            pushIfDue(company, doc?.type || 'Company Document', doc?.expiryDate)
        );
        (company?.ejari || []).forEach((ej) =>
            pushIfDue(company, ej?.type ? `Ejari — ${ej.type}` : 'Ejari', ej?.expiryDate)
        );
        (company?.insurance || []).forEach((ins) =>
            pushIfDue(company, ins?.type ? `Insurance — ${ins.type}` : 'Insurance', ins?.expiryDate)
        );
        const ownerFields = [
            ['passport', 'Passport'],
            ['visa', 'Visa'],
            ['emiratesId', 'Emirates ID'],
            ['medical', 'Medical Insurance'],
            ['drivingLicense', 'Driving License'],
            ['labourCard', 'Labour Card'],
        ];
        (company?.owners || []).forEach((owner) => {
            ownerFields.forEach(([k, lbl]) =>
                pushIfDue(company, `${owner?.name || 'Owner'} - ${lbl}`, owner?.[k]?.expiryDate)
            );
        });
    });

    return list;
}

function employeeDisplayName(emp) {
    const n = `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim();
    return n || emp?.employeeId || '';
}

/**
 * Synthetic employee document expiry rows from list payload (matches fields from GET /Employee aggregate).
 */
export function collectEmployeeLiveExpiryNotifications(employees = []) {
    const list = [];
    const pushIfDue = (emp, label, expiryDate) => {
        if (!emp || !expiryDate) return;
        const daysRemaining = getCalendarDaysUntilExpiry(expiryDate);
        if (!isExpiryNotificationWindow(daysRemaining)) return;
        const d = new Date(expiryDate);
        if (Number.isNaN(d.getTime())) return;
        const expLabel = d.toLocaleDateString('en-GB');
        const subjectName = employeeDisplayName(emp);
        const eid = emp.employeeId;
        list.push({
            id: emp._id,
            actionId: null,
            type: 'Employee Document Expiry Reminder',
            requestedBy: 'System',
            requestedDate: d.toISOString(),
            status: 'Pending',
            extra1: `Expiry follow-up required: ${label} (Exp: ${expLabel})`,
            extra2: `${subjectName} (${eid})`,
            scope: 'inbox',
            targetEmployeeId: eid,
        });
    };

    for (const emp of employees || []) {
        const passportExp = emp?.passportDetails?.expiryDate || emp?.passportExp;
        pushIfDue(emp, 'Passport', passportExp);
        pushIfDue(emp, 'Emirates ID', emp?.eidExp);
        pushIfDue(emp, 'Medical Insurance', emp?.medExp);
        pushIfDue(emp, 'Labour Card', emp?.labourCardExp);

        const vd = emp?.visaDetails;
        if (vd) {
            pushIfDue(emp, 'Visit Visa', vd?.visit?.expiryDate);
            pushIfDue(emp, 'Employment Visa', vd?.employment?.expiryDate);
            pushIfDue(emp, 'Spouse Visa', vd?.spouse?.expiryDate);
        }

        (emp?.documents || []).forEach((doc) => {
            pushIfDue(emp, doc?.type || 'Employee Document', doc?.expiryDate);
        });

        pushIfDue(emp, 'Contract Expiry', emp?.contractExpiryDate);
    }

    return list;
}

export function mergeExpiryNotificationDedupe(apiItems = [], fallbackItems = []) {
    const merged = [...(apiItems || [])];
    const seen = new Set(
        merged.map((x) => `${x.type}|${x.id}|${String(x.extra1 || '').trim()}`)
    );
    (fallbackItems || []).forEach((x) => {
        const key = `${x.type}|${x.id}|${String(x.extra1 || '').trim()}`;
        if (!seen.has(key)) {
            seen.add(key);
            merged.push(x);
        }
    });
    merged.sort((a, b) => new Date(b.requestedDate || 0) - new Date(a.requestedDate || 0));
    return merged;
}
