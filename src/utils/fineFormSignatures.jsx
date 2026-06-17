'use client';

function approverName(user) {
    if (!user) return '';
    if (typeof user === 'string') return user;
    if (user.name) return user.name;
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
}

function workflowApproved(fine, roles) {
    return (fine?.workflow || []).some(
        (w) => w.status === 'Approved' && roles.some((r) => (w.role || '').toLowerCase() === r.toLowerCase())
    );
}

export function getFineSignatureState(fine, { displayName, hodName } = {}) {
    const finalized = ['Approved', 'Active', 'Paid', 'Completed'].includes(fine?.fineStatus);
    const hrApproved = !!(fine?.hrApprovedBy || workflowApproved(fine, ['HR']));
    const accountsApproved = !!(fine?.accountsApprovedBy || workflowApproved(fine, ['Accounts']));
    const mgmtApproved = finalized && !!(fine?.approvedBy || workflowApproved(fine, ['Management', 'CEO']));
    const hodApproved = !!(fine?.managerApprovedBy || workflowApproved(fine, ['Manager', 'HOD']));

    return {
        employee: { show: finalized, name: displayName || '' },
        hod: { show: hodApproved, name: hodName || '' },
        hr: {
            show: hrApproved,
            name: approverName(fine?.hrApprovedBy) || fine?.hrHODName || '',
        },
        accounts: {
            show: accountsApproved,
            name: approverName(fine?.accountsApprovedBy) || fine?.accountsHODName || '',
        },
        management: {
            show: mgmtApproved,
            name: approverName(fine?.approvedBy) || fine?.ceoName || 'MANAGEMENT',
            stamped: mgmtApproved,
        },
    };
}

export function FineFormSignatureRow({ signatures, isCompanyFine = false }) {
    const sig = signatures || {};
    const boxes = [
        { key: 'employee', label: isCompanyFine ? 'Company Name\nSignature' : 'Employee Name\nSignature' },
        { key: 'hod', label: 'HOD Name\nSignature' },
        { key: 'hr', label: 'HR Officer Name\nSignature' },
        { key: 'accounts', label: 'Accounts Name\nSignature' },
        { key: 'management', label: 'Management\nSignature' },
    ];

    return (
        <div className="border border-black bg-white/90 flex h-28 text-sm">
            {boxes.map((box, idx) => {
                const data = sig[box.key] || {};
                const isLast = idx === boxes.length - 1;
                return (
                    <div
                        key={box.key}
                        className={`flex-1 flex flex-col p-2 ${!isLast ? 'border-r border-black' : ''}`}
                    >
                        <div className="font-semibold text-center h-10 whitespace-pre-line">{box.label}</div>
                        <div className="flex-1 flex flex-col items-center justify-end pb-2 relative">
                            {box.key === 'management' && data.stamped && (
                                <div className="border-2 border-green-600 text-green-600 font-bold text-sm px-2 py-1 rounded rotate-[-12deg] opacity-70 absolute top-1">
                                    APPROVED MANAGEMENT
                                </div>
                            )}
                            {data.show && data.name ? (
                                <span className="font-bold text-xs uppercase text-center text-black">{data.name}</span>
                            ) : null}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
