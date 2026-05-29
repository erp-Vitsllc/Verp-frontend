'use client';

import { useEffect, useRef, useState } from 'react';
import { ResponsiveContainer } from 'recharts';

/**
 * Recharts needs a parent with positive width/height. This waits until the box is measurable.
 */
export default function RechartsBox({
    height = 280,
    minHeight = 180,
    minWidth = 0,
    className = '',
    children,
}) {
    const ref = useRef(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const check = () => {
            const { width, height: h } = el.getBoundingClientRect();
            setReady(width > 0 && h > 0);
        };

        check();
        const ro = new ResizeObserver(check);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            className={`w-full min-w-0 ${className}`.trim()}
            style={{ height, minHeight }}
        >
            {ready ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={minWidth} minHeight={minHeight}>
                    {children}
                </ResponsiveContainer>
            ) : null}
        </div>
    );
}
