import assert from 'node:assert/strict';
import test from 'node:test';
import { clusterWorkOrderTasks, visibleWorkOrderLeaves, workOrderPendingTitle } from './workOrderTaskLabel.js';

function task(partial) {
    return {
        actionId: partial.actionId,
        requestType: partial.requestType,
        workOrderNo: 'WO-26-006',
        status: partial.status,
        taskName: partial.taskName,
        requestDate: partial.requestDate || '2026-11-28T10:00:00.000Z',
    };
}

test('a work order with open tasks lists only the pending steps', () => {
    const created = task({ actionId: 'root', requestType: 'Work Order Project', status: 'Pending', taskName: 'New work order created' });
    const cancelled = task({ actionId: 'kick', requestType: 'Work Order Checklist', status: 'Cancelled', taskName: 'Sales kick off' });
    const lpo = task({ actionId: 'lpo', requestType: 'Work Order LPO', status: 'Pending', taskName: 'LPO' });
    const boq = task({ actionId: 'boq', requestType: 'Work Order Actual BOQ', status: 'Pending', taskName: 'BOQ' });
    const blocks = clusterWorkOrderTasks([created, cancelled, lpo, boq]);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, 'tree');
    assert.deepEqual(blocks[0].leaves.map((row) => row.actionId).sort(), ['boq', 'lpo']);
});

test('a submitted MOM is a pending approval under the work order', () => {
    const mom = task({ actionId: 'mom', requestType: 'Work Order MOM', status: 'Pending', taskName: 'Approve the MOM on WO-26-006' });
    assert.equal(workOrderPendingTitle(mom, 'Raseel M'), 'MOM pending with Raseel M');
});

test('a cancelled-only list still shows those finished tasks', () => {
    const leaves = [
        task({ actionId: 'kick', requestType: 'Work Order Checklist', status: 'Cancelled', taskName: 'Sales kick off' }),
        task({ actionId: 'mom', requestType: 'Work Order Checklist', status: 'Cancelled', taskName: 'MOM' }),
    ];
    assert.equal(visibleWorkOrderLeaves(leaves, false).length, 2);
});
