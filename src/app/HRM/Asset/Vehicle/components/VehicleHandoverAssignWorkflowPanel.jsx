'use client';

import { useEffect, useMemo, useState } from 'react';
import axiosInstance from '@/utils/axios';
import WorkflowHistoryTimeline from '@/app/HRM/shared/workflowHistory/WorkflowHistoryTimeline';
import {
    buildHandoverAssignWorkflowEvents,
    pickFlowchartAdminRow,
    pickFlowchartHrRow,
} from '../utils/vehicleHandoverAssignWorkflow';
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
    className = '',
    canApprove = false,
    isHrStage = false,
    onApproveWithFine,
    onVehicleUpdated,
    onHistoryUpdated,
    onScrollToAssessment,
}) {
    const [flowchartRows, setFlowchartRows] = useState([]);
    const [hrActiveHolder, setHrActiveHolder] = useState(null);

    useEffect(() => {
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
    }, []);

    const isInspection = isInspectionHandoverDetailEntry(historyEntry, vehicle);

    const events = useMemo(() => {
        if (isInspection) {
            return buildInspectionHandoverWorkflowEvents({
                vehicle,
                historyEntry,
                flowchartHrRow: pickFlowchartHrRow(flowchartRows),
                hrActiveHolder,
            });
        }
        return buildHandoverAssignWorkflowEvents({
            vehicle,
            historyEntry,
            flowchartAdminRow: pickFlowchartAdminRow(flowchartRows),
            flowchartHrRow: pickFlowchartHrRow(flowchartRows),
            hrActiveHolder,
        });
    }, [vehicle, historyEntry, flowchartRows, hrActiveHolder, isInspection]);

    const cardHeightClass = card.stretchFullHeight ? 'h-full min-h-0' : '';
    const cardMinHeightClass = card.minHeightClass || '';

    return (
        <div
            className={`flex w-full flex-col ${cardHeightClass} ${cardMinHeightClass} ${card.roundedClass} ${card.borderClass} ${card.backgroundClass} ${card.paddingClass} ${className}`}
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
                verticalSpread={timeline.verticalSpread}
                className={timeline.verticalSpread ? 'min-h-0 flex-1' : ''}
                layoutConfig={{
                    verticalSpread: timeline.verticalSpread,
                    steps,
                    header,
                    list,
                    text,
                    connector,
                    spread,
                }}
                events={events}
            />
            {!isInspection && canApprove && isHrStage ? (
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
                        onVehicleUpdated={onVehicleUpdated}
                        onHistoryUpdated={onHistoryUpdated}
                        canApprove={canApprove}
                        isHrStage={isHrStage}
                        onApproveWithFine={onApproveWithFine}
                        onScrollToAssessment={onScrollToAssessment}
                    />
                </div>
            ) : null}
        </div>
    );
}

export { VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG };
