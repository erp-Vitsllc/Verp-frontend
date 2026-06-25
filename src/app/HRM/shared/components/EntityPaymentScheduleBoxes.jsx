'use client';

function formatAmount(value) {
    return (parseFloat(value) || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function ScheduleBox({ box }) {
    const boxClass = box.isPaid
        ? 'bg-green-50 border-green-500'
        : box.isPartial
            ? 'bg-amber-50 border-amber-500'
            : box.isEos
                ? 'bg-amber-50 border-amber-400'
                : 'bg-red-50 border-red-500';

    const labelClass = box.isPaid
        ? 'text-green-700'
        : box.isPartial
            ? 'text-amber-700'
            : box.isEos
                ? 'text-amber-700'
                : 'text-red-700';

    return (
        <div className={`p-4 rounded-xl border-2 transition-all ${boxClass}`}>
            <div className={`text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between ${labelClass}`}>
                <span>{box.label}</span>
                {box.isPaid ? (
                    <span className="text-green-600 bg-green-100 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                        ✓
                    </span>
                ) : box.isPartial ? (
                    <span className="text-amber-600 bg-amber-100 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                        ~
                    </span>
                ) : (
                    <span className="text-red-600 bg-red-100 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                        ✗
                    </span>
                )}
            </div>
            <div className={`text-sm font-bold mb-1 ${labelClass}`}>
                {formatAmount(box.paidAmount)}
                {' '}
                <span className="text-xs font-normal text-gray-500">
                    / {formatAmount(box.monthlyAmount)} AED
                </span>
            </div>
            {!box.isPaid ? (
                <div className={`text-[10px] font-medium mt-2 ${box.isPartial ? 'text-amber-600/80' : 'text-red-600/80'}`}>
                    Remaining: {formatAmount(box.remaining)} AED
                </div>
            ) : null}
        </div>
    );
}

export default function EntityPaymentScheduleBoxes({ boxes = [], eosBoxes = [] }) {
    const salaryBoxes = boxes.filter((b) => !b.isEos);
    const eosOnly = eosBoxes.length > 0 ? eosBoxes : boxes.filter((b) => b.isEos);

    if (salaryBoxes.length === 0 && eosOnly.length === 0) return null;

    return (
        <div className="mb-6 p-4 bg-gray-50/80 border border-gray-100 rounded-2xl">
            <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                Payment Schedule
            </h3>
            <p className="text-xs text-gray-500 mb-4">
                Installment status for this item (green = paid, amber = partial, red = unpaid)
            </p>
            {salaryBoxes.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {salaryBoxes.map((box) => (
                        <ScheduleBox key={box.key} box={box} />
                    ))}
                </div>
            ) : null}
            {eosOnly.length > 0 ? (
                <div className={salaryBoxes.length > 0 ? 'mt-4' : ''}>
                    {salaryBoxes.length > 0 ? (
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-2">
                            End of Service (separate payment)
                        </p>
                    ) : null}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {eosOnly.map((box) => (
                            <ScheduleBox key={box.key} box={box} />
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
