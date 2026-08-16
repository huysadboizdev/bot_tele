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
    
    // Khởi tạo các bảng rỗng sạch sẽ, không tự động thêm dữ liệu mẫu
    Database.instance.exec(CREATE_TABLES_SQL);
  }

  public static close() {
    if (Database.instance) {
      Database.instance.close();
      Database.instance = null;
    }
  }
}
