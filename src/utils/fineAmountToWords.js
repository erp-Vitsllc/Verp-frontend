/** Mirrors backend buildAssetLossFineEmailFields.parseAmountForWords / amountToWords */

export function parseAmountForWords(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number') return Math.floor(Math.abs(value));
    const cleaned = String(value).replace(/,/g, '').replace(/\s*AED\s*/gi, '').trim();
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? Math.floor(Math.abs(parsed)) : 0;
}

export function amountToWords(n) {
    const num = parseAmountForWords(n);
    if (num === 0) return 'ZERO';
    const ones = [
        '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
        'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
        'SEVENTEEN', 'EIGHTEEN', 'NINETEEN',
    ];
    const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

    const under1000 = (x) => {
        if (x < 20) return ones[x];
        if (x < 100) {
            const t = tens[Math.floor(x / 10)];
            const o = x % 10 ? ` ${ones[x % 10]}` : '';
            return `${t}${o}`.trim();
        }
        const h = ones[Math.floor(x / 100)];
        const rem = x % 100;
        return `${h} HUNDRED${rem ? ` ${under1000(rem)}` : ''}`;
    };

    const underMillion = (x) => {
        if (x < 1000) return under1000(x);
        const th = Math.floor(x / 1000);
        const rem = x % 1000;
        return `${under1000(th)} THOUSAND${rem ? ` ${under1000(rem)}` : ''}`.trim();
    };

    if (num < 1000000) return underMillion(num);
    const millions = Math.floor(num / 1000000);
    const rem = num % 1000000;
    return `${underMillion(millions)} MILLION${rem ? ` ${underMillion(rem)}` : ''}`.trim();
}

export function buildAssetLossFineAcknowledgementText(employeeName, payableAmount) {
    const name = String(employeeName || '—').trim() || '—';
    const amountWords = amountToWords(payableAmount);
    return (
        `I, Mr./Ms. ${name}, acknowledge that the fine mentioned above has been committed due to my responsibility. ` +
        `I understand and accept that I am accountable for the amount of (${amountWords} DIRHAMS). ` +
        `I hereby authorize the deduction of the specified amount as mentioned from the source of income.`
    );
}
