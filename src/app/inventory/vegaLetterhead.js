const LETTERHEAD_URL = '/assets/vega_letterhead.png?v=2';

let letterheadUrl;

export function loadVegaLetterhead() {
    if (!letterheadUrl) {
        letterheadUrl = fetch(LETTERHEAD_URL)
            .then((response) => {
                if (!response.ok) throw new Error('Could not load the company letterhead.');
                return response.blob();
            })
            .then(async (blob) => {
                const bytes = new Uint8Array(await blob.arrayBuffer());
                let binary = '';
                const chunk = 0x8000;
                for (let index = 0; index < bytes.length; index += chunk) {
                    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
                }
                const type = blob.type || 'image/png';
                return `data:${type};base64,${btoa(binary)}`;
            });
    }
    return letterheadUrl;
}

export function paintVegaLetterhead(pdf, dataUrl) {
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    pdf.addImage(dataUrl, 'PNG', 0, 0, pageW, pageH, 'vega-letterhead', 'FAST');
}
