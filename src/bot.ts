import { Bot, GrammyError, HttpError } from 'grammy';
import { CONFIG, validateConfig } from './config/env';
import { AdminHandlers } from './modules/admin/handlers';
import { TaskHandlers } from './modules/tasks/handlers';

export function createBot(): Bot {
  validateConfig();

  if (!CONFIG.BOT_TOKEN) {
    throw new Error('BOT_TOKEN chưa được cung cấp trong file .env');
  }

  const bot = new Bot(CONFIG.BOT_TOKEN);

  // 1. Middleware ghi log & cập nhật thông tin user
  bot.use(async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      console.error('Lỗi khi xử lý tin nhắn:', err);
    }
  });

  // 2. Các lệnh hệ thống & Quản trị
  bot.command('start', AdminHandlers.handleStart);
  bot.command('help', AdminHandlers.handleHelp);
  bot.command('departments', AdminHandlers.handleDepartments);
  bot.command('members', AdminHandlers.handleMembers);
  bot.command('set_dept', AdminHandlers.handleSetDept);
  bot.command('set_role', AdminHandlers.handleSetRole);
  bot.command('add_dept', AdminHandlers.handleAddDept);
  bot.command('stats', AdminHandlers.handleStats);

  // 3. Các lệnh Giao việc & Quản lý Task
  bot.command('task', TaskHandlers.assignUserTask);
  bot.command('task_dept', TaskHandlers.assignDepartmentTask);
  bot.command('my_tasks', TaskHandlers.getMyTasks);
  bot.command('all_tasks', TaskHandlers.getAllTasks);

  // 4. Xử lý Callback từ các nút bấm Inline (Nhận việc, Hoàn thành, Hủy)
  bot.on('callback_query:data', TaskHandlers.handleCallback);

  // 5. Bắt lỗi toàn cục của Grammy
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
