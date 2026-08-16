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
    if (!input) return '';
    const clean = input.trim();
    const now = new Date();

    // 1. Format: YYYY-MM-DD HH:mm:ss hoặc YYYY-MM-DD HH:mm hoặc YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2}(:\d{2})?)?$/.test(clean)) {
      const parts = clean.split(/\s+/);
      const datePart = parts[0];
      const timePart = parts[1] || '09:00:00';
      const timeParts = timePart.split(':');
      const h = timeParts[0].padStart(2, '0');
      const m = (timeParts[1] || '00').padStart(2, '0');
      const s = (timeParts[2] || '00').padStart(2, '0');
      return `${datePart} ${h}:${m}:${s}`;
    }

    // 2. Format: DD/MM/YYYY hoặc DD-MM-YYYY kèm giờ (14h30 hoặc 14:30 hoặc 14h)
    const fullDateMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2})(?:h|:)?(\d{2})?)?$/i);
    if (fullDateMatch) {
      const day = fullDateMatch[1].padStart(2, '0');
      const month = fullDateMatch[2].padStart(2, '0');
      const year = fullDateMatch[3];
      const hour = (fullDateMatch[4] || '09').padStart(2, '0');
      const min = (fullDateMatch[5] || '00').padStart(2, '0');
      return `${year}-${month}-${day} ${hour}:${min}:00`;
    }

    // 3. Format: DD/MM hoặc DD-MM kèm giờ
    const shortDateMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2})(?:h|:)?(\d{2})?)?$/i);
    if (shortDateMatch) {
      const day = shortDateMatch[1].padStart(2, '0');
      const month = shortDateMatch[2].padStart(2, '0');
      const year = now.getFullYear().toString();
      const hour = (shortDateMatch[3] || '09').padStart(2, '0');
      const min = (shortDateMatch[4] || '00').padStart(2, '0');
      return `${year}-${month}-${day} ${hour}:${min}:00`;
    }

    // 4. Format: Ngày mai / Mai (ví dụ: mai 14h30, ngày mai 9h, mai 14:30)
    const tomorrowMatch = clean.match(/^(?:ngày\s+)?(?:mai|ngay\s*mai)(?:\s+(\d{1,2})(?:h|:)?(\d{2})?)?$/i);
    if (tomorrowMatch) {
      const tm = new Date();
      tm.setDate(tm.getDate() + 1);
      const year = tm.getFullYear();
      const month = String(tm.getMonth() + 1).padStart(2, '0');
      const day = String(tm.getDate()).padStart(2, '0');
      const hour = (tomorrowMatch[1] || '09').padStart(2, '0');
      const min = (tomorrowMatch[2] || '00').padStart(2, '0');
      return `${year}-${month}-${day} ${hour}:${min}:00`;
    }

    // 5. Format: Hôm nay / Nay (ví dụ: hôm nay 14h30, nay 9h)
    const todayMatch = clean.match(/^(?:hôm\s+)?(?:nay|hom\s*nay)(?:\s+(\d{1,2})(?:h|:)?(\d{2})?)?$/i);
    if (todayMatch) {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hour = (todayMatch[1] || '09').padStart(2, '0');
      const min = (todayMatch[2] || '00').padStart(2, '0');
      return `${year}-${month}-${day} ${hour}:${min}:00`;
    }

    // 6. Format: Chỉ có giờ trong ngày hôm nay: 14h30, 14h, 9h15, 9h, 14:30, 09:00
    const timeMatch = clean.match(/^(\d{1,2})(?:h(\d{1,2})?|:(\d{2}))$/i);
    if (timeMatch) {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hour = timeMatch[1].padStart(2, '0');
      const min = (timeMatch[2] || timeMatch[3] || '00').padStart(2, '0');
      return `${year}-${month}-${day} ${hour}:${min}:00`;
    }

    // Trả về nguyên bản nếu không nhận dạng được
    return clean;
  }
}
