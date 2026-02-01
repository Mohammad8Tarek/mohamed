
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '../test-utils';
import EmployeesPage from './EmployeesPage';
import { employeeApi, logActivity } from '../services/apiService';
import '@testing-library/jest-dom';
import type { Employee } from '../types';
import * as Auth from '../hooks/useAuth';

// Mock the API module and other dependencies
jest.mock('../services/apiService', () => {
    const originalModule = jest.requireActual<typeof import('../services/apiService')>('../services/apiService');
    return {
        ...originalModule,
        employeeApi: {
            getAll: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        // FIX: Moved mock implementation to `beforeEach` to resolve type inference issues.
        logActivity: jest.fn(),
    };
});

// FIX: Replace generic type assertion with explicit types for each mock function to ensure correct type inference.
const mockedEmployeeApi = {
    getAll: employeeApi.getAll as jest.Mock<typeof employeeApi.getAll>,
    create: employeeApi.create as jest.Mock<typeof employeeApi.create>,
    update: employeeApi.update as jest.Mock<typeof employeeApi.update>,
    delete: employeeApi.delete as jest.Mock<typeof employeeApi.delete>,
};
// FIX: The mock for logActivity was weakly typed, causing type inference errors downstream. Providing the function signature from the original module resolves the issue.
const mockedLogActivity = logActivity as jest.Mock<typeof logActivity>;

// Mock useAuth to provide an admin user
const mockUseAuth = jest.spyOn(Auth, 'useAuth');

/**
 * Fix: Added missing 'contractStartDate', 'workLocation', 'address', and 'dateOfBirth' to all mock employees to satisfy the mandatory fields in the interface.
 */
const mockEmployees: Employee[] = [
    { id: 1, propertyId: 1, employeeId: 'EMP001', firstName: 'John', lastName: 'Doe', nationalId: '123456789', jobTitle: 'Developer', phone: '111', department: 'it', status: 'active', contractStartDate: '2022-01-01T00:00:00.000Z', contractEndDate: '2025-01-01T00:00:00.000Z', workLocation: 'Main Building', address: '123 Street', dateOfBirth: '1990-01-01' },
    { id: 2, propertyId: 1, employeeId: 'EMP002', firstName: 'Jane', lastName: 'Smith', nationalId: '987654321', jobTitle: 'HR Manager', phone: '222', department: 'hr', status: 'active', contractStartDate: '2023-01-01T00:00:00.000Z', contractEndDate: '2025-01-01T00:00:00.000Z', workLocation: 'Main Building', address: '456 Avenue', dateOfBirth: '1992-05-15' },
    { id: 3, propertyId: 1, employeeId: 'EMP003', firstName: 'Peter', lastName: 'Jones', nationalId: '112233445', jobTitle: 'Designer', phone: '333', department: 'marketing', status: 'left', contractStartDate: '2020-01-01T00:00:00.000Z', contractEndDate: '2023-01-01T00:00:00.000Z', workLocation: 'Beach Side', address: '789 Road', dateOfBirth: '1988-11-20' },
];

describe('EmployeesPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedEmployeeApi.getAll.mockResolvedValue([...mockEmployees]);
        // FIX: Provide a valid ActivityLog object to match the function's return type.
        mockedLogActivity.mockResolvedValue({ id: 1, propertyId: 1, username: 'test-user', action: 'test action', timestamp: new Date().toISOString() } as any);
        mockUseAuth.mockReturnValue({
            user: { id: 1, propertyId: 1, username: 'testadmin', roles: ['admin'], status: 'active' } as any,
            loading: false,
            login: jest.fn(),
            logout: jest.fn(),
            token: 'fake-token'
        });
    });

    afterEach(() => {
        mockUseAuth.mockRestore();
    });

    it('renders the page, add button, and displays employees', async () => {
        render(<EmployeesPage />);
        expect(screen.getByRole('heading', { name: /employee directory/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
        
        await waitFor(() => {
            expect(screen.getByText('John')).toBeInTheDocument();
            expect(screen.getByText('Jane')).toBeInTheDocument();
            expect(screen.getByText('Peter')).toBeInTheDocument();
        });
    });

    it('filters employees by search term', async () => {
        render(<EmployeesPage />);
        await waitFor(() => expect(screen.getByText('John')).toBeInTheDocument());
        
        const searchInput = screen.getByPlaceholderText(/search by name or clock id/i);
        fireEvent.change(searchInput, { target: { value: 'Jane' } });

        expect(screen.queryByText('John')).not.toBeInTheDocument();
        expect(screen.getByText('Jane')).toBeInTheDocument();
        expect(screen.queryByText('Peter')).not.toBeInTheDocument();
    });

    it('filters employees by status', async () => {
        render(<EmployeesPage />);
        await waitFor(() => expect(screen.getByText('John')).toBeInTheDocument());

        const statusFilter = screen.getByRole('combobox', { name: '' }); // Status filter select
        fireEvent.change(statusFilter, { target: { value: 'left' } });

        expect(screen.queryByText('John')).not.toBeInTheDocument();
        expect(screen.queryByText('Jane')).not.toBeInTheDocument();
        expect(screen.getByText('Peter')).toBeInTheDocument();
    });

    it('opens add modal, creates a new employee, and displays it', async () => {
        // FIX: Explicitly type `newEmployee` and added missing mandatory fields 'workLocation', 'address', 'dateOfBirth'.
        const newEmployee: Employee = { id: 4, propertyId: 1, employeeId: 'EMP004', firstName: 'Test', lastName: 'User', nationalId: '444555666', jobTitle: 'QA', phone: '444', department: 'it', status: 'active', contractStartDate: '2022-01-01T00:00:00.000Z', contractEndDate: '2026-01-01T00:00:00.000Z', workLocation: 'Main Building', address: '123 Street', dateOfBirth: '1995-01-01' };
        mockedEmployeeApi.create.mockResolvedValue(newEmployee);
        // Mock the getAll call to return the new list after creation
        // FIX: Add `newEmployee` to the mock response array to simulate data refresh.
        mockedEmployeeApi.getAll.mockResolvedValueOnce([...mockEmployees]).mockResolvedValueOnce([...mockEmployees, newEmployee]);
        
        render(<EmployeesPage />);
        
        fireEvent.click(screen.getByRole('button', { name: /add/i }));

        // Wait for modal to appear
        await screen.findByRole('heading', { name: /add employee/i });
        
        // Fill out the form
        fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Test' } });
        fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'User' } });
        fireEvent.change(screen.getByPlaceholderText(/clock id/i), { target: { value: 'EMP004' } });
        fireEvent.change(screen.getByLabelText(/national id/i), { target: { value: '444555666' } });
        fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '1995-01-01' } });
        fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '444' } });
        
        const departmentSelect = screen.getByLabelText(/department/i);
        fireEvent.change(departmentSelect, { target: { value: 'it' } });
        
        // Wait for job titles to update based on department selection
        await waitFor(() => {
            const jobTitleSelect = screen.getByLabelText(/job title/i);
            expect(jobTitleSelect.children.length).toBeGreaterThan(0);
        });

        // Submit the form
        fireEvent.click(screen.getByRole('button', { name: /save/i }));

        // Check if the API was called
        await waitFor(() => {
            expect(mockedEmployeeApi.create).toHaveBeenCalledWith(expect.objectContaining({
                firstName: 'Test',
                lastName: 'User',
                employeeId: 'EMP004'
            }));
        });

        // Check if the new employee is displayed in the table
        await waitFor(() => {
            expect(screen.getByText('Test')).toBeInTheDocument();
            expect(screen.getByText('User')).toBeInTheDocument();
        });
    });
});
