import Link from 'next/link';

/**
 * Shown when `notFound()` is called for this employee route.
 */
export default function EmployeeProfileNotFound() {
    return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-400">404</p>
            <p className="text-sm text-gray-600 max-w-md">Some server error. Please try again.</p>
            <Link
                href="/emp"
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
                Back to employees
            </Link>
        </div>
    );
}
