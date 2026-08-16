import { Context } from 'grammy';
import { UserService } from '../users/service';
import { DepartmentService } from '../departments/service';
import { TaskService } from '../tasks/service';

export class AdminHandlers {
  /**
   * /start: Đăng ký người dùng và hiển thị menu chính
   */
  public static async handleStart(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId) return;

    const user = UserService.upsertUser(senderId, ctx.from.username, ctx.from.first_name);
    const roleTitle = user.role === 'ADMIN' ? '👑 Quản Trị Viên (Sếp)' : user.role === 'MANAGER' ? '⭐ Quản Lý' : '👤 Nhân Viên';

    let welcome = `👋 **Xin chào ${user.full_name}!**\n\n`;
    welcome += `🏢 Chào mừng bạn đến với **Hệ thống Quản lý Công việc & Giao việc** của Công ty.\n`;
    welcome += `🔑 **Vai trò của bạn:** ${roleTitle}\n`;
    welcome += `📍 **Phòng ban:** ${user.department_id ? `Phòng ${user.department_id.toUpperCase()}` : '_Chưa phân phòng (Sếp sẽ gán cho bạn)_'}\n\n`;

    welcome += `📌 **Các lệnh cơ bản:**\n`;
    welcome += `• \`/my_tasks\`: Xem danh sách việc của bạn\n`;
    welcome += `• \`/departments\`: Xem danh sách các phòng ban\n`;
    welcome += `• \`/help\`: Xem toàn bộ hướng dẫn sử dụng\n`;

    if (user.role === 'ADMIN' || user.role === 'MANAGER') {
      welcome += `\n👑 **Lệnh dành cho Sếp / Quản lý:**\n`;
      welcome += `• \`/task @username <nội dung>\`: Giao việc cho nhân viên & tag tên\n`;
      welcome += `• \`/task_dept <phòng> <nội dung>\`: Giao việc cho cả phòng ban\n`;
      welcome += `• \`/all_tasks\`: Tổng hợp tất cả công việc\n`;
      welcome += `• \`/members\`: Xem danh sách nhân sự\n`;
      welcome += `• \`/stats\`: Báo cáo thống kê tiến độ\n`;
    }

