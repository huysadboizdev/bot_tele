import { Context, InlineKeyboard } from 'grammy';
import { TaskService, Task } from './service';
import {
  formatTaskMessage,
  getTaskKeyboard,
  getExtensionOptionsKeyboard,
} from './keyboards';
import { UserService } from '../users/service';
import { DepartmentService } from '../departments/service';
import { TaskParser } from '../parser';
import { CONFIG } from '../../config/env';

export interface PendingExtensionState {
  taskId: number;
  newDeadline?: string;
  isCustom?: boolean;
}

export class TaskHandlers {
  // Lưu trạng thái chờ người dùng nhập lý do gia hạn hoặc hạn chót mới (key: string userId hoặc chatId)
  public static pendingExtensions = new Map<string, PendingExtensionState>();

  /**
   * /task @username <nội dung> [hạn: YYYY-MM-DD HH:mm]
   */
  public static async assignUserTask(ctx: Context) {
    const isChannel = ctx.chat?.type === 'channel';
    const rawMsg = ctx.message || ctx.channelPost;
    let senderId = ctx.from?.id;

    if (isChannel && !senderId) {
      senderId = CONFIG.ADMIN_IDS[0] || (ctx.chat?.id ? Math.abs(ctx.chat.id) : 111111);
    }

    if (!senderId) return;

    if (ctx.from?.id) {
      UserService.upsertUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
    }

    if (!isChannel && !UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Bạn cần có quyền Quản trị viên (Admin/Manager) để giao việc.', {
        reply_to_message_id: rawMsg?.message_id,
      });
      return;
    }

    const text = rawMsg?.text || '';
    const parsed = TaskParser.parseUserTask(text);

    if (!parsed) {
      await ctx.reply(
        '📌 <b>Hướng dẫn giao việc cá nhân:</b>\n' +
        '👉 Cú pháp: <code>/task @username &lt;nội dung công việc&gt; [hạn: YYYY-MM-DD HH:mm]</code>\n' +
        '💡 Ví dụ: <code>/task @nam Làm slide giới thiệu sản phẩm mới hạn: 2026-08-20 17:00 [gấp]</code>',
        { parse_mode: 'HTML', reply_to_message_id: rawMsg?.message_id }
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

    const cleanUsername = parsed.targetRaw.replace(/^@+/, '').trim();
    const tagString = cleanUsername ? `@${cleanUsername}` : '';
    const messageText = `🔔 ${tagString} Bạn có công việc mới được giao!\n\n` + formatTaskMessage(task);

    const sentMsg = await ctx.reply(messageText, {
      parse_mode: 'HTML',
      reply_markup: getTaskKeyboard(task),
    });

    TaskService.updateMessageId(task.id, sentMsg.message_id, ctx.chat?.id.toString());
  }

  /**
   * /task_dept <tên phòng> <nội dung> [hạn: YYYY-MM-DD HH:mm]
   */
  public static async assignDepartmentTask(ctx: Context) {
    const isChannel = ctx.chat?.type === 'channel';
    const rawMsg = ctx.message || ctx.channelPost;
    let senderId = ctx.from?.id;

    if (isChannel && !senderId) {
      senderId = CONFIG.ADMIN_IDS[0] || (ctx.chat?.id ? Math.abs(ctx.chat.id) : 111111);
    }

    if (!senderId) return;

    if (ctx.from?.id) {
      UserService.upsertUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
    }

    if (!isChannel && !UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Bạn cần có quyền Quản trị viên (Admin/Manager) để giao việc theo phòng ban.', {
        reply_to_message_id: rawMsg?.message_id,
      });
      return;
    }

    const text = rawMsg?.text || '';
    const parsed = TaskParser.parseDepartmentTask(text);

    if (!parsed) {
      const depts = DepartmentService.getAll();
      const deptList = depts.map(d => `• <code>${d.id}</code> (${d.name})`).join('\n');

      await ctx.reply(
        '👥 <b>Hướng dẫn giao việc theo phòng ban:</b>\n' +
        '👉 Cú pháp: <code>/task_dept &lt;tên_phòng&gt; &lt;nội dung&gt; [hạn: YYYY-MM-DD HH:mm]</code>\n' +
        '💡 Ví dụ: <code>/task_dept marketing Thiết kế banner sự kiện tuần sau hạn: 17h</code>\n\n' +
        `🏢 <b>Danh sách phòng ban hiện có:</b>\n${deptList || '<i>Chưa có phòng ban nào</i>'}\n\n` +
        '👉 Dùng <code>/add_dept &lt;mã&gt; &lt;tên&gt;</code> để tạo phòng ban.',
        { parse_mode: 'HTML', reply_to_message_id: rawMsg?.message_id }
      );
      return;
    }

    const dept = DepartmentService.findByNameOrSlug(parsed.targetRaw);
    if (!dept) {
      await ctx.reply(`❌ Không tìm thấy phòng ban nào khớp với: "${parsed.targetRaw}". Dùng /departments để xem danh sách.`, {
        reply_to_message_id: rawMsg?.message_id,
      });
      return;
    }

    const deptMembers = UserService.getByDepartment(dept.id);
    const tagList = deptMembers
      .map(u => u.username ? `@${u.username.replace(/^@+/, '')}` : u.full_name)
      .filter(Boolean);
    const tagString = tagList.length > 0 ? tagList.join(' ') : `phòng ${dept.name}`;

    const task = TaskService.create({
      title: parsed.title,
      description: parsed.description,
      assignedBy: senderId,
      deadline: parsed.deadline,
      priority: parsed.priority,
      groupChatId: ctx.chat?.id.toString(),
    });

    const messageText = `📢 <b>GIAO VIỆC PHÒNG ${dept.name.toUpperCase()}</b>\n` +
      `👥 <b>Thành viên:</b> ${tagString}\n\n` +
      formatTaskMessage(task);

    const sentMsg = await ctx.reply(messageText, {
      parse_mode: 'HTML',
      reply_markup: getTaskKeyboard(task),
    });

    TaskService.updateMessageId(task.id, sentMsg.message_id, ctx.chat?.id.toString());
  }

  /**
   * /my_tasks: Xem danh sách task được giao cho bản thân
   */
  public static async getMyTasks(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    UserService.upsertUser(userId, ctx.from.username, ctx.from.first_name);

    const tasks = TaskService.getByUser(userId);
    const activeTasks = tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS');

    if (activeTasks.length === 0) {
      await ctx.reply('✨ Bạn hiện tại không có công việc nào đang chờ xử lý. Tuyệt vời!');
      return;
    }

    let msg = `📋 **DANH SÁCH CÔNG VIỆC CỦA BẠN (${activeTasks.length}):**\n\n`;
    for (const t of activeTasks) {
      const statusIcon = t.status === 'PENDING' ? '⏳ Chờ nhận' : '⚡ Đang làm';
      const deadlineStr = t.deadline ? `\n   ⏰ Hạn chót: \`${t.deadline}\`` : '';
      msg += `• **#${t.id}**: ${t.title} [${statusIcon}]${deadlineStr}\n`;
    }
    msg += `\n👉 Gõ \`/task\` hoặc bấm các nút trên tin nhắn task để nhận việc / hoàn thành.`;

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  /**
   * /all_tasks: Xem danh sách toàn bộ task trong hệ thống (chỉ Admin)
   */
  public static async getAllTasks(ctx: Context) {
    const isChannel = ctx.chat?.type === 'channel';
    const senderId = ctx.from?.id || (isChannel ? (CONFIG.ADMIN_IDS[0] || 111111) : undefined);
    if (!senderId || (!isChannel && !UserService.isAdmin(senderId))) {
      await ctx.reply('⚠️ Chỉ Quản trị viên mới có quyền xem toàn bộ công việc.');
      return;
    }

    const tasks = TaskService.getAll(undefined, 20);
    if (tasks.length === 0) {
      await ctx.reply('✨ Chưa có công việc nào được tạo trong hệ thống.');
      return;
    }

    let msg = `📊 **TỔNG HỢP CÔNG VIỆC TOÀN CÔNG TY (20 task gần nhất):**\n\n`;
    for (const t of tasks) {
      let icon = '⏳';
      if (t.status === 'IN_PROGRESS') icon = '⚡';
      else if (t.status === 'COMPLETED') icon = '✅';
      else if (t.status === 'CANCELLED') icon = '🚫';

      const target = t.assignee_username ? `@${t.assignee_username}` : (t.assignee_name || 'Chưa gán');
      msg += `• **#${t.id}** [${icon}] ${t.title}\n   🎯 Giao: ${target} | Hạn: \`${t.deadline || 'Không có'}\`\n\n`;
    }

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  /**
   * /pending_tasks: Xem các task đang chờ nhận hoặc đang làm
   */
  public static async getPendingTasks(ctx: Context) {
    const isChannel = ctx.chat?.type === 'channel';
    const senderId = ctx.from?.id || (isChannel ? (CONFIG.ADMIN_IDS[0] || 111111) : undefined);
    if (!senderId || (!isChannel && !UserService.isAdmin(senderId))) {
      await ctx.reply('⚠️ Chỉ Quản trị viên mới có quyền xem danh sách này.');
      return;
    }

    const pending = TaskService.getAll('PENDING', 20);
    const inProgress = TaskService.getAll('IN_PROGRESS', 20);
    const tasks = [...pending, ...inProgress];

    if (tasks.length === 0) {
      await ctx.reply('🎉 Toàn bộ công việc đã hoàn thành sạch sẽ!');
      return;
    }

    let msg = `⏳ **CÁC CÔNG VIỆC CHƯA HOÀN THÀNH (${tasks.length}):**\n\n`;
    for (const t of tasks) {
      const icon = t.status === 'PENDING' ? '⏳' : '⚡';
      const target = t.assignee_username ? `@${t.assignee_username}` : (t.assignee_name || 'Chưa nhận');
      msg += `• **#${t.id}** [${icon}] ${t.title}\n   🎯 Phụ trách: ${target} | Hạn: \`${t.deadline || 'Không có'}\`\n\n`;
    }

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  /**
   * /done_tasks: Xem các task đã hoàn thành gần đây
   */
  public static async getDoneTasks(ctx: Context) {
    const isChannel = ctx.chat?.type === 'channel';
    const senderId = ctx.from?.id || (isChannel ? (CONFIG.ADMIN_IDS[0] || 111111) : undefined);
    if (!senderId || (!isChannel && !UserService.isAdmin(senderId))) {
      await ctx.reply('⚠️ Chỉ Quản trị viên mới có quyền xem danh sách này.');
      return;
    }

    const tasks = TaskService.getAll('COMPLETED', 15);
    if (tasks.length === 0) {
      await ctx.reply('Chưa có công việc nào hoàn thành.');
      return;
    }

    let msg = `✅ **CÁC CÔNG VIỆC ĐÃ HOÀN THÀNH GẦN ĐÂY:**\n\n`;
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
    const isChannel = ctx.chat?.type === 'channel';
    const rawMsg = ctx.message || ctx.channelPost;
    let senderId = ctx.from?.id;

    if (isChannel && !senderId) {
      senderId = CONFIG.ADMIN_IDS[0] || (ctx.chat?.id ? Math.abs(ctx.chat.id) : 111111);
    }

    if (!senderId || (!isChannel && !UserService.isAdmin(senderId))) {
      await ctx.reply('⚠️ Chỉ Quản trị viên mới có quyền chỉnh sửa công việc.');
      return;
    }

    const text = (rawMsg?.text || '').replace(/^\/edit_task(@\w+)?\s*/i, '').trim();
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
    const isChannel = ctx.chat?.type === 'channel';
    const rawMsg = ctx.message || ctx.channelPost;
    let senderId = ctx.from?.id;

    if (isChannel && !senderId) {
      senderId = CONFIG.ADMIN_IDS[0] || (ctx.chat?.id ? Math.abs(ctx.chat.id) : 111111);
    }

    if (!senderId || (!isChannel && !UserService.isAdmin(senderId))) {
      await ctx.reply('⚠️ Chỉ Quản trị viên mới có quyền xóa công việc.');
      return;
    }

    const text = (rawMsg?.text || '').replace(/^\/(del_task|delete_task)(@\w+)?\s*/i, '').trim();
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

      TaskHandlers.pendingExtensions.set(String(userId), {
        taskId,
        newDeadline,
        isCustom: false,
      });
      if (ctx.chat?.id) {
        TaskHandlers.pendingExtensions.set(String(ctx.chat.id), {
          taskId,
          newDeadline,
          isCustom: false,
        });
      }

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
      TaskHandlers.pendingExtensions.set(String(userId), {
        taskId,
        isCustom: true,
      });
      if (ctx.chat?.id) {
        TaskHandlers.pendingExtensions.set(String(ctx.chat.id), {
          taskId,
          isCustom: true,
        });
      }

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
          parse_mode: 'HTML',
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
      const target = TaskService.getById(taskId);
      if (target) {
        await ctx.answerCallbackQuery();
        await ctx.editMessageText(formatTaskMessage(target), {
          parse_mode: 'HTML',
          reply_markup: getTaskKeyboard(target),
        });
      }
    }

    // 9. Nút Sửa công việc (Edit Task Prompt)
    else if (subAction === 'edit') {
      await ctx.answerCallbackQuery();
      await ctx.reply(
        `✏️ <b>HƯỚNG DẪN SỬA CÔNG VIỆC #${task.id}:</b>\n\n` +
        `👉 Cú pháp: <code>/edit_task ${task.id} &lt;Nội dung mới&gt; [hạn: YYYY-MM-DD HH:mm] [gấp]</code>\n` +
        `💡 Ví dụ: <code>/edit_task ${task.id} ${task.title} (Cập nhật) hạn: mai 17h</code>`,
        { parse_mode: 'HTML' }
      );
    }

    // 10. Nút Xóa công việc (Delete Task Confirmation)
    else if (subAction === 'del_confirm') {
      const isAdmin = UserService.isAdmin(userId);
      const isAssigner = task.assigned_by === userId;

      if (!isAdmin && !isAssigner) {
        await ctx.answerCallbackQuery({ text: '⚠️ Chỉ người giao việc hoặc Admin mới có quyền xóa task.', show_alert: true });
        return;
      }

      const confirmKb = new InlineKeyboard()
        .text('⚠️ Xác Nhận Xóa', `task:delete_confirmed:${taskId}`)
        .text('Quay Lại', `task:detail:${taskId}`);

      await ctx.answerCallbackQuery();
      await ctx.editMessageReplyMarkup({ reply_markup: confirmKb });
    }

    // 11. Đã bấm xác nhận Xóa
    else if (subAction === 'delete_confirmed') {
      const isAdmin = UserService.isAdmin(userId);
      const isAssigner = task.assigned_by === userId;

      if (!isAdmin && !isAssigner) {
        await ctx.answerCallbackQuery({ text: '⚠️ Bạn không có quyền xóa.', show_alert: true });
        return;
      }

      TaskService.deleteTask(taskId);
      await ctx.answerCallbackQuery({ text: 'Đã xóa công việc thành công!' });
      await ctx.editMessageText(`🗑️ <b>Công việc #${taskId} ("${task.title}") đã được xóa hoàn toàn khỏi hệ thống bởi ${userName}.</b>`, {
        parse_mode: 'HTML',
      });
    }
  }

  /**
   * Bắt tin nhắn văn bản khi người dùng đang trong trạng thái nhập lý do gia hạn
   */
  public static async handleTextMessage(ctx: Context): Promise<boolean> {
    const rawMsg = ctx.message || ctx.channelPost;
    const text = rawMsg?.text?.trim();
    if (!text) return false;

    // Bỏ qua nếu là lệnh bắt đầu bằng dấu /
    if (text.startsWith('/')) return false;

    const userIdStr = ctx.from?.id ? String(ctx.from.id) : undefined;
    const chatIdStr = ctx.chat?.id ? String(ctx.chat.id) : undefined;

    let pending: PendingExtensionState | undefined;
    if (userIdStr && TaskHandlers.pendingExtensions.has(userIdStr)) {
      pending = TaskHandlers.pendingExtensions.get(userIdStr);
      TaskHandlers.pendingExtensions.delete(userIdStr);
      if (chatIdStr) TaskHandlers.pendingExtensions.delete(chatIdStr);
    } else if (chatIdStr && TaskHandlers.pendingExtensions.has(chatIdStr)) {
      pending = TaskHandlers.pendingExtensions.get(chatIdStr);
      TaskHandlers.pendingExtensions.delete(chatIdStr);
    }

    if (!pending) return false;

    const task = TaskService.getById(pending.taskId);
    if (!task) {
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

    const authorId = ctx.from?.id || (CONFIG.ADMIN_IDS[0] || 111111);
    const updated = TaskService.extendDeadline(pending.taskId, targetDeadline, reason, authorId);

    const userName = ctx.from?.username 
      ? `@${ctx.from.username.replace(/_/g, '\\_')}` 
      : (ctx.from?.first_name || ctx.chat?.title || 'Người phụ trách');

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
