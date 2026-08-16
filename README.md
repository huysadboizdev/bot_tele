# 🤖 Telegram Bot Giao Việc & Quản Lý Công Việc Cho Công Ty

Telegram Bot quản lý công việc chuyên nghiệp cho doanh nghiệp: hỗ trợ **Giao việc đích danh (@tag nhân sự)**, **Giao việc theo phòng ban (tag đồng loạt cả nhóm)**, **Tương tác qua nút bấm Inline**, **Nhắc việc tự động 24/7**, tối ưu hóa cho **VPS Windows**.

---

## 🌟 Tính Năng Nổi Bật

1. 🎯 **Giao việc đích danh (@tag)**: Sếp giao việc bằng lệnh `/task @username <nội dung>`, Bot tự động tag username Telegram của nhân viên và hiển thị nút nhận việc.
2. 👥 **Giao việc phòng ban**: Lệnh `/task_dept <phòng> <nội dung>` tự động tag toàn bộ thành viên trong phòng ban đó.
3. 🚀 **Nút bấm Inline tương tác**:
   - `[🚀 Nhận việc]`: Đổi trạng thái sang "Đang xử lý", thông báo cho Sếp.
   - `[📝 Báo tiến độ]`: Ghi chú tiến độ thực hiện.
   - `[✅ Hoàn thành]`: Đổi trạng thái sang "Đã xong" và ghi nhận thời gian.
   - `[❌ Hủy task]`: Sếp hoặc người giao việc có thể hủy task bất kỳ lúc nào.
4. ⏰ **Nhắc việc tự động 24/7 (Timezone GMT+7)**:
   - Quét deadline mỗi 5 phút.
   - Nhắc nhở trước 24h & Cảnh báo khẩn cấp trước 2h.
   - **08:30 sáng**: Báo cáo danh sách việc cần làm trong ngày.
   - **17:30 chiều**: Báo cáo tổng kết tiến độ (Hoàn thành / Đang làm / Quá hạn) gửi Sếp.
5. 🗄️ **Cơ sở dữ liệu SQLite siêu nhẹ**: Lưu toàn bộ trong 1 file `.sqlite`, không cần cài đặt SQL Server / MySQL.

---

## 📋 Danh Sách Lệnh (Bot Commands)

### 👤 Dành cho Nhân viên:
| Lệnh | Mô tả |
| :--- | :--- |
| `/start` | Đăng ký tài khoản vào hệ thống, xem thông tin phòng ban & vai trò |
| `/my_tasks` | Xem danh sách công việc cá nhân cần thực hiện |
| `/departments` | Xem danh sách tất cả phòng ban trong công ty |
| `/help` | Xem hướng dẫn sử dụng chi tiết |

### 👑 Dành cho Sếp / Quản lý (Admin):
| Lệnh | Cú pháp ví dụ | Mô tả |
| :--- | :--- | :--- |
| `/task` | `/task @nam Làm slide tuần sau hạn: 2026-08-20 17:00 [gấp]` | Giao việc cho nhân viên & tag tên |
| `/task_dept` | `/task_dept marketing Chuẩn bị tư liệu hạn: 17h` | Giao việc cho toàn bộ phòng ban |
| `/all_tasks` | `/all_tasks` | Xem 20 công việc mới nhất toàn công ty |
| `/members` | `/members` | Xem danh bạ nhân sự phân theo phòng ban |
| `/set_dept` | `/set_dept @nam marketing` | Gán nhân viên vào phòng ban |
| `/set_role` | `/set_role @nam ADMIN` | Phân quyền (`ADMIN`, `MANAGER`, `EMPLOYEE`) |
| `/add_dept` | `/add_dept cskh Chăm Sóc Khách Hàng` | Tạo phòng ban mới |
| `/stats` | `/stats` | Xem báo cáo chỉ số tiến độ toàn công ty |

---

## 🚀 Hướng Dẫn Cài Đặt & Vận Hành Trên VPS Windows (2 Core, 2GB RAM, 30GB)

### Bước 1: Chuẩn bị trên VPS
1. Tải và cài đặt **[Node.js LTS](https://nodejs.org)** (Bản `.msi`). Bấm `Next` đến khi hoàn tất.
2. Copy toàn bộ thư mục `bot_tele` vào VPS.

### Bước 2: Cấu hình File `.env`
Tạo file `.env` (nhân bản từ `.env.example`) và điền các thông tin:
```env
BOT_TOKEN=123456789:AAH... (Token lấy từ @BotFather trên Telegram)
ADMIN_IDS=123456789 (Telegram ID của bạn, lấy từ @userinfobot)
MAIN_GROUP_ID=-1001234567890 (ID nhóm chat công ty nếu muốn gửi báo cáo vào nhóm)
TIMEZONE=Asia/Ho_Chi_Minh
```

### Bước 3: Khởi chạy Bot
- **Cách 1 (Chạy thử nghiệm nhanh)**: Click đúp vào file `scripts/start.bat`.
- **Cách 2 (Chạy ngầm 24/7 vĩnh viễn với PM2)**:
  - Click chuột phải vào `scripts/install_service.bat` chọn **Run as administrator**.
  - Xong! Bot sẽ tự động chạy ngầm, tự phục hồi nếu crash và tự khởi động lại khi VPS reboot.

---

## 🛠️ Các Lệnh Quản Lý PM2 Trên VPS
```cmd
pm2 status                  # Xem trạng thái bot đang chạy
pm2 logs bot-tele-company   # Xem nhật ký hoạt động
pm2 restart bot-tele-company # Khởi động lại bot
pm2 stop bot-tele-company    # Tạm dừng bot
```
