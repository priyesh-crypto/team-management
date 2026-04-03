export type Priority = 'Urgent' | 'High' | 'Medium' | 'Low';
export type Status = 'To Do' | 'In Progress' | 'In Review' | 'Completed' | 'Blocked';

export interface Task {
    id: string;
    name: string;
    employeeId: string;
    startDate: string;
    deadline: string;
    priority: Priority;
    hoursSpent: number;
    status: Status;
    notes: string;
    createdAt: string;
}

export interface Employee {
    id: string;
    name: string;
    email: string;
    password?: string;
    role: 'employee' | 'manager';
}

const defaultEmployees: Employee[] = [
    { id: '1', name: 'Alice Smith', email: 'alice@company.com', role: 'employee' },
    { id: '2', name: 'Bob Jones', email: 'bob@company.com', role: 'employee' },
    { id: '3', name: 'Charlie Brown', email: 'charlie@company.com', role: 'employee' },
    { id: 'admin', name: 'System Admin', email: 'admin@company.com', role: 'manager' }
];

const defaultTasks: Task[] = [
    {
        id: 't1',
        name: 'Designing Homepage',
        employeeId: '1',
        startDate: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0], // 3 days ago
        deadline: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0], // 2 days from now
        priority: 'High',
        hoursSpent: 5.5,
        status: 'In Progress',
        notes: 'Almost done with hero section.',
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString()
    },
    {
        id: 't2',
        name: 'Fixing Authentication Bug',
        employeeId: '2',
        startDate: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
        deadline: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0], // Overdue!
        priority: 'Urgent',
        hoursSpent: 9.5,
        status: 'In Progress',
        notes: 'Still trying to find the root cause in the middleware.',
        createdAt: new Date(Date.now() - 5 * 86400000).toISOString()
    },
    {
        id: 't3',
        name: 'Writing API Documentation',
        employeeId: '3',
        startDate: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
        deadline: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
        priority: 'Low',
        hoursSpent: 2,
        status: 'To Do',
        notes: 'Initial setup done.',
        createdAt: new Date(Date.now() - 1 * 86400000).toISOString()
    }
];

export const store = {
    getEmployees: (): Employee[] => {
        if (typeof window === 'undefined') return defaultEmployees;
        const data = localStorage.getItem('employees');
        if (!data) {
            localStorage.setItem('employees', JSON.stringify(defaultEmployees));
            return defaultEmployees;
        }
        const parsed = JSON.parse(data);

        // Migration: If the old data exists without emails, replace with new defaults
        if (parsed.length > 0 && !parsed[0].email) {
            localStorage.setItem('employees', JSON.stringify(defaultEmployees));
            return defaultEmployees;
        }

        return parsed;
    },

    saveEmployee: (emp: Employee) => {
        const employees = store.getEmployees();
        const index = employees.findIndex(e => e.id === emp.id);
        if (index > -1) {
            employees[index] = emp;
        } else {
            employees.push(emp);
        }
        localStorage.setItem('employees', JSON.stringify(employees));
    },

    deleteEmployee: (id: string) => {
        const employees = store.getEmployees().filter(e => e.id !== id);
        localStorage.setItem('employees', JSON.stringify(employees));
    },

    getTasks: (): Task[] => {
        if (typeof window === 'undefined') return defaultTasks;
        const data = localStorage.getItem('tasks');
        if (!data) {
            localStorage.setItem('tasks', JSON.stringify(defaultTasks));
            return defaultTasks;
        }
        return JSON.parse(data);
    },

    saveTask: (task: Task) => {
        const tasks = store.getTasks();
        const index = tasks.findIndex(t => t.id === task.id);
        if (index > -1) {
            tasks[index] = task;
        } else {
            tasks.push(task);
        }
        localStorage.setItem('tasks', JSON.stringify(tasks));
    },

    deleteTask: (id: string) => {
        const tasks = store.getTasks().filter(t => t.id !== id);
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }
};
