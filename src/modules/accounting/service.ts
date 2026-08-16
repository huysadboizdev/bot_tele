import { Database } from '../../database/db';
import { UserService } from '../users/service';
import { DepartmentService } from '../departments/service';

export interface FinancialTransaction {
  id: number;
  type: 'CHI' | 'THU';
  title: string;
  amount: number;
  payer_id: number | null;
  payer_name: string | null;
  payment_method: 'BANK' | 'CASH';
  split_type: 'ALL' | 'DEPARTMENT' | 'CUSTOM' | 'NONE';
  split_target: string | null;
  total_members: number;
  amount_per_person: number;
  group_chat_id: string | null;
  created_by: number;
  created_at: string;
  creator_name?: string;
  creator_username?: string;
}

export interface TransactionSplit {
  id: number;
  transaction_id: number;
  user_id: number | null;
  username: string;
  full_name: string | null;
  amount_owed: number;
  is_paid: number;
  paid_at: string | null;
  confirmed_by: number | null;
  confirmed_at: string | null;
}

export class AccountingService {
  /**
   * Chuyển đổi định dạng số tiền thông minh: 500k, 1.5tr, 1tr5, 2m, 2000000 -> number
   */
  public static parseMoney(input: string): number {
    if (!input) return 0;
    const clean = input.toLowerCase().replace(/[,.\s_]/g, '').trim();

    // 1tr5 -> 1500000
    const trKMatch = clean.match(/^(\d+)tr(\d+)(k?)$/);
    if (trKMatch) {
      const trPart = Number(trKMatch[1]) * 1000000;
      const sub = trKMatch[2];
      const subNumber = Number(sub);
      const multiplier = sub.length === 1 ? 100000 : sub.length === 2 ? 10000 : 1000;
      return trPart + subNumber * multiplier;
    }

    // 1.5tr / 1.5m / 2tr / 2m / 2trieu
    const trMatch = input.toLowerCase().replace(/,/g, '.').match(/^([\d.]+)\s*(?:tr|m|trieu|triệu)$/);
    if (trMatch) {
      return Math.round(parseFloat(trMatch[1]) * 1000000);
    }

    // 500k / 50k / 100k / 500ngan / 500nghìn
    const kMatch = input.toLowerCase().replace(/,/g, '.').match(/^([\d.]+)\s*(?:k|ngan|ngàn|nghin|nghìn)$/);
    if (kMatch) {
      return Math.round(parseFloat(kMatch[1]) * 1000);
    }

    // Số thuần: 500000, 2000000
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }

  public static formatMoney(amount: number): string {
    return (amount || 0).toLocaleString('vi-VN') + ' VNĐ';
  }

  /**
   * Tạo khoản chi tiêu tài nguyên và tự động chia đều tiền
   */
  public static createExpense(data: {
    title: string;
    amount: number;
    payerId?: number;
    payerName?: string;
    paymentMethod: 'BANK' | 'CASH';
    splitType: 'ALL' | 'DEPARTMENT' | 'CUSTOM' | 'NONE';
    splitTarget?: string;
    targetUsernames?: string[];
    groupChatId?: string;
    createdBy: number;
  }): { transaction: FinancialTransaction; splits: TransactionSplit[] } {
    const db = Database.getDb();

    // 1. Xác định danh sách thành viên tham gia chia tiền
    let participatingUsers: { userId?: number; username: string; fullName: string }[] = [];

    if (data.splitType === 'ALL') {
      const all = UserService.getAll();
      participatingUsers = all.map(u => ({
        userId: u.telegram_id,
        username: u.username || `id_${u.telegram_id}`,
        fullName: u.full_name,
      }));
    } else if (data.splitType === 'DEPARTMENT' && data.splitTarget) {
      const members = UserService.getByDepartment(data.splitTarget);
      participatingUsers = members.map(u => ({
        userId: u.telegram_id,
        username: u.username || `id_${u.telegram_id}`,
        fullName: u.full_name,
      }));
    } else if (data.targetUsernames && data.targetUsernames.length > 0) {
      for (const uname of data.targetUsernames) {
        const cleanUname = uname.replace(/^@/, '').toLowerCase().trim();
        const user = UserService.getByUsername(cleanUname);
        participatingUsers.push({
          userId: user?.telegram_id,
          username: cleanUname,
          fullName: user?.full_name || `@${cleanUname}`,
        });
      }
    }

    // Nếu không chỉ định ai tham gia -> chia cho chính người tạo
    if (participatingUsers.length === 0) {
      const creator = UserService.getById(data.createdBy);
      participatingUsers.push({
        userId: data.createdBy,
        username: creator?.username || `id_${data.createdBy}`,
        fullName: creator?.full_name || 'Người tạo',
      });
    }

    const totalMembers = participatingUsers.length;
    const amountPerPerson = Math.round(data.amount / totalMembers);

    // 2. Ghi nhận giao dịch chính
    const stmt = db.prepare(`
      INSERT INTO financial_transactions (
        type, title, amount, payer_id, payer_name, payment_method,
        split_type, split_target, total_members, amount_per_person,
        group_chat_id, created_by
      ) VALUES ('CHI', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.title.trim(),
      data.amount,
      data.payerId || null,
      data.payerName || null,
      data.paymentMethod,
      data.splitType,
      data.splitTarget || null,
      totalMembers,
      amountPerPerson,
      data.groupChatId || null,
      data.createdBy
    );

    const transactionId = Number(result.lastInsertRowid);

    // 3. Ghi nhận chi tiết chia tiền từng người
    const splitStmt = db.prepare(`
      INSERT INTO transaction_splits (
        transaction_id, user_id, username, full_name, amount_owed, is_paid
      ) VALUES (?, ?, ?, ?, ?, 0)
    `);

    for (const p of participatingUsers) {
      splitStmt.run(transactionId, p.userId || null, p.username, p.fullName, amountPerPerson);
    }

    const transaction = AccountingService.getById(transactionId)!;
    const splits = AccountingService.getSplits(transactionId);
    return { transaction, splits };
  }

  /**
   * Tạo khoản thu tiền
   */
  public static createIncome(data: {
    title: string;
    amount: number;
    payerId?: number;
    payerName?: string;
    paymentMethod: 'BANK' | 'CASH';
    groupChatId?: string;
    createdBy: number;
  }): FinancialTransaction {
    const db = Database.getDb();
    const stmt = db.prepare(`
      INSERT INTO financial_transactions (
        type, title, amount, payer_id, payer_name, payment_method,
        split_type, total_members, amount_per_person, group_chat_id, created_by
      ) VALUES ('THU', ?, ?, ?, ?, ?, 'NONE', 1, ?, ?, ?)
    `);

    const result = stmt.run(
      data.title.trim(),
      data.amount,
      data.payerId || null,
      data.payerName || null,
      data.paymentMethod,
      data.amount,
      data.groupChatId || null,
      data.createdBy
    );

    return AccountingService.getById(Number(result.lastInsertRowid))!;
  }

  public static getById(id: number): FinancialTransaction | null {
    const db = Database.getDb();
    const query = db.prepare(`
      SELECT ft.*, u.full_name as creator_name, u.username as creator_username
      FROM financial_transactions ft
      LEFT JOIN users u ON ft.created_by = u.telegram_id
      WHERE ft.id = ?
    `);
    return (query.get(id) as unknown as FinancialTransaction) || null;
  }

  public static getSplits(transactionId: number): TransactionSplit[] {
    const db = Database.getDb();
    const query = db.prepare(`
      SELECT * FROM transaction_splits 
      WHERE transaction_id = ?
      ORDER BY id ASC
    `);
    return query.all(transactionId) as unknown as TransactionSplit[];
  }

  public static markSplitPaid(
    transactionId: number,
    username: string,
    isPaid: boolean = true,
    confirmedBy?: number
  ): boolean {
    const db = Database.getDb();
    const cleanUsername = username.replace(/^@/, '').toLowerCase().trim();
    try {
      const stmt = db.prepare(`
        UPDATE transaction_splits
        SET is_paid = ?,
            paid_at = CASE WHEN ? = 1 THEN datetime('now', 'localtime') ELSE NULL END,
            confirmed_by = ?,
            confirmed_at = CASE WHEN ? = 1 THEN datetime('now', 'localtime') ELSE NULL END
        WHERE transaction_id = ? AND LOWER(username) = ?
      `);
      stmt.run(isPaid ? 1 : 0, isPaid ? 1 : 0, confirmedBy || null, isPaid ? 1 : 0, transactionId, cleanUsername);
      return true;
    } catch (error) {
      console.error('Error marking split paid:', error);
      return false;
    }
  }

  public static getAll(limit: number = 30, type?: 'CHI' | 'THU'): FinancialTransaction[] {
    const db = Database.getDb();
    let sql = `
      SELECT ft.*, u.full_name as creator_name, u.username as creator_username
      FROM financial_transactions ft
      LEFT JOIN users u ON ft.created_by = u.telegram_id
    `;
    if (type) {
      sql += ' WHERE ft.type = ? ORDER BY ft.created_at DESC LIMIT ?';
      const query = db.prepare(sql);
      return query.all(type, limit) as unknown as FinancialTransaction[];
    } else {
      sql += ' ORDER BY ft.created_at DESC LIMIT ?';
      const query = db.prepare(sql);
      return query.all(limit) as unknown as FinancialTransaction[];
    }
  }

  public static getByDate(dateStr: string): FinancialTransaction[] {
    const db = Database.getDb();
    const query = db.prepare(`
      SELECT ft.*, u.full_name as creator_name, u.username as creator_username
      FROM financial_transactions ft
      LEFT JOIN users u ON ft.created_by = u.telegram_id
      WHERE DATE(ft.created_at) = ?
      ORDER BY ft.created_at DESC
    `);
    return query.all(dateStr) as unknown as FinancialTransaction[];
  }

  public static getUnpaidDebts(username?: string): (TransactionSplit & { transaction_title: string; payer_name: string; created_at: string })[] {
    const db = Database.getDb();
    let sql = `
      SELECT ts.*, ft.title as transaction_title, ft.payer_name, ft.created_at
      FROM transaction_splits ts
      JOIN financial_transactions ft ON ts.transaction_id = ft.id
      WHERE ts.is_paid = 0
    `;
    if (username) {
      const cleanUsername = username.replace(/^@/, '').toLowerCase().trim();
      sql += ' AND LOWER(ts.username) = ? ORDER BY ts.id DESC';
      const query = db.prepare(sql);
      return query.all(cleanUsername) as unknown as (TransactionSplit & { transaction_title: string; payer_name: string; created_at: string })[];
    } else {
      sql += ' ORDER BY ts.id DESC';
      const query = db.prepare(sql);
      return query.all() as unknown as (TransactionSplit & { transaction_title: string; payer_name: string; created_at: string })[];
    }
  }

  public static getFundSummary() {
    const db = Database.getDb();
    const totalIncomeQuery = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM financial_transactions WHERE type = 'THU'");
    const totalExpenseQuery = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM financial_transactions WHERE type = 'CHI'");
    const unpaidDebtQuery = db.prepare('SELECT COALESCE(SUM(amount_owed), 0) as total FROM transaction_splits WHERE is_paid = 0');

    const totalIncome = (totalIncomeQuery.get() as { total: number }).total;
    const totalExpense = (totalExpenseQuery.get() as { total: number }).total;
    const unpaidDebts = (unpaidDebtQuery.get() as { total: number }).total;
    const currentFund = totalIncome - totalExpense;

    return {
      totalIncome,
      totalExpense,
      currentFund,
      unpaidDebts,
    };
  }
}
