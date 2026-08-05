'use client';

import {
    OIL_PAYMENT_METHOD_OPTIONS,
    OIL_PAYMENT_TYPE_OPTIONS,
    isOilPayablePaymentMode,
    normalizeOilPaymentMethod,
    normalizeOilPaymentType,
} from '../utils/vehicleOilServiceDetailForm';

function SegmentedToggle({ options, value, onChange, disabled, selectedFallback }) {
    const selected = value || selectedFallback;
    return (
        <div className="inline-flex w-full flex-wrap gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {options.map((opt) => (
                <button
                    key={opt.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(opt.id)}
                    className={`min-w-0 flex-1 rounded-md px-1.5 py-1.5 text-[11px] font-bold transition-all sm:text-xs ${
                        selected === opt.id
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                    } disabled:opacity-60`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

/**
 * Payment Type + Payment Method (+ warranty expiry) for shop initiate forms.
 * Mirrors Oil Service controls without changing Oil Service itself.
 */
export default function VehicleServicePaymentTypeMethodFields({
    FieldCell,
    accent,
    fieldMinHeightPx,
    formData,
    onChange,
    disabled = false,
    warrantyExpiryLabel = '—',
    fieldInputClassName = '',
}) {
    const cashPaymentMode = isOilPayablePaymentMode(formData?.amountMode);

    const setAmountMode = (mode) => {
        const type = normalizeOilPaymentType(mode) || mode;
        if (typeof onChange === 'function') {
            onChange('amountMode', type);
            if (type === 'warranty') {
                onChange('paymentMethod', '');
            } else if (!normalizeOilPaymentMethod(formData?.paymentMethod)) {
                onChange('paymentMethod', 'cash');
            }
        }
    };

    return (
        <>
            <FieldCell label="Payment Type" accentClass={accent(0)} minHeightPx={fieldMinHeightPx}>
                <SegmentedToggle
                    options={OIL_PAYMENT_TYPE_OPTIONS}
                    value={normalizeOilPaymentType(formData?.amountMode)}
                    selectedFallback="amount"
                    onChange={setAmountMode}
                    disabled={disabled}
                />
            </FieldCell>
            <FieldCell label="Payment Method" accentClass={accent(1)} minHeightPx={fieldMinHeightPx}>
                {cashPaymentMode ? (
                    <SegmentedToggle
                        options={OIL_PAYMENT_METHOD_OPTIONS}
                        value={normalizeOilPaymentMethod(formData?.paymentMethod)}
                        selectedFallback="cash"
                        onChange={(mode) => onChange?.('paymentMethod', mode)}
                        disabled={disabled}
                    />
                ) : (
                    <input
                        className={`${fieldInputClassName} opacity-60`.trim()}
                        type="text"
                        readOnly
                        value="—"
                        disabled
                    />
                )}
            </FieldCell>
            <FieldCell label="Warranty Expiry" accentClass={accent(2)} minHeightPx={fieldMinHeightPx}>
                <input
                    className={`${fieldInputClassName} ${cashPaymentMode ? 'opacity-60' : ''}`.trim()}
                    type="text"
                    readOnly
                    value={warrantyExpiryLabel || '—'}
                    disabled
                />
            </FieldCell>
        </>
    );
}

export { SegmentedToggle };
