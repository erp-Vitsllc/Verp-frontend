import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { summaryIdentityForMonth } from './utilityEntryMonthDetails.js';

const entry = {
    id: 'sim-1',
    values: { accountNumber: '0500000000', monthlyRental: 80, provider: 'Du' },
    assignedTo: 'FARSANA ASHRAF',
    assignedToType: 'Employee',
    assignedToId: 'VEGA-HR-00035',
    detailRevisions: [
        {
            fromMonth: '0000-01',
            values: { accountNumber: '0521981385', monthlyRental: 50, provider: 'Etisalat' },
            assignedTo: 'ZEESHAN MUHAMMAD',
            assignedToType: 'Employee',
            assignedToId: 'VEGA-HR-00018',
        },
        {
            fromMonth: '2026-09',
            values: { accountNumber: '0500000000', monthlyRental: 80, provider: 'Du' },
            assignedTo: 'FARSANA ASHRAF',
            assignedToType: 'Employee',
            assignedToId: 'VEGA-HR-00035',
        },
    ],
};

describe('summary month identity', () => {
    it('keeps a past month on the details from before the edit', () => {
        const row = summaryIdentityForMonth(entry, '2026-07', null, '2026-09');
        assert.equal(row.assigneeName, 'ZEESHAN MUHAMMAD');
        assert.equal(row.accountNo, '0521981385');
        assert.equal(row.contractAmount, 50);
        assert.equal(row.isCurrent, false);
    });

    it('shows the edited details on the open bill month', () => {
        const row = summaryIdentityForMonth(
            entry,
            '2026-09',
            { accountNo: '0521981385', monthlyRental: 50, amount: 75 },
            '2026-09',
        );
        assert.equal(row.assigneeName, 'FARSANA ASHRAF');
        assert.equal(row.accountNo, '0500000000');
        assert.equal(row.contractAmount, 80);
        assert.equal(row.isCurrent, true);
    });

    it('keeps a past billed contract and account, and the assignee from that month', () => {
        const row = summaryIdentityForMonth(
            entry,
            '2026-07',
            { accountNo: '0521981385', monthlyRental: 50, amount: 75 },
            '2026-09',
        );
        assert.equal(row.assigneeName, 'ZEESHAN MUHAMMAD');
        assert.equal(row.accountNo, '0521981385');
        assert.equal(row.contractAmount, 50);
    });

    it('uses the revision that was in effect for a later past month', () => {
        const next = {
            ...entry,
            values: { accountNumber: '0511111111', monthlyRental: 100, provider: 'Du' },
            assignedTo: 'NEW PERSON',
            detailRevisions: [
                ...entry.detailRevisions,
                {
                    fromMonth: '2026-10',
                    values: { accountNumber: '0511111111', monthlyRental: 100 },
                    assignedTo: 'NEW PERSON',
                    assignedToType: 'Employee',
                    assignedToId: 'VEGA-HR-00099',
                },
            ],
        };
        const september = summaryIdentityForMonth(next, '2026-09', null, '2026-10');
        const october = summaryIdentityForMonth(next, '2026-10', null, '2026-10');
        assert.equal(september.assigneeName, 'FARSANA ASHRAF');
        assert.equal(september.contractAmount, 80);
        assert.equal(october.assigneeName, 'NEW PERSON');
        assert.equal(october.contractAmount, 100);
    });
});
