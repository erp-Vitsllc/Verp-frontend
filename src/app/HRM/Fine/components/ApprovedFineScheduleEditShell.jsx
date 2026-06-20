'use client';

/**
 * Locks all form controls except wrappers marked with data-schedule-field or data-accessory-remove-field.
 */
export default function ApprovedFineScheduleEditShell({ scheduleOnlyEdit, assetControllerOnlyEdit, children }) {
    if (!scheduleOnlyEdit && !assetControllerOnlyEdit) return children;

    const showMsg = scheduleOnlyEdit ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This fine is approved. Only <strong>Payable From</strong> and <strong>Duration</strong> can be
            edited by HR.
        </div>
    ) : (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            This fine is approved. Only <strong>Accessory Removal</strong> can be performed by the Asset Controller.
        </div>
    );

    return (
        <div className="space-y-5">
            {showMsg}
            <div className="space-y-5 approved-fine-schedule-locked">
                <style
                    dangerouslySetInnerHTML={{
                        __html: `
                    .approved-fine-schedule-locked input:not([type='hidden']),
                    .approved-fine-schedule-locked select,
                    .approved-fine-schedule-locked textarea,
                    .approved-fine-schedule-locked button {
                        pointer-events: none;
                        opacity: 0.55;
                    }
                    ${scheduleOnlyEdit ? `
                    .approved-fine-schedule-locked [data-schedule-field],
                    .approved-fine-schedule-locked [data-schedule-field] * {
                        pointer-events: auto !important;
                        opacity: 1 !important;
                    }
                    .approved-fine-schedule-locked [data-schedule-field] {
                        position: relative;
                        z-index: 2;
                    }
                    ` : ''}
                    ${assetControllerOnlyEdit ? `
                    .approved-fine-schedule-locked [data-accessory-remove-field],
                    .approved-fine-schedule-locked [data-accessory-remove-field] * {
                        pointer-events: auto !important;
                        opacity: 1 !important;
                    }
                    .approved-fine-schedule-locked [data-accessory-remove-field] {
                        position: relative;
                        z-index: 2;
                    }
                    ` : ''}
                `,
                    }}
                />
                {children}
            </div>
        </div>
    );
}
