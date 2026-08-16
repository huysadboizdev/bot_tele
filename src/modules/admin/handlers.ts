import { Context, InlineKeyboard } from 'grammy';
import { UserService } from '../users/service';
import { DepartmentService } from '../departments/service';
import { TaskService } from '../tasks/service';
import { MeetingService } from '../meetings/service';
import { CONFIG } from '../../config/env';

export class AdminHandlers {
  public static getDashboardKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('🏢 Phòng Ban', 'admin:dept_menu')
      .text('👥 Nhân Sự', 'admin:user_menu')
      .row()
      .text('📌 Công Việc', 'admin:task_menu')
      .text('📅 Lịch Họp', 'admin:meeting_menu')
      .row()
      .text('📢 Phát Thông Báo', 'admin:broadcast_info')
      .text('📊 Báo Cáo KPI', 'admin:stats')
      .row()
      .text('👑 Danh Sách Admin', 'admin:admins_list');
  }
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

    let help = `📖 **HỆ THỐNG LỆNH QUẢN TRỊ & GIAO VIỆC (FULL CRUD)**\n\n`;

    help += `👤 **Dành cho Nhân viên:**\n`;
    help += `• \`/my_tasks\`: Xem danh sách việc của mình\n`;
    help += `• Bấm **[🚀 Nhận việc]** / **[✅ Hoàn thành]** dưới mỗi thông báo\n`;
    help += `• \`/departments\`: Xem danh sách phòng ban công ty\n\n`;

    if (isAdmin) {
      help += `👑 **Dành cho Sếp / Quản trị viên:**\n\n`;

      help += `🏢 **1. Quản lý Phòng Ban (CRUD):**\n`;
      help += `• **Thêm:** \`/add_dept <mã> <Tên phòng>\` (vd: \`/add_dept media Phòng Truyền Thông\`)\n`;
      help += `• **Sửa tên:** \`/edit_dept <mã> <Tên mới>\` (vd: \`/edit_dept media Ban Media\`)\n`;
      help += `• **Xóa:** \`/del_dept <mã>\` (vd: \`/del_dept media\`)\n`;
      help += `• **Xem:** \`/departments\`\n\n`;

      help += `👥 **2. Quản lý Nhân Sự, Chức Vụ & Phân Quyền (CRUD):**\n`;
      help += `• **Gán phòng & Chức vụ (Gộp):** \`/set_user @username <mã_phòng> <Chức vụ>\` (vd: \`/set_user @nam mkt Trưởng Phòng\`)\n`;
      help += `• **Đổi chức vụ:** \`/set_title @username <Chức vụ mới>\` (vd: \`/set_title @nam Phó Giám Đốc\`)\n`;
      help += `• **Gán phòng lẻ:** \`/set_dept @username <mã_phòng>\` (hoặc reply \`/set_dept <mã>\`)\n`;
      help += `• **Xóa khỏi phòng:** \`/remove_dept @username\` (hoặc reply \`/remove_dept\`)\n`;
      help += `• **Phân quyền:** \`/set_role @username ADMIN\` (hoặc reply \`/set_role ADMIN\`)\n`;
      help += `• **Xóa tài khoản:** \`/del_user @username\` (hoặc reply \`/del_user\`)\n`;
      help += `• **Xem danh bạ:** \`/members\`\n\n`;

      help += `📌 **3. Quản lý Công Việc & Tiến Độ (CRUD):**\n`;
      help += `• **Giao việc cá nhân:** \`/task @username <nội dung> [hạn: YYYY-MM-DD HH:mm] [gấp]\`\n`;
      help += `• **Giao việc phòng ban:** \`/task_dept <mã_phòng> <nội dung> [hạn: ...]\`\n`;
      help += `• **Sửa việc/deadline:** \`/edit_task <id> <nội dung mới> [hạn: ...]\`\n`;
      help += `• **Xóa việc:** \`/del_task <id>\`\n`;
      help += `• **Tổng hợp:** \`/all_tasks\`, \`/pending_tasks\`, \`/done_tasks\`, \`/stats\`\n\n`;

      help += `📅 **4. Lên Lịch & Quản Lý Cuộc Họp (Meetings):**\n`;
      help += `• **Lên lịch họp:** \`/meeting <Chủ đề> lúc: <thời gian> [tại: ...] [cho: all/mã_phòng/@user]\`\n`;
      help += `• **Xem lịch họp:** \`/meetings\`\n`;
      help += `• **Hủy họp:** \`/del_meeting <id>\`\n`;
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
          const titleText = m.title ? ` - 💼 ${m.title}` : '';
          msg += `  • ${m.full_name} (${userTag})${titleText} [${m.role}]\n`;
        }
        msg += '\n';
      }
    }

    const unassigned = users.filter(u => !u.department_id);
    if (unassigned.length > 0) {
      msg += `❓ **Chưa phân phòng ban:**\n`;
      for (const m of unassigned) {
        const userTag = m.username ? `@${m.username}` : `(ID: ${m.telegram_id})`;
        const titleText = m.title ? ` - 💼 ${m.title}` : '';
        msg += `  • ${m.full_name} (${userTag})${titleText} [${m.role}]\n`;
      }
    }

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  /**
   * /set_user [@username] <mã_phòng> <Chức vụ> (hoặc Reply tin nhắn)
   */
  public static async handleSetUser(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId || !UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Bạn không có quyền thực hiện lệnh này.');
      return;
    }

    const text = (ctx.message?.text || '').replace(/^\/set_user(@\w+)?\s*/i, '').trim();
    const parts = text.split(/\s+/);
    const repliedUser = ctx.message?.reply_to_message?.from;

    let targetUsername = '';
    let deptInput = '';
    let titleInput = '';

    // Trường hợp 1: Reply tin nhắn của nhân viên và gõ /set_user <mã_phòng> <Chức vụ>
    if (repliedUser && parts.length >= 2 && !parts[0].startsWith('@')) {
      deptInput = parts[0].toLowerCase();
      titleInput = parts.slice(1).join(' ');

      const dept = DepartmentService.findByNameOrSlug(deptInput);
      if (!dept) {
        await ctx.reply(`❌ Không tìm thấy phòng ban "${deptInput}". Gõ \`/departments\` để xem danh sách.`);
        return;
      }

      UserService.upsertUser(repliedUser.id, repliedUser.username, repliedUser.first_name);
      UserService.setDepartment(repliedUser.id, dept.id);
      UserService.setTitle(repliedUser.id, titleInput);

      let targetRole: 'ADMIN' | 'MANAGER' | 'EMPLOYEE' = 'EMPLOYEE';
      if (/trưởng|phó|leader|quản lý|manager|director|giám đốc|chủ nhiệm/i.test(titleInput)) {
        targetRole = 'MANAGER';
        if (!UserService.isAdmin(repliedUser.id)) {
          UserService.setRole(repliedUser.id, 'MANAGER');
        }
      }

      const userTag = repliedUser.username ? `@${repliedUser.username}` : repliedUser.first_name;
      await ctx.reply(
        `✅ **ĐÃ THIẾT LẬP NHÂN SỰ:**\n\n` +
        `👤 **Nhân sự:** **${repliedUser.first_name}** (${userTag})\n` +
        `🏢 **Phòng ban:** Phòng ${dept.name}\n` +
        `💼 **Chức vụ:** ${titleInput}\n` +
        `🔑 **Quyền:** ${targetRole}`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Trường hợp 2: Gõ /set_user @username <mã_phòng> <Chức vụ>
    if (parts.length < 3) {
      await ctx.reply(
        '👉 **Cú pháp gán Phòng ban & Chức vụ:**\n\n' +
        '1. `/set_user @username <mã_phòng> <Chức vụ>`\n' +
        '   _Ví dụ:_ `/set_user @nam mkt Trưởng Phòng Marketing`\n' +
        '   _Ví dụ:_ `/set_user @hoa sales Chuyên Viên Bán Hàng`\n\n' +
        '2. Hoặc **Reply tin nhắn** và gõ: `/set_user <mã_phòng> <Chức vụ>`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    targetUsername = parts[0].replace(/^@/, '');
    deptInput = parts[1].toLowerCase();
    titleInput = parts.slice(2).join(' ');

    const dept = DepartmentService.findByNameOrSlug(deptInput);
    if (!dept) {
      await ctx.reply(`❌ Không tìm thấy phòng ban "${deptInput}". Gõ \`/departments\` để xem danh sách.`);
      return;
    }

    const result = UserService.setUserDeptAndTitle(targetUsername, dept.id, titleInput);

    if (result.status === 'UPDATED') {
      await ctx.reply(
        `✅ **ĐÃ THIẾT LẬP NHÂN SỰ:**\n\n` +
        `👤 **Nhân sự:** **${result.fullName}** (@${targetUsername})\n` +
        `🏢 **Phòng ban:** Phòng ${dept.name}\n` +
        `💼 **Chức vụ:** ${titleInput}\n` +
        `🔑 **Quyền:** ${result.appliedRole}`,
        { parse_mode: 'Markdown' }
      );
    } else {
      await ctx.reply(
        `✅ **ĐÃ GÁN TRƯỚC THÔNG TIN NHÂN SỰ:**\n\n` +
        `👤 **Username:** @${targetUsername}\n` +
        `🏢 **Phòng ban:** Phòng ${dept.name}\n` +
        `💼 **Chức vụ:** ${titleInput}\n` +
        `🔑 **Quyền:** ${result.appliedRole}\n\n` +
        `_Thông tin sẽ tự động kích hoạt ngay khi @${targetUsername} tương tác với Bot._`,
        { parse_mode: 'Markdown' }
      );
    }
  }

  /**
   * /set_title [@username] <Chức vụ mới> (hoặc Reply tin nhắn)
   */
  public static async handleSetTitle(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId || !UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Bạn không có quyền thực hiện lệnh này.');
      return;
    }

    const text = (ctx.message?.text || '').replace(/^\/set_title(@\w+)?\s*/i, '').trim();
    const parts = text.split(/\s+/);
    const repliedUser = ctx.message?.reply_to_message?.from;

    // Trường hợp 1: Reply tin nhắn và gõ /set_title <Chức vụ mới>
    if (repliedUser && parts.length >= 1 && !parts[0].startsWith('@')) {
      const title = text;
      UserService.upsertUser(repliedUser.id, repliedUser.username, repliedUser.first_name);
      UserService.setTitle(repliedUser.id, title);

      const userTag = repliedUser.username ? `@${repliedUser.username}` : repliedUser.first_name;
      await ctx.reply(`✅ Đã cập nhật chức vụ cho **${repliedUser.first_name}** (${userTag}) thành: **${title}**!`, {
        parse_mode: 'Markdown',
      });
      return;
    }

    // Trường hợp 2: Gõ /set_title @username <Chức vụ mới>
    if (parts.length < 2) {
      await ctx.reply(
        '👉 **Cú pháp đổi chức vụ:**\n' +
        '1. `/set_title @username <Chức vụ mới>`\n' +
        '   _Ví dụ:_ `/set_title @nam Phó Giám Đốc`\n' +
        '2. Hoặc **Reply tin nhắn** của nhân viên và gõ: `/set_title <Chức vụ mới>`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const targetUsername = parts[0].replace(/^@/, '');
    const title = parts.slice(1).join(' ');

    const result = UserService.setTitleByUsername(targetUsername, title);

    if (result.status === 'UPDATED') {
      await ctx.reply(`✅ Đã cập nhật chức vụ cho **${result.fullName}** (@${targetUsername}) thành: **${title}**!`, {
        parse_mode: 'Markdown',
      });
    } else {
      await ctx.reply(
        `✅ Đã gán trước chức vụ **${title}** cho @${targetUsername}!\n` +
        `_Chức vụ sẽ tự động kích hoạt ngay khi @${targetUsername} tương tác với Bot._`,
        { parse_mode: 'Markdown' }
      );
    }
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
   * /remove_dept [@username] (hoặc Reply tin nhắn)
   */
  public static async handleRemoveDept(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId || !UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Bạn không có quyền thực hiện lệnh này.');
      return;
    }

    const text = (ctx.message?.text || '').replace(/^\/(remove_dept|unset_dept)(@\w+)?\s*/i, '').trim();
    const repliedUser = ctx.message?.reply_to_message?.from;

    let targetUsername = '';

    // Trường hợp 1: Reply tin nhắn và gõ /remove_dept
    if (repliedUser) {
      UserService.upsertUser(repliedUser.id, repliedUser.username, repliedUser.first_name);
      UserService.setDepartment(repliedUser.id, null);

      const userTag = repliedUser.username ? `@${repliedUser.username}` : repliedUser.first_name;
      await ctx.reply(`✅ Đã xóa nhân viên **${repliedUser.first_name}** (${userTag}) khỏi phòng ban!`, {
        parse_mode: 'Markdown',
      });
      return;
    }

    // Trường hợp 2: Gõ /remove_dept @username
    if (!text) {
      await ctx.reply(
        '👉 **Cú pháp:**\n' +
        '1. `/remove_dept @username` (Ví dụ: `/remove_dept @nam`)\n' +
        '2. Hoặc **Reply tin nhắn** của nhân viên và gõ: `/remove_dept`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    targetUsername = text.replace(/^@/, '').trim();
    const result = UserService.removeDepartmentByUsername(targetUsername);

    if (result.status === 'REMOVED') {
      await ctx.reply(`✅ Đã xóa nhân viên **${result.fullName}** (@${targetUsername}) khỏi phòng ban!`, {
        parse_mode: 'Markdown',
      });
    } else {
      await ctx.reply(`✅ Đã xóa liên kết phòng ban của @${targetUsername}!`, {
        parse_mode: 'Markdown',
      });
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
   * /del_dept <mã_phòng>
   */
  public static async handleDelDept(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId || !UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Bạn không có quyền thực hiện lệnh này.');
      return;
    }

    const text = (ctx.message?.text || '').replace(/^\/del_dept(@\w+)?\s*/i, '').trim();
    if (!text) {
      await ctx.reply(
        '👉 Cú pháp: `/del_dept <mã_phòng>`\nVí dụ: `/del_dept cskh`\n_Gõ /departments để xem mã phòng._',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const dept = DepartmentService.findByNameOrSlug(text);
    if (!dept) {
      await ctx.reply(`❌ Không tìm thấy phòng ban nào có mã hoặc tên là "${text}".`, { parse_mode: 'Markdown' });
      return;
    }

    const success = DepartmentService.delete(dept.id);
    if (success) {
      await ctx.reply(`🗑️ Đã xóa phòng ban **${dept.name}** (Mã: \`${dept.id}\`) khỏi hệ thống!`, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply(`❌ Xóa phòng ban thất bại.`, { parse_mode: 'Markdown' });
    }
  }

  /**
   * /edit_dept <mã_phòng> <tên_mới>
   */
  public static async handleEditDept(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId || !UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Bạn không có quyền thực hiện lệnh này.');
      return;
    }

    const text = (ctx.message?.text || '').replace(/^\/(edit_dept|rename_dept)(@\w+)?\s*/i, '').trim();
    const parts = text.split(/\s+/);

    if (parts.length < 2) {
      await ctx.reply(
        '👉 **Cú pháp sửa tên phòng ban:**\n' +
        '`/edit_dept <mã_phòng> <Tên mới>`\n' +
        'Ví dụ: `/edit_dept tech Phòng Kỹ Thuật & Công Nghệ`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const id = parts[0].toLowerCase();
    const newName = parts.slice(1).join(' ');

    const dept = DepartmentService.getById(id);
    if (!dept) {
      await ctx.reply(`❌ Không tìm thấy phòng ban nào có mã là "${id}". Gõ \`/departments\` để xem danh sách.`, {
        parse_mode: 'Markdown',
      });
      return;
    }

    const success = DepartmentService.update(id, newName);
    if (success) {
      await ctx.reply(`✏️ Đã đổi tên phòng ban \`${id}\` thành: **${newName}**!`, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply(`❌ Cập nhật tên phòng ban thất bại.`, { parse_mode: 'Markdown' });
    }
  }

  /**
   * /del_user [@username] (hoặc Reply tin nhắn)
   */
  public static async handleDelUser(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId || !UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Bạn không có quyền thực hiện lệnh này.');
      return;
    }

    const text = (ctx.message?.text || '').replace(/^\/(del_user|remove_user)(@\w+)?\s*/i, '').trim();
    const repliedUser = ctx.message?.reply_to_message?.from;

    if (repliedUser) {
      UserService.deleteUser(repliedUser.id);
      const userTag = repliedUser.username ? `@${repliedUser.username}` : repliedUser.first_name;
      await ctx.reply(`🗑️ Đã xóa hoàn toàn người dùng **${repliedUser.first_name}** (${userTag}) khỏi hệ thống!`, {
        parse_mode: 'Markdown',
      });
      return;
    }

    if (!text) {
      await ctx.reply(
        '👉 **Cú pháp xóa người dùng:**\n' +
        '1. `/del_user @username` (Ví dụ: `/del_user @nam`)\n' +
        '2. Hoặc **Reply tin nhắn** của người đó và gõ: `/del_user`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const targetUsername = text.replace(/^@/, '').trim();
    const result = UserService.deleteUserByUsername(targetUsername);

    if (result.status === 'DELETED') {
      await ctx.reply(`🗑️ Đã xóa hoàn toàn người dùng **${result.fullName}** (@${targetUsername}) khỏi hệ thống!`, {
        parse_mode: 'Markdown',
      });
    } else {
      await ctx.reply(`🗑️ Đã xóa bản ghi chờ của @${targetUsername} khỏi hệ thống!`, {
        parse_mode: 'Markdown',
      });
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

  /**
   * /admin hoặc /dashboard: Bảng điều khiển quản trị một chạm
   */
  public static async handleDashboard(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId || !UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Lệnh này chỉ dành cho Quản trị viên (Admin / Manager).');
      return;
    }

    const user = UserService.getById(senderId);
    const roleTitle = user?.role === 'ADMIN' ? '👑 Ban Giám Đốc (Admin)' : '⭐ Trưởng Phòng (Manager)';
    const senderName = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name;

    let msg = `👑 **BẢNG ĐIỀU KHIỂN QUẢN TRỊ (ADMIN DASHBOARD)** 👑\n\n`;
    msg += `Xin chào **${senderName}** (${roleTitle})!\n`;
    msg += `👉 Vui lòng chạm vào các nút bên dưới để điều hành công ty:`;

    await ctx.reply(msg, {
      parse_mode: 'Markdown',
      reply_markup: AdminHandlers.getDashboardKeyboard(),
    });
  }

  /**
   * /admins: Xem danh sách toàn bộ Quản trị viên công ty
   */
  public static async handleAdminsList(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId || !UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Lệnh này chỉ dành cho Quản trị viên.');
      return;
    }

    const users = UserService.getAll();
    const adminUsers = users.filter(u => u.role === 'ADMIN' || u.role === 'MANAGER');

    let msg = `👑 **DANH SÁCH BAN QUẢN TRỊ CÔNG TY**\n\n`;

    if (CONFIG.ADMIN_IDS.length > 0) {
      msg += `🌟 **Super Admin (Cấu hình hệ thống):**\n`;
      for (const id of CONFIG.ADMIN_IDS) {
        const u = users.find(x => x.telegram_id === id);
        const tag = u ? `${u.full_name} (@${u.username || id})` : `Telegram ID: \`${id}\``;
        msg += `  • ${tag} - 👑 SUPER ADMIN\n`;
      }
      msg += '\n';
    }

    msg += `👥 **Quản Trị Viên & Quản Lý (${adminUsers.length}):**\n`;
    if (adminUsers.length === 0) {
      msg += `_Chưa có nhân sự nào được phân quyền Admin/Manager._\n`;
    } else {
      for (const a of adminUsers) {
        const userTag = a.username ? `@${a.username}` : `(ID: ${a.telegram_id})`;
        const titleText = a.title ? ` - 💼 ${a.title}` : '';
        const deptText = a.department_name ? ` [Phòng ${a.department_name}]` : '';
        msg += `  • ${a.full_name} (${userTag})${titleText}${deptText} - \`${a.role}\`\n`;
      }
    }

    msg += `\n👉 Dùng \`/set_role @username ADMIN\` để cấp thêm quyền quản trị.`;
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  /**
   * /broadcast <nội dung> hoặc /thong_bao <nội dung>: Phát thông báo toàn công ty
   */
  public static async handleBroadcast(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId || !UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Chỉ Quản trị viên mới có quyền phát thông báo toàn công ty.');
      return;
    }

    const text = (ctx.message?.text || '').replace(/^\/(broadcast|thong_bao|announcement)(@\w+)?\s*/i, '').trim();

    if (!text) {
      await ctx.reply(
        '📢 **Hướng dẫn phát thông báo toàn công ty:**\n\n' +
        '👉 Cú pháp: `/broadcast <Nội dung thông báo>`\n' +
        '💡 Ví dụ: `/broadcast Chiều nay 16h họp khẩn toàn thể công ty tại phòng họp lớn!`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const user = UserService.getById(senderId);
    const senderName = user ? (user.username ? `@${user.username}` : user.full_name) : (ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name);
    const titlePart = user?.title ? ` - 💼 ${user.title}` : '';
    const nowStr = new Date().toLocaleString('vi-VN', { timeZone: CONFIG.TIMEZONE });

    let announceMsg = `📢 **THÔNG BÁO TỪ BAN LÃNH ĐẠO** 📢\n\n`;
    announceMsg += `👤 **Người gửi:** ${senderName}${titlePart}\n`;
    announceMsg += `⏰ **Thời gian:** \`${nowStr}\`\n\n`;
    announceMsg += `📝 **Nội dung:**\n${text}\n\n`;
    announceMsg += `⚠️ _Đề nghị toàn thể nhân sự chú ý theo dõi và thực hiện nghiêm túc!_`;

    let sentCount = 0;

    // Gửi vào nhóm hiện tại
    await ctx.reply(announceMsg, { parse_mode: 'Markdown' });
    sentCount++;

    // Nếu có cấu hình MAIN_GROUP_ID và khác nhóm hiện tại -> Gửi thêm vào Main Group
    if (CONFIG.MAIN_GROUP_ID && ctx.chat?.id.toString() !== CONFIG.MAIN_GROUP_ID) {
      await ctx.api.sendMessage(CONFIG.MAIN_GROUP_ID, announceMsg, { parse_mode: 'Markdown' }).catch(console.error);
      sentCount++;
    }

    await ctx.reply(`✅ Đã phát thông báo thành công đến ${sentCount} kênh/nhóm!`);
  }

  /**
   * Xử lý tương tác nút bấm trong Bảng điều khiển Admin
   */
  public static async handleCallback(ctx: Context) {
    const callbackData = ctx.callbackQuery?.data;
    const userId = ctx.from?.id;
    if (!callbackData || !userId) return;

    if (!UserService.isAdmin(userId)) {
      await ctx.answerCallbackQuery({ text: '⚠️ Bạn không có quyền truy cập menu Quản trị.' });
      return;
    }

    await ctx.answerCallbackQuery();

    // 1. Menu Phòng ban
    if (callbackData === 'admin:dept_menu') {
      const depts = DepartmentService.getAll();
      let text = `🏢 **QUẢN TRỊ PHÒNG BAN (${depts.length} phòng)**\n\n`;
      for (const d of depts) {
        text += `• \`${d.id}\`: **${d.name}**\n`;
      }
      text += `\n💡 **Lệnh thao tác:**\n`;
      text += `• Thêm phòng: \`/add_dept <mã> <tên>\`\n`;
      text += `• Đổi tên phòng: \`/edit_dept <mã> <tên_mới>\`\n`;
      text += `• Xóa phòng: \`/del_dept <mã>\``;

      const kb = new InlineKeyboard()
        .text('🔙 Quay lại Bảng điều khiển', 'admin:back_dashboard');

      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
    }

    // 2. Menu Nhân sự
    else if (callbackData === 'admin:user_menu') {
      const users = UserService.getAll();
      let text = `👥 **QUẢN TRỊ NHÂN SỰ (${users.length} thành viên)**\n\n`;
      text += `💡 **Lệnh thao tác nhanh:**\n`;
      text += `• Gán phòng & chức vụ: \`/set_user @user <phòng> <chức_vụ>\`\n`;
      text += `• Đổi chức vụ: \`/set_title @user <chức_vụ_mới>\`\n`;
      text += `• Phân quyền Sếp: \`/set_role @user ADMIN\`\n`;
      text += `• Xóa nhân sự: \`/del_user @user\`\n`;
      text += `• Xem toàn bộ danh bạ: \`/members\``;

      const kb = new InlineKeyboard()
        .text('🔙 Quay lại Bảng điều khiển', 'admin:back_dashboard');

      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
    }

    // 3. Menu Công việc
    else if (callbackData === 'admin:task_menu') {
      const stats = TaskService.getStats();
      let text = `📌 **QUẢN TRỊ CÔNG VIỆC**\n\n`;
      text += `• 📁 Tổng số việc: \`${stats.total || 0}\`\n`;
      text += `• ⏳ Đang chờ nhận: \`${stats.pending || 0}\`\n`;
      text += `• ⚙️ Đang xử lý: \`${stats.in_progress || 0}\`\n`;
      text += `• 🔴 Quá hạn: \`${stats.overdue || 0}\`\n\n`;
      text += `💡 **Lệnh thao tác:**\n`;
      text += `• Giao việc: \`/task @user <nội dung> hạn: 17h\`\n`;
      text += `• Giao cả phòng: \`/task_dept <phòng> <nội dung>\`\n`;
      text += `• Xem tất cả: \`/all_tasks\``;

      const kb = new InlineKeyboard()
        .text('🔙 Quay lại Bảng điều khiển', 'admin:back_dashboard');

      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
    }

    // 4. Menu Lịch họp
    else if (callbackData === 'admin:meeting_menu') {
      const meetings = MeetingService.getUpcoming(5);
      let text = `📅 **QUẢN TRỊ LỊCH HỌP (${meetings.length} cuộc họp sắp tới)**\n\n`;
      for (const m of meetings) {
        text += `• #${m.id}: **${m.title}** lúc \`${m.meeting_time}\`\n`;
      }
      text += `\n💡 **Lệnh thao tác:**\n`;
      text += `• Lên lịch họp: \`/meeting <Tiêu đề> lúc: <thời gian> tại: <địa điểm>\`\n`;
      text += `• Xem tất cả: \`/meetings\``;

      const kb = new InlineKeyboard()
        .text('🔙 Quay lại Bảng điều khiển', 'admin:back_dashboard');

      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
    }

    // 5. Hướng dẫn Phát thông báo
    else if (callbackData === 'admin:broadcast_info') {
      let text = `📢 **PHÁT THÔNG BÁO TOÀN CÔNG TY**\n\n`;
      text += `👉 Hãy gửi lệnh theo cú pháp:\n`;
      text += `\`/broadcast <Nội dung thông báo>\`\n\n`;
      text += `💡 _Ví dụ:_ \`/broadcast Ngày mai 15h họp toàn công ty tại Tầng 2\``;

      const kb = new InlineKeyboard()
        .text('🔙 Quay lại Bảng điều khiển', 'admin:back_dashboard');

      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
    }

    // 6. Xem danh sách Admin
    else if (callbackData === 'admin:admins_list') {
      const users = UserService.getAll();
      const adminUsers = users.filter(u => u.role === 'ADMIN' || u.role === 'MANAGER');

      let text = `👑 **DANH SÁCH QUẢN TRỊ VIÊN (${adminUsers.length})**\n\n`;
      for (const a of adminUsers) {
        const userTag = a.username ? `@${a.username}` : `(ID: ${a.telegram_id})`;
        const titleText = a.title ? ` - 💼 ${a.title}` : '';
        text += `• ${a.full_name} (${userTag})${titleText} - \`${a.role}\`\n`;
      }

      const kb = new InlineKeyboard()
        .text('🔙 Quay lại Bảng điều khiển', 'admin:back_dashboard');

      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
    }

    // 7. Báo cáo thống kê
    else if (callbackData === 'admin:stats') {
      const stats = TaskService.getStats();
      let text = `📊 **BÁO CÁO TIẾN ĐỘ CÔNG VIỆC**\n\n`;
      text += `📁 Tổng số việc: \`${stats.total || 0}\`\n`;
      text += `⏳ Đang chờ nhận: \`${stats.pending || 0}\`\n`;
      text += `⚙️ Đang xử lý: \`${stats.in_progress || 0}\`\n`;
      text += `✅ Đã hoàn thành: \`${stats.completed || 0}\`\n`;
      text += `🔴 Quá hạn: \`${stats.overdue || 0}\`\n`;

      const kb = new InlineKeyboard()
        .text('🔙 Quay lại Bảng điều khiển', 'admin:back_dashboard');

      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
    }

    // 8. Quay lại Dashboard chính
    else if (callbackData === 'admin:back_dashboard') {
      const senderName = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name;
      let text = `👑 **BẢNG ĐIỀU KHIỂN QUẢN TRỊ (ADMIN DASHBOARD)** 👑\n\n`;
      text += `Xin chào **${senderName}**!\n`;
      text += `👉 Vui lòng chạm vào các nút bên dưới để điều hành công ty:`;

      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: AdminHandlers.getDashboardKeyboard(),
      });
    }
  }
}
