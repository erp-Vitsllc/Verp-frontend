'use client';

/**
 * Shared bright blue panel (employee profile + employment summary) with corner orbs.
 */
export default function EmployeeHeroCardBackground() {
    return (
        <>
            <div className="pointer-events-none absolute inset-0 bg-[#00A3FF]" aria-hidden />
            <div
                className="pointer-events-none absolute -bottom-28 -left-20 h-[288px] w-[288px] rounded-full bg-[#007ACC]/55"
                aria-hidden
            />
            <div
                className="pointer-events-none absolute -right-16 -top-24 h-60 w-60 rounded-full bg-[#5EC4FF]/45"
                aria-hidden
            />
        </>
    );
}
