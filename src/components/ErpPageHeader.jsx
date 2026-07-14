'use client';

/**
 * Standard list-page header. Back control lives in the global Navbar.
 * Scales for phone → laptop → large monitor; children stay visible (wrap, never hide).
 */
export default function ErpPageHeader({ title, subtitle, children }) {
    return (
        <div className="flex flex-col gap-3 mb-4 sm:mb-6 lg:mb-8 xl:flex-row xl:items-center xl:justify-between xl:gap-4">
            <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 mb-1 sm:mb-2 leading-tight">
                    {title}
                </h1>
                {subtitle ? (
                    <p className="text-xs sm:text-sm lg:text-base text-gray-600 break-words">{subtitle}</p>
                ) : null}
            </div>
            {children ? (
                <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 flex-wrap w-full xl:w-auto xl:shrink-0 xl:justify-end">
                    {children}
                </div>
            ) : null}
        </div>
    );
}
