'use client';

import { useMemo } from 'react';
import WorkflowHistoryTimeline from '@/app/HRM/shared/workflowHistory/WorkflowHistoryTimeline';
import { buildMechanicalWorkDetailWorkflowEvents } from '../utils/vehicleMechanicalWorkDetailWorkflow';
import { VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG } from '../utils/vehicleHandoverAssignWorkflowTrackerConfig';

const { card, timeline, steps, header, list, text, connector, spread } =
    VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG;

const MECHANICAL_WORK_SUBTITLE =
    'Service created, updated, submitted, quotation review, garage, accounts, and completion';

export default function VehicleMechanicalWorkWorkflowPanel({ asset, service, className = '' }) {
    const events = useMemo(
        () => buildMechanicalWorkDetailWorkflowEvents(asset, service),
        [asset, service],
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
                subtitle={MECHANICAL_WORK_SUBTITLE}
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
