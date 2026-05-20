'use client';

/**
 * Catches runtime errors in this route segment (e.g. employee profile tabs).
 */
export default function EmployeeProfileError({ error, reset }) {
    return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <h1 className="text-xl font-semibold text-gray-900">Unable to load this page</h1>
            <p className="text-sm text-gray-600 max-w-md">
                Some server error. Please try again.
            </p>
            {process.env.NODE_ENV === 'development' && error?.message ? (
                <p className="text-xs font-mono text-red-600 max-w-lg break-words">{error.message}</p>
            ) : null}
            <button
                type="button"
                onClick={() => reset()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
                Try again
            </button>
        </div>
    );
}
