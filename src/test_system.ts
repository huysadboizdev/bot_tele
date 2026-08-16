import { Database } from './database/db';
import { UserService } from './modules/users/service';
import { DepartmentService } from './modules/departments/service';
import { TaskService } from './modules/tasks/service';
import { TaskParser } from './modules/parser';
import { formatTaskMessage, getTaskKeyboard } from './modules/tasks/keyboards';

function runTests() {
  console.log('🧪 BẮT ĐẦU CHẠY KIỂM THỬ HỆ THỐNG BOT_TELE...\n');

  // 1. Kiểm tra Database & Departments
  console.log('1️⃣ Kiểm tra Khởi tạo Database & Phòng ban mặc định:');
  const depts = DepartmentService.getAll();
  console.log(`   ✅ Số lượng phòng ban: ${depts.length}`);
  if (depts.length === 0) throw new Error('Không có phòng ban nào!');

  // 2. Kiểm tra User Management
  console.log('\n2️⃣ Kiểm tra Quản lý Nhân sự:');
  const admin = UserService.upsertUser(111111, 'sep_tong', 'Nguyen Van Boss');
  UserService.setRole(admin.telegram_id, 'ADMIN');
  console.log(`   ✅ Tạo Sếp Admin: ${admin.full_name} (@${admin.username}) - Role: ${UserService.getById(admin.telegram_id)?.role}`);

  const employee1 = UserService.upsertUser(222222, 'nam_marketing', 'Tran Van Nam');
  UserService.setDepartment(employee1.telegram_id, 'marketing');
  console.log(`   ✅ Tạo Nhân viên 1: ${employee1.full_name} (@${employee1.username}) - Phòng: marketing`);

  const employee2 = UserService.upsertUser(333333, 'hoa_marketing', 'Le Thi Hoa');
  UserService.setDepartment(employee2.telegram_id, 'marketing');
  console.log(`   ✅ Tạo Nhân viên 2: ${employee2.full_name} (@${employee2.username}) - Phòng: marketing`);

  // 3. Kiểm tra Parser
  console.log('\n3️⃣ Kiểm tra Bộ bóc tách lệnh (TaskParser):');
  const sample1 = '/task @nam_marketing Thiết kế banner sự kiện hạn: 2026-08-25 17:00 [gấp]';
  const parsed1 = TaskParser.parseUserTask(sample1);
  console.log('   ✅ Parse task cá nhân:', parsed1);
  if (!parsed1 || parsed1.targetRaw !== 'nam_marketing' || parsed1.priority !== 'URGENT') {
    throw new Error('Lỗi parse task cá nhân!');
  }

  const sample2 = '/task_dept marketing Soạn thảo chiến dịch quý 3 hạn: 17h';
  const parsed2 = TaskParser.parseDepartmentTask(sample2);
  console.log('   ✅ Parse task phòng ban:', parsed2);
  if (!parsed2 || parsed2.targetRaw !== 'marketing') {
    throw new Error('Lỗi parse task phòng ban!');
  }

  // 4. Kiểm tra Tạo Task & Tag Tên
  console.log('\n4️⃣ Kiểm tra Tạo Task & Tag Tên:');
  const task1 = TaskService.create({
    title: parsed1.title,
    description: parsed1.description,
    assignedBy: admin.telegram_id,
    assignedTo: employee1.telegram_id,
    deadline: parsed1.deadline,
    priority: parsed1.priority,
  });
  console.log(`   ✅ Tạo Task #${task1.id}: "${task1.title}" giao cho ${task1.assignee_name}`);

  // Test Task Message formatting & Inline Keyboard
  const formattedMsg = formatTaskMessage(task1);
  const kb = getTaskKeyboard(task1);
  console.log('   ✅ Format message & Keyboard:\n' + formattedMsg);

  // 5. Kiểm tra Lifecycle Task (Accept -> Complete)
  console.log('5️⃣ Kiểm tra Vòng đời Task:');
  const accepted = TaskService.updateStatus(task1.id, 'IN_PROGRESS', employee1.telegram_id, 'Nam đã nhận việc');
  console.log(`   ✅ Task sau khi nhận: Status = ${accepted?.status}`);

  const completed = TaskService.updateStatus(task1.id, 'COMPLETED', employee1.telegram_id, 'Hoàn thành xong banner');
  console.log(`   ✅ Task sau khi xong: Status = ${completed?.status}, CompletedAt = ${completed?.completed_at}`);

  // 6. Kiểm tra Task theo Phòng Ban
  console.log('\n6️⃣ Kiểm tra Giao việc Phòng ban & Lấy danh sách thành viên:');
  const mktMembers = UserService.getByDepartment('marketing');
  const tags = mktMembers.map(m => `@${m.username}`).join(' ');
  console.log(`   ✅ Tag toàn bộ phòng Marketing: ${tags}`);
  if (!tags.includes('@nam_marketing') || !tags.includes('@hoa_marketing')) {
    throw new Error('Tag phòng ban thiếu thành viên!');
  }

  // 7. Kiểm tra Thống kê
  console.log('\n7️⃣ Kiểm tra Báo cáo thống kê:');
  const stats = TaskService.getStats();
  console.log('   ✅ Thống kê hệ thống:', stats);

  console.log('\n🎉 TẤT CẢ CÁC BÀI KIỂM THỬ ĐÃ PASS 100% THÀNH CÔNG!');
  Database.close();
}

runTests();
