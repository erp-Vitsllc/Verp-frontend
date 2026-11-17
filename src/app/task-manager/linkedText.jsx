function linkHref(value) {
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function linkParts(text) {
    const source = String(text || '');
    const parts = [];
    let last = 0;
    for (const match of source.matchAll(/\b(?:https?:\/\/|www\.)[^\s<>"']+/gi)) {
        const start = match.index ?? 0;
        if (start > last) parts.push({ type: 'text', value: source.slice(last, start) });
        let value = match[0];
        let trailing = '';
        while (value && /[),.;:!?]$/.test(value)) {
            trailing = value.slice(-1) + trailing;
            value = value.slice(0, -1);
        }
        if (value) parts.push({ type: 'link', value });
        if (trailing) parts.push({ type: 'text', value: trailing });
        last = start + match[0].length;
    }
    if (last < source.length) parts.push({ type: 'text', value: source.slice(last) });
    return parts;
}

export default function LinkedText({ text, className = 'whitespace-pre-wrap text-sm text-slate-700' }) {
    return (
        <p className={className}>
            {linkParts(text).map((part, index) => (
                part.type === 'link' ? (
                    <a
                        key={`${part.value}-${index}`}
                        href={linkHref(part.value)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[#2563EB] underline"
                        onClick={(event) => event.stopPropagation()}
                    >
                        {part.value}
                    </a>
                ) : (
                    <span key={`text-${index}`}>{part.value}</span>
                )
            ))}
        </p>
    );
}
