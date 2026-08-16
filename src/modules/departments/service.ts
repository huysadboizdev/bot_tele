import { Database } from '../../database/db';

export interface Department {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export class DepartmentService {
  public static getAll(): Department[] {
    const db = Database.getDb();
    const query = db.prepare('SELECT * FROM departments ORDER BY name ASC');
    return query.all() as unknown as Department[];
  }

  public static getById(id: string): Department | null {
    const db = Database.getDb();
    const query = db.prepare('SELECT * FROM departments WHERE id = ?');
    return (query.get(id) as unknown as Department) || null;
  }

  public static findByNameOrSlug(search: string): Department | null {
    const db = Database.getDb();
    const cleanSearch = search.trim().toLowerCase();
    
    // Tìm chính xác theo id hoặc tên gần đúng
    const query = db.prepare(`
      SELECT * FROM departments 
      WHERE LOWER(id) = ? 
         OR LOWER(name) = ?
         OR LOWER(name) LIKE ?
      LIMIT 1
    `);
    return (query.get(cleanSearch, cleanSearch, `%${cleanSearch}%`) as unknown as Department) || null;
  }

  public static create(id: string, name: string, description?: string): boolean {
    const db = Database.getDb();
    try {
      const stmt = db.prepare('INSERT INTO departments (id, name, description) VALUES (?, ?, ?)');
      stmt.run(id.toLowerCase().trim(), name.trim(), description || null);
      return true;
    } catch (error) {
      console.error('Error creating department:', error);
      return false;
    }
  }

  public static update(id: string, name: string, description?: string): boolean {
    const db = Database.getDb();
    try {
      const stmt = db.prepare(`
        UPDATE departments 
        SET name = ?, description = COALESCE(?, description)
        WHERE id = ?
      `);
      stmt.run(name.trim(), description || null, id.toLowerCase().trim());
      return true;
    } catch (error) {
      console.error('Error updating department:', error);
      return false;
    }
  }

  public static delete(id: string): boolean {
    const db = Database.getDb();
    try {
      const stmt = db.prepare('DELETE FROM departments WHERE id = ?');
      stmt.run(id);
      return true;
    } catch (error) {
      console.error('Error deleting department:', error);
      return false;
    }
  }
}
