import { Database } from '../../database/db';

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  assigned_by: number;
  assigned_to: number | null;
  department_id: string | null;
  group_chat_id: string | null;
  message_id: number | null;
  deadline: string | null;
  reminded_24h: number;
  reminded_2h: number;
  overdue_prompted: number;
  extension_count: number;
  extension_reason: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  // Joined fields
  assigner_name?: string;
  assigner_username?: string | null;
  assignee_name?: string | null;
  assignee_username?: string | null;
  assignee_title?: string | null;
  department_name?: string | null;
}

export interface CreateTaskDTO {
  title: string;
  description?: string;
  assignedBy: number;
  assignedTo?: number;
  departmentId?: string;
  groupChatId?: string;
  messageId?: number;
  deadline?: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

export class TaskService {
  public static create(dto: CreateTaskDTO): Task {
    const db = Database.getDb();
    const stmt = db.prepare(`
      INSERT INTO tasks (
        title, description, assigned_by, assigned_to, department_id,
        group_chat_id, message_id, deadline, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      dto.title,
      dto.description || null,
      dto.assignedBy,
      dto.assignedTo || null,
      dto.departmentId || null,
      dto.groupChatId || null,
      dto.messageId || null,
      dto.deadline || null,
      dto.priority || 'NORMAL'
    );

    const taskId = Number(result.lastInsertRowid);

    // Ghi log tạo task
    const logStmt = db.prepare(`
      INSERT INTO task_logs (task_id, user_id, action, note)
      VALUES (?, ?, 'CREATED', 'Tạo công việc mới')
    `);
    logStmt.run(taskId, dto.assignedBy);

    return TaskService.getById(taskId)!;
  }

  public static getById(id: number): Task | null {
    const db = Database.getDb();
    const query = db.prepare(`
      SELECT 
        t.*,
        u1.full_name as assigner_name,
        u1.username as assigner_username,
        u2.full_name as assignee_name,
        u2.username as assignee_username,
        u2.title as assignee_title,
        d.name as department_name
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_by = u1.telegram_id
      LEFT JOIN users u2 ON t.assigned_to = u2.telegram_id
      LEFT JOIN departments d ON t.department_id = d.id
      WHERE t.id = ?
    `);
    return (query.get(id) as unknown as Task) || null;
  }

  public static getByUser(userId: number, status?: string): Task[] {
    const db = Database.getDb();
    let sql = `
      SELECT 
        t.*,
        u1.full_name as assigner_name,
        u1.username as assigner_username,
        u2.full_name as assignee_name,
        u2.username as assignee_username,
        u2.title as assignee_title,
        d.name as department_name
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_by = u1.telegram_id
      LEFT JOIN users u2 ON t.assigned_to = u2.telegram_id
      LEFT JOIN departments d ON t.department_id = d.id
      WHERE (t.assigned_to = ? OR t.department_id IN (SELECT department_id FROM users WHERE telegram_id = ?))
    `;

    if (status) {
      sql += ' AND t.status = ?';
      sql += ' ORDER BY t.created_at DESC';
      const query = db.prepare(sql);
      return query.all(userId, userId, status) as unknown as Task[];
    } else {
      sql += " AND t.status IN ('PENDING', 'IN_PROGRESS')";
      sql += ' ORDER BY t.created_at DESC';
      const query = db.prepare(sql);
      return query.all(userId, userId) as unknown as Task[];
    }
  }

  public static getAll(status?: string, limit: number = 50): Task[] {
    const db = Database.getDb();
    let sql = `
      SELECT 
        t.*,
        u1.full_name as assigner_name,
        u1.username as assigner_username,
        u2.full_name as assignee_name,
        u2.username as assignee_username,
        u2.title as assignee_title,
        d.name as department_name
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_by = u1.telegram_id
      LEFT JOIN users u2 ON t.assigned_to = u2.telegram_id
      LEFT JOIN departments d ON t.department_id = d.id
    `;

    if (status) {
      sql += ' WHERE t.status = ? ORDER BY t.created_at DESC LIMIT ?';
      const query = db.prepare(sql);
      return query.all(status, limit) as unknown as Task[];
    } else {
      sql += ' ORDER BY t.created_at DESC LIMIT ?';
      const query = db.prepare(sql);
      return query.all(limit) as unknown as Task[];
    }
  }

  public static updateStatus(
    taskId: number,
    newStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
    userId: number,
    note?: string
  ): Task | null {
    const db = Database.getDb();
    const task = TaskService.getById(taskId);
    if (!task) return null;

    let completedAt: string | null = null;
    if (newStatus === 'COMPLETED') {
      completedAt = new Date().toISOString();
    }

    const stmt = db.prepare(`
      UPDATE tasks 
      SET status = ?, 
          completed_at = COALESCE(?, completed_at),
          assigned_to = CASE WHEN assigned_to IS NULL AND ? = 'IN_PROGRESS' THEN ? ELSE assigned_to END,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);
    stmt.run(newStatus, completedAt, newStatus, userId, taskId);

    // Ghi nhật ký
    const logActionMap: Record<string, string> = {
      IN_PROGRESS: 'ACCEPTED',
      COMPLETED: 'COMPLETED',
      CANCELLED: 'CANCELLED',
      PENDING: 'RESET',
    };

    const action = logActionMap[newStatus] || 'UPDATED';
    const logStmt = db.prepare(`
      INSERT INTO task_logs (task_id, user_id, action, note)
      VALUES (?, ?, ?, ?)
    `);
    logStmt.run(taskId, userId, action, note || null);

    return TaskService.getById(taskId);
  }

