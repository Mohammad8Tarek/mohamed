
// Module Types
export type ModuleType = 'dashboard' | 'housing' | 'employees' | 'reservations' | 'maintenance' | 'reports' | 'users' | 'settings' | 'activity_log';

// Granular Permission Set
export type SystemPermission = 
    | 'DASHBOARD.VIEW'
    | 'HOUSING.VIEW' | 'HOUSING.MANAGE' | 'HOUSING.DELETE'
    | 'EMPLOYEE.VIEW' | 'EMPLOYEE.CREATE' | 'EMPLOYEE.EDIT' | 'EMPLOYEE.DELETE' | 'EMPLOYEE.IMPORT' | 'EMPLOYEE.EXPORT.PDF' | 'EMPLOYEE.EXPORT.EXCEL'
    | 'RESERVATION.VIEW' | 'RESERVATION.MANAGE' | 'RESERVATION.DELETE'
    | 'MAINTENANCE.VIEW' | 'MAINTENANCE.MANAGE' | 'MAINTENANCE.DELETE'
    | 'REPORT.VIEW' | 'REPORT.EXPORT'
    // Dynamic Report Permissions
    | 'report.view.employees' | 'report.export.pdf.employees' | 'report.export.excel.employees'
    | 'report.view.housing' | 'report.export.pdf.housing' | 'report.export.excel.housing'
    | 'report.view.inhouse' | 'report.export.pdf.inhouse' | 'report.export.excel.inhouse'
    | 'report.view.reservations' | 'report.export.pdf.reservations' | 'report.export.excel.reservations'
    | 'report.view.maintenance' | 'report.export.pdf.maintenance' | 'report.export.excel.maintenance'
    | 'report.view.audit' | 'report.export.pdf.audit' | 'report.export.excel.audit'
    | 'USER.VIEW' | 'USER.CREATE' | 'USER.EDIT' | 'USER.DISABLE' | 'USER.RESET_PASSWORD'
    | 'ROLE.VIEW' | 'ROLE.MANAGE'
    | 'PROPERTY.MANAGE'
    | 'LOG.VIEW'
    | 'SETTINGS.VIEW' | 'SETTINGS.MANAGE';

// --- ENTERPRISE REPORT ENGINE TYPES ---
export type ReportFilterKey = 
    | 'property' 
    | 'building' 
    | 'department' 
    | 'status' 
    | 'gender' 
    | 'dateRange' 
    | 'roomType' 
    | 'priority' 
    | 'jobTitle'
    | 'bookingType'
    | 'user'
    | 'level'
    | 'module';

export interface ReportDefinition {
    key: string;
    labelEn: string;
    labelAr: string;
    apiEndpoint: (propertyId?: number) => Promise<any[]>;
    allowedFilters: ReportFilterKey[];
    availableColumns: string[]; // Strict listing and ordering
    defaultColumns: string[];
    summableColumns: string[]; // NEW: Columns for which totals should be calculated
    permissions: {
        view: SystemPermission;
        exportPdf: SystemPermission;
        exportExcel: SystemPermission;
    };
}

export interface Role {
    id: number;
    name: string;
    permissions: SystemPermission[];
    isSystem?: boolean; 
}

export interface UserPropertyAccess {
    propertyId: number;
    isDefault: boolean;
}

export interface UserPermissionOverride {
    userId: number; // Added userId to match DB schema
    propertyId: number;
    permissionKey: SystemPermission;
    isAllowed: boolean; // true = Forced Grant, false = Forced Deny
}

export interface User {
    id: number;
    propertyId: number; // Primary/Default Property
    username: string;
    fullName: string;
    email: string;
    password?: string;
    roleId: number;
    status: 'active' | 'disabled';
    lastLoginAt: string | null;
    createdAt: string;
    authorizedProperties?: number[]; 
    overrides?: UserPermissionOverride[];
    roles: string[];
}

export interface Property {
    id: number;
    name: string;
    code: string;
    displayName: string;
    logo: string | null;
    primaryColor: string;
    defaultLanguage: 'en' | 'ar';
    enabledModules: ModuleType[];
    status: 'active' | 'disabled';
    createdAt: string;
}

export const AVAILABLE_MODULES: { key: ModuleType; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'housing', label: 'Housing' },
    { key: 'employees', label: 'Employees' },
    { key: 'reservations', label: 'Reservations' },
    { key: 'maintenance', label: 'Maintenance' },
    { key: 'reports', label: 'Reports' },
    { key: 'users', label: 'Users' },
    { key: 'settings', label: 'Settings' },
    { key: 'activity_log', label: 'Activity Log' },
];

