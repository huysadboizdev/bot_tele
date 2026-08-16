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
  minutes TEXT, -- Toàn văn nội dung / biên bản cuộc họp
  minutes_by INTEGER, -- ID người nộp/ghi chép biên bản
  minutes_at TEXT, -- Thời điểm nộp/cập nhật biên bản
  status TEXT DEFAULT 'SCHEDULED', -- 'SCHEDULED', 'COMPLETED', 'CANCELLED'
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (created_by) REFERENCES users(telegram_id),
  FOREIGN KEY (minutes_by) REFERENCES users(telegram_id)
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

-- Bảng Giao Dịch Thu / Chi & Mua Sắm Tài Nguyên
CREATE TABLE IF NOT EXISTS financial_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL, -- 'CHI' (Khoản chi) hoặc 'THU' (Khoản thu)
  title TEXT NOT NULL, -- Tên tài nguyên mua sắm / nội dung thu chi
  amount REAL NOT NULL, -- Tổng số tiền
  payer_id INTEGER, -- Người thanh toán / người ứng tiền trước
  payer_name TEXT, -- Tên hiển thị người thanh toán
  payment_method TEXT NOT NULL DEFAULT 'BANK', -- 'BANK' (Chuyển khoản) hoặc 'CASH' (Tiền mặt)
  split_type TEXT DEFAULT 'CUSTOM', -- 'ALL', 'DEPARTMENT', 'CUSTOM', 'NONE'
  split_target TEXT, -- Mã phòng hoặc danh sách @username
  total_members INTEGER DEFAULT 1, -- Số người chia
  amount_per_person REAL DEFAULT 0, -- Số tiền mỗi người sau khi chia đều
  group_chat_id TEXT,
  created_by INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (created_by) REFERENCES users(telegram_id),
  FOREIGN KEY (payer_id) REFERENCES users(telegram_id)
);

-- Bảng Chi Tiết Chia Tiền & Công Nợ Từng Người
CREATE TABLE IF NOT EXISTS transaction_splits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  user_id INTEGER,
  username TEXT NOT NULL,
  full_name TEXT,
  amount_owed REAL NOT NULL,
  is_paid INTEGER DEFAULT 0, -- 0: Chưa đóng, 1: Đã đóng
  paid_at TEXT,
  confirmed_by INTEGER,
  confirmed_at TEXT,
  FOREIGN KEY (transaction_id) REFERENCES financial_transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(telegram_id),
  FOREIGN KEY (confirmed_by) REFERENCES users(telegram_id)
);
`;
