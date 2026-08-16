# 🤖 Telegram Bot Giao Việc & Quản Lý Công Việc Cho Công Ty (Full CRUD)

Telegram Bot quản lý công việc chuyên nghiệp cho doanh nghiệp: hỗ trợ **Thêm - Sửa - Cập nhật - Xóa (CRUD)** đầy đủ cho Phòng Ban, Nhân Sự, và Công Việc, tích hợp **Giao việc đích danh (@tag nhân sự)**, **Giao việc theo phòng ban (tag đồng loạt)**, **Tương tác qua nút bấm Inline**, **Nhắc việc tự động 24/7**, tối ưu hóa cho **VPS Windows**.

---

## 📋 Danh Sách Toàn Bộ Lệnh Quản Trị & Vận Hành (Full CRUD)

### 🏢 1. Quản lý Phòng Ban (CRUD):
| Hành động | Lệnh | Ví dụ | Mô tả |
| :--- | :--- | :--- | :--- |
| **Thêm (Create)** | `/add_dept` | `/add_dept media Phòng Truyền Thông` | Tạo phòng ban mới |
| **Sửa (Update)** | `/edit_dept` | `/edit_dept media Ban Media & Video` | Đổi tên / cập nhật phòng ban |
| **Xóa (Delete)** | `/del_dept` | `/del_dept media` | Xóa hoàn toàn phòng ban khỏi hệ thống |
| **Xem (Read)** | `/departments` | `/departments` | Xem danh sách tất cả phòng ban |

---

### 👥 2. Quản lý Nhân Sự, Chức Vụ & Phân Quyền (CRUD):
| Hành động | Lệnh | Ví dụ | Mô tả |
| :--- | :--- | :--- | :--- |
| **Gán phòng & Chức vụ (Gộp)** | `/set_user` | `/set_user @nam mkt Trưởng Phòng Marketing` *(hoặc reply `/set_user mkt Trưởng Phòng`)* | Gán 1 lệnh đồng thời Phòng ban + Chức danh + Tự cấp quyền Quản lý |
| **Đổi chức vụ** | `/set_title` | `/set_title @nam Phó Giám Đốc` *(hoặc reply `/set_title Phó Giám Đốc`)* | Cập nhật chức danh / vị trí công việc |
| **Gán phòng lẻ** | `/set_dept` | `/set_dept @nam marketing` *(hoặc reply `/set_dept marketing`)* | Gán nhân viên vào phòng ban |
| **Xóa khỏi phòng** | `/remove_dept` | `/remove_dept @nam` *(hoặc reply `/remove_dept`)* | Xóa nhân viên khỏi phòng ban |
| **Phân quyền** | `/set_role` | `/set_role @nam ADMIN` *(hoặc reply `/set_role ADMIN`)* | Cấp quyền `ADMIN`, `MANAGER`, `EMPLOYEE` |
| **Xóa tài khoản** | `/del_user` | `/del_user @nam` *(hoặc reply `/del_user`)* | Xóa nhân sự khỏi database hệ thống |
| **Xem danh bạ** | `/members` | `/members` | Xem danh bạ nhân sự phân theo phòng ban & chức vụ |

---

### 📌 3. Quản lý Công Việc & Tiến Độ (CRUD):
| Hành động | Lệnh | Ví dụ | Mô tả |
| :--- | :--- | :--- | :--- |
| **Giao việc cá nhân** | `/task` | `/task @nam Làm slide tuần sau hạn: 17h [gấp]` | Giao việc cho nhân viên & tag tên |
| **Giao việc phòng ban**| `/task_dept` | `/task_dept marketing Chuẩn bị tư liệu hạn: 17h` | Giao việc cho toàn bộ phòng ban |
| **Sửa việc / Deadline** | `/edit_task` | `/edit_task 1 Sửa lại slide và gửi trước 18h hạn: 18h` | Cập nhật nội dung & deadline task |
| **Xóa công việc** | `/del_task` | `/del_task 1` | Xóa vĩnh viễn task khỏi hệ thống |
| **Xem việc của mình** | `/my_tasks` | `/my_tasks` | Nhân viên xem danh sách việc cần làm |
| **Xem toàn bộ việc** | `/all_tasks` | `/all_tasks` | Sếp xem 20 công việc mới nhất toàn công ty |
| **Xem việc chờ nhận** | `/pending_tasks` | `/pending_tasks` | Danh sách các việc chưa có ai nhận |
| **Xem việc đã xong** | `/done_tasks` | `/done_tasks` | Danh sách các việc đã hoàn thành |
| **Xem báo cáo KPI** | `/stats` | `/stats` | Thống kê số lượng việc theo trạng thái |

---

### 📅 4. Lên Lịch, Biên Bản & Quản Lý Cuộc Họp (Meetings):
| Hành động | Lệnh | Ví dụ | Mô tả |
| :--- | :--- | :--- | :--- |
| **Lên lịch họp** | `/meeting` | `/meeting Họp giao ban lúc: 09:00 tại: Phòng Tầng 2 [cho: all]` | Lên lịch họp, tag nhân sự & kèm nút điểm danh, ghi biên bản |
| **Xem lịch & Tra cứu theo ngày** | `/meetings` | `/meetings 2026-08-16` *(hoặc `/meetings hom_nay`)* | Xem danh sách & xuất nội dung các cuộc họp theo ngày |
| **Xem / Nộp biên bản** | `/minutes` | `/minutes 1` *(hoặc `/minutes 1 Nội dung biên bản...`)* | Thư ký nộp hoặc Sếp xem lại toàn văn kết luận cuộc họp |
| **Hủy cuộc họp** | `/del_meeting` | `/del_meeting 1` | Hủy / Xóa cuộc họp khỏi hệ thống |

---

### 👑 5. Bảng Điều Khiển Quản Trị & Phát Thông Báo (Admin Controls):
| Hành động | Lệnh | Ví dụ | Mô tả |
| :--- | :--- | :--- | :--- |
| **Bảng điều khiển 1 chạm** | `/admin` | `/admin` hoặc `/dashboard` | Mở menu nút bấm quản trị toàn diện công ty |
| **Phát thông báo toàn cty** | `/broadcast` | `/broadcast Ngày mai 15h họp toàn công ty` | Gửi thông báo trang trọng từ BGĐ đến toàn thể nhân sự |
| **Danh sách Quản trị viên** | `/admins` | `/admins` | Xem danh sách Super Admin, Admin và Trưởng phòng |

---

## 🚀 Hướng Dẫn Cài Đặt & Vận Hành Trên VPS Windows (2 Core, 2GB RAM, 30GB)

### Bước 1: Chuẩn bị trên VPS
1. Tải và cài đặt **[Node.js LTS](https://nodejs.org)** (Bản `.msi`). Bấm `Next` đến khi hoàn tất.
2. Clone code từ GitHub:
   ```cmd
   git clone https://github.com/huysadboizdev/bot_tele.git
   cd bot_tele
   ```

### Bước 2: Cấu hình File `.env`
Tạo file `.env` (nhân bản từ `.env.example`) và điền các thông tin:
```env
BOT_TOKEN=8123456789:AAH... (Token lấy từ @BotFather trên Telegram)
ADMIN_IDS=7535121273 (Telegram ID của bạn)
MAIN_GROUP_ID=-1004337699275 (ID nhóm chat công ty)
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
