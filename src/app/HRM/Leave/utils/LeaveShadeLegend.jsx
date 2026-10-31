export function LeaveShadeLegend({ className = '' }) {
    return (
        <div className={`flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 ${className}`}>
            <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-md border border-slate-300 bg-slate-200" />
                Closed
            </span>
            <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-md border border-emerald-200 bg-emerald-100" />
                You can apply
            </span>
            <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-md border border-amber-200 bg-amber-100" />
                Within 2 days of leave
            </span>
        </div>
    );
}
