import { Database } from './database/db';
import { UserService } from './modules/users/service';
import { DepartmentService } from './modules/departments/service';
import { TaskService } from './modules/tasks/service';
import { TaskParser } from './modules/parser';
import { MeetingService } from './modules/meetings/service';
import { formatTaskMessage, getTaskKeyboard } from './modules/tasks/keyboards';

async function runTests() {
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
  const keyboard = getTaskKeyboard(task1);
  console.log('   ✅ Format message & Keyboard:\n' + formattedMsg);

  // 5. Kiểm tra Nhận việc & Hoàn thành Task
  console.log('\n5️⃣ Kiểm tra Vòng đời Task:');
  const inProgress = TaskService.updateStatus(task1.id, 'IN_PROGRESS', employee1.telegram_id);
  console.log(`   ✅ Task sau khi nhận: Status = ${inProgress?.status}`);

  const completed = TaskService.updateStatus(task1.id, 'COMPLETED', employee1.telegram_id);
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

  // 8. Kiểm tra Quản lý Lịch họp (MeetingService)
  console.log('\n8️⃣ Kiểm tra Quản lý Lịch Họp (Meetings):');
  const meeting = MeetingService.create({
    title: 'Họp giao ban toàn công ty',
    meetingTime: '2026-08-25 09:00:00',
    location: 'Phòng họp Tầng 2',
    targetType: 'ALL',
    createdBy: admin.telegram_id,
  });
  console.log(`   ✅ Tạo cuộc họp #${meeting.id}: "${meeting.title}" lúc ${meeting.meeting_time}`);

  MeetingService.setParticipantStatus(meeting.id, employee1.telegram_id, 'CONFIRMED');
  MeetingService.setParticipantStatus(meeting.id, employee2.telegram_id, 'DECLINED');
  const participants = MeetingService.getParticipants(meeting.id);
  console.log(`   ✅ Điểm danh: ${participants.confirmed.length} xác nhận tham gia, ${participants.declined.length} báo vắng`);

  const upcoming = MeetingService.getUpcoming();
  console.log(`   ✅ Số cuộc họp sắp tới: ${upcoming.length}`);

  // 9. Kiểm tra Xử lý Hết hạn Deadline & Gia hạn tương tác
  console.log('\n9️⃣ Kiểm tra Xử lý Hết Hạn Deadline & Xin Gia Hạn (Interactive Extension):');
  const pastTask = TaskService.create({
    title: 'Nộp báo cáo thuế tháng 7',
    description: 'Nộp báo cáo thuế tháng 7',
    assignedBy: admin.telegram_id,
    assignedTo: employee1.telegram_id,
    deadline: '2026-08-01 17:00:00', // Đã hết hạn trong quá khứ
    priority: 'HIGH',
  });
  console.log(`   ✅ Tạo Task quá hạn #${pastTask.id}: Deadline = ${pastTask.deadline}`);

  const dueOverdue = TaskService.getTasksDueForOverduePrompt();
  const isFound = dueOverdue.some(t => t.id === pastTask.id);
  console.log(`   ✅ Phát hiện Task hết hạn cần gửi 2 nút [Đã xong] / [Chưa xong]: ${isFound ? 'THÀNH CÔNG' : 'THẤT BẠI'}`);
  if (!isFound) throw new Error('Không phát hiện được task hết hạn!');

  TaskService.markOverduePrompted(pastTask.id);
  const extended = TaskService.extendDeadline(pastTask.id, '2026-08-28 18:00:00', 'Đang đợi bổ sung hóa đơn từ đối tác', employee1.telegram_id);
  console.log(`   ✅ Gia hạn thành công: Hạn mới = ${extended?.deadline}, Số lần gia hạn = ${extended?.extension_count}, Lý do = "${extended?.extension_reason}"`);
  if (extended?.extension_count !== 1 || extended?.overdue_prompted !== 0) {
    throw new Error('Lỗi cập nhật gia hạn task!');
  }

  // 10. Kiểm tra Quản lý Chức Vụ gắn liền với Phòng Ban
  console.log('\n🔟 Kiểm tra Quản Lý Chức Vụ & Phòng Ban (Positions & Titles):');
  const setUserRes = UserService.setUserDeptAndTitle('nam_marketing', 'marketing', 'Trưởng Phòng Marketing');
  console.log(`   ✅ Gán gộp Phòng ban + Chức vụ (@nam_marketing): Title = "Trưởng Phòng Marketing", Role = ${setUserRes.appliedRole}`);
  if (setUserRes.appliedRole !== 'MANAGER') {
    throw new Error('Tự động thăng cấp MANAGER khi có chức danh Trưởng phòng thất bại!');
  }

  const setTitleRes = UserService.setTitleByUsername('hoa_marketing', 'Chuyên Viên Sáng Tạo Nội Dung');
  console.log(`   ✅ Đổi chức danh lẻ (@hoa_marketing): Status = ${setTitleRes.status}`);

  const allMembers = UserService.getAll();
  const nam = allMembers.find(u => u.username === 'nam_marketing');
  console.log(`   ✅ Kiểm tra danh bạ: ${nam?.full_name} - 💼 ${nam?.title} [${nam?.role}]`);
  if (nam?.title !== 'Trưởng Phòng Marketing') {
    throw new Error('Chức danh chưa được lưu chính xác!');
  }

  console.log('\n🎉 TẤT CẢ 10/10 BÀI KIỂM THỬ ĐÃ PASS 100% THÀNH CÔNG!');
  Database.close();
}

runTests();
