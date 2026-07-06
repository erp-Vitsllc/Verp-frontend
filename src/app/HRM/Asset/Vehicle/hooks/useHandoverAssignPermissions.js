'use client';

import { useEffect, useMemo, useState } from 'react';
import axiosInstance from '@/utils/axios';
import {
    canEditHandoverReports,
    canEditInspectionHandoverContent,
    canUserActOnHandoverAssign,
    flowchartAdminRowMatchesUser,
    isHandoverReportsLocked,
    isHandoverReportsCompleteForEntry,
} from '../utils/vehicleHandoverAssignActions';
import { isVehicleInspectionHandoverEntry } from '../utils/vehicleHandoverHistory';
import { pickFlowchartAdminRow, pickFlowchartHrRow } from '../utils/vehicleHandoverAssignWorkflow';
import { isAdmin as isPortalSuperUser } from '@/utils/permissions';

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

    const flowchartHrRow = useMemo(() => pickFlowchartHrRow(flowchartRows), [flowchartRows]);

    const isFlowchartHr = useMemo(() => {
        if (!currentUser) return false;
        if (isPortalSuperUser()) return true;
        return flowchartAdminRowMatchesUser(flowchartHrRow, currentUser);
    }, [currentUser, flowchartHrRow]);

    const reportsLocked = useMemo(
        () => isHandoverReportsLocked(vehicle, historyEntry),
        [vehicle, historyEntry],
    );

    const canEditReports = useMemo(() => {
        if (isVehicleInspectionHandoverEntry(historyEntry, vehicle)) {
            return canEditInspectionHandoverContent({
                vehicle,
                historyEntry,
                currentUser,
                flowchartAdminRow,
            });
        }
        return canEditHandoverReports({
            vehicle,
            historyEntry,
            currentUser,
            flowchartAdminRow,
        });
    }, [vehicle, historyEntry, currentUser, flowchartAdminRow]);

    const canApprove = useMemo(
        () =>
            canUserActOnHandoverAssign({
                vehicle,
                historyEntry,
                currentUser,
                flowchartAdminRow,
                flowchartHrRow,
            }),
        [vehicle, historyEntry, currentUser, flowchartAdminRow, flowchartHrRow],
    );

    const canReviewInspection = useMemo(() => {
        if (!isVehicleInspectionHandoverEntry(historyEntry, vehicle)) return false;
        if (!isFlowchartHr) return false;
        return String(vehicle?.vehicleInspectionStatus || '').toLowerCase() === 'pending_hr';
    }, [historyEntry, isFlowchartHr, vehicle?.vehicleInspectionStatus]);

    const canEditInspectionForm = useMemo(
        () =>
            canEditInspectionHandoverContent({
                vehicle,
                historyEntry,
                currentUser,
                flowchartAdminRow,
            }),
        [vehicle, historyEntry, currentUser, flowchartAdminRow],
    );

    const canSubmitInspectionForHr = useMemo(() => {
        if (!canEditInspectionHandoverContent({
            vehicle,
            historyEntry,
            currentUser,
            flowchartAdminRow,
            allowAfterBodyComplete: true,
        })) {
            return false;
        }
        return isHandoverReportsCompleteForEntry(historyEntry, vehicle);
    }, [vehicle, historyEntry, currentUser, flowchartAdminRow]);

    return {
        currentUser,
        flowchartAdminRow,
        flowchartHrRow,
        isFlowchartHr,
        canEditReports,
        canApprove,
        isHandoverHrStage: useMemo(
            () => {
                const stage = vehicle?.pendingActionDetails?.vehicleHandoverFlow?.stage;
                return stage === 'hr' || stage === 'management';
            },
            [vehicle?.pendingActionDetails?.vehicleHandoverFlow?.stage],
        ),
        canReviewInspection,
        canEditInspectionForm,
        canSubmitInspectionForHr,
        reportsLocked,
        loading,
    };
}
