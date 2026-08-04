'use client';

import { useEffect, useMemo, useState } from 'react';
import axiosInstance from '@/utils/axios';
import WorkflowHistoryTimeline from '@/app/HRM/shared/workflowHistory/WorkflowHistoryTimeline';
import { buildBodyWorkDetailWorkflowEvents } from '../utils/vehicleBodyWorkDetailWorkflow';
import { SHOP_SERVICE_WORKFLOW_SUBTITLE } from '../utils/vehicleShopServiceDetailWorkflow';
import { VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG } from '../utils/vehicleHandoverAssignWorkflowTrackerConfig';

const { card, timeline, steps, header, list, text, connector, spread } =
    VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG;

export default function VehicleBodyWorkWorkflowPanel({ asset, service, className = '' }) {
    const [flowchartRows, setFlowchartRows] = useState([]);

    useEffect(() => {
        let cancelled = false;
        axiosInstance
            .get('/Flowchart', { skipToast: true })
            .then(({ data }) => {
                if (!cancelled) setFlowchartRows(Array.isArray(data) ? data : []);
            })
            .catch(() => {
                if (!cancelled) setFlowchartRows([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const events = useMemo(
        () => buildBodyWorkDetailWorkflowEvents(asset, service, flowchartRows),
        [asset, service, flowchartRows],
    );

    const cardHeightClass = className.includes('flex-1') || className.includes('h-full')
        ? 'h-full min-h-0 flex-1'
        : card.stretchFullHeight
          ? 'h-full min-h-0'
          : '';

    return (
        <div
            className={`flex w-full flex-col ${cardHeightClass} ${card.roundedClass} ${card.borderClass} ${card.backgroundClass} ${card.paddingClass} ${className}`}
        >
            <WorkflowHistoryTimeline
                title="Service Workflow History"
                subtitle={SHOP_SERVICE_WORKFLOW_SUBTITLE}
                emptyMessage="No workflow activity recorded yet."
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
