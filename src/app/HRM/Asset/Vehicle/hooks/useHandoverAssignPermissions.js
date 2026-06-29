'use client';

import { useEffect, useMemo, useState } from 'react';
import axiosInstance from '@/utils/axios';
import {
    canEditHandoverReports,
    canUserActOnHandoverAssign,
    isHandoverReportsLocked,
} from '../utils/vehicleHandoverAssignActions';
import { pickFlowchartAdminRow } from '../utils/vehicleHandoverAssignWorkflow';

export function useHandoverAssignPermissions(vehicle, historyEntry) {
    const [currentUser, setCurrentUser] = useState(null);
    const [flowchartRows, setFlowchartRows] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            try {
                const stored = localStorage.getItem('user');
                const parsedStored = stored ? JSON.parse(stored) : null;
                const [userRes, flowRes] = await Promise.all([
                    axiosInstance.get('/Employee/me', { skipToast: true }).catch(() => ({ data: parsedStored })),
                    axiosInstance.get('/Flowchart', { skipToast: true }).catch(() => ({ data: [] })),
                ]);
                if (cancelled) return;

                const employee = userRes?.data || parsedStored || null;
                const mergedUser = employee
                    ? {
                          ...(parsedStored && typeof parsedStored === 'object' ? parsedStored : {}),
                          ...employee,
                          employeeObjectId:
                              employee.employeeObjectId ||
                              employee._id ||
                              parsedStored?.employeeObjectId ||
                              parsedStored?._id ||
                              null,
                      }
                    : null;

                setCurrentUser(mergedUser);
                setFlowchartRows(Array.isArray(flowRes?.data) ? flowRes.data : []);
            } catch {
                if (!cancelled) {
                    try {
                        const stored = localStorage.getItem('user');
                        setCurrentUser(stored ? JSON.parse(stored) : null);
                    } catch {
                        setCurrentUser(null);
                    }
                    setFlowchartRows([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const flowchartAdminRow = useMemo(
        () => pickFlowchartAdminRow(flowchartRows),
        [flowchartRows],
    );

    const reportsLocked = useMemo(
        () => isHandoverReportsLocked(vehicle, historyEntry),
        [vehicle, historyEntry],
    );

    const canEditReports = useMemo(
        () =>
            canEditHandoverReports({
                vehicle,
                historyEntry,
                currentUser,
                flowchartAdminRow,
            }),
        [vehicle, historyEntry, currentUser, flowchartAdminRow],
    );

    const canApprove = useMemo(
        () =>
            canUserActOnHandoverAssign({
                vehicle,
                historyEntry,
                currentUser,
                flowchartAdminRow,
            }),
        [vehicle, historyEntry, currentUser, flowchartAdminRow],
    );

    return {
        currentUser,
        flowchartAdminRow,
        canEditReports,
        canApprove,
        reportsLocked,
        loading,
    };
}
