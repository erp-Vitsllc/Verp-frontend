'use client';

export const ERP_USER_ERROR_MESSAGE =
    'Oops, something went wrong. Please send this screenshot to erpadmin@vegadigital.ae.';

/** Standard ERP page error banner — shown under the navbar inside AppPageShell. */
export default function ErpErrorBanner({ message, onRetry, className = '' }) {
    const displayMessage = String(message || '').trim() || ERP_USER_ERROR_MESSAGE;

    return (
        <div
            role="alert"
            className={`rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 ${className}`.trim()}
        >
            <p className="font-semibold leading-relaxed">{displayMessage}</p>
            {onRetry ? (
                <button
                    type="button"
                    onClick={onRetry}
                    className="mt-2 text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-900"
                >
                    Try again
                </button>
            ) : null}
        </div>
    );
}
