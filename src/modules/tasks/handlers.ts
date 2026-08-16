import { Context } from 'grammy';
import { UserService } from '../users/service';
import { DepartmentService } from '../departments/service';
import { TaskService } from './service';
import { TaskParser } from '../parser';
import {
  formatTaskMessage,
  getTaskKeyboard,
  getExtensionOptionsKeyboard,
} from './keyboards';

export interface PendingExtensionState {
  taskId: number;
  newDeadline?: string;
  isCustom?: boolean;
}

export class TaskHandlers {
  // Lưu trạng thái chờ người dùng nhập lý do gia hạn hoặc hạn chót mới
  public static pendingExtensions = new Map<number, PendingExtensionState>();

  /**
   * /task @username <nội dung> [hạn: YYYY-MM-DD HH:mm]
   */
  public static async assignUserTask(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId) return;

    UserService.upsertUser(senderId, ctx.from.username, ctx.from.first_name);

    if (!UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Bạn cần có quyền Quản trị viên (Admin/Manager) để giao việc.', {
        reply_to_message_id: ctx.message?.message_id,
      });
      return;
    }

    const text = ctx.message?.text || '';
    const parsed = TaskParser.parseUserTask(text);

    if (!parsed) {
      await ctx.reply(
        '📌 **Hướng dẫn giao việc cá nhân:**\n' +
        '👉 Cú pháp: `/task @username <nội dung công việc> [hạn: YYYY-MM-DD HH:mm]`\n' +
        '💡 Ví dụ: `/task @nam Làm slide giới thiệu sản phẩm mới hạn: 2026-08-20 17:00 [gấp]`',
        { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }
      );
      return;
    }

    const targetUser = UserService.getByUsername(parsed.targetRaw);
    const assignedToId = targetUser ? targetUser.telegram_id : undefined;

    const task = TaskService.create({
      title: parsed.title,
      description: parsed.description,
      assignedBy: senderId,
      assignedTo: assignedToId,
      deadline: parsed.deadline,
      priority: parsed.priority,
      groupChatId: ctx.chat?.id.toString(),
    });

    const tagString = `@${parsed.targetRaw}`;
    const messageText = `🔔 ${tagString} Bạn có công việc mới được giao!\n\n` + formatTaskMessage(task);

    const sentMsg = await ctx.reply(messageText, {
      parse_mode: 'Markdown',
      reply_markup: getTaskKeyboard(task),
    });

    TaskService.updateMessageId(task.id, sentMsg.message_id, ctx.chat?.id.toString());
  }

  /**
   * /task_dept <tên phòng> <nội dung> [hạn: YYYY-MM-DD HH:mm]
   */
  public static async assignDepartmentTask(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId) return;

    UserService.upsertUser(senderId, ctx.from.username, ctx.from.first_name);

    if (!UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Bạn cần có quyền Quản trị viên (Admin/Manager) để giao việc theo phòng ban.', {
        reply_to_message_id: ctx.message?.message_id,
      });
      return;
    }

    const text = ctx.message?.text || '';
    const parsed = TaskParser.parseDepartmentTask(text);

    if (!parsed) {
      const depts = DepartmentService.getAll();
      const deptList = depts.map(d => `• \`${d.id}\` (${d.name})`).join('\n');

      await ctx.reply(
        '👥 **Hướng dẫn giao việc theo phòng ban:**\n' +
        '👉 Cú pháp: `/task_dept <tên_phòng> <nội dung> [hạn: YYYY-MM-DD HH:mm]`\n' +
        '💡 Ví dụ: `/task_dept marketing Thiết kế banner sự kiện tuần sau hạn: 17h`\n\n' +
        `🏢 **Danh sách phòng ban hiện có:**\n${deptList || '_Chưa có phòng ban nào_'}\n\n` +
        '👉 Dùng `/add_dept <mã> <tên>` để tạo phòng ban.',
        { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }
      );
      return;
    }

    const dept = DepartmentService.findByNameOrSlug(parsed.targetRaw);
    if (!dept) {
      await ctx.reply(
        `❌ Không tìm thấy phòng ban **"${parsed.targetRaw}"**.\n` +
        `Gõ \`/departments\` để xem danh sách phòng ban hoặc \`/add_dept\` để tạo mới.`,
        { reply_to_message_id: ctx.message?.message_id }
      );
      return;
    }

    const task = TaskService.create({
      title: parsed.title,
      description: parsed.description,
      assignedBy: senderId,
      departmentId: dept.id,
      deadline: parsed.deadline,
      priority: parsed.priority,
      groupChatId: ctx.chat?.id.toString(),
    });

    const members = UserService.getByDepartment(dept.id);
    let tagString = '';
    if (members.length > 0) {
      const tags = members.map(m => (m.username ? `@${m.username}` : m.full_name)).join(' ');
      tagString = `📢 **Mời các thành viên nhận việc:** ${tags}\n\n`;
    } else {
      tagString = `ℹ️ _Phòng ${dept.name} hiện chưa có nhân viên nào. Gõ /set_dept để gán nhân sự._\n\n`;
    }

    const messageText = `🏢 **CÔNG VIỆC PHÒNG ${dept.name.toUpperCase()}**\n\n` + tagString + formatTaskMessage(task);

    const sentMsg = await ctx.reply(messageText, {
      parse_mode: 'Markdown',
      reply_markup: getTaskKeyboard(task),
    });

    TaskService.updateMessageId(task.id, sentMsg.message_id, ctx.chat?.id.toString());
  }

  /**
   * /my_tasks: Xem danh sách công việc của cá nhân
   */
  public static async getMyTasks(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId) return;

    UserService.upsertUser(senderId, ctx.from.username, ctx.from.first_name);

    const tasks = TaskService.getByUser(senderId);
    if (tasks.length === 0) {
      await ctx.reply('🎉 Bạn hiện không có công việc nào đang chờ xử lý!');
      return;
    }

    let msg = `📋 **DANH SÁCH CÔNG VIỆC CỦA BẠN (${tasks.length})**\n\n`;
    for (const t of tasks) {
      const statusIcon = t.status === 'IN_PROGRESS' ? '⚙️' : '⏳';
      const deadlineInfo = t.deadline ? ` | ⏰ Hạn: \`${t.deadline}\`` : '';
      msg += `${statusIcon} **#${t.id}:** ${t.title} (${t.status})${deadlineInfo}\n`;
    }

    msg += '\n👉 Nhấn vào từng công việc để cập nhật trạng thái.';
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  /**
   * /all_tasks: Xem toàn bộ công việc công ty
   */
  public static async getAllTasks(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId) return;

    if (!UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Lệnh này chỉ dành cho Quản trị viên (Admin/Manager).');
      return;
    }

    const tasks = TaskService.getAll(undefined, 20);
    if (tasks.length === 0) {
      await ctx.reply('Hiện chưa có công việc nào được ghi nhận.');
      return;
    }

    let msg = `🏢 **TỔNG HỢP CÔNG VIỆC CÔNG TY (Gần nhất ${tasks.length})**\n\n`;
    for (const t of tasks) {
      const statusIcon = {
        PENDING: '⏳',
        IN_PROGRESS: '⚙️',
        COMPLETED: '✅',
        CANCELLED: '🚫',
      }[t.status];

      const assignee = t.assignee_username 
        ? `@${t.assignee_username}` 
        : (t.department_name ? `Phòng ${t.department_name}` : 'Chưa có');

      msg += `${statusIcon} **#${t.id}**: ${t.title}\n   👤 Nhận: ${assignee} | 📊 ${t.status}\n`;
    }

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  /**
   * /pending_tasks: Xem danh sách việc đang chờ nhận
   */
  public static async getPendingTasks(ctx: Context) {
    const tasks = TaskService.getAll('PENDING', 20);
    if (tasks.length === 0) {
      await ctx.reply('✨ Không có công việc nào đang chờ nhận việc!');
      return;
    }

    let msg = `⏳ **DANH SÁCH VIỆC ĐANG CHỜ NHẬN (${tasks.length})**\n\n`;
    for (const t of tasks) {
      const target = t.assignee_username ? `@${t.assignee_username}` : (t.department_name ? `Phòng ${t.department_name}` : 'Tất cả');
      msg += `• **#${t.id}**: ${t.title}\n   🎯 Cho: ${target}\n`;
    }
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  /**
   * /done_tasks: Xem danh sách việc đã hoàn thành
   */
  public static async getDoneTasks(ctx: Context) {
    const tasks = TaskService.getAll('COMPLETED', 20);
    if (tasks.length === 0) {
      await ctx.reply('Chưa có công việc nào hoàn thành gần đây.');
      return;
    }

    let msg = `✅ **DANH SÁCH VIỆC ĐÃ HOÀN THÀNH (Gần nhất ${tasks.length})**\n\n`;
    for (const t of tasks) {
      const target = t.assignee_username ? `@${t.assignee_username}` : (t.assignee_name || 'Nhân sự');
      msg += `• **#${t.id}**: ${t.title} (${target})\n   🎉 Xong lúc: \`${t.completed_at || t.updated_at}\`\n`;
    }
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  /**
   * /edit_task <id> <nội dung mới> [hạn: ...]
   */
  public static async handleEditTask(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId || !UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Chỉ Quản trị viên mới có quyền chỉnh sửa công việc.');
      return;
    }

    const text = (ctx.message?.text || '').replace(/^\/edit_task(@\w+)?\s*/i, '').trim();
    const parts = text.split(/\s+/);

    if (parts.length < 2 || isNaN(Number(parts[0]))) {
      await ctx.reply(
        '👉 **Cú pháp sửa công việc:**\n' +
        '`/edit_task <id_task> <Nội dung mới> [hạn: YYYY-MM-DD HH:mm]`\n' +
        'Ví dụ: `/edit_task 1 Soạn lại slide và gửi trước 18h hạn: 18h [gấp]`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const taskId = Number(parts[0]);
    const rawContent = parts.slice(1).join(' ');
    const task = TaskService.getById(taskId);

    if (!task) {
      await ctx.reply(`❌ Không tìm thấy công việc với ID #${taskId}.`);
      return;
    }

    let newPriority = task.priority;
    let newDeadline = task.deadline;
    let cleanTitle = rawContent;

    if (/gấp|khẩn cấp|urgent/i.test(cleanTitle)) {
      newPriority = 'URGENT';
      cleanTitle = cleanTitle.replace(/(\[?(gấp|khẩn cấp|urgent)\]?)/gi, '').trim();
    }

    const deadlineRegex = /(?:hạn|deadline|trước|due):\s*([0-9:\-\/\sA-Za-z]+)$/i;
    const deadlineMatch = cleanTitle.match(deadlineRegex);
    if (deadlineMatch) {
      newDeadline = TaskParser.standardizeDeadline(deadlineMatch[1].trim());
      cleanTitle = cleanTitle.replace(deadlineMatch[0], '').trim();
    }

    const updated = TaskService.updateTask(taskId, {
      title: cleanTitle,
      description: cleanTitle,
      deadline: newDeadline,
      priority: newPriority,
    });

    if (updated) {
      await ctx.reply(`✏️ Đã cập nhật công việc **#${taskId}** thành công!\n\n` + formatTaskMessage(updated), {
        parse_mode: 'Markdown',
        reply_markup: getTaskKeyboard(updated),
      });
    } else {
      await ctx.reply(`❌ Cập nhật công việc #${taskId} thất bại.`);
    }
  }

  /**
   * /del_task <id>
   */
  public static async handleDelTask(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId || !UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Chỉ Quản trị viên mới có quyền xóa công việc.');
      return;
    }

    const text = (ctx.message?.text || '').replace(/^\/(del_task|delete_task)(@\w+)?\s*/i, '').trim();
    const taskId = Number(text);

    if (!text || isNaN(taskId)) {
      await ctx.reply(
        '👉 **Cú pháp xóa công việc:**\n' +
        '`/del_task <id_task>`\nVí dụ: `/del_task 1`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const task = TaskService.getById(taskId);
    if (!task) {
      await ctx.reply(`❌ Không tìm thấy công việc với ID #${taskId}.`);
      return;
    }

    const success = TaskService.deleteTask(taskId);
    if (success) {
      await ctx.reply(`🗑️ Đã xóa hoàn toàn công việc **#${taskId}** ("${task.title}") khỏi hệ thống!`, {
        parse_mode: 'Markdown',
      });
    } else {
      await ctx.reply(`❌ Xóa công việc thất bại.`);
    }
  }

  /**
   * Xử lý khi bấm nút nhận việc, hoàn thành, hủy, điểm danh hết hạn, gia hạn
   */
  public static async handleCallback(ctx: Context) {
    const callbackData = ctx.callbackQuery?.data;
    const userId = ctx.from?.id;
    if (!callbackData || !userId) return;

    UserService.upsertUser(userId, ctx.from?.username, ctx.from?.first_name);

    const parts = callbackData.split(':');
    const action = parts[0];
    const subAction = parts[1];
    const rawTaskId = parts[2];
    const extraParam = parts[3];

    if (action !== 'task') return;

    const taskId = Number(rawTaskId);
    const task = TaskService.getById(taskId);

    if (!task) {
      await ctx.answerCallbackQuery({ text: '❌ Công việc không tồn tại hoặc đã bị xóa.' });
      return;
    }

    const userName = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

    // 1. Nhận việc (Accept)
    if (subAction === 'accept') {
      if (task.status !== 'PENDING') {
        await ctx.answerCallbackQuery({ text: `Công việc này đang ở trạng thái: ${task.status}` });
        return;
      }

      const updated = TaskService.updateStatus(taskId, 'IN_PROGRESS', userId, `Được tiếp nhận bởi ${userName}`);
      if (updated) {
        await ctx.answerCallbackQuery({ text: '🚀 Bạn đã tiếp nhận công việc này!' });
        const updatedMsg = formatTaskMessage(updated, `🚀 ${userName} đã tiếp nhận xử lý lúc ${new Date().toLocaleTimeString('vi-VN')}`);
        await ctx.editMessageText(updatedMsg, {
          parse_mode: 'Markdown',
          reply_markup: getTaskKeyboard(updated),
        });
      }
    }

    // 2. Báo cáo hoàn thành (Complete)
    else if (subAction === 'complete' || subAction === 'overdue_done') {
      if (task.status === 'COMPLETED') {
        await ctx.answerCallbackQuery({ text: 'Công việc đã được hoàn thành trước đó.' });
        return;
      }

      const updated = TaskService.updateStatus(taskId, 'COMPLETED', userId, `Hoàn thành bởi ${userName}`);
      if (updated) {
        await ctx.answerCallbackQuery({ text: '🎉 Chúc mừng! Bạn đã hoàn thành công việc!' });
        const updatedMsg = formatTaskMessage(updated, `🎉 ${userName} đã báo cáo HOÀN THÀNH lúc ${new Date().toLocaleTimeString('vi-VN')}`);
        await ctx.editMessageText(updatedMsg, {
          parse_mode: 'Markdown',
          reply_markup: getTaskKeyboard(updated),
        });
      }
    }

    // 3. Khi bấm [Chưa Xong] ở thông báo hết hạn -> Hiện menu chọn gia hạn
    else if (subAction === 'overdue_pending') {
      await ctx.answerCallbackQuery();
      await ctx.reply(
        `⏳ **GIA HẠN CÔNG VIỆC #${taskId}: "${task.title}"**\n\n` +
        `👉 Vui lòng chọn thời gian bạn muốn gia hạn thêm:`,
        {
          parse_mode: 'Markdown',
          reply_markup: getExtensionOptionsKeyboard(taskId),
        }
      );
    }

    // 4. Chọn mức gia hạn nhanh (+2h, +4h, +1d, +2d)
    else if (subAction === 'ext_opt') {
      const duration = extraParam as '2h' | '4h' | '1d' | '2d';
      const newDeadline = TaskHandlers.calculateFutureTime(duration);

      TaskHandlers.pendingExtensions.set(userId, {
        taskId,
        newDeadline,
        isCustom: false,
      });

      await ctx.answerCallbackQuery({ text: `Đã chọn gia hạn +${duration}` });
      await ctx.reply(
        `⏱️ **GIA HẠN TASK #${taskId} ĐẾN: \`${newDeadline}\`**\n\n` +
        `👉 Vui lòng gửi một tin nhắn ngắn nêu **LÝ DO CHƯA XONG** để hoàn tất gia hạn:\n` +
        `_(Ví dụ: Đang đợi duyệt file / Cần bổ sung tài liệu)_`,
        { parse_mode: 'Markdown' }
      );
    }

    // 5. Tự nhập hạn & lý do
    else if (subAction === 'ext_custom') {
      TaskHandlers.pendingExtensions.set(userId, {
        taskId,
        isCustom: true,
      });

      await ctx.answerCallbackQuery();
      await ctx.reply(
        `✍️ **TỰ NHẬP HẠN MỚI & LÝ DO CHO TASK #${taskId}:**\n\n` +
        `👉 Vui lòng gửi tin nhắn theo cú pháp: \`[Thời gian mới] - [Lý do]\`\n` +
        `💡 Ví dụ:\n` +
        `• \`mai 12h - Đang chờ số liệu đối tác\`\n` +
        `• \`2026-08-25 18:00 - Cần thêm thời gian kiểm thử phần mềm\``,
        { parse_mode: 'Markdown' }
      );
    }

    // 6. Hủy công việc (Cancel)
    else if (subAction === 'cancel') {
      const isAdmin = UserService.isAdmin(userId);
      const isAssigner = task.assigned_by === userId;

      if (!isAdmin && !isAssigner) {
        await ctx.answerCallbackQuery({ text: '⚠️ Chỉ người giao việc hoặc Admin mới có quyền hủy task.' });
        return;
      }

      const updated = TaskService.updateStatus(taskId, 'CANCELLED', userId, `Bị hủy bởi ${userName}`);
      if (updated) {
        await ctx.answerCallbackQuery({ text: 'Đã hủy công việc.' });
        const updatedMsg = formatTaskMessage(updated, `🚫 ${userName} đã hủy công việc này.`);
        await ctx.editMessageText(updatedMsg, {
          parse_mode: 'Markdown',
          reply_markup: getTaskKeyboard(updated),
        });
      }
    }

    // 7. Báo cáo tiến độ (Progress)
    else if (subAction === 'progress') {
      await ctx.answerCallbackQuery({ 
        text: `📌 Để báo cáo tiến độ, bạn có thể reply trực tiếp vào tin nhắn này kèm nội dung cập nhật.`,
        show_alert: true 
      });
    }

    // 8. Xem chi tiết (Detail)
    else if (subAction === 'detail') {
      await ctx.answerCallbackQuery({
        text: `Chi tiết task #${task.id}: ${task.title}\nTrạng thái: ${task.status}`,
        show_alert: true
      });
    }
  }

  /**
   * Bắt tin nhắn văn bản khi người dùng đang trong trạng thái nhập lý do gia hạn
   */
  public static async handleTextMessage(ctx: Context): Promise<boolean> {
    const userId = ctx.from?.id;
    const text = ctx.message?.text?.trim();
    if (!userId || !text) return false;

    // Bỏ qua nếu là lệnh bắt đầu bằng dấu /
    if (text.startsWith('/')) return false;

    const pending = TaskHandlers.pendingExtensions.get(userId);
    if (!pending) return false;

    const task = TaskService.getById(pending.taskId);
    if (!task) {
      TaskHandlers.pendingExtensions.delete(userId);
      return false;
    }

    let targetDeadline = pending.newDeadline || '';
    let reason = text;

    if (pending.isCustom) {
      // Tách theo dấu gạch ngang "-"
      if (text.includes('-')) {
        const parts = text.split('-');
        const timePart = parts[0].trim();
        reason = parts.slice(1).join('-').trim();
        targetDeadline = TaskParser.standardizeDeadline(timePart);
      } else {
        targetDeadline = TaskParser.standardizeDeadline(text);
        reason = 'Chưa kịp hoàn thành';
      }
    }

    if (!targetDeadline) {
      targetDeadline = TaskHandlers.calculateFutureTime('2h');
    }

    const updated = TaskService.extendDeadline(pending.taskId, targetDeadline, reason, userId);
    TaskHandlers.pendingExtensions.delete(userId);

    const userName = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

    let responseMsg = `✅ **ĐÃ GIA HẠN CÔNG VIỆC #${task.id} THÀNH CÔNG!**\n\n`;
    responseMsg += `📌 **Tiêu đề:** **${task.title}**\n`;
    responseMsg += `👤 **Người thực hiện:** ${userName}\n`;
    responseMsg += `⏰ **Hạn chót mới:** \`${targetDeadline}\` (Gia hạn lần ${task.extension_count + 1})\n`;
    responseMsg += `📝 **Lý do:** _${reason}_\n\n`;
    responseMsg += `🔔 _Hệ thống sẽ tự động theo dõi và tiếp tục nhắc nhở theo hạn mới!_`;

    await ctx.reply(responseMsg, {
      parse_mode: 'Markdown',
      reply_markup: updated ? getTaskKeyboard(updated) : undefined,
    });

    return true;
  }

  public static calculateFutureTime(duration: '2h' | '4h' | '1d' | '2d'): string {
    const now = new Date();
    let addMs = 0;
    if (duration === '2h') addMs = 2 * 3600 * 1000;
    else if (duration === '4h') addMs = 4 * 3600 * 1000;
    else if (duration === '1d') addMs = 24 * 3600 * 1000;
    else if (duration === '2d') addMs = 48 * 3600 * 1000;

    const target = new Date(now.getTime() + addMs);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const YYYY = target.getFullYear();
    const MM = pad(target.getMonth() + 1);
    const DD = pad(target.getDate());
    const HH = pad(target.getHours());
    const mm = pad(target.getMinutes());
    const ss = '00';
    return `${YYYY}-${MM}-${DD} ${HH}:${mm}:${ss}`;
  }
}
