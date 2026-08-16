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
  action TEXT NOT NULL, -- 'CREATED', 'ACCEPTED', 'PROGRESS', 'COMPLETED', 'CANCELLED'
  note TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(telegram_id)
);
`;

export const DEFAULT_DEPARTMENTS = [
  { id: 'bld', name: 'Ban Giám Đốc', description: 'Ban lãnh đạo và quản lý cấp cao' },
  { id: 'tech', name: 'Kỹ Thuật / Dev', description: 'Đội ngũ phát triển phần mềm và CNTT' },
  { id: 'marketing', name: 'Marketing', description: 'Phòng truyền thông và tiếp thị' },
  { id: 'sales', name: 'Kinh Doanh / Sales', description: 'Phòng kinh doanh và phát triển thị trường' },
  { id: 'ketoan', name: 'Kế Toán / Tài Chính', description: 'Phòng kế toán và quản lý tài chính' },
  { id: 'hr', name: 'Hành Chính / HR', description: 'Phòng nhân sự và hành chính tổng hợp' },
];
