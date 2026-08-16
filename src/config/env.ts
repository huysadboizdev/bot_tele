import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Tải cấu hình từ .env nếu có
dotenv.config();

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const CONFIG = {
  BOT_TOKEN: process.env.BOT_TOKEN || '',
  ADMIN_IDS: (process.env.ADMIN_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean)
    .map(Number),
  MAIN_GROUP_ID: (process.env.MAIN_GROUP_ID || '').split(',')[0]?.trim() || '',
  NOTIFICATION_CHAT_IDS: (process.env.MAIN_GROUP_ID || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean),
  TIMEZONE: process.env.TIMEZONE || 'Asia/Ho_Chi_Minh',
  DATABASE_PATH: process.env.DATABASE_PATH || path.join(dataDir, 'company_bot.sqlite'),
};

export function validateConfig() {
  if (!CONFIG.BOT_TOKEN || CONFIG.BOT_TOKEN.includes('EXAMPLE')) {
    console.warn('\n⚠️  CẢNH BÁO: Bạn chưa cấu hình BOT_TOKEN trong file .env');
    console.warn('👉 Vui lòng tạo file .env từ .env.example và điền BOT_TOKEN từ @BotFather.\n');
  }
}