export type LogSeverity = 'info' | 'warning' | 'critical';
export type LogActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'APPROVE' | 'REJECT' | 'ERROR' | 'SECURITY';

export interface RoomTypeConfig {
    name: string;
    description: string;
    defaultCapacity: number;
}

export interface CustomTaxonomy {
    departments: string[];
    jobTitles: Record<string, string[]>;
    roomTypes: RoomTypeConfig[];
    workLocations: string[]; 
    hiddenDepartments: string[];
    hiddenJobTitles: Record<string, string[]>;
}

export interface AppSettings {
    systemName: string;
    systemLogo: string | null;
    defaultLanguage: 'en' | 'ar';
    primaryColor: string;
    sidebarColor: string;
    headerColor: string;
    backgroundColor: string;
    textColor: string;
    buttonColor: string;
    reportTitle: string;
    reportLogo: string | null;
    reportFooter: string;
    pdfOrientation: 'p' | 'l';
    pdfFontSize: number;
    customTaxonomy: CustomTaxonomy;
    departureAlertsEnabled: boolean;
    departureAlertThreshold: number; 
}

export const DEFAULT_SETTINGS: AppSettings = {
    systemName: 'Sunrise Housing System',
    systemLogo: null,
    defaultLanguage: 'en',
    primaryColor: '#0F2A44',
    sidebarColor: '#0F2A44',
    headerColor: '#FFFFFF',
    backgroundColor: '#E2E8F0',
    textColor: '#1A202C',
    buttonColor: '#C9A24D',
    reportTitle: 'Sunrise Staff Housing Report',
    reportLogo: null,
    reportFooter: 'Generated by Sunrise Housing System',
    pdfOrientation: 'p',
    pdfFontSize: 9,
    customTaxonomy: {
        departments: [],
        jobTitles: {},
        roomTypes: [
            { name: 'Single Room', description: 'Private room for senior staff', defaultCapacity: 1 },
            { name: 'Shared Room', description: 'Standard shared accommodation', defaultCapacity: 2 },
            { name: 'Family Room', description: 'For staff with families', defaultCapacity: 4 }
        ],
        workLocations: ['Main Building', 'Beach Side', 'Outlet A', 'Spa Center'],
        hiddenDepartments: [],
        hiddenJobTitles: {}
    },
    departureAlertsEnabled: true,
    departureAlertThreshold: 3
};

export interface Building {
  id: number;
  propertyId: number;
  name: string;
  location: string;
  capacity: number;
  status: 'active' | 'inactive';
}

export interface Floor {
    id: number;
    propertyId: number;
    buildingId: number;
    floorNumber: string;
    description: string;
}

export interface Room {
    id: number;
    propertyId: number;
    floorId: number;
    roomNumber: string;
    roomType: string;
    capacity: number;
    currentOccupancy: number;
    status: 'available' | 'occupied' | 'maintenance' | 'reserved';
}

export interface Employee {
    id: number;
    propertyId: number;
    employeeId: string; 
    clockId?: string | null;  
    firstName: string;
    lastName: string;
    nationalId: string;
    jobTitle: string;
    phone: string;
    department: string;
    workLocation: string;
    address?: string; // Made optional
    dateOfBirth?: string; // Made optional
    status: 'active' | 'left';
    contractStartDate: string; 
    contractEndDate?: string | null; // Made optional for nullable values
    profileImage?: string | null; 
    idImage?: string | null; 
    level?: string | null; // Made nullable
    gender?: 'male' | 'female' | null; // Made nullable
}

export interface Assignment {
    id: number;
    propertyId: number;
    employeeId: number;
    roomId: number;
    checkInDate: string;
    expectedCheckOutDate: string | null;
    checkOutDate: string | null;
    notes?: string | null; 
}

export interface MaintenanceRequest {
    id: number;
    propertyId: number;
    roomId: number;
    problemType: string;
    description: string;
    status: 'open' | 'in_progress' | 'resolved';
    priority: 'low' | 'medium' | 'high'; 
    reportedAt: string;
    dueDate: string | null;
}

export interface ActivityLog {
    id: number;
    propertyId: number;
    username: string;
    userId?: number;
    userRole?: string;
    action: string;
    actionType: LogActionType;
    module: ModuleType | 'system' | 'auth' | 'security';
    entityType?: string;
    entityId?: number;
    sourcePropertyId?: number;
    oldValues?: string; 
    newValues?: string; 
    severity: LogSeverity;
    timestamp: string;
}

export interface ReservationGuest {
    firstName: string;
    lastName: string;
    guestIdCardNumber: string;
    guestPhone: string;
    jobTitle: string;
    department: string;
    guestType: 'adult' | 'child';
    age?: string;
}

export interface Reservation {
    id: number;
    propertyId: number;
    roomId: number;
    firstName: string;
    lastName: string;
    checkInDate: string;
    checkOutDate: string | null;
    notes: string;
    guestIdCardNumber: string;
    guestPhone: string;
    jobTitle: string;
    department: string;
    guests: string; 
}

export interface Hosting {
    id: number;
    propertyId: number;
    employeeId: number;
    roomId: number; 
    guestFirstName: string;
    guestLastName: string;
    guestIdCardNumber: string;
    startDate: string;
    endDate: string;
    notes: string | null;
    status: 'active' | 'completed' | 'cancelled' | 'pending';
    guests: string;
}

export interface OccupancyReportRow {
    propertyCode: string;
    propertyName: string;
    buildingName: string;
    buildingLocation: string;
    roomNumber: string;
    roomType: string;
    capacity: number;
    currentOccupants: number;
    availableBeds: number;
    roomStatus: string;
}

export interface EmployeeHousingReportRow {
    propertyCode: string;
    fullName: string;
    employeeId: string; 
    clockId: string;    
    nationalId: string;
    gender: string;
    phone: string;
    department: string;
    workLocation: string;
    address: string;
    dateOfBirth: string;
    jobTitle: string;
    level: string;
    status: string;
    buildingName: string;
    roomNumber: string;
    roomType: string;
    checkInDate: string;
    expectedCheckOutDate: string | null;
    checkOutDate: string | null;
    contractStartDate: string;
}

export const departmentJobTitles: Record<string, string[]> = {
    reception: ['Manager', 'Supervisor', 'Agent', 'Clerk'],
    reservations: ['Manager', 'Supervisor', 'Agent', 'Clerk'],
    public_relations: ['Manager', 'Specialist', 'Coordinator'],
    concierge: ['Chief Concierge', 'Concierge', 'Bell Captain', 'Bellman'],
    housekeeping: ['Executive Housekeeper', 'Assistant Housekeeper', 'Supervisor', 'Room Attendant', 'Public Area Attendant'],
    laundry: ['Manager', 'Supervisor', 'Valet', 'Presser', 'Washer'],
    security_safety: ['Director', 'Manager', 'Supervisor', 'Officer'],
    food_beverage: ['Director', 'Manager', 'Supervisor', 'Captain', 'Waiter/Waitress', 'Host/Hostess', 'Bartender'],
    kitchen: ['Executive Chef', 'Sous Chef', 'Chef de Partie', 'Commis Chef', 'Steward'],
    maintenance_engineering: ['Chief Engineer', 'Assistant Chief Engineer', 'Supervisor', 'Technician (Plumbing, Electrical, HVAC)'],
    it: ['Cluster', 'Manager', 'Assistant', 'Supervisor', 'Clerk'],
    hr: ['Director', 'Manager', 'Specialist', 'Coordinator', 'Assistant'],
    admin_affairs: ['Manager', 'Coordinator', 'Clerk'],
    finance_accounting: ['Director of Finance', 'Controller', 'Accountant', 'Accounts Payable/Receivable', 'Auditor'],
    purchasing: ['Manager', 'Buyer', 'Clerk'],
    stores: ['Manager', 'Storekeeper', 'Clerk'],
    transportation: ['Manager', 'Supervisor', 'Driver'],
    general_cleaning: ['Supervisor', 'Cleaner'],
    sales: ['Director of Sales', 'Sales Manager', 'Sales Executive', 'Coordinator'],
    marketing: ['Director of Marketing', 'Marketing Manager', 'Marketing Executive', 'Digital Marketing Specialist'],
    tour_programs: ['Manager', 'Coordinator', 'Specialist'],
    flight_reservations: ['Manager', 'Supervisor', 'Agent'],
    tour_guides: ['Senior Guide', 'Guide'],
    tourist_transport: ['Manager', 'Supervisor', 'Driver', 'Coordinator'],
    international_relations: ['Manager', 'Specialist', 'Coordinator'],
    housing_section: ['Manager', 'Supervisor', 'Coordinator', 'Clerk']
};

export const DEPARTMENTS = Object.keys(departmentJobTitles);