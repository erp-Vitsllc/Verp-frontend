import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { employeeListName, listedTaskNameLines, personKey, requesterEmployeeName, taskRolePeople } from './taskRolePeople.js';

const tasks = [
    {
        taskName: 'Mulkia expiry',
        requesterBaseName: 'Farsana Ashraf',
        requesterName: 'Adarsh Sundaresan (Farsana Ashraf)',
        assigneeName: 'Raseel Muhammad (Raj Angadembe)',
        originalAssigneeName: 'Raj Angadembe',
        mainAssigneeName: 'Raj Angadembe',
        reassignedAssigneeName: 'Raseel Muhammad',
    },
    {
        taskName: 'Tool acknowledgement',
        requesterBaseName: 'Asset system',
        requesterName: 'Asset system',
        assigneeName: 'System',
        originalAssigneeName: '',
    },
    {
        taskName: 'Leave request',
        requesterName: 'Vishnu Prasad (Melvin Shijo Tharsis)',
        assigneeName: 'Akash Mohanan Pillai',
        originalAssigneeName: '',
    },
];

describe('task role dropdown people', () => {
    it('lists requesters who requested at least one task, not the original assignee or system', () => {
        const names = taskRolePeople(tasks, 'requester').map((person) => person.name);
        assert.deepEqual(names, ['Farsana Ashraf', 'Melvin Shijo Tharsis']);
    });

    it('lists assignees who have at least one assignment, including the original holder', () => {
        const names = taskRolePeople(tasks, 'assignee').map((person) => person.name);
        assert.deepEqual(names, ['Akash Mohanan Pillai', 'Raj Angadembe', 'Raseel Muhammad']);
    });

    it('matches a requester filter to the employee who requested, not the display label', () => {
        assert.equal(personKey(requesterEmployeeName(tasks[0])), 'farsana ashraf');
        assert.equal(personKey(requesterEmployeeName(tasks[2])), 'melvin shijo tharsis');
    });

    it('shows a first name and the first letter of the second name', () => {
        assert.equal(employeeListName('VISHNU PRASAD'), 'VISHNU P');
        assert.equal(employeeListName('Raseel Muhammad'), 'Raseel M');
        assert.equal(employeeListName('Akash Mohanan Pillai'), 'Akash M');
        assert.equal(employeeListName('NESMI'), 'NESMI');
    });

    it('shortens only the employee name under the task title', () => {
        const shown = listedTaskNameLines(
            { subjectName: 'ZEESHAN MUHAMMAD', requesterName: 'NESMI SHAMSUDEEN' },
            ['Hour Approval Request', 'Oct 29, 2026', 'ZEESHAN MUHAMMAD', 'VEGA-HR-00078'],
        );
        assert.deepEqual(shown, ['Hour Approval Request', 'Oct 29, 2026', 'ZEESHAN M', 'VEGA-HR-00078']);
    });

    it('hides an employee who has no task in that role', () => {
        const requesters = taskRolePeople(tasks, 'requester').map((person) => person.key);
        const assignees = taskRolePeople(tasks, 'assignee').map((person) => person.key);
        assert.equal(requesters.includes('adarsh sundaresan'), false);
        assert.equal(requesters.includes('akash mohanan pillai'), false);
        assert.equal(assignees.includes('farsana ashraf'), false);
        assert.equal(assignees.includes('asset system'), false);
    });
});
