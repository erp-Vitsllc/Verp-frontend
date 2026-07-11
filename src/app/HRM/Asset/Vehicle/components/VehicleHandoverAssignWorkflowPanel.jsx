'use client';

import { useEffect, useMemo, useState } from 'react';
import axiosInstance from '@/utils/axios';
import WorkflowHistoryTimeline from '@/app/HRM/shared/workflowHistory/WorkflowHistoryTimeline';
import {
    buildHandoverAssignWorkflowEvents,
    pickFlowchartAdminRow,
    pickFlowchartHrRow,
} from '../utils/vehicleHandoverAssignWorkflow';
import { isHandoverHistoryFullyApproved } from '../utils/vehicleHandoverAssignActions';
import {
    buildInspectionHandoverWorkflowEvents,
    isInspectionHandoverDetailEntry,
} from '../utils/vehicleInspectionHandoverWorkflow';
import { VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG } from '../utils/vehicleHandoverAssignWorkflowTrackerConfig';

import VehicleHandoverAssignActions from './VehicleHandoverAssignActions';

const { card, timeline, steps, header, list, text, connector, spread } =
    VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG;

export default function VehicleHandoverAssignWorkflowPanel({
    vehicle,
    historyEntry,
    assetHistory = [],
    handoverItemFines = {},
    handoverItemFineWaivers = {},
    handoverItemFineInclusions = {},
    className = '',
    canApprove = false,
    isHrStage = false,
    onApproveWithIncludedFines,
    onVehicleUpdated,
    onHistoryUpdated,
    onResponded,
    onScrollToAssessment,
    accessoriesSidePanel = false,
    flowchartRows: flowchartRowsProp,
    hrActiveHolder: hrActiveHolderProp,
}) {
    const [flowchartRows, setFlowchartRows] = useState([]);
    const [hrActiveHolder, setHrActiveHolder] = useState(null);

    const hasExternalFlowchart = flowchartRowsProp !== undefined;
    const resolvedFlowchartRows = hasExternalFlowchart ? flowchartRowsProp : flowchartRows;
    const resolvedHrActiveHolder =
        hrActiveHolderProp !== undefined ? hrActiveHolderProp : hrActiveHolder;

    useEffect(() => {
        if (hasExternalFlowchart) return undefined;

        let cancelled = false;

        const load = async () => {
            try {
                const [flowRes, hrRes] = await Promise.all([
                    axiosInstance.get('/Flowchart', { skipToast: true }).catch(() => ({ data: [] })),
                    axiosInstance.get('/Flowchart/active-holder/hr', { skipToast: true }).catch(() => ({ data: null })),
                ]);
                if (cancelled) return;
                setFlowchartRows(Array.isArray(flowRes?.data) ? flowRes.data : []);
                setHrActiveHolder(hrRes?.data || null);
            } catch {
                if (!cancelled) {
                    setFlowchartRows([]);
                    setHrActiveHolder(null);
                }
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [hasExternalFlowchart]);

    const isInspection = isInspectionHandoverDetailEntry(historyEntry, vehicle);
    const handoverFullyApproved = isHandoverHistoryFullyApproved(historyEntry);

    const events = useMemo(() => {
        if (isInspection) {
            return buildInspectionHandoverWorkflowEvents({
                vehicle,
                historyEntry,
                flowchartHrRow: pickFlowchartHrRow(resolvedFlowchartRows),
                hrActiveHolder: resolvedHrActiveHolder,
            });
        }
        return buildHandoverAssignWorkflowEvents({
            vehicle,
            historyEntry,
            flowchartAdminRow: pickFlowchartAdminRow(resolvedFlowchartRows),
            flowchartHrRow: pickFlowchartHrRow(resolvedFlowchartRows),
            hrActiveHolder: resolvedHrActiveHolder,
        });
    }, [vehicle, historyEntry, resolvedFlowchartRows, resolvedHrActiveHolder, isInspection]);

    const useVerticalSpread = accessoriesSidePanel
        ? timeline.accessoriesSideVerticalSpread ?? timeline.verticalSpread
        : timeline.verticalSpread;
    const cardLayoutClass = useVerticalSpread ? 'h-full min-h-0 flex flex-col' : 'h-fit w-full shrink-0';
    const cardMinHeightClass = card.minHeightClass || '';
    const sidePanelPaddingClass = accessoriesSidePanel ? 'p-4' : card.paddingClass;

    return (
        <div
            className={`${cardLayoutClass} ${cardMinHeightClass} ${card.roundedClass} ${card.borderClass} ${card.backgroundClass} ${sidePanelPaddingClass} ${className}`}
        >
            <WorkflowHistoryTimeline
                title={isInspection ? 'Inspection Handover Workflow' : timeline.title}
                subtitle={
                    isInspection
                        ? 'Handover by, handover to, and HR approval'
                        : timeline.subtitle
                }
                emptyMessage={timeline.emptyMessage}
                size={timeline.size}
                verticalSpread={useVerticalSpread}
                className={useVerticalSpread ? 'min-h-0 flex-1' : 'shrink-0'}
                layoutConfig={{
                    verticalSpread: useVerticalSpread,
                    steps,
                    header,
                    list,
                    text,
                    connector,
                    spread,
                }}
                events={events}
            />
            {!isInspection && canApprove && isHrStage && !handoverFullyApproved ? (
                <div className="mt-4 border-t border-slate-100 pt-4">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        HR approval
                    </p>
                    <VehicleHandoverAssignActions
                        vehicle={vehicle}
                        historyEntry={historyEntry}
                        assetHistory={assetHistory}
                        handoverItemFines={handoverItemFines}
                        handoverItemFineWaivers={handoverItemFineWaivers}
                        handoverItemFineInclusions={handoverItemFineInclusions}
                        onVehicleUpdated={onVehicleUpdated}
                        onHistoryUpdated={onHistoryUpdated}
                        onResponded={onResponded}
                        canApprove={canApprove}
                        isHrStage={isHrStage}
                        onApproveWithIncludedFines={onApproveWithIncludedFines}
                        onScrollToAssessment={onScrollToAssessment}
                    />
                </div>
            ) : null}
        </div>
    );
}

export { VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG };
