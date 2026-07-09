/**
 * Handover Assign — Workflow Tracker layout config.
 * Edit values here to tune the outer card and inner timeline spacing.
 */

export const VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG = {
    /** Outer white card wrapper */
    card: {
        stretchFullHeight: false,
        paddingClass: 'p-5',
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
        /** Compact steps — do not stretch to fill sidebar height */
        verticalSpread: false,
        accessoriesSideVerticalSpread: false,
    },

    /** Step row sizing */
    steps: {
        minHeightPx: 64,
        gapBottomClass: 'pb-7',
        paddingLeftClass: 'pl-12',
        spreadMinHeightPx: 72,
    },

    /** Full-height spread mode */
    spread: {
        trailingLine: false,
        listPaddingYClass: 'py-3',
    },

    header: {
        paddingBottomClass: 'pb-2',
        marginBottomClass: 'mb-3',
    },

    list: {
        paddingYClass: 'py-2',
        marginLeftClass: 'ml-2',
    },

    text: {
        labelGapClass: 'gap-2',
        leadingClass: 'leading-snug',
        actorMarginTopClass: 'mt-0.5',
        dateMarginTopClass: 'mt-0',
    },

    connector: {
        topClass: 'top-8',
        leftClass: 'left-[16px]',
        widthClass: 'w-1',
    },

    /** Detail pages — main form ~3/4, workflow/history sidebar ~1/4 */
    page: {
        rowClassName: 'grid w-full grid-cols-1 items-start gap-6 lg:grid-cols-4',
        mainColumnClassName: 'flex w-full min-w-0 flex-col gap-6 lg:col-span-3',
        sideColumnClassName: 'w-full min-w-0 lg:col-span-1 lg:sticky lg:top-6 h-fit self-start',
        columnClassName: 'w-full min-w-0 self-start lg:col-span-1 h-fit',
        panelClassName: 'w-full h-fit',
    },
};
