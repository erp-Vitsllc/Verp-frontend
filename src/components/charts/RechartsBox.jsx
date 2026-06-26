'use client';

import { useEffect, useRef, useState } from 'react';
import { ResponsiveContainer } from 'recharts';

/**
 * Recharts needs a parent with positive width/height. Measures the box and passes pixel dimensions.
 */
export default function RechartsBox({
    height = 280,
    minHeight = 180,
    minWidth = 0,
    className = '',
    children,
}) {
    const ref = useRef(null);
    const [size, setSize] = useState(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const check = () => {
            const rect = el.getBoundingClientRect();
            const width = Math.max(minWidth, Math.floor(rect.width));
            const measuredHeight = Math.max(minHeight, Math.floor(rect.height));
            if (width > 0 && measuredHeight > 0) {
                setSize((prev) =>
                    prev?.width === width && prev?.height === measuredHeight
                        ? prev
                        : { width, height: measuredHeight },
                );
            }
        };

        check();
        const ro = new ResizeObserver(check);
        ro.observe(el);
        return () => ro.disconnect();
    }, [minWidth, minHeight]);

    return (
        <div
            ref={ref}
            className={`w-full min-w-0 ${className}`.trim()}
            style={{ height, minHeight, minWidth: minWidth > 0 ? minWidth : undefined }}
        >
            {size ? (
                <ResponsiveContainer width={size.width} height={size.height}>
                    {children}
                </ResponsiveContainer>
            ) : null}
        </div>
    );
}
