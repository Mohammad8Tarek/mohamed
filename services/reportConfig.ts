
import { ReportDefinition } from '../types';
import { reportsApi, activityLogApi, employeeApi } from './apiService';

/**
 * Enterprise Report Definitions Registry
 * NORMALIZED - NO DUPLICATION
 */
export const REPORT_REGISTRY: ReportDefinition[] = [
    {
        key: 'employees',
        labelEn: 'Employees',
        labelAr: 'الموظفين',
        apiEndpoint: (pId) => employeeApi.getAll(pId), // Pass pId for potentially global queries
        allowedFilters: ['property', 'department', 'gender', 'jobTitle', 'level', 'dateRange', 'status'],
        availableColumns: [
            'profileImage',
            'employeeId', 
            'firstName', 
            'lastName', 
            'gender', 
            'dateOfBirth', 
            'department', 
            'jobTitle', 
            'level', 
            'status', 
            'contractStartDate', 
            'phone', 
            'nationalId', 
            'workLocation', 
            'propertyId'
        ],
        defaultColumns: ['profileImage', 'employeeId', 'firstName', 'lastName', 'department', 'jobTitle', 'status', 'workLocation'],
        summableColumns: [], // No obvious numeric columns to sum for employees list
        permissions: {
            view: 'report.view.employees',
            exportPdf: 'report.export.pdf.employees',
            exportExcel: 'report.export.excel.employees'
        }
    },
    {
        key: 'housing',
        labelEn: 'Housing',
        labelAr: 'السكن',
        apiEndpoint: reportsApi.getOccupancyReport,
        allowedFilters: ['property', 'building', 'roomType', 'status'],
        availableColumns: ['buildingName', 'roomNumber', 'roomType', 'capacity', 'currentOccupants', 'availableBeds', 'roomStatus'],
        defaultColumns: ['buildingName', 'roomNumber', 'roomType', 'capacity', 'currentOccupants', 'availableBeds', 'roomStatus'],
        summableColumns: ['capacity', 'currentOccupants', 'availableBeds'], // Sum these columns
        permissions: {
            view: 'report.view.housing',
            exportPdf: 'report.export.pdf.housing',
            exportExcel: 'report.export.excel.housing'
        }
    },
    {
        key: 'inhouse',
        labelEn: 'In-House',
        labelAr: 'الساكنين',
        apiEndpoint: reportsApi.getCurrentInHouseReport,
        allowedFilters: ['property', 'department', 'gender'],
        availableColumns: ['fullName', 'gender', 'department', 'buildingName', 'roomNumber', 'checkInDate', 'propertyId'],
        defaultColumns: ['fullName', 'gender', 'department', 'buildingName', 'roomNumber', 'checkInDate'],
        summableColumns: [], // No obvious numeric columns
        permissions: {
            view: 'report.view.inhouse',
            exportPdf: 'report.export.pdf.inhouse',
            exportExcel: 'report.export.excel.inhouse'
        }
    },
    {
        key: 'reservations',
        labelEn: 'Reservations',
        labelAr: 'الحجوزات',
        apiEndpoint: reportsApi.getReservationsReport,
        allowedFilters: ['property', 'dateRange', 'bookingType'],
        availableColumns: ['fullName', 'department', 'jobTitle', 'roomNumber', 'roomType', 'checkInDate', 'checkOutDate', 'guestIdCardNumber', 'guestPhone', 'propertyId'],
        defaultColumns: ['fullName', 'department', 'roomNumber', 'checkInDate', 'checkOutDate'],
        summableColumns: [], // No obvious numeric columns
        permissions: {
            view: 'report.view.reservations',
            exportPdf: 'report.export.pdf.reservations',
            exportExcel: 'report.export.excel.reservations'
        }
    },
    {
        key: 'maintenance',
        labelEn: 'Maintenance',
        labelAr: 'الصيانة',
        apiEndpoint: reportsApi.getMaintenanceStatusReport,
        allowedFilters: ['property', 'priority', 'status', 'building'],
        availableColumns: ['buildingName', 'roomNumber', 'problemType', 'priority', 'status', 'reportedAt', 'dueDate', 'propertyId'],
        defaultColumns: ['buildingName', 'roomNumber', 'problemType', 'priority', 'status', 'reportedAt', 'dueDate'],
        summableColumns: [], // No obvious numeric columns
        permissions: {
            view: 'report.view.maintenance',
            exportPdf: 'report.export.pdf.maintenance',
            exportExcel: 'report.export.excel.maintenance'
        }
    },
    {
        key: 'audit',
        labelEn: 'Audit Log',
        labelAr: 'سجل التدقيق',
        apiEndpoint: (pId) => activityLogApi.getAll(true, pId), // Pass pId for filtered audit log
        allowedFilters: ['user', 'module', 'status', 'dateRange', 'property'], // Added property filter for audit log
        availableColumns: ['timestamp', 'username', 'module', 'actionType', 'action', 'severity', 'propertyId'],
        defaultColumns: ['timestamp', 'username', 'module', 'actionType', 'action', 'severity'],
        summableColumns: [], // No obvious numeric columns
        permissions: {
            view: 'report.view.audit',
            exportPdf: 'report.export.pdf.audit',
            exportExcel: 'report.export.excel.audit'
        }
    }
];