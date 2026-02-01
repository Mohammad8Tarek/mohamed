
import { User, Building, Floor, Room, Employee, Assignment, MaintenanceRequest, ActivityLog, Reservation, Hosting, OccupancyReportRow, EmployeeHousingReportRow, AppSettings, DEFAULT_SETTINGS, Property, AVAILABLE_MODULES, LogSeverity, LogActionType, ModuleType, Role, SystemPermission, UserPermissionOverride } from '../types';
import { AuthService } from './auth.service'; // NEW: Import AuthService for login

declare var initSqlJs: any;

// --- Database Core ---
const DB_NAME = 'tal-avenue-housing.sqlite';
const DB_VERSION = 32; // Patch 1: Incremented for profileImage column. Patch 2: Add userId to UserPermissions
const BACKUP_PREFIX = 'backup-';
const MAX_BACKUPS = 5;

let db: any;
let dbInitialized: Promise<void> | null = null;
let writeCounter = 0;

// GLOBAL STATE FOR MULTI-TENANCY
let ACTIVE_PROPERTY_ID: number = 1; 

export const setApiPropertyId = (id: number) => {
    ACTIVE_PROPERTY_ID = id;
};

export const getApiPropertyId = () => ACTIVE_PROPERTY_ID;

const openIndexedDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('SQLiteDB', 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore('files');
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const saveDataToIndexedDB = (idb: IDBDatabase, key: string, data: Uint8Array): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = idb.transaction('files', 'readwrite');
        const store = transaction.objectStore('files');
        const request = store.put(data, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

const loadDataFromIndexedDB = (idb: IDBDatabase, key: string): Promise<Uint8Array | null> => {
    return new Promise((resolve, reject) => {
        const transaction = idb.transaction('files', 'readonly');
        const store = transaction.objectStore('files');
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
};

const saveDatabase = async () => {
    if (db) {
        try {
            const idb = await openIndexedDB();
            const data = db.export();
            await saveDataToIndexedDB(idb, DB_NAME, data);
            idb.close();
            writeCounter++;
            if (writeCounter > 50) { 
                await backupDatabase();
                writeCounter = 0;
            }
        } catch (e) {
            console.error("Critical error saving database to IndexedDB:", e);
        }
    }
};

const backupDatabase = async () => {
    if (!db) return;
    const timestamp = new Date().toISOString();
    const backupKey = `${BACKUP_PREFIX}${DB_NAME}-${timestamp}`;
    const idb = await openIndexedDB();
    const data = db.export();
    await saveDataToIndexedDB(idb, backupKey, data);
    
    db.run(`UPDATE SystemVariables SET value = ? WHERE key = 'last_backup_time'`, [timestamp]);
    
    const tx = idb.transaction('files', 'readwrite');
    const store = tx.objectStore('files');
    const request = store.getAllKeys();
    request.onsuccess = () => {
        const keys = request.result.filter(k => (k as string).startsWith(BACKUP_PREFIX)).sort().reverse();
        if (keys.length > MAX_BACKUPS) {
            for (let i = MAX_BACKUPS; i < keys.length; i++) {
                store.delete(keys[i]);
            }
        }
    };
    idb.close();
};

const dbToObjects = (result: any[]): any[] => {
    if (!result || result.length === 0) return [];
    const { columns, values } = result[0];
    return values.map(row => {
        const obj: { [key: string]: any } = {};
        columns.forEach((col, i) => {
            obj[col] = row[i];
        });
        return obj;
    });
};

const executeQuery = async (sql: string, params: any[] = []): Promise<any[]> => {
    await dbInitialized;
    try {
        const results = db.exec(sql, params);
        const isWrite = /^(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i.test(sql);
        if (isWrite) {
            await saveDatabase();
        }
        return dbToObjects(results);
    } catch (e) {
        console.error("Query failed:", sql, params, e);
        throw e;
    }
};

const executeNonQuery = async (sql: string, params: any[] = []): Promise<void> => {
     await dbInitialized;
    try {
        db.run(sql, params);
        await saveDatabase();
    } catch (e: any) {
        console.error("NonQuery failed:", sql, params, e);
        if (e.message && e.message.includes('UNIQUE constraint failed')) {
            if (e.message.includes('Properties.code')) {
                throw new Error("Property Code must be unique.");
            }
            if (e.message.includes('Users.username')) {
                throw new Error("Username already exists.");
            }
            if (e.message.includes('Roles.name')) {
                throw new Error("Role name must be unique.");
            }
            if (e.message.includes('Employees.nationalId')) {
                throw new Error("National ID must be unique per property.");
            }
        }
        throw e;
    }
}

// --- Schema and Migrations ---
const CURRENT_SCHEMA = [
    `CREATE TABLE IF NOT EXISTS SystemVariables (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS Properties (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, code TEXT UNIQUE, displayName TEXT, logo TEXT, primaryColor TEXT, defaultLanguage TEXT DEFAULT 'en', enabledModules TEXT, status TEXT DEFAULT 'active', createdAt TEXT);`,
    `CREATE TABLE IF NOT EXISTS Roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, permissions TEXT NOT NULL, isSystem INTEGER DEFAULT 0);`,
    `CREATE TABLE IF NOT EXISTS Users (id INTEGER PRIMARY KEY AUTOINCREMENT, propertyId INTEGER DEFAULT 1, username TEXT UNIQUE NOT NULL COLLATE NOCASE, fullName TEXT, email TEXT, password TEXT NOT NULL, roleId INTEGER, roles TEXT, status TEXT DEFAULT 'active', lastLoginAt TEXT, createdAt TEXT);`,
    `CREATE TABLE IF NOT EXISTS UserProperties (userId INTEGER, propertyId INTEGER, isDefault INTEGER DEFAULT 0, PRIMARY KEY(userId, propertyId), FOREIGN KEY(userId) REFERENCES Users(id), FOREIGN KEY(propertyId) REFERENCES Properties(id));`,
    `CREATE TABLE IF NOT EXISTS UserPermissions (userId INTEGER, propertyId INTEGER, permissionKey TEXT, isAllowed INTEGER, PRIMARY KEY(userId, propertyId, permissionKey), FOREIGN KEY(userId) REFERENCES Users(id), FOREIGN KEY(propertyId) REFERENCES Properties(id));`,
    `CREATE TABLE IF NOT EXISTS Buildings (id INTEGER PRIMARY KEY AUTOINCREMENT, propertyId INTEGER DEFAULT 1, name TEXT, location TEXT, capacity INTEGER, status TEXT);`,
    `CREATE TABLE IF NOT EXISTS Floors (id INTEGER PRIMARY KEY AUTOINCREMENT, propertyId INTEGER DEFAULT 1, buildingId INTEGER, floorNumber TEXT, description TEXT, FOREIGN KEY(buildingId) REFERENCES Buildings(id));`,
    `CREATE TABLE IF NOT EXISTS Rooms (id INTEGER PRIMARY KEY AUTOINCREMENT, propertyId INTEGER DEFAULT 1, floorId INTEGER, roomNumber TEXT, roomType TEXT DEFAULT 'Standard', capacity INTEGER, currentOccupancy INTEGER, status TEXT, FOREIGN KEY(floorId) REFERENCES Floors(id));`,
    // Patch 1: Enhanced Employees Table with unique nationalId
    `CREATE TABLE IF NOT EXISTS Employees (id INTEGER PRIMARY KEY AUTOINCREMENT, propertyId INTEGER DEFAULT 1, firstName TEXT, lastName TEXT, nationalId TEXT UNIQUE, employeeId TEXT, clockId TEXT, phone TEXT, department TEXT, workLocation TEXT, address TEXT, dateOfBirth TEXT, status TEXT, contractStartDate TEXT, contractEndDate TEXT, jobTitle TEXT, idImage TEXT, profileImage TEXT, level TEXT, gender TEXT);`,
    `CREATE TABLE IF NOT EXISTS Assignments (id INTEGER PRIMARY KEY AUTOINCREMENT, propertyId INTEGER DEFAULT 1, employeeId INTEGER, roomId INTEGER, checkInDate TEXT, expectedCheckOutDate TEXT, checkOutDate TEXT, notes TEXT, FOREIGN KEY(employeeId) REFERENCES Employees(id), FOREIGN KEY(roomId) REFERENCES Rooms(id));`,
    `CREATE TABLE IF NOT EXISTS MaintenanceRequests (id INTEGER PRIMARY KEY AUTOINCREMENT, propertyId INTEGER DEFAULT 1, roomId INTEGER, problemType TEXT, description TEXT, status TEXT, priority TEXT DEFAULT 'medium', reportedAt TEXT, dueDate TEXT, FOREIGN KEY(roomId) REFERENCES Rooms(id));`,
    `CREATE TABLE IF NOT EXISTS Reservations (id INTEGER PRIMARY KEY AUTOINCREMENT, propertyId INTEGER DEFAULT 1, roomId INTEGER, firstName TEXT, lastName TEXT, checkInDate TEXT, checkOutDate TEXT, notes TEXT, guestIdCardNumber TEXT, guestPhone TEXT, jobTitle TEXT, department TEXT, guests TEXT, FOREIGN KEY(roomId) REFERENCES Rooms(id));`,
    `CREATE TABLE IF NOT EXISTS Hostings (id INTEGER PRIMARY KEY AUTOINCREMENT, propertyId INTEGER DEFAULT 1, employeeId INTEGER, roomId INTEGER, guestFirstName TEXT, guestLastName TEXT, guestIdCardNumber TEXT, startDate TEXT, endDate TEXT, notes TEXT, status TEXT, guests TEXT, FOREIGN KEY(employeeId) REFERENCES Employees(id));`,
    `CREATE TABLE IF NOT EXISTS ActivityLog (id INTEGER PRIMARY KEY AUTOINCREMENT, propertyId INTEGER DEFAULT 1, username TEXT, userId INTEGER, userRole TEXT, action TEXT, actionType TEXT, module TEXT, entityType TEXT, entityId INTEGER, sourcePropertyId INTEGER, oldValues TEXT, newValues TEXT, severity TEXT, timestamp TEXT);`,
    `CREATE TABLE IF NOT EXISTS AppSettings (key TEXT PRIMARY KEY NOT NULL, value TEXT);`
];

const seedSampleData = async () => {
    const ALL_PERMISSIONS: SystemPermission[] = [
        'DASHBOARD.VIEW', 'HOUSING.VIEW', 'HOUSING.MANAGE', 'HOUSING.DELETE', 'EMPLOYEE.VIEW', 'EMPLOYEE.CREATE', 'EMPLOYEE.EDIT', 'EMPLOYEE.DELETE', 'EMPLOYEE.IMPORT', 'EMPLOYEE.EXPORT.PDF', 'EMPLOYEE.EXPORT.EXCEL', 'RESERVATION.VIEW', 'RESERVATION.MANAGE', 'RESERVATION.DELETE', 'MAINTENANCE.VIEW', 'MAINTENANCE.MANAGE', 'MAINTENANCE.DELETE', 'REPORT.VIEW', 'REPORT.EXPORT', 'USER.VIEW', 'USER.CREATE', 'USER.EDIT', 'USER.DISABLE', 'USER.RESET_PASSWORD', 'ROLE.VIEW', 'ROLE.MANAGE', 'PROPERTY.MANAGE', 'LOG.VIEW', 'SETTINGS.VIEW', 'SETTINGS.MANAGE'
    ];

    db.run(`INSERT OR IGNORE INTO Roles (id, name, permissions, isSystem) VALUES 
        (1, 'Super Admin', ?, 1),
        (2, 'Admin', ?, 1),
        (3, 'HR Officer', ?, 1),
        (4, 'Housing Supervisor', ?, 1),
        (5, 'Engineering', ?, 1),
        (6, 'Viewer', ?, 1)`, 
        [
            JSON.stringify(ALL_PERMISSIONS),
            JSON.stringify(ALL_PERMISSIONS.filter(p => p !== 'PROPERTY.MANAGE')),
            JSON.stringify(['DASHBOARD.VIEW', 'EMPLOYEE.VIEW', 'EMPLOYEE.CREATE', 'EMPLOYEE.EDIT', 'EMPLOYEE.IMPORT', 'EMPLOYEE.EXPORT.EXCEL', 'REPORT.VIEW']),
            JSON.stringify(['DASHBOARD.VIEW', 'HOUSING.VIEW', 'HOUSING.MANAGE', 'RESERVATION.VIEW', 'RESERVATION.MANAGE', 'MAINTENANCE.VIEW']),
            JSON.stringify(['DASHBOARD.VIEW', 'MAINTENANCE.VIEW', 'MAINTENANCE.MANAGE']),
            JSON.stringify(['DASHBOARD.VIEW', 'HOUSING.VIEW', 'EMPLOYEE.VIEW', 'REPORT.VIEW'])
        ]
    );

    db.run(`INSERT OR IGNORE INTO Properties (id, name, code, displayName, status, createdAt, primaryColor, enabledModules) VALUES 
        (1, 'Sunrise HQ', 'HQ-01', 'Sunrise HQ', 'active', datetime('now'), '#0FB9B1', '["dashboard","housing","employees","reservations","maintenance","reports","users","settings","activity_log"]')`);

    db.run(`INSERT OR IGNORE INTO Users (id, propertyId, username, fullName, email, password, roleId, roles, status, createdAt) VALUES 
        (1, 1, 'admin', 'System Administrator', 'admin@sunrise-resorts.com', 'admin', 1, '["super_admin"]', 'active', datetime('now'))`);

    db.run(`INSERT OR IGNORE INTO UserProperties (userId, propertyId, isDefault) VALUES (1, 1, 1)`);

    await saveDatabase();
};

export const initDb = () => {
    if (dbInitialized) return dbInitialized;
    dbInitialized = new Promise(async (resolve, reject) => {
        try {
            const SQL = await initSqlJs({ locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}` });
            const idb = await openIndexedDB();
            const dbFile = await loadDataFromIndexedDB(idb, DB_NAME);
            if (dbFile) {
                db = new SQL.Database(dbFile);
            } else {
                db = new SQL.Database();
            }
            idb.close();

            let currentVersion = 0;
            try {
                const res = db.exec(`SELECT value FROM SystemVariables WHERE key = 'version'`);
                if (res.length > 0 && res[0].values.length > 0) {
                    currentVersion = parseInt(res[0].values[0][0], 10);
                }
            } catch (e) {}

            if (currentVersion < DB_VERSION) {
                CURRENT_SCHEMA.forEach(stmt => {
                    try { db.run(stmt); } catch(e) {}
                });

                // Cumulative Migrations for Patches
                if (currentVersion < 29) {
                    try { db.run(`ALTER TABLE Employees ADD COLUMN workLocation TEXT;`); } catch(e) {}
                    try { db.run(`ALTER TABLE Employees ADD COLUMN address TEXT;`); } catch(e) {}
                    try { db.run(`ALTER TABLE Employees ADD COLUMN dateOfBirth TEXT;`); } catch(e) {}
                }
                if (currentVersion < 30) {
                    try { db.run(`ALTER TABLE Employees ADD COLUMN clockId TEXT;`); } catch(e) {}
                }
                if (currentVersion < 31) {
                    try { db.run(`ALTER TABLE Employees ADD COLUMN profileImage TEXT;`); } catch(e) {}
                }
                if (currentVersion < 32) {
                    try { db.run(`ALTER TABLE Employees ADD COLUMN gender TEXT;`); } catch(e) {}
                    try { db.run(`ALTER TABLE Employees ADD COLUMN level TEXT;`); } catch(e) {}
                    // Add UNIQUE constraint to National ID for Employees
                    try { db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_nationalId ON Employees(nationalId, propertyId);`); } catch(e) {}
                }
                
                await seedSampleData();
                db.run(`INSERT OR REPLACE INTO SystemVariables (key, value) VALUES ('version', '${DB_VERSION}')`);
            }
            await saveDatabase();
            resolve();
        } catch (e) {
            reject(e);
        }
    });
    return dbInitialized;
};

export const authApi = {
    // REMOVED old direct login logic and replaced with a placeholder
    // The actual login will now happen via AuthService.login which performs a fetch to a backend.
    login: async (credentials: { username: string; password: string }): Promise<{ user: User; role: Role; token: string }> => {
        // This is a simulation for frontend-only demo
        // In a real app, this would be a direct fetch call to a backend authentication API.
        const results = await executeQuery(
            `SELECT u.*, r.name as roleName, r.permissions 
             FROM Users u 
             JOIN Roles r ON u.roleId = r.id 
             WHERE u.username = ? AND u.password = ?`, 
            [credentials.username.toLowerCase(), credentials.password]
        );

        if (results.length === 0) {
            throw new Error("Invalid username or password");
        }

        const row = results[0];
        if (row.status === 'disabled') {
            throw new Error("Account is disabled. Please contact administrator.");
        }

        const user: User = {
            ...row,
            roles: JSON.parse(row.roles || '[]'),
            authorizedProperties: (await executeQuery(`SELECT propertyId FROM UserProperties WHERE userId = ?`, [row.id])).map(p => p.propertyId)
        };

        const role: Role = {
            id: row.roleId,
            name: row.roleName,
            permissions: JSON.parse(row.permissions || '[]')
        };

        // Update last login
        await executeNonQuery(`UPDATE Users SET lastLoginAt = ? WHERE id = ?`, [new Date().toISOString(), user.id]);

        // For demo, generate a dummy token. In real app, this comes from backend.
        // This token is not validated by the client in this *simulated* step,
        // but it will be validated by AuthService.
        const dummyToken = `dummy-jwt-${Math.random().toString(36).substr(2)}`;
        // Assume backend also sends a refreshToken
        const dummyRefreshToken = `dummy-refresh-${Math.random().toString(36).substr(2)}`;
        
        // This structure must match what AuthService.login expects to receive from the fetch response
        return { user, role, token: dummyToken };
    },
    // NEW: Added a /api/auth/me placeholder for useAuth to fetch current user data
    getMe: async (token: string): Promise<{user: User; role: Role}> => {
        // This is a simulation. In a real app, this would involve validating the token
        // on the backend and returning the user/role associated with it.
        // For now, we'll try to retrieve from local storage (if available).
        const { user, role } = AuthService.getUserAndRole();
        if (user && role) {
            return { user, role };
        }
        throw new Error("User data not found for token.");
    }
};

function createApiService<T extends { id: number; propertyId: number }>(tableName: string) {
    return {
        getAll: async (): Promise<T[]> => {
            const results = await executeQuery(`SELECT * FROM ${tableName} WHERE propertyId = ?`, [ACTIVE_PROPERTY_ID]);
            return results as T[];
        },
        getById: async (id: number): Promise<T | null> => {
            const results = await executeQuery(`SELECT * FROM ${tableName} WHERE id = ? AND propertyId = ?`, [id, ACTIVE_PROPERTY_ID]);
            return (results[0] as T) || null;
        },
        create: async (data: Partial<T>): Promise<T> => {
            const exclude = ['roles', 'authorizedProperties', 'overrides', 'propertyId', 'id'];
            const keys = Object.keys(data).filter(k => !exclude.includes(k));
            const values = keys.map(k => (data as any)[k]);
            const placeholders = keys.map(() => '?').join(', ');
            const targetPropertyId = data.propertyId || ACTIVE_PROPERTY_ID;
            
            await executeNonQuery(
                `INSERT INTO ${tableName} (${keys.join(', ')}, propertyId) VALUES (${placeholders}, ?)`, 
                [...values, targetPropertyId]
            );
            window.dispatchEvent(new CustomEvent('datachanged', { detail: { table: tableName } }));
            const results = await executeQuery(`SELECT * FROM ${tableName} WHERE id = last_insert_rowid()`);
            return results[0] as T;
        },
        update: async (id: number, data: Partial<T>): Promise<void> => {
            const exclude = ['roles', 'authorizedProperties', 'overrides', 'propertyId', 'id'];
            const keys = Object.keys(data).filter(k => !exclude.includes(k));
            const values = keys.map(k => (data as any)[k]);
            const setClause = keys.map(key => `${key} = ?`).join(', ');
            
            if (keys.length > 0) {
                await executeNonQuery(`UPDATE ${tableName} SET ${setClause} WHERE id = ? AND propertyId = ?`, [...values, id, ACTIVE_PROPERTY_ID]);
            }
            window.dispatchEvent(new CustomEvent('datachanged', { detail: { table: tableName } }));
        },
        updateMany: async (ids: number[], data: Partial<T>): Promise<void> => {
            if (ids.length === 0) return;
            const keys = Object.keys(data).filter(k => k !== 'id' && k !== 'propertyId');
            const values = keys.map(k => (data as any)[k]);
            const setClause = keys.map(key => `${key} = ?`).join(', ');
            const placeholders = ids.map(() => '?').join(', ');
            await executeNonQuery(
                `UPDATE ${tableName} SET ${setClause} WHERE id IN (${placeholders}) AND propertyId = ?`, 
                [...values, ...ids, ACTIVE_PROPERTY_ID]
            );
            window.dispatchEvent(new CustomEvent('datachanged', { detail: { table: tableName } }));
        },
        deleteMany: async (ids: number[]): Promise<void> => {
            if (ids.length === 0) return;
            const placeholders = ids.map(() => '?').join(', ');
            await executeNonQuery(`DELETE FROM ${tableName} WHERE id IN (${placeholders}) AND propertyId = ?`, [...ids, ACTIVE_PROPERTY_ID]);
            window.dispatchEvent(new CustomEvent('datachanged', { detail: { table: tableName } }));
        },
        delete: async (id: number): Promise<void> => {
            await executeNonQuery(`DELETE FROM ${tableName} WHERE id = ? AND propertyId = ?`, [id, ACTIVE_PROPERTY_ID]);
            window.dispatchEvent(new CustomEvent('datachanged', { detail: { table: tableName } }));
        }
    };
}

export const roleApi = {
    getAll: async (): Promise<Role[]> => {
        const results = await executeQuery(`SELECT * FROM Roles`);
        return results.map(r => ({ ...r, permissions: JSON.parse(r.permissions || '[]'), isSystem: !!r.isSystem }));
    },
    update: async (id: number, data: Partial<Role>): Promise<void> => {
        const sql = `UPDATE Roles SET name = ?, permissions = ? WHERE id = ?`;
        await executeNonQuery(sql, [data.name, JSON.stringify(data.permissions), id]);
        window.dispatchEvent(new CustomEvent('datachanged', { detail: { table: 'Roles' } }));
    },
    create: async (data: Partial<Role>): Promise<Role> => {
        await executeNonQuery(`INSERT INTO Roles (name, permissions) VALUES (?, ?)`, [data.name, JSON.stringify(data.permissions)]);
        const res = await executeQuery(`SELECT * FROM Roles WHERE id = last_insert_rowid()`);
        return { ...res[0], permissions: JSON.parse(res[0].permissions) };
    },
    delete: async (id: number): Promise<void> => {
        await executeNonQuery(`DELETE FROM Roles WHERE id = ? AND isSystem = 0`, [id]);
        window.dispatchEvent(new CustomEvent('datachanged', { detail: { table: 'Roles' } }));
    }
};

export const userApi = {
    ...createApiService<User>('Users'),
    getAll: async (global: boolean = false): Promise<User[]> => {
        const sql = global ? `SELECT * FROM Users` : `SELECT * FROM Users WHERE propertyId = ?`;
        const params = global ? [] : [ACTIVE_PROPERTY_ID];
        const results = await executeQuery(sql, params);
        const usersWithData = [];
        for(const row of results) {
            const authProps = await executeQuery(`SELECT propertyId FROM UserProperties WHERE userId = ?`, [row.id]);
            usersWithData.push({
                ...row,
                roles: JSON.parse(row.roles || '[]'),
                authorizedProperties: authProps.map(p => p.propertyId)
            });
        }
        return usersWithData as User[];
    },
    getOverrides: async (userId: number): Promise<UserPermissionOverride[]> => {
        const results = await executeQuery(`SELECT userId, propertyId, permissionKey, isAllowed FROM UserPermissions WHERE userId = ?`, [userId]);
        return results.map(r => ({ ...r, isAllowed: !!r.isAllowed })) as UserPermissionOverride[];
    },
    updateAccess: async (userId: number, propertyIds: number[], defaultPropertyId: number): Promise<void> => {
        await executeNonQuery(`DELETE FROM UserProperties WHERE userId = ?`, [userId]);
        for (const pId of propertyIds) {
            await executeNonQuery(`INSERT INTO UserProperties (userId, propertyId, isDefault) VALUES (?, ?, ?)`, [userId, pId, pId === defaultPropertyId ? 1 : 0]);
        }
        window.dispatchEvent(new CustomEvent('datachanged', { detail: { table: 'Users' } }));
    },
    updateOverrides: async (userId: number, overrides: UserPermissionOverride[]): Promise<void> => {
        await executeNonQuery(`DELETE FROM UserPermissions WHERE userId = ?`, [userId]);
        for (const ov of overrides) {
            await executeNonQuery(`INSERT INTO UserPermissions (userId, propertyId, permissionKey, isAllowed) VALUES (?, ?, ?, ?)`, [userId, ov.propertyId, ov.permissionKey, ov.isAllowed ? 1 : 0]);
        }
        window.dispatchEvent(new CustomEvent('datachanged', { detail: { table: 'Users' } }));
    },
    create: async (data: Partial<User>): Promise<User> => {
        if (!data.username || !data.username.trim()) {
            throw new Error("Username is mandatory for identity provisioning.");
        }
        // Exclude 'password' from direct stringify if it's hashed and handled elsewhere
        // Assume password passed here is already hashed or handled by backend, not frontend hashing.
        const { password, ...restData } = data;
        
        const exclude = ['roles', 'authorizedProperties', 'overrides', 'propertyId', 'id'];
        const keys = Object.keys(restData).filter(k => !exclude.includes(k));
        const values = keys.map(k => (restData as any)[k]);
        const placeholders = keys.map(() => '?').join(', ');
        const targetPropertyId = data.propertyId || ACTIVE_PROPERTY_ID;
        
        let sql = `INSERT INTO Users (${keys.join(', ')}`;
        let sqlValues = values;

        if (password) {
            sql += `, password`;
            sqlValues.push(password);
        }
        sql += `, roles, propertyId) VALUES (${placeholders}`;
        if (password) {
            sql += `, ?`; // Placeholder for password
        }
        sql += `, ?, ?)`; // Placeholders for roles and propertyId

        await executeNonQuery(sql, [...sqlValues, '[]', targetPropertyId]);

        const results = await executeQuery(`SELECT * FROM Users WHERE id = last_insert_rowid()`);
        const newUser = results[0];
        await executeNonQuery(`INSERT INTO UserProperties (userId, propertyId, isDefault) VALUES (?, ?, 1)`, [newUser.id, targetPropertyId]);
        return newUser as User;
    },
    checkUsernameExists: async (username: string): Promise<boolean> => {
        const results = await executeQuery(`SELECT count(*) as count FROM Users WHERE username = ?`, [username]);
        return results[0].count > 0;
    }
};

export const employeeApi = {
    ...createApiService<Employee>('Employees'),
    searchGlobal: async (query: string, propertyId?: number): Promise<Employee[]> => {
        let sql = `SELECT * FROM Employees WHERE (firstName LIKE ? OR lastName LIKE ? OR employeeId LIKE ? OR clockId LIKE ? OR nationalId LIKE ?)`;
        const params: any[] = [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`];
        if (propertyId) {
            sql += ` AND propertyId = ?`;
            params.push(propertyId);
        }
        const results = await executeQuery(sql, params);
        return results as Employee[];
    },
    getAll: async (propertyId?: number): Promise<Employee[]> => { // Added optional propertyId
        const pid = propertyId || ACTIVE_PROPERTY_ID;
        const results = await executeQuery(`SELECT * FROM Employees WHERE propertyId = ?`, [pid]);
        return results as Employee[];
    }
};

export const activityLogApi = {
    ...createApiService<ActivityLog>('ActivityLog'),
    getAll: async (global: boolean = false, propertyId?: number): Promise<ActivityLog[]> => {
        const pid = propertyId || ACTIVE_PROPERTY_ID;
        const sql = global ? `SELECT * FROM ActivityLog` : `SELECT * FROM ActivityLog WHERE propertyId = ?`;
        const params = global ? [] : [pid];
        const results = await executeQuery(sql, params);
        return results as ActivityLog[];
    }
};

export const logActivity = async (username: string, action: string, options: any = {}): Promise<ActivityLog> => {
    const timestamp = new Date().toISOString();
    // Default userId and userRole from AuthService if not provided
    const { user: authUser, role: authRole } = AuthService.getUserAndRole();
    const userId = options.userId || authUser?.id || null;
    const userRole = options.userRole || authRole?.name || null;

    const { actionType = 'UPDATE', module = 'system', severity = 'info', oldValues, newValues } = options;
    await executeNonQuery(
        `INSERT INTO ActivityLog (propertyId, username, userId, userRole, action, actionType, module, severity, timestamp, oldValues, newValues) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
        [ACTIVE_PROPERTY_ID, username, userId, userRole, action, actionType, module, severity, timestamp, oldValues || null, newValues || null]
    );
    window.dispatchEvent(new CustomEvent('datachanged', { detail: { table: 'ActivityLog' } }));
    const newLog = await executeQuery(`SELECT * FROM ActivityLog WHERE rowid = last_insert_rowid()`);
    return newLog[0];
};

export const propertyApi = {
    getAll: async (): Promise<Property[]> => {
        const results = await executeQuery(`SELECT * FROM Properties`);
        return results.map(p => ({ ...p, enabledModules: JSON.parse(p.enabledModules || '[]') })) as Property[];
    },
    create: async (data: any): Promise<Property> => {
        const { name, code, displayName, status, primaryColor, logo, defaultLanguage, enabledModules, adminUsername, adminPassword } = data;
        const modulesStr = JSON.stringify(enabledModules || []);
        await executeNonQuery(
            `INSERT INTO Properties (name, code, displayName, status, createdAt, primaryColor, logo, defaultLanguage, enabledModules) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, code, displayName, status, new Date().toISOString(), primaryColor, logo, defaultLanguage, modulesStr]
        );
        const propResults = await executeQuery(`SELECT id FROM Properties WHERE code = ?`, [code]);
        const propId = propResults[0].id;
        if (adminUsername && adminPassword) {
            // Assume adminPassword is already hashed or will be handled by AuthService
            await executeNonQuery(`INSERT INTO Users (username, fullName, password, roleId, status, propertyId, createdAt, roles) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), '["admin"]')`, [adminUsername, 'Property Admin', adminPassword, 2, 'active', propId]); // Assign role 2 (Admin)
            const userRes = await executeQuery(`SELECT id FROM Users WHERE username = ?`, [adminUsername]);
            await executeNonQuery(`INSERT INTO UserProperties (userId, propertyId, isDefault) VALUES (?, ?, 1)`, [userRes[0].id, propId]);
        }
        window.dispatchEvent(new CustomEvent('datachanged', { detail: { table: 'Properties' } }));
        return propResults[0] as Property;
    },
    update: async (id: number, data: Partial<Property>): Promise<void> => {
        const keys = Object.keys(data).filter(k => k !== 'enabledModules' && k !== 'id');
        const values = keys.map(k => (data as any)[k]);
        let sql = `UPDATE Properties SET ${keys.map(k => `${k} = ?`).join(', ')}`;
        if (data.enabledModules) {
            sql += `, enabledModules = ?`;
            values.push(JSON.stringify(data.enabledModules));
        }
        sql += ` WHERE id = ?`;
        values.push(id);
        await executeNonQuery(sql, values);
        window.dispatchEvent(new CustomEvent('datachanged', { detail: { table: 'Properties' } }));
    },
    delete: async (id: number): Promise<void> => {
        await executeNonQuery(`DELETE FROM Properties WHERE id = ?`, [id]);
        window.dispatchEvent(new CustomEvent('datachanged', { detail: { table: 'Properties' } }));
    },
    checkCodeExists: async (code: string): Promise<boolean> => {
        const results = await executeQuery(`SELECT count(*) as count FROM Properties WHERE code = ?`, [code]);
        return results[0].count > 0;
    }
};

export const buildingApi = createApiService<Building>('Buildings');
export const floorApi = createApiService<Floor>('Floors');
export const roomApi = createApiService<Room>('Rooms');
export const assignmentApi = createApiService<Assignment>('Assignments');
export const maintenanceApi = createApiService<MaintenanceRequest>('MaintenanceRequests');
export const reservationApi = createApiService<Reservation>('Reservations');
export const hostingApi = createApiService<Hosting>('Hostings');

export const importApi = {
    importEmployees: async (employees: Partial<Employee>[]): Promise<void> => {
        for (const emp of employees) {
            try { 
                // Ensure National ID is unique per property before attempting to create
                const existing = await executeQuery(`SELECT id FROM Employees WHERE nationalId = ? AND propertyId = ?`, [emp.nationalId, ACTIVE_PROPERTY_ID]);
                if (existing.length > 0) {
                    console.warn(`Skipping import for employee with duplicate National ID: ${emp.nationalId}`);
                    continue; // Skip this employee due to duplicate
                }
                await employeeApi.create(emp); 
            } catch(e) { 
                console.warn("Import skip:", e); 
                throw e; // Re-throw to be caught by toast context
            }
        }
        window.dispatchEvent(new CustomEvent('datachanged', { detail: { table: 'Employees' } }));
    }
};

export const reportsApi = {
    getOccupancyReport: async (propertyId?: number): Promise<OccupancyReportRow[]> => {
        const pid = propertyId || ACTIVE_PROPERTY_ID;
        const sql = `
            SELECT 
                p.code as propertyCode, 
                p.displayName as propertyName, 
                b.name as buildingName, 
                b.location as buildingLocation, 
                r.roomNumber, 
                r.roomType, 
                r.capacity, 
                r.currentOccupancy as currentOccupants, 
                (r.capacity - r.currentOccupancy) as availableBeds, 
                r.status as roomStatus 
            FROM Rooms r 
            JOIN Floors f ON r.floorId = f.id 
            JOIN Buildings b ON f.buildingId = b.id 
            JOIN Properties p ON r.propertyId = p.id
            WHERE r.propertyId = ?
        `;
        return await executeQuery(sql, [pid]) as OccupancyReportRow[];
    },
    getEmployeeHousingReport: async (propertyId?: number): Promise<EmployeeHousingReportRow[]> => {
        const pid = propertyId || ACTIVE_PROPERTY_ID;
        const sql = `
            SELECT 
                p.code as propertyCode,
                (e.firstName || ' ' || e.lastName) as fullName, 
                e.employeeId, 
                e.clockId,
                e.nationalId, 
                e.gender, 
                e.phone, 
                e.department, 
                e.workLocation,
                e.address,
                e.dateOfBirth,
                e.jobTitle, 
                e.level, 
                e.status,
                b.name as buildingName, 
                r.roomNumber, 
                r.roomType, 
                a.checkInDate, 
                a.expectedCheckOutDate, 
                a.checkOutDate, 
                e.contractStartDate 
            FROM Assignments a 
            JOIN Employees e ON a.employeeId = e.id 
            JOIN Rooms r ON a.roomId = r.id 
            JOIN Floors f ON r.floorId = f.id 
            JOIN Buildings b ON f.buildingId = b.id 
            JOIN Properties p ON a.propertyId = p.id
            WHERE a.propertyId = ?
        `;
        return await executeQuery(sql, [pid]) as EmployeeHousingReportRow[];
    },
    getCurrentInHouseReport: async (propertyId?: number): Promise<any[]> => {
        const pid = propertyId || ACTIVE_PROPERTY_ID;
        const sql = `
            SELECT 
                p.code as propertyCode,
                (e.firstName || ' ' || e.lastName) as fullName, 
                e.employeeId as clockId, 
                e.nationalId, 
                e.gender, 
                e.department, 
                e.workLocation,
                e.address,
                e.dateOfBirth,
                e.jobTitle, 
                b.name as buildingName, 
                r.roomNumber, 
                r.roomType, 
                a.checkInDate,
                e.contractStartDate 
            FROM Assignments a 
            JOIN Employees e ON a.employeeId = e.id 
            JOIN Rooms r ON a.roomId = r.id 
            JOIN Floors f ON r.floorId = f.id 
            JOIN Buildings b ON f.buildingId = b.id 
            JOIN Properties p ON a.propertyId = p.id
            WHERE a.propertyId = ? AND a.checkOutDate IS NULL
        `;
        return await executeQuery(sql, [pid]);
    },
    getMaintenanceStatusReport: async (propertyId?: number): Promise<any[]> => {
        const pid = propertyId || ACTIVE_PROPERTY_ID;
        const sql = `
            SELECT 
                p.code as propertyCode,
                b.name as buildingName, 
                f.floorNumber, 
                r.roomNumber, 
                r.roomType, 
                m.problemType, 
                m.description, 
                m.priority, 
                m.status, 
                m.reportedAt, 
                m.dueDate 
            FROM MaintenanceRequests m 
            JOIN Rooms r ON m.roomId = r.id 
            JOIN Floors f ON r.floorId = f.id 
            JOIN Buildings b ON f.buildingId = b.id 
            JOIN Properties p ON m.propertyId = p.id
            WHERE m.propertyId = ?
        `;
        return await executeQuery(sql, [pid]);
    },
    getReservationsReport: async (propertyId?: number): Promise<any[]> => {
        const pid = propertyId || ACTIVE_PROPERTY_ID;
        const sql = `
            SELECT 
                p.code as propertyCode,
                (firstName || ' ' || lastName) as fullName,
                guestIdCardNumber,
                guestPhone,
                department,
                jobTitle,
                r.roomNumber,
                r.roomType,
                checkInDate,
                checkOutDate,
                res.notes
            FROM Reservations res
            JOIN Rooms r ON res.roomId = r.id
            JOIN Properties p ON res.propertyId = p.id
            WHERE res.propertyId = ?
        `;
        return await executeQuery(sql, [pid]);
    },
    getHostingsReport: async (propertyId?: number): Promise<any[]> => {
        const pid = propertyId || ACTIVE_PROPERTY_ID;
        const sql = `
            SELECT 
                p.code as propertyCode,
                (e.firstName || ' ' || e.lastName) as hostName,
                (guestFirstName || ' ' || guestLastName) as guestName,
                guestIdCardNumber,
                r.roomNumber,
                r.roomType,
                startDate,
                endDate,
                h.status,
                h.notes
            FROM Hostings h
            JOIN Employees e ON h.employeeId = e.id
            JOIN Rooms r ON h.roomId = r.id
            JOIN Properties p ON h.propertyId = p.id
            WHERE h.propertyId = ?
        `;
        return await executeQuery(sql, [pid]);
    }
};

export const settingsApi = {
    getSettings: async (): Promise<AppSettings> => {
        const results = await executeQuery(`SELECT * FROM AppSettings`);
        const settings: any = {};
        results.forEach(row => { settings[row.key] = JSON.parse(row.value); });
        return { ...DEFAULT_SETTINGS, ...settings } as AppSettings;
    },
    updateSettings: async (newSettings: Partial<AppSettings>): Promise<void> => {
        for (const [key, value] of Object.entries(newSettings)) {
            await executeNonQuery(`INSERT OR REPLACE INTO AppSettings (key, value) VALUES (?, ?)`, [key, JSON.stringify(value)]);
        }
        window.dispatchEvent(new CustomEvent('settingschanged'));
    }
};

export const resetDatabase = async () => {
    const idb = await openIndexedDB();
    const transaction = idb.transaction('files', 'readwrite');
    const store = transaction.objectStore('files');
    await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
    idb.close();
    location.reload();
};
