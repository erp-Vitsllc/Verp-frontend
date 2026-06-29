/**
 * Handover Assign — Workflow Tracker layout config.
 * Edit values here to tune the outer card and inner timeline spacing.
 */

export const VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG = {
    /** Outer white card wrapper */
    card: {
        stretchFullHeight: true,
        paddingClass: 'p-7',
        roundedClass: 'rounded-2xl',
        borderClass: 'border border-gray-100',
        backgroundClass: 'bg-white shadow-sm',
    },

    /** Timeline header + step list */
    timeline: {
        title: 'Handover Workflow History',
        subtitle: 'All status, stages, dates, and user who performed task',
        emptyMessage: 'No workflow history available yet.',
        size: 'large',
        /** Compact steps with moderate gap (no full-height spread) */
        verticalSpread: false,
    },

    /** Step row sizing */
    steps: {
        minHeightPx: 76,
        gapBottomClass: 'pb-15',
        paddingLeftClass: 'pl-14',
        spreadMinHeightPx: 96,
    },

    /** Full-height spread mode */
    spread: {
        trailingLine: false,
        listPaddingYClass: 'py-3',
    },

    header: {
        paddingBottomClass: 'pb-3',
        marginBottomClass: 'mb-4',
    },

    list: {
        paddingYClass: 'py-2',
        marginLeftClass: 'ml-3',
    },

    text: {
        labelGapClass: 'gap-2',
        leadingClass: 'leading-snug',
        actorMarginTopClass: 'mt-0.5',
        dateMarginTopClass: 'mt-0',
    },

    connector: {
        topClass: 'top-9',
        leftClass: 'left-[18px]',
        widthClass: 'w-1',
    },

    /** Assign page row — keeps card aligned with left column height */
    page: {
        rowClassName: 'flex w-full flex-col gap-6 md:flex-row md:items-stretch',
        columnClassName: 'flex w-full min-w-0 self-stretch md:w-1/2',
        panelClassName: 'h-full flex-1',
    },
};
