'use client';

/**
 * Standard list-page header. Back control lives in the global Navbar.
 */
export default function ErpPageHeader({ title, subtitle, children }) {
    return (
        <div className="flex items-center justify-between mb-6 gap-4">
            <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">{title}</h1>
                {subtitle ? <p className="text-gray-600">{subtitle}</p> : null}
            </div>
            {children ? (
                <div className="flex items-center gap-4 shrink-0 flex-wrap justify-end">{children}</div>
            ) : null}
        </div>
    );
}
