/** Floral light-shade palette for fleet analytics charts. */
export const FLORAL = {
    rose: '#e8b4bc',
    roseDeep: '#d4919c',
    sage: '#b8d4b8',
    sageDeep: '#9bc49b',
    lavender: '#c9b8e0',
    lavenderDeep: '#b09fd4',
    peach: '#f5d0b8',
    peachDeep: '#e8b896',
    mint: '#b8ddd4',
    mintDeep: '#9dcec3',
    sky: '#b8d4e8',
    skyDeep: '#9bbfd9',
    cream: '#ffffff',
    panel: '#ffffff',
    border: '#e5e7eb',
    text: '#5c4f55',
    textMuted: '#9a8a90',
    overdue: '#e8a4a4',
    onTime: '#a8c8e8',
};

export const FLORAL_CLASS_COLORS = [
    FLORAL.lavenderDeep,
    FLORAL.peachDeep,
    FLORAL.sageDeep,
    FLORAL.skyDeep,
    FLORAL.roseDeep,
    FLORAL.mintDeep,
    '#d4b8c8',
    '#c8d4b8',
];

export const FLORAL_DEPT_COLORS = [
    FLORAL.sky,
    FLORAL.peach,
    FLORAL.sage,
    FLORAL.lavender,
    FLORAL.mint,
    FLORAL.rose,
    '#e8d4b8',
    '#d4e8e0',
];

export const floralTooltipStyle = {
    borderRadius: '12px',
    border: `1px solid ${FLORAL.border}`,
    background: FLORAL.panel,
    boxShadow: '0 8px 24px rgba(92, 79, 85, 0.1)',
    fontSize: '12px',
    color: FLORAL.text,
};

export const floralPanelClass =
    'rounded-2xl border shadow-sm p-4 md:p-5 transition-shadow hover:shadow-md';

export const floralPanelStyle = {
    background: FLORAL.panel,
    borderColor: FLORAL.border,
};
