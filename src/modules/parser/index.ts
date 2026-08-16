export interface ParsedTaskInput {
  targetType: 'USER' | 'DEPARTMENT';
  targetRaw: string;
  title: string;
  description?: string;
  deadline?: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

export class TaskParser {
  /**
   * Phân tích nội dung lệnh giao việc cá nhân: /task @username <nội dung> [hạn: ...]
   */
  public static parseUserTask(text: string): ParsedTaskInput | null {
    const cleanText = text.replace(/^\/task(@\w+)?\s*/i, '').trim();
    if (!cleanText) return null;

    // Tìm @username ở đầu hoặc vị trí bất kỳ
    const userMatch = cleanText.match(/@([a-zA-Z0-9_]{4,32})/);
    if (!userMatch) return null;

    const username = userMatch[1];
    let remainingText = cleanText.replace(userMatch[0], '').trim();

    return TaskParser.extractDetails(remainingText, 'USER', username);
  }

  /**
   * Phân tích nội dung lệnh giao việc phòng ban: /task_dept <tên_phòng> <nội dung> [hạn: ...]
   */
  public static parseDepartmentTask(text: string): ParsedTaskInput | null {
    const cleanText = text.replace(/^\/task_dept(@\w+)?\s*/i, '').trim();
    if (!cleanText) return null;

    // Lấy từ đầu tiên hoặc cụm trong ngoặc làm tên phòng ban
    const parts = cleanText.split(/\s+/);
    if (parts.length < 2) return null;

    const deptRaw = parts[0];
    const remainingText = parts.slice(1).join(' ').trim();

    return TaskParser.extractDetails(remainingText, 'DEPARTMENT', deptRaw);
  }

  private static extractDetails(
    text: string,
    targetType: 'USER' | 'DEPARTMENT',
    targetRaw: string
  ): ParsedTaskInput {
    let raw = text;
    let priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL';
    let deadline: string | undefined = undefined;

    // 1. Nhận diện Mức độ ưu tiên
    if (/gấp|khẩn cấp|urgent|priority:high/i.test(raw)) {
      priority = 'URGENT';
      raw = raw.replace(/(\[?(gấp|khẩn cấp|urgent|priority:high)\]?)/gi, '').trim();
    } else if (/ưu tiên cao|high/i.test(raw)) {
      priority = 'HIGH';
      raw = raw.replace(/(\[?(ưu tiên cao|high)\]?)/gi, '').trim();
    }

    // 2. Nhận diện Deadline (vd: hạn: 2026-08-20 17:00 hoặc deadline: 17h hoặc trước: 17:30 18/08)
    const deadlineRegex = /(?:hạn|deadline|trước|due):\s*([0-9:\-\/\sA-Za-z]+)$/i;
    const deadlineMatch = raw.match(deadlineRegex);

    if (deadlineMatch) {
      deadline = TaskParser.standardizeDeadline(deadlineMatch[1].trim());
      raw = raw.replace(deadlineMatch[0], '').trim();
    }

    const title = raw || 'Công việc mới được giao';

    return {
      targetType,
      targetRaw,
      title,
      description: title,
      deadline,
      priority,
    };
  }

  /**
   * Chuẩn hóa deadline thành định dạng YYYY-MM-DD HH:mm:ss
   */
  public static standardizeDeadline(input: string): string {
    const now = new Date();

    // Format: YYYY-MM-DD HH:mm
    if (/^\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2})?$/.test(input)) {
      return input.includes(':') ? `${input}:00` : `${input} 18:00:00`;
    }

    // Format: DD/MM/YYYY HH:mm hoặc DD/MM HH:mm
    const dateMatch = input.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?(?:\s+(\d{1,2}):(\d{2}))?$/);
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, '0');
      const month = dateMatch[2].padStart(2, '0');
      const year = dateMatch[3] || now.getFullYear().toString();
      const hour = dateMatch[4] ? dateMatch[4].padStart(2, '0') : '18';
      const min = dateMatch[5] || '00';
      return `${year}-${month}-${day} ${hour}:${min}:00`;
    }

    // Format: 17h, 17:30 (Tính cho ngày hôm nay)
    const timeMatch = input.match(/^(\d{1,2})(?:h|:(\d{2}))$/);
    if (timeMatch) {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hour = timeMatch[1].padStart(2, '0');
      const min = timeMatch[2] || '00';
      return `${year}-${month}-${day} ${hour}:${min}:00`;
    }

    // Trả về nguyên bản nếu không nhận dạng được
    return input;
  }
}