    await ctx.reply(welcome, { parse_mode: 'Markdown' });
  }

  /**
   * /help: Hướng dẫn chi tiết
   */
  public static async handleHelp(ctx: Context) {
    const senderId = ctx.from?.id;
    const isAdmin = senderId ? UserService.isAdmin(senderId) : false;

    let help = `📖 **HƯỚNG DẪN SỬ DỤNG BOT GIAO VIỆC CÔNG TY**\n\n`;

    help += `👤 **Dành cho Nhân viên:**\n`;
    help += `1️⃣ Khi được giao việc, Bot sẽ tự động **@tag tên bạn** trong nhóm.\n`;
    help += `2️⃣ Bấm nút **[🚀 Nhận việc]** để báo cho Sếp biết bạn đã bắt đầu làm.\n`;
    help += `3️⃣ Khi làm xong, bấm **[✅ Hoàn thành]** để hoàn tất task.\n`;
    help += `• \`/my_tasks\`: Xem công việc cá nhân cần làm.\n\n`;

    if (isAdmin) {
      help += `👑 **Dành cho Sếp / Quản trị viên:**\n`;
      help += `• **Giao việc cá nhân:**\n`;
      help += `  \`/task @nam Viết bài PR sản phẩm mới hạn: 2026-08-20 17:00 [gấp]\`\n\n`;

      help += `• **Giao việc cả phòng ban:**\n`;
      help += `  \`/task_dept marketing Chuẩn bị tư liệu tuần sau hạn: 17h\`\n\n`;

      help += `• **Quản lý nhân sự & phòng ban:**\n`;
      help += `  \`/set_role @username ADMIN\` (hoặc Reply tin nhắn gõ \`/set_role ADMIN\`)\n`;
      help += `  \`/set_dept @username marketing\` (hoặc Reply tin nhắn gõ \`/set_dept marketing\`)\n`;
      help += `  \`/add_dept <mã_phòng> <tên_phòng>\`: Thêm phòng ban mới\n`;
      help += `  \`/members\`: Xem danh bạ nhân sự theo phòng ban\n`;
      help += `  \`/stats\`: Xem chỉ số KPI và tiến độ toàn công ty\n`;
    }

    await ctx.reply(help, { parse_mode: 'Markdown' });
  }

  /**
   * /departments: Xem danh sách phòng ban
   */
  public static async handleDepartments(ctx: Context) {
    const depts = DepartmentService.getAll();
    let msg = `🏢 **DANH SÁCH PHÒNG BAN CÔNG TY (${depts.length})**\n\n`;

    for (const d of depts) {
      const members = UserService.getByDepartment(d.id);
      msg += `📁 **${d.name}** (Mã: \`${d.id}\`)\n`;
      if (d.description) msg += `   ℹ️ _${d.description}_\n`;
      msg += `   👥 Nhân sự: ${members.length} người\n\n`;
    }

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  /**
   * /members: Xem danh sách nhân sự
   */
  public static async handleMembers(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId || !UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Lệnh này chỉ dành cho Quản trị viên.');
      return;
    }

    const users = UserService.getAll();
    let msg = `👥 **DANH BẠ NHÂN SỰ CÔNG TY (${users.length})**\n\n`;

    const depts = DepartmentService.getAll();
    for (const d of depts) {
      const deptMembers = users.filter(u => u.department_id === d.id);
      if (deptMembers.length > 0) {
        msg += `🏢 **Phòng ${d.name}:**\n`;
        for (const m of deptMembers) {
          const userTag = m.username ? `@${m.username}` : `(ID: ${m.telegram_id})`;
          msg += `  • ${m.full_name} (${userTag}) - [${m.role}]\n`;
        }
        msg += '\n';
      }
    }

    const unassigned = users.filter(u => !u.department_id);
    if (unassigned.length > 0) {
      msg += `❓ **Chưa phân phòng ban:**\n`;
      for (const m of unassigned) {
        const userTag = m.username ? `@${m.username}` : `(ID: ${m.telegram_id})`;
        msg += `  • ${m.full_name} (${userTag}) - [${m.role}]\n`;
      }
    }

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  /**
   * /set_dept [@username] <mã_phòng> (hoặc Reply tin nhắn)
   */
  public static async handleSetDept(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId || !UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Bạn không có quyền thực hiện lệnh này.');
      return;
    }

    const text = (ctx.message?.text || '').replace(/^\/set_dept(@\w+)?\s*/i, '').trim();
    const parts = text.split(/\s+/);
    const repliedUser = ctx.message?.reply_to_message?.from;

    let targetUsername = '';
    let deptInput = '';

    // Trường hợp 1: Reply tin nhắn của người khác và gõ /set_dept <mã_phòng>
    if (repliedUser && parts.length >= 1 && parts[0] && !parts[0].startsWith('@')) {
      deptInput = parts[0].toLowerCase();
      UserService.upsertUser(repliedUser.id, repliedUser.username, repliedUser.first_name);
      targetUsername = repliedUser.username ? `@${repliedUser.username}` : repliedUser.first_name;

      const dept = DepartmentService.findByNameOrSlug(deptInput);
      if (!dept) {
        await ctx.reply(`❌ Không tìm thấy phòng ban "${deptInput}". Gõ \`/departments\` để xem danh sách.`);
        return;
      }

      UserService.setDepartment(repliedUser.id, dept.id);
      await ctx.reply(`✅ Đã gán nhân viên **${repliedUser.first_name}** (${targetUsername}) vào **Phòng ${dept.name}**!`, {
        parse_mode: 'Markdown',
      });
      return;
    }

    // Trường hợp 2: Gõ /set_dept @username <mã_phòng>
    if (parts.length < 2) {
      await ctx.reply(
        '👉 **Cú pháp:**\n' +
        '1. `/set_dept @username <mã_phòng>` (Ví dụ: `/set_dept @nam marketing`)\n' +
        '2. Hoặc **Reply tin nhắn** của nhân viên trong nhóm và gõ: `/set_dept marketing`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    targetUsername = parts[0].replace(/^@/, '');
    deptInput = parts[1].toLowerCase();

    const dept = DepartmentService.findByNameOrSlug(deptInput);
    if (!dept) {
      await ctx.reply(`❌ Không tìm thấy phòng ban "${deptInput}". Gõ \`/departments\` để xem danh sách.`);
      return;
    }

    const result = UserService.setDepartmentByUsername(targetUsername, dept.id);

    if (result.status === 'UPDATED') {
      await ctx.reply(`✅ Đã gán nhân viên **${result.fullName}** (@${targetUsername}) vào **Phòng ${dept.name}**!`, {
        parse_mode: 'Markdown',
      });
    } else {
      await ctx.reply(
        `✅ Đã gán trước @${targetUsername} vào **Phòng ${dept.name}**!\n` +
        `_Phòng ban sẽ tự động kích hoạt ngay khi @${targetUsername} tương tác với Bot._`,
        { parse_mode: 'Markdown' }
      );
    }
  }

  /**
   * /set_role [@username] <ADMIN | MANAGER | EMPLOYEE> (hoặc Reply tin nhắn)
   */
  public static async handleSetRole(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId || !UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Bạn không có quyền thực hiện lệnh này.');
      return;
    }

    const text = (ctx.message?.text || '').replace(/^\/set_role(@\w+)?\s*/i, '').trim();
    const parts = text.split(/\s+/);
    const repliedUser = ctx.message?.reply_to_message?.from;

    let targetUsername = '';
    let roleInput: 'ADMIN' | 'MANAGER' | 'EMPLOYEE' = 'EMPLOYEE';

    // Trường hợp 1: Reply tin nhắn của ai đó và gõ: /set_role ADMIN
    if (repliedUser && parts.length >= 1 && ['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(parts[0].toUpperCase())) {
      roleInput = parts[0].toUpperCase() as 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
      UserService.upsertUser(repliedUser.id, repliedUser.username, repliedUser.first_name);
      UserService.setRole(repliedUser.id, roleInput);

      const userTag = repliedUser.username ? `@${repliedUser.username}` : repliedUser.first_name;
      await ctx.reply(`✅ Đã phân quyền **${roleInput}** cho **${repliedUser.first_name}** (${userTag}) thành công!`, {
        parse_mode: 'Markdown',
      });
      return;
    }

    // Trường hợp 2: Gõ /set_role @username ADMIN
    if (parts.length < 2) {
      await ctx.reply(
        '👉 **Cú pháp:**\n' +
        '1. `/set_role @username <ADMIN | MANAGER | EMPLOYEE>` (Ví dụ: `/set_role @nam ADMIN`)\n' +
        '2. Hoặc **Reply tin nhắn** của người đó và gõ: `/set_role ADMIN`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    targetUsername = parts[0].replace(/^@/, '');
    const candidateRole = parts[1].toUpperCase();

    if (!['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(candidateRole)) {
      await ctx.reply('❌ Vai trò chỉ có thể là: `ADMIN`, `MANAGER`, hoặc `EMPLOYEE`.', { parse_mode: 'Markdown' });
      return;
    }
    roleInput = candidateRole as 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

    const result = UserService.setRoleByUsername(targetUsername, roleInput);

    if (result.status === 'UPDATED') {
      await ctx.reply(`✅ Đã cập nhật quyền cho **${result.fullName}** (@${targetUsername}) thành: **${roleInput}**!`, {
        parse_mode: 'Markdown',
      });
    } else {
      await ctx.reply(
        `✅ Đã gán trước quyền **${roleInput}** cho @${targetUsername}!\n` +
        `_Quyền sẽ tự động kích hoạt ngay khi @${targetUsername} nhắn bất kỳ tin nào vào nhóm hoặc bấm /start._`,
        { parse_mode: 'Markdown' }
      );
    }
  }

  /**
   * /add_dept <mã_phòng> <tên phòng> [mô tả]
   */
  public static async handleAddDept(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId || !UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Bạn không có quyền thực hiện lệnh này.');
      return;
    }

    const text = (ctx.message?.text || '').replace(/^\/add_dept(@\w+)?\s*/i, '').trim();
    const parts = text.split(/\s+/);

    if (parts.length < 2) {
      await ctx.reply(
        '👉 Cú pháp: `/add_dept <mã_viết_tắt> <Tên đầy đủ>`\nVí dụ: `/add_dept cskh Chăm Sóc Khách Hàng`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const id = parts[0].toLowerCase();
    const name = parts.slice(1).join(' ');

    const success = DepartmentService.create(id, name);
    if (success) {
      await ctx.reply(`✅ Đã tạo mới phòng ban **${name}** (Mã: \`${id}\`) thành công!`, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply(`❌ Tạo phòng ban thất bại (Mã phòng \`${id}\` có thể đã tồn tại).`, { parse_mode: 'Markdown' });
    }
  }

  /**
   * /stats: Thống kê KPI & tiến độ công việc
   */
  public static async handleStats(ctx: Context) {
    const stats = TaskService.getStats();

    let msg = `📊 **BÁO CÁO TIẾN ĐỘ CÔNG VIỆC TOÀN CÔNG TY**\n\n`;
    msg += `📁 **Tổng số công việc:** \`${stats.total || 0}\`\n`;
    msg += `⏳ **Đang chờ nhận:** \`${stats.pending || 0}\`\n`;
    msg += `⚙️ **Đang thực hiện:** \`${stats.in_progress || 0}\`\n`;
    msg += `✅ **Đã hoàn thành:** \`${stats.completed || 0}\`\n`;
    msg += `🚫 **Đã hủy:** \`${stats.cancelled || 0}\`\n`;

    if (stats.overdue > 0) {
      msg += `\n⚠️ **Số task quá hạn (Overdue):** 🔴 \`${stats.overdue}\`\n`;
    } else {
      msg += `\n✨ Không có công việc nào bị quá hạn!`;
    }

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }
}