  public static setMessageId(taskId: number, messageId: number) {
    const db = Database.getDb();
    const stmt = db.prepare('UPDATE tasks SET message_id = ? WHERE id = ?');
    stmt.run(messageId, taskId);
  }

  public static updateMessageId(taskId: number, messageId: number, groupChatId?: string) {
    const db = Database.getDb();
    const stmt = db.prepare('UPDATE tasks SET message_id = ?, group_chat_id = COALESCE(?, group_chat_id) WHERE id = ?');
    stmt.run(messageId, groupChatId || null, taskId);
  }

  public static markReminded(taskId: number, type: '24h' | '2h') {
    const db = Database.getDb();
    const field = type === '24h' ? 'reminded_24h' : 'reminded_2h';
    const stmt = db.prepare(`UPDATE tasks SET ${field} = 1 WHERE id = ?`);
    stmt.run(taskId);
  }

  public static markOverduePrompted(taskId: number) {
    const db = Database.getDb();
    const stmt = db.prepare('UPDATE tasks SET overdue_prompted = 1 WHERE id = ?');
    stmt.run(taskId);
  }

  public static extendDeadline(
    taskId: number,
    newDeadline: string,
    reason: string,
    userId: number
  ): Task | null {
    const db = Database.getDb();
    const task = TaskService.getById(taskId);
    if (!task) return null;

    const stmt = db.prepare(`
      UPDATE tasks
      SET deadline = ?,
          overdue_prompted = 0,
          reminded_24h = 0,
          reminded_2h = 0,
          extension_count = COALESCE(extension_count, 0) + 1,
          extension_reason = ?,
          status = CASE WHEN status = 'PENDING' THEN 'IN_PROGRESS' ELSE status END,
          assigned_to = COALESCE(assigned_to, ?),
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);
    stmt.run(newDeadline, reason.trim(), userId, taskId);

    const logStmt = db.prepare(`
      INSERT INTO task_logs (task_id, user_id, action, note)
      VALUES (?, ?, 'EXTENDED', ?)
    `);
    logStmt.run(taskId, userId, `Gia hạn đến ${newDeadline} - Lý do: ${reason.trim()}`);

    return TaskService.getById(taskId);
  }

  public static getTasksDueSoon(): Task[] {
    const db = Database.getDb();
    const query = db.prepare(`
      SELECT 
        t.*,
        u1.full_name as assigner_name,
        u1.username as assigner_username,
        u2.full_name as assignee_name,
        u2.username as assignee_username,
        u2.title as assignee_title,
        d.name as department_name
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_by = u1.telegram_id
      LEFT JOIN users u2 ON t.assigned_to = u2.telegram_id
      LEFT JOIN departments d ON t.department_id = d.id
      WHERE t.status IN ('PENDING', 'IN_PROGRESS')
        AND t.deadline IS NOT NULL
        AND t.deadline > datetime('now', 'localtime')
        AND t.deadline <= datetime('now', 'localtime', '+24 hours')
      ORDER BY t.deadline ASC
    `);
    return query.all() as unknown as Task[];
  }

  public static getTasksDueForOverduePrompt(): Task[] {
    const db = Database.getDb();
    const query = db.prepare(`
      SELECT 
        t.*,
        u1.full_name as assigner_name,
        u1.username as assigner_username,
        u2.full_name as assignee_name,
        u2.username as assignee_username,
        u2.title as assignee_title,
        d.name as department_name
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_by = u1.telegram_id
      LEFT JOIN users u2 ON t.assigned_to = u2.telegram_id
      LEFT JOIN departments d ON t.department_id = d.id
      WHERE t.status IN ('PENDING', 'IN_PROGRESS')
        AND t.deadline IS NOT NULL
        AND t.deadline <= datetime('now', 'localtime')
        AND (t.overdue_prompted = 0 OR t.overdue_prompted IS NULL)
      ORDER BY t.deadline ASC
    `);
    return query.all() as unknown as Task[];
  }

  public static getOverdueTasks(): Task[] {
    const db = Database.getDb();
    const query = db.prepare(`
      SELECT 
        t.*,
        u1.full_name as assigner_name,
        u1.username as assigner_username,
        u2.full_name as assignee_name,
        u2.username as assignee_username,
        u2.title as assignee_title,
        d.name as department_name
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_by = u1.telegram_id
      LEFT JOIN users u2 ON t.assigned_to = u2.telegram_id
      LEFT JOIN departments d ON t.department_id = d.id
      WHERE t.status IN ('PENDING', 'IN_PROGRESS')
        AND t.deadline IS NOT NULL
        AND t.deadline < datetime('now', 'localtime')
      ORDER BY t.deadline ASC
    `);
    return query.all() as unknown as Task[];
  }

  public static updateTask(
    taskId: number,
    data: { title?: string; description?: string; deadline?: string | null; priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' }
  ): Task | null {
    const db = Database.getDb();
    const task = TaskService.getById(taskId);
    if (!task) return null;

    const newTitle = data.title !== undefined ? data.title : task.title;
    const newDesc = data.description !== undefined ? data.description : task.description;
    const newDeadline = data.deadline !== undefined ? data.deadline : task.deadline;
    const newPriority = data.priority !== undefined ? data.priority : task.priority;

    const stmt = db.prepare(`
      UPDATE tasks 
      SET title = ?,
          description = ?,
          deadline = ?,
          priority = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);
    stmt.run(newTitle, newDesc, newDeadline, newPriority, taskId);

    return TaskService.getById(taskId);
  }

  public static deleteTask(taskId: number): boolean {
    const db = Database.getDb();
    try {
      const stmt = db.prepare('DELETE FROM tasks WHERE id = ?');
      stmt.run(taskId);
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      return false;
    }
  }

  public static getStats() {
    const db = Database.getDb();
    const totalQuery = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status IN ('PENDING', 'IN_PROGRESS') AND deadline < datetime('now', 'localtime') THEN 1 ELSE 0 END) as overdue
      FROM tasks
    `);
    return totalQuery.get() as {
      total: number;
      pending: number;
      in_progress: number;
      completed: number;
      cancelled: number;
      overdue: number;
    };
  }
}
