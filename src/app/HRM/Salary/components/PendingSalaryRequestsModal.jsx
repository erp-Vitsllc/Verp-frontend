'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { navigateFromNotificationClick } from '@/utils/listReturnNavigation';
import { mapPendingInboxToRow } from '@/utils/notificationInboxPresentation';
import NotificationInboxModal from '@/components/notifications/NotificationInboxModal';
import {
    pendingEnrollmentInboxItems,
    pendingEnrollmentMessage,
} from '../utils/salaryPendingInboxCount';

function salaryHref(row) {
    const raw = row?.raw || row;
    if (raw?.href) return String(raw.href);
    const employeeId =
        raw?.subjectEmployeeId ||
        raw?.employeeId ||
        row?.subjectEmployeeId ||
        '';
    if (!employeeId) return '';
    return `/HRM/Salary/enroll/${encodeURIComponent(employeeId)}`;
}

export default function PendingSalaryRequestsModal({
    isOpen,
    onClose,
    onRefreshParent,
    pendingEnrollmentEmployees = [],
}) {
    const { toast } = useToast();
    const router = useRouter();
    const inboxItems = useMemo(
        () => pendingEnrollmentInboxItems(pendingEnrollmentEmployees),
        [pendingEnrollmentEmployees],
    );
    const notificationRows = useMemo(
        () => inboxItems.map((row, index) => mapPendingInboxToRow(row, index)),
        [inboxItems],
    );
    const pendingCount = inboxItems.length;

    const handleRowActivate = (row) => {
        const path = salaryHref(row);
        if (!path) {
            toast({
                variant: 'destructive',
                title: 'Unable to open',
                description: 'Could not open this employee salary profile.',
            });
            return;
        }
        navigateFromNotificationClick(router, path);
        onClose();
        if (typeof onRefreshParent === 'function') onRefreshParent();
    };

    return (
        <NotificationInboxModal
            isOpen={isOpen}
            onClose={onClose}
            title="Salary notifications"
            subtitle={pendingEnrollmentMessage(pendingCount)}
            items={notificationRows}
            loading={false}
            refreshing={false}
            emptyMessage="No employees pending for enrollment."
            onItemClick={handleRowActivate}
            getItemHref={(row) => salaryHref(row)}
        />
    );
}
