export const CREATE_TABLES_SQL = `
-- Bảng phòng ban trong công ty
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Bảng nhân sự
CREATE TABLE IF NOT EXISTS users (
  telegram_id INTEGER PRIMARY KEY,
  username TEXT,
  full_name TEXT NOT NULL,
  title TEXT, -- Chức vụ / Vị trí công việc (ví dụ: 'Trưởng Phòng', 'Chuyên Viên', 'Leader')
  role TEXT DEFAULT 'EMPLOYEE', -- 'ADMIN', 'MANAGER', 'EMPLOYEE'
  department_id TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

-- Bảng công việc (Tasks)
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
  priority TEXT DEFAULT 'NORMAL', -- 'LOW', 'NORMAL', 'HIGH', 'URGENT'
  assigned_by INTEGER NOT NULL,
  assigned_to INTEGER, -- Null nếu giao cho toàn phòng ban
  department_id TEXT, -- Phòng ban nhận việc nếu có
  group_chat_id TEXT, -- ID nhóm nếu giao trong nhóm
  message_id INTEGER, -- ID tin nhắn thông báo task để edit
  deadline TEXT, -- Hạn chót định dạng 'YYYY-MM-DD HH:mm:ss'
  reminded_24h INTEGER DEFAULT 0,
  reminded_2h INTEGER DEFAULT 0,
  overdue_prompted INTEGER DEFAULT 0, -- 1 nếu đã gửi thông báo hỏi kết quả hết hạn
  extension_count INTEGER DEFAULT 0, -- Số lần xin gia hạn
  extension_reason TEXT, -- Lý do xin gia hạn gần nhất
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  completed_at TEXT,
  FOREIGN KEY (assigned_by) REFERENCES users(telegram_id),
  FOREIGN KEY (assigned_to) REFERENCES users(telegram_id),
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

-- Bảng nhật ký xử lý công việc (Task Logs)
CREATE TABLE IF NOT EXISTS task_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(telegram_id)
);

-- Bảng lưu phân quyền / phòng ban chờ kích hoạt (khi user chưa bấm /start)
CREATE TABLE IF NOT EXISTS pending_assignments (
  username TEXT PRIMARY KEY,
  role TEXT,
  department_id TEXT,
  title TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Bảng lưu cấu hình hệ thống (tránh tự động nạp lại phòng ban khi Sếp đã xóa)
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Bảng Lịch Họp (Meetings)
CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  meeting_time TEXT NOT NULL, -- Định dạng: 'YYYY-MM-DD HH:mm:ss'
  location TEXT, -- Địa điểm hoặc Link Google Meet / Zoom
  target_type TEXT DEFAULT 'ALL', -- 'ALL', 'DEPARTMENT', 'USERS'
  target_value TEXT, -- Mã phòng hoặc danh sách @username
  group_chat_id TEXT,
  created_by INTEGER NOT NULL,
  reminded_24h INTEGER DEFAULT 0,
  reminded_1h INTEGER DEFAULT 0,
  reminded_15m INTEGER DEFAULT 0,
  status TEXT DEFAULT 'SCHEDULED', -- 'SCHEDULED', 'COMPLETED', 'CANCELLED'
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (created_by) REFERENCES users(telegram_id)
);

-- Bảng người tham gia và điểm danh cuộc họp
CREATE TABLE IF NOT EXISTS meeting_participants (
  meeting_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  status TEXT DEFAULT 'CONFIRMED', -- 'CONFIRMED', 'DECLINED'
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  PRIMARY KEY (meeting_id, user_id),
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(telegram_id)
);
`;
