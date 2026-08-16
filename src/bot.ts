import { Bot, GrammyError, HttpError } from 'grammy';
import { CONFIG, validateConfig } from './config/env';
import { AdminHandlers } from './modules/admin/handlers';
import { TaskHandlers } from './modules/tasks/handlers';
import { MeetingHandlers } from './modules/meetings/handlers';
import { AccountingHandlers } from './modules/accounting/handlers';
import { UserService } from './modules/users/service';

export function createBot(): Bot {
  validateConfig();

  if (!CONFIG.BOT_TOKEN) {
    throw new Error('BOT_TOKEN chưa được cung cấp trong file .env');
  }

  const bot = new Bot(CONFIG.BOT_TOKEN);

  // 1. Middleware ghi log & tự động đăng ký/cập nhật thông tin user toàn cục
  bot.use(async (ctx, next) => {
    if (ctx.from?.id) {
      try {
        UserService.upsertUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
      } catch (err) {
        console.error('Lỗi khi upsert user trong middleware:', err);
      }
    }

    try {
      await next();
    } catch (err) {
      console.error('Lỗi khi xử lý tin nhắn:', err);
    }
  });

  // 2. Middleware chặn tin nhắn phản hồi khi đang trong trạng thái gia hạn task hoặc nộp biên bản họp
  bot.on('message:text', async (ctx, next) => {
    const taskHandled = await TaskHandlers.handleTextMessage(ctx);
    if (taskHandled) return;

    const meetingHandled = await MeetingHandlers.handleTextMessage(ctx);
    if (meetingHandled) return;

    await next();
  });

  // 3. Các lệnh hệ thống & Quản trị Phòng ban / Nhân sự
  bot.command('start', AdminHandlers.handleStart);
  bot.command('help', AdminHandlers.handleHelp);
  bot.command(['admin', 'dashboard'], AdminHandlers.handleDashboard);
  bot.command('admins', AdminHandlers.handleAdminsList);
  bot.command(['broadcast', 'thong_bao', 'announcement'], AdminHandlers.handleBroadcast);
  bot.command('departments', AdminHandlers.handleDepartments);
  bot.command('members', AdminHandlers.handleMembers);
  bot.command('set_user', AdminHandlers.handleSetUser);
  bot.command('set_title', AdminHandlers.handleSetTitle);
  bot.command('set_dept', AdminHandlers.handleSetDept);
  bot.command(['remove_dept', 'unset_dept'], AdminHandlers.handleRemoveDept);
  bot.command('set_role', AdminHandlers.handleSetRole);
  bot.command('add_dept', AdminHandlers.handleAddDept);
  bot.command(['edit_dept', 'rename_dept'], AdminHandlers.handleEditDept);
  bot.command(['del_dept', 'delete_dept'], AdminHandlers.handleDelDept);
  bot.command(['del_user', 'remove_user'], AdminHandlers.handleDelUser);
  bot.command('stats', AdminHandlers.handleStats);

  // 4. Các lệnh Giao việc & Quản lý Task (CRUD)
  bot.command('task', TaskHandlers.assignUserTask);
  bot.command('task_dept', TaskHandlers.assignDepartmentTask);
  bot.command('edit_task', TaskHandlers.handleEditTask);
  bot.command(['del_task', 'delete_task'], TaskHandlers.handleDelTask);
  bot.command('my_tasks', TaskHandlers.getMyTasks);
  bot.command('all_tasks', TaskHandlers.getAllTasks);
  bot.command('pending_tasks', TaskHandlers.getPendingTasks);
  bot.command('done_tasks', TaskHandlers.getDoneTasks);

  // 5. Các lệnh Lên lịch & Quản lý Cuộc họp (Meetings)
  bot.command('meeting', MeetingHandlers.handleScheduleMeeting);
  bot.command('meetings', MeetingHandlers.handleGetMeetings);
  bot.command(['meeting_notes', 'minutes', 'bien_ban'], MeetingHandlers.handleMeetingNotes);
  bot.command(['del_meeting', 'cancel_meeting'], MeetingHandlers.handleDelMeeting);

  // 6. Các lệnh Kế toán: Thu / Chi / Chia Tiền / Công Nợ / Sổ Quỹ
  bot.command('chi', AccountingHandlers.handleExpense);
  bot.command('thu', AccountingHandlers.handleIncome);
  bot.command(['cong_no', 'debts'], AccountingHandlers.handleDebts);
  bot.command('my_debts', AccountingHandlers.handleMyDebts);
  bot.command(['so_quy', 'thu_chi', 'ledger'], AccountingHandlers.handleLedger);
  bot.command(['quy', 'funds'], AccountingHandlers.handleFundReport);

  // 7. Xử lý Callback từ các nút bấm Inline (Admin & Task & Meeting & Accounting)
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery?.data;
    if (data?.startsWith('meeting:')) {
      await MeetingHandlers.handleCallback(ctx);
    } else if (data?.startsWith('admin:')) {
      await AdminHandlers.handleCallback(ctx);
    } else if (data?.startsWith('acc:')) {
      await AccountingHandlers.handleCallback(ctx);
    } else {
      await TaskHandlers.handleCallback(ctx);
    }
  });

  // 7. Bắt lỗi toàn cục của Grammy
  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Lỗi khi xử lý update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof GrammyError) {
      console.error('Lỗi từ Telegram API:', e.description);
    } else if (e instanceof HttpError) {
      console.error('Lỗi kết nối mạng Telegram:', e);
    } else {
      console.error('Lỗi không xác định:', e);
    }
  });

  return bot;
}
