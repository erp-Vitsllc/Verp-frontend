'use client';

export function formatMoney(value) {
    return Number(value || 0).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
}

export function FineFormCard({ icon: Icon, iconBg, iconColor, title, subtitle, children, className = '' }) {
    return (
        <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col w-full overflow-hidden ${className}`}>
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-4">
                <div className={`p-2.5 rounded-xl shrink-0 ${iconBg} ${iconColor}`}>
                    <Icon size={24} />
                </div>
                <div className="min-w-0">
                    <h4 className="text-lg font-bold text-gray-800">{title}</h4>
                    {subtitle ? <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p> : null}
                </div>
            </div>
            {children}
        </div>
    );
}

export function DetailField({ label, value, valueClassName = 'font-semibold text-gray-800' }) {
    return (
        <div>
            <span className="text-xs text-gray-400 block font-medium mb-0.5">{label}</span>
            <span className={`text-sm block ${valueClassName}`}>{value ?? '—'}</span>
        </div>
    );
}

export function DetailGrid({ children, columns = 2 }) {
    const gridClass =
        columns === 4
            ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-y-4 gap-x-6'
            : 'grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6';
    return <div className={gridClass}>{children}</div>;
}

export function SectionDivider({ title }) {
    if (!title) return <div className="border-t border-gray-100 my-4" />;
    return (
        <div className="border-t border-gray-100 pt-4 mt-4 mb-4">
            <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{title}</h5>
        </div>
    );
}

export function NoteBox({ children }) {
    return (
        <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-700 leading-relaxed text-justify bg-gray-50 p-4 rounded-xl border border-gray-100">
                {children}
            </p>
        </div>
    );
}

export function SignatureBox({ label, name, signed }) {
    return (
        <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 flex flex-col min-h-[88px]">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center mb-3">
                {label}
            </p>
            <div className="flex-1 flex items-end justify-center">
                {signed && name ? (
                    <span className="text-xs font-bold text-gray-800 uppercase text-center border-t border-gray-300 pt-2 w-full">
                        {name}
                    </span>
                ) : null}
            </div>
        </div>
    );
}

export function formatDeductionMonth(value) {
    if (!value || value === '-') return '—';
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    if (value.includes('/')) {
        const [m, y] = value.split('/');
        const month = parseInt(m, 10);
        const year = parseInt(y, 10);
        if (month >= 1 && month <= 12 && year) {
            return `${monthNames[month - 1]} ${String(year).slice(-2)}`;
        }
    }

    if (value.includes('-')) {
        const parts = value.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        if (month >= 1 && month <= 12 && year) {
            return `${monthNames[month - 1]} ${String(year).slice(-2)}`;
        }
    }

    return value;
}

export function formatServiceTenure(joinDate) {
    if (!joinDate) return '—';
    const start = new Date(joinDate);
    if (Number.isNaN(start.getTime())) return '—';
    const end = new Date();
    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    if (end.getDate() < start.getDate()) months -= 1;
    if (months < 0) {
        years -= 1;
        months += 12;
    }
    const parts = [];
    if (years > 0) parts.push(`${years} year${years !== 1 ? 's' : ''}`);
    if (months > 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
    return parts.length ? parts.join(' ') : '0 months';
}
