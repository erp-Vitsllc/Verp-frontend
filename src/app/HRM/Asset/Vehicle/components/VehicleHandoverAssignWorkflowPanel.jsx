'use client';

import { useEffect, useMemo, useState } from 'react';
import axiosInstance from '@/utils/axios';
import WorkflowHistoryTimeline from '@/app/HRM/shared/workflowHistory/WorkflowHistoryTimeline';
import {
    buildHandoverAssignWorkflowEvents,
    pickFlowchartAdminRow,
    pickFlowchartHrRow,
} from '../utils/vehicleHandoverAssignWorkflow';
import { VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG } from '../utils/vehicleHandoverAssignWorkflowTrackerConfig';

const { card, timeline, steps, header, list, text, connector, spread } =
    VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG;

export default function VehicleHandoverAssignWorkflowPanel({ vehicle, historyEntry, className = '' }) {
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

    const events = useMemo(
        () =>
            buildHandoverAssignWorkflowEvents({
                vehicle,
                historyEntry,
                flowchartAdminRow: pickFlowchartAdminRow(flowchartRows),
                flowchartHrRow: pickFlowchartHrRow(flowchartRows),
                hrActiveHolder,
            }),
        [vehicle, historyEntry, flowchartRows, hrActiveHolder],
    );

    const cardHeightClass = card.stretchFullHeight ? 'h-full min-h-0' : '';
    const cardMinHeightClass = card.minHeightClass || '';

    return (
        <div
            className={`flex w-full flex-col ${cardHeightClass} ${cardMinHeightClass} ${card.roundedClass} ${card.borderClass} ${card.backgroundClass} ${card.paddingClass} ${className}`}
        >
            <WorkflowHistoryTimeline
                title={timeline.title}
                subtitle={timeline.subtitle}
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
        </div>
    );
}

export { VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG };
