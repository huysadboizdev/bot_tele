import { Database } from '../../database/db';

export interface Meeting {
  id: number;
  title: string;
  description: string | null;
  meeting_time: string;
  location: string | null;
  target_type: 'ALL' | 'DEPARTMENT' | 'USERS';
  target_value: string | null;
  group_chat_id: string | null;
  created_by: number;
  reminded_24h: number;
  reminded_1h: number;
  reminded_15m: number;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  created_at: string;
  creator_name?: string;
  creator_username?: string;
}

export interface MeetingParticipant {
  meeting_id: number;
  user_id: number;
  status: 'CONFIRMED' | 'DECLINED';
  updated_at: string;
  full_name?: string;
  username?: string;
}

export class MeetingService {
  public static create(data: {
    title: string;
    description?: string;
    meetingTime: string;
    location?: string;
    targetType: 'ALL' | 'DEPARTMENT' | 'USERS';
    targetValue?: string;
    groupChatId?: string;
    createdBy: number;
  }): Meeting {
    const db = Database.getDb();
    const stmt = db.prepare(`
      INSERT INTO meetings (
        title, description, meeting_time, location, target_type, target_value, group_chat_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.title.trim(),
      data.description?.trim() || null,
      data.meetingTime,
      data.location?.trim() || null,
      data.targetType,
      data.targetValue || null,
      data.groupChatId || null,
      data.createdBy
    );

    return MeetingService.getById(Number(result.lastInsertRowid))!;
  }

  public static getById(id: number): Meeting | null {
    const db = Database.getDb();
    const query = db.prepare(`
      SELECT m.*, u.full_name as creator_name, u.username as creator_username
      FROM meetings m
      LEFT JOIN users u ON m.created_by = u.telegram_id
      WHERE m.id = ?
    `);
    return (query.get(id) as unknown as Meeting) || null;
  }

  public static getUpcoming(limit: number = 10): Meeting[] {
    const db = Database.getDb();
    const query = db.prepare(`
      SELECT m.*, u.full_name as creator_name, u.username as creator_username
      FROM meetings m
      LEFT JOIN users u ON m.created_by = u.telegram_id
      WHERE m.status = 'SCHEDULED'
        AND m.meeting_time >= datetime('now', 'localtime')
      ORDER BY m.meeting_time ASC
      LIMIT ?
    `);
    return query.all(limit) as unknown as Meeting[];
  }

  public static getMeetingsDueForReminder(): {
    meeting: Meeting;
    type: '24h' | '1h' | '15m';
  }[] {
    const db = Database.getDb();
    const results: { meeting: Meeting; type: '24h' | '1h' | '15m' }[] = [];

    // Nhắc trước 24 giờ (trong khoảng 23h - 24h trước khi họp)
    const q24h = db.prepare(`
      SELECT m.*, u.full_name as creator_name, u.username as creator_username
      FROM meetings m
      LEFT JOIN users u ON m.created_by = u.telegram_id
      WHERE m.status = 'SCHEDULED'
        AND m.reminded_24h = 0
        AND m.meeting_time > datetime('now', 'localtime')
        AND m.meeting_time <= datetime('now', 'localtime', '+24 hours')
    `);
    const due24h = q24h.all() as unknown as Meeting[];
    for (const m of due24h) {
      results.push({ meeting: m, type: '24h' });
    }

    // Nhắc trước 1 giờ (trong khoảng 15p - 60p trước khi họp)
    const q1h = db.prepare(`
      SELECT m.*, u.full_name as creator_name, u.username as creator_username
      FROM meetings m
      LEFT JOIN users u ON m.created_by = u.telegram_id
      WHERE m.status = 'SCHEDULED'
        AND m.reminded_1h = 0
        AND m.meeting_time > datetime('now', 'localtime')
        AND m.meeting_time <= datetime('now', 'localtime', '+1 hours')
    `);
    const due1h = q1h.all() as unknown as Meeting[];
    for (const m of due1h) {
      results.push({ meeting: m, type: '1h' });
    }

    // Nhắc khẩn cấp trước 15 phút (trong khoảng 0p - 15p trước khi họp)
    const q15m = db.prepare(`
      SELECT m.*, u.full_name as creator_name, u.username as creator_username
      FROM meetings m
      LEFT JOIN users u ON m.created_by = u.telegram_id
      WHERE m.status = 'SCHEDULED'
        AND m.reminded_15m = 0
        AND m.meeting_time > datetime('now', 'localtime')
        AND m.meeting_time <= datetime('now', 'localtime', '+15 minutes')
    `);
    const due15m = q15m.all() as unknown as Meeting[];
    for (const m of due15m) {
      results.push({ meeting: m, type: '15m' });
    }

    return results;
  }

  public static markReminded(id: number, type: '24h' | '1h' | '15m') {
    const db = Database.getDb();
    const field = type === '24h' ? 'reminded_24h' : type === '1h' ? 'reminded_1h' : 'reminded_15m';
    const stmt = db.prepare(`UPDATE meetings SET ${field} = 1 WHERE id = ?`);
    stmt.run(id);
  }

  public static delete(id: number): boolean {
    const db = Database.getDb();
    try {
      const stmt = db.prepare('DELETE FROM meetings WHERE id = ?');
      stmt.run(id);
      return true;
    } catch (error) {
      console.error('Error deleting meeting:', error);
      return false;
    }
  }

  public static setParticipantStatus(meetingId: number, userId: number, status: 'CONFIRMED' | 'DECLINED') {
    const db = Database.getDb();
    const stmt = db.prepare(`
      INSERT INTO meeting_participants (meeting_id, user_id, status, updated_at)
      VALUES (?, ?, ?, datetime('now', 'localtime'))
      ON CONFLICT(meeting_id, user_id) DO UPDATE SET 
        status = excluded.status,
        updated_at = datetime('now', 'localtime')
    `);
    stmt.run(meetingId, userId, status);
  }

  public static getParticipants(meetingId: number): { confirmed: MeetingParticipant[]; declined: MeetingParticipant[] } {
    const db = Database.getDb();
    const query = db.prepare(`
      SELECT mp.*, u.full_name, u.username
      FROM meeting_participants mp
      LEFT JOIN users u ON mp.user_id = u.telegram_id
      WHERE mp.meeting_id = ?
    `);
    const all = query.all(meetingId) as unknown as MeetingParticipant[];
    return {
      confirmed: all.filter(p => p.status === 'CONFIRMED'),
      declined: all.filter(p => p.status === 'DECLINED'),
    };
  }
}
