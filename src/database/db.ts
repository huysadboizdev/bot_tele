import { DatabaseSync } from 'node:sqlite';
import { CONFIG } from '../config/env';
import { CREATE_TABLES_SQL } from './schema';

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
    
    // Khởi tạo các bảng rỗng sạch sẽ
    Database.instance.exec(CREATE_TABLES_SQL);

    // Tự động nâng cấp các cột mới nếu database đã tồn tại từ phiên bản trước
    try {
      Database.instance.exec('ALTER TABLE tasks ADD COLUMN overdue_prompted INTEGER DEFAULT 0;');
    } catch (_) {}

    try {
      Database.instance.exec('ALTER TABLE tasks ADD COLUMN extension_count INTEGER DEFAULT 0;');
    } catch (_) {}

    try {
      Database.instance.exec('ALTER TABLE tasks ADD COLUMN extension_reason TEXT;');
    } catch (_) {}
  }

  public static close() {
    if (Database.instance) {
      Database.instance.close();
      Database.instance = null;
    }
  }
}
