import { Database } from './database/db';
import { createBot } from './bot';
import { SchedulerService } from './modules/scheduler';
import { CONFIG } from './config/env';

async function bootstrap() {
  console.log('====================================================');
  console.log('🤖 KHỞI ĐỘNG TELEGRAM BOT QUẢN LÝ CÔNG VIỆC CÔNG TY');
  console.log('====================================================');

  try {
    // 1. Khởi tạo Cơ sở dữ liệu SQLite
    console.log('📦 Đang kiểm tra & nạp cơ sở dữ liệu SQLite...');
    Database.getDb();
    console.log(`✅ Kết nối Database thành công tại: ${CONFIG.DATABASE_PATH}`);

    // 2. Khởi tạo Bot Telegram
    console.log('📡 Đang kết nối Bot Telegram qua Long-Polling...');
    const bot = createBot();

    // 3. Khởi động Lập lịch Nhắc việc 24/7
    SchedulerService.init(bot);

    // 4. Bắt đầu lắng nghe tin nhắn
    bot.start({
      onStart: (botInfo) => {
        console.log(`🚀 BOT ĐÃ HOẠT ĐỘNG ONLINE: @${botInfo.username}`);
        console.log(`👑 Danh sách Admin IDs: ${CONFIG.ADMIN_IDS.join(', ') || 'Chưa cấu hình'}`);
        console.log(`🌐 Múi giờ hệ thống: ${CONFIG.TIMEZONE}`);
        console.log('====================================================');
      },
    });

    // 5. Xử lý đóng ứng dụng an toàn (Graceful Shutdown)
    const shutdown = () => {
      console.log('\n🛑 Đang dừng Bot an toàn...');
      bot.stop();
      Database.close();
      console.log('👋 Bot đã tắt.');
      process.exit(0);
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (error) {
    console.error('❌ Khởi động Bot thất bại:', error);
    process.exit(1);
  }
}

bootstrap();
