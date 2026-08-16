import { Database } from '../../database/db';
import { CONFIG } from '../../config/env';

export interface User {
  telegram_id: number;
  username: string | null;
  full_name: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  department_id: string | null;
  created_at: string;
  updated_at: string;
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
    const defaultRole = isSuperAdmin ? 'ADMIN' : 'EMPLOYEE';

    const existing = UserService.getById(telegramId);

    if (existing) {
      const stmt = db.prepare(`
        UPDATE users 
        SET username = ?, full_name = ?, updated_at = datetime('now', 'localtime')
        WHERE telegram_id = ?
      `);
      stmt.run(cleanUsername, fullName, telegramId);
      
      // Đảm bảo nếu ID trong ADMIN_IDS thì luôn giữ quyền ADMIN
      if (isSuperAdmin && existing.role !== 'ADMIN') {
        UserService.setRole(telegramId, 'ADMIN');
      }
      return UserService.getById(telegramId)!;
    } else {
      const stmt = db.prepare(`
        INSERT INTO users (telegram_id, username, full_name, role)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(telegramId, cleanUsername, fullName, defaultRole);
      return UserService.getById(telegramId)!;
    }
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

  public static isAdmin(telegramId: number): boolean {
    if (CONFIG.ADMIN_IDS.includes(telegramId)) return true;
    const user = UserService.getById(telegramId);
    return user ? user.role === 'ADMIN' || user.role === 'MANAGER' : false;
  }
}
