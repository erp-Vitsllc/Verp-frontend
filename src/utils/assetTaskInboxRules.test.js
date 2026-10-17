import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    isExpiryFollowUpTaskInboxRow,
    isLegacyVehicleNameExpiryRow,
    taskInboxIdentity,
} from './assetTaskInboxRules.js';

describe('vehicle pending task rows', () => {
    it('drops an expiry follow-up task and keeps the vehicle reminder', () => {
        const notice = {
            requestType: 'Task Manager',
            extra1: 'Expiry follow-up required: Mulkia (Registration) (Exp: 21/10/2026)',
            extra3: JSON.stringify({ module: 'vehicle', reassignedNotice: true, taskManagerId: 'abc' }),
        };
        const reminder = {
            requestType: 'Vehicle Document Expiry Reminder',
            extra1: 'Expiry follow-up required: Mulkia (Registration) (Exp: 21/10/2026)',
        };
        assert.equal(isExpiryFollowUpTaskInboxRow(notice), true);
        assert.equal(isExpiryFollowUpTaskInboxRow(reminder), false);
    });

    it('drops a finished name-only vehicle reminder and keeps a live document reminder', () => {
        const finished = {
            requestType: 'Vehicle Document Expiry Reminder',
            extra1: 'YARIS (VEGA-VHCL-006)',
            subjectName: 'YARIS',
            subjectEmployeeId: 'VEGA-VHCL-006',
        };
        const live = {
            requestType: 'Vehicle Document Expiry Reminder',
            extra1: 'Expiry follow-up required: Insurance Card (Exp: 18/10/2026)',
            subjectName: 'YARIS',
            subjectEmployeeId: 'VEGA-VHCL-006',
        };
        assert.equal(isLegacyVehicleNameExpiryRow(finished), true);
        assert.equal(isLegacyVehicleNameExpiryRow(live), false);
    });

    it('treats two notices for the same task as one', () => {
        const extra3 = JSON.stringify({ taskManagerId: 'task-1', taskKey: 'action-1' });
        assert.equal(taskInboxIdentity({ extra3 }), taskInboxIdentity({ extra3: { taskManagerId: 'task-1' } }));
    });
});
