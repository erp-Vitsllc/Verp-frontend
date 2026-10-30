export function LeaveShadeLegend({ className = '' }) {
    return (
        <div className={`flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-600 ${className}`}>
            <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#e5e7eb]" />
                Closed
            </span>
            <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#dcfce7]" />
                You can apply
            </span>
            <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#fef9c3]" />
                Within 2 days of leave
            </span>
        </div>
    );
}
