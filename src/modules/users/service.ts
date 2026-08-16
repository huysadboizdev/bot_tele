import { Database } from '../../database/db';
import { CONFIG } from '../../config/env';

export interface User {
  telegram_id: number;
  username: string | null;
  full_name: string;
  title: string | null;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  department_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PendingAssignment {
  username: string;
  role: string | null;
  department_id: string | null;
  title: string | null;
  created_at: string;
}

export class UserService {
  public static upsertUser(
    telegramId: number,
    username: string | null | undefined,
    fullName: string
  ): User {
    const db = Database.getDb();
    const cleanUsername = username ? username.replace(/^@/, '').toLowerCase().trim() : null;
    const isSuperAdmin = CONFIG.ADMIN_IDS.includes(telegramId);
    let defaultRole: 'ADMIN' | 'MANAGER' | 'EMPLOYEE' = isSuperAdmin ? 'ADMIN' : 'EMPLOYEE';
    let defaultDept: string | null = null;
    let defaultTitle: string | null = null;

    // Kiểm tra xem có phân quyền, phòng ban hoặc chức vụ chờ sẵn cho username này không
    if (cleanUsername) {
      const pendingQuery = db.prepare('SELECT * FROM pending_assignments WHERE username = ?');
      const pending = pendingQuery.get(cleanUsername) as unknown as PendingAssignment | undefined;

      if (pending) {
        if (pending.role && !isSuperAdmin) {
          defaultRole = pending.role as 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
        }
        if (pending.department_id) {
          defaultDept = pending.department_id;
        }
        if (pending.title) {
          defaultTitle = pending.title;
        }
      }
    }

    const existing = UserService.getById(telegramId);

    if (existing) {
      const stmt = db.prepare(`
        UPDATE users 
        SET username = ?, 
            full_name = ?, 
            department_id = COALESCE(?, department_id),
            title = COALESCE(?, title),
            role = CASE WHEN ? = 'ADMIN' THEN 'ADMIN' ELSE role END,
            updated_at = datetime('now', 'localtime')
        WHERE telegram_id = ?
      `);
      stmt.run(cleanUsername, fullName, defaultDept, defaultTitle, defaultRole, telegramId);

      if (isSuperAdmin && existing.role !== 'ADMIN') {
        UserService.setRole(telegramId, 'ADMIN');
      }
    } else {
      const stmt = db.prepare(`
        INSERT INTO users (telegram_id, username, full_name, role, department_id, title)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(telegramId, cleanUsername, fullName, defaultRole, defaultDept, defaultTitle);
    }

    // Xóa record pending nếu có
    if (cleanUsername) {
      const delStmt = db.prepare('DELETE FROM pending_assignments WHERE username = ?');
      delStmt.run(cleanUsername);
    }

    return UserService.getById(telegramId)!;
  }

  public static getById(telegramId: number): User | null {
    const db = Database.getDb();
    const query = db.prepare('SELECT * FROM users WHERE telegram_id = ?');
    return (query.get(telegramId) as unknown as User) || null;
  }

  public static getByUsername(username: string): User | null {
    const db = Database.getDb();
    const cleanUsername = username.replace(/^@/, '').toLowerCase().trim();
    const query = db.prepare('SELECT * FROM users WHERE LOWER(username) = ?');
    return (query.get(cleanUsername) as unknown as User) || null;
  }

  public static getByDepartment(departmentId: string): User[] {
    const db = Database.getDb();
    const query = db.prepare('SELECT * FROM users WHERE department_id = ? ORDER BY full_name ASC');
    return query.all(departmentId) as unknown as User[];
  }

  public static getAll(): (User & { department_name: string | null })[] {
    const db = Database.getDb();
    const query = db.prepare(`
      SELECT u.*, d.name as department_name 
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      ORDER BY u.role DESC, u.full_name ASC
    `);
    return query.all() as unknown as (User & { department_name: string | null })[];
  }

  public static setDepartment(telegramId: number, departmentId: string | null): boolean {
    const db = Database.getDb();
    try {
      const stmt = db.prepare(`
        UPDATE users 
        SET department_id = ?, updated_at = datetime('now', 'localtime')
        WHERE telegram_id = ?
      `);
      stmt.run(departmentId, telegramId);
      return true;
    } catch (error) {
      console.error('Error setting user department:', error);
      return false;
    }
  }

  public static setTitle(telegramId: number, title: string | null): boolean {
    const db = Database.getDb();
    try {
      const stmt = db.prepare(`
        UPDATE users 
        SET title = ?, updated_at = datetime('now', 'localtime')
        WHERE telegram_id = ?
      `);
      stmt.run(title ? title.trim() : null, telegramId);
      return true;
    } catch (error) {
      console.error('Error setting user title:', error);
      return false;
    }
  }

  public static setRole(telegramId: number, role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'): boolean {
    const db = Database.getDb();
    try {
      const stmt = db.prepare(`
        UPDATE users 
        SET role = ?, updated_at = datetime('now', 'localtime')
        WHERE telegram_id = ?
      `);
      stmt.run(role, telegramId);
      return true;
    } catch (error) {
      console.error('Error setting user role:', error);
      return false;
    }
  }

  /**
   * Phân quyền trực tiếp hoặc lưu tạm chờ kích hoạt khi username chưa tương tác với bot
   */
  public static setRoleByUsername(username: string, role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'): { status: 'UPDATED' | 'PENDING', fullName?: string } {
    const cleanUsername = username.replace(/^@/, '').toLowerCase().trim();
    const user = UserService.getByUsername(cleanUsername);

    if (user) {
      UserService.setRole(user.telegram_id, role);
      return { status: 'UPDATED', fullName: user.full_name };
    } else {
      const db = Database.getDb();
      const stmt = db.prepare(`
        INSERT INTO pending_assignments (username, role)
        VALUES (?, ?)
        ON CONFLICT(username) DO UPDATE SET role = excluded.role
      `);
      stmt.run(cleanUsername, role);
      return { status: 'PENDING' };
    }
  }

  /**
   * Gán phòng ban trực tiếp hoặc lưu tạm chờ kích hoạt khi username chưa tương tác với bot
   */
  public static setDepartmentByUsername(username: string, departmentId: string): { status: 'UPDATED' | 'PENDING', fullName?: string } {
    const cleanUsername = username.replace(/^@/, '').toLowerCase().trim();
    const user = UserService.getByUsername(cleanUsername);

    if (user) {
      UserService.setDepartment(user.telegram_id, departmentId);
      return { status: 'UPDATED', fullName: user.full_name };
    } else {
      const db = Database.getDb();
      const stmt = db.prepare(`
        INSERT INTO pending_assignments (username, department_id)
        VALUES (?, ?)
        ON CONFLICT(username) DO UPDATE SET department_id = excluded.department_id
      `);
      stmt.run(cleanUsername, departmentId);
      return { status: 'PENDING' };
    }
  }

  /**
   * Gán chức danh trực tiếp hoặc lưu tạm chờ kích hoạt
   */
  public static setTitleByUsername(username: string, title: string): { status: 'UPDATED' | 'PENDING', fullName?: string } {
    const cleanUsername = username.replace(/^@/, '').toLowerCase().trim();
    const cleanTitle = title.trim();
    const user = UserService.getByUsername(cleanUsername);

    if (user) {
      UserService.setTitle(user.telegram_id, cleanTitle);
      return { status: 'UPDATED', fullName: user.full_name };
    } else {
      const db = Database.getDb();
      const stmt = db.prepare(`
        INSERT INTO pending_assignments (username, title)
        VALUES (?, ?)
        ON CONFLICT(username) DO UPDATE SET title = excluded.title
      `);
      stmt.run(cleanUsername, cleanTitle);
      return { status: 'PENDING' };
    }
  }

  /**
   * Gán đồng thời Phòng ban + Chức vụ (+ Quyền tự động)
   */
  public static setUserDeptAndTitle(
    username: string,
    departmentId: string,
    title: string,
    role?: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
  ): { status: 'UPDATED' | 'PENDING', fullName?: string; appliedRole: 'ADMIN' | 'MANAGER' | 'EMPLOYEE' } {
    const cleanUsername = username.replace(/^@/, '').toLowerCase().trim();
    const cleanTitle = title.trim();
    let targetRole: 'ADMIN' | 'MANAGER' | 'EMPLOYEE' = role || 'EMPLOYEE';

    // Tự động thăng hạng MANAGER nếu chức danh có yếu tố quản lý/trưởng
    if (!role) {
      if (/trưởng|phó|leader|quản lý|manager|director|giám đốc|chủ nhiệm/i.test(cleanTitle)) {
        targetRole = 'MANAGER';
      }
    }

    const user = UserService.getByUsername(cleanUsername);
    if (user) {
      UserService.setDepartment(user.telegram_id, departmentId);
      UserService.setTitle(user.telegram_id, cleanTitle);
      if (user.role !== 'ADMIN') {
        UserService.setRole(user.telegram_id, targetRole);
      }
      return { status: 'UPDATED', fullName: user.full_name, appliedRole: user.role === 'ADMIN' ? 'ADMIN' : targetRole };
    } else {
      const db = Database.getDb();
      const stmt = db.prepare(`
        INSERT INTO pending_assignments (username, department_id, title, role)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(username) DO UPDATE SET 
          department_id = excluded.department_id,
          title = excluded.title,
          role = excluded.role
      `);
      stmt.run(cleanUsername, departmentId, cleanTitle, targetRole);
      return { status: 'PENDING', appliedRole: targetRole };
    }
  }

  /**
   * Xóa nhân viên khỏi phòng ban (set department_id = null)
   */
  public static removeDepartmentByUsername(username: string): { status: 'REMOVED' | 'NOT_FOUND', fullName?: string } {
    const cleanUsername = username.replace(/^@/, '').toLowerCase().trim();
    const user = UserService.getByUsername(cleanUsername);

    if (user) {
      UserService.setDepartment(user.telegram_id, null);
      return { status: 'REMOVED', fullName: user.full_name };
    } else {
      const db = Database.getDb();
      const stmt = db.prepare('UPDATE pending_assignments SET department_id = NULL WHERE username = ?');
      stmt.run(cleanUsername);
      return { status: 'NOT_FOUND' };
    }
  }

  /**
   * Xóa hoàn toàn người dùng khỏi hệ thống
   */
  public static deleteUserByUsername(username: string): { status: 'DELETED' | 'NOT_FOUND', fullName?: string } {
    const cleanUsername = username.replace(/^@/, '').toLowerCase().trim();
    const user = UserService.getByUsername(cleanUsername);
    const db = Database.getDb();

    if (user) {
      const stmt = db.prepare('DELETE FROM users WHERE telegram_id = ?');
      stmt.run(user.telegram_id);
      return { status: 'DELETED', fullName: user.full_name };
    } else {
      const stmt = db.prepare('DELETE FROM pending_assignments WHERE username = ?');
      stmt.run(cleanUsername);
      return { status: 'NOT_FOUND' };
    }
  }

  public static deleteUser(telegramId: number): boolean {
    const db = Database.getDb();
    try {
      const stmt = db.prepare('DELETE FROM users WHERE telegram_id = ?');
      stmt.run(telegramId);
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  public static isAdmin(telegramId: number): boolean {
    if (CONFIG.ADMIN_IDS.includes(telegramId)) return true;
    const user = UserService.getById(telegramId);
    return user ? user.role === 'ADMIN' || user.role === 'MANAGER' : false;
  }
}
