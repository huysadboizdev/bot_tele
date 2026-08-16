import { DatabaseSync } from 'node:sqlite';
import { CONFIG } from '../config/env';
import { CREATE_TABLES_SQL, DEFAULT_DEPARTMENTS } from './schema';

export class Database {
  private static instance: DatabaseSync | null = null;

  public static getDb(): DatabaseSync {
    if (!Database.instance) {
      Database.instance = new DatabaseSync(CONFIG.DATABASE_PATH);
      Database.instance.exec('PRAGMA foreign_keys = ON;');
      Database.instance.exec('PRAGMA journal_mode = WAL;');
      Database.initTables();
    }
    return Database.instance;
  }

  private static initTables() {
    if (!Database.instance) return;
    
    // Khởi tạo các bảng
    Database.instance.exec(CREATE_TABLES_SQL);

    // Khởi tạo phòng ban mặc định nếu chưa có
    const countQuery = Database.instance.prepare('SELECT COUNT(*) as count FROM departments');
    const result = countQuery.get() as { count: number };

    if (result && result.count === 0) {
      const insertDept = Database.instance.prepare(
        'INSERT INTO departments (id, name, description) VALUES (?, ?, ?)'
      );
      for (const dept of DEFAULT_DEPARTMENTS) {
        insertDept.run(dept.id, dept.name, dept.description);
      }
      console.log('✅ Đã khởi tạo các phòng ban mặc định cho công ty.');
    }
  }

  public static close() {
    if (Database.instance) {
      Database.instance.close();
      Database.instance = null;
    }
  }
}
