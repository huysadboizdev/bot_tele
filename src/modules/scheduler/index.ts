import cron from 'node-cron';
import { Bot } from 'grammy';
import { TaskService } from '../tasks/service';
import { MeetingService } from '../meetings/service';
import { UserService } from '../users/service';
import { CONFIG } from '../../config/env';
import { formatTaskMessage, getTaskKeyboard } from '../tasks/keyboards';
import { formatMeetingMessage, getMeetingKeyboard } from '../meetings/keyboards';

export class SchedulerService {
  private static botInstance: Bot | null = null;

  public static init(bot: Bot) {
    SchedulerService.botInstance = bot;

    console.log('⏰ Khởi động hệ thống lập lịch nhắc việc & lịch họp 24/7 (Timezone: ' + CONFIG.TIMEZONE + ')...');

    // 1. Quét deadline công việc & lịch họp mỗi 2 phút
    cron.schedule('*/2 * * * *', () => {
      SchedulerService.checkDeadlines();
      SchedulerService.checkMeetingReminders();
    }, {
      timezone: CONFIG.TIMEZONE
    });

    // 2. Báo cáo buổi sáng (08:30 AM từ Thứ 2 đến Thứ 7)
    cron.schedule('30 8 * * 1-6', () => {
      SchedulerService.sendMorningBriefing();
    }, {
      timezone: CONFIG.TIMEZONE
    });

    // 3. Báo cáo tổng kết chiều (17:30 PM từ Thứ 2 đến Thứ 7)
    cron.schedule('30 17 * * 1-6', () => {
      SchedulerService.sendEveningSummary();
    }, {
      timezone: CONFIG.TIMEZONE
    });
  }

  /**
   * Quét kiểm tra deadline của các task
   */
  public static async checkDeadlines() {
    if (!SchedulerService.botInstance) return;

    try {
      const activeTasks = TaskService.getTasksDueSoon();
      const now = new Date().getTime();

      for (const task of activeTasks) {
        if (!task.deadline) continue;

        const deadlineTime = new Date(task.deadline).getTime();
        const diffHours = (deadlineTime - now) / (1000 * 60 * 60);

        // Tag string
        const tag = task.assignee_username 
          ? `@${task.assignee_username}` 
          : (task.department_name ? `Phòng ${task.department_name}` : 'Nhân sự phụ trách');

        const targetChatId = task.group_chat_id || task.assigned_to?.toString() || CONFIG.MAIN_GROUP_ID;
        if (!targetChatId) continue;

        // Cảnh báo trước 24h
        if (diffHours <= 24 && diffHours > 2 && task.reminded_24h === 0) {
          const msg = `⚠️ **NHẮC VIỆC TRƯỚC 24H** ⚠️\n` +
            `🔔 ${tag} ơi, công việc **#${task.id}: ${task.title}** còn khoảng **${Math.round(diffHours)} tiếng** nữa là đến hạn chót!\n\n` +
            formatTaskMessage(task);

          await SchedulerService.botInstance.api.sendMessage(targetChatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: getTaskKeyboard(task),
          }).catch(console.error);

          TaskService.markReminded(task.id, '24h');
        }

        // Cảnh báo khẩn cấp trước 2h
        else if (diffHours <= 2 && diffHours > 0 && task.reminded_2h === 0) {
          const msg = `🚨 **CẢNH BÁO GẤP: SẮP HẾT HẠN TRONG 2 TIẾNG!** 🚨\n` +
            `🔴 ${tag} khẩn trương hoàn thành task **#${task.id}: ${task.title}** trước \`${task.deadline}\`!\n\n` +
            formatTaskMessage(task);

          await SchedulerService.botInstance.api.sendMessage(targetChatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: getTaskKeyboard(task),
          }).catch(console.error);

          TaskService.markReminded(task.id, '2h');
        }
      }
    } catch (error) {
      console.error('Error during deadline check:', error);
    }
  }

  /**
   * Quét kiểm tra nhắc lịch họp
   */
  public static async checkMeetingReminders() {
    if (!SchedulerService.botInstance) return;

    try {
      const dueMeetings = MeetingService.getMeetingsDueForReminder();

      for (const item of dueMeetings) {
        const { meeting, type } = item;
        const targetChatId = meeting.group_chat_id || CONFIG.MAIN_GROUP_ID;
        if (!targetChatId) continue;

        let tagString = '';
        if (meeting.target_type === 'DEPARTMENT' && meeting.target_value) {
          const members = UserService.getByDepartment(meeting.target_value);
          const tags = members.map(m => m.username ? `@${m.username}` : m.full_name).filter(Boolean);
          if (tags.length > 0) tagString = `\n📢 **Mời các bạn tham gia:** ${tags.join(' ')}\n`;
        } else if (meeting.target_type === 'USERS' && meeting.target_value) {
          tagString = `\n📢 **Mời:** ${meeting.target_value}\n`;
        }

        let prefix = '📢 **THÔNG BÁO LỊCH HỌP**';
        if (type === '24h') {
          prefix = '🔔 **NHẮC LỊCH HỌP (TRƯỚC 24 GIỜ)** 🔔';
        } else if (type === '1h') {
          prefix = '⏰ **NHẮC LỊCH HỌP: CÒN 1 TIẾNG NỮA BẮT ĐẦU!** ⏰';
        } else if (type === '15m') {
          prefix = '🚨 **KHẨN CẤP: CUỘC HỌP SẮP BẮT ĐẦU TRONG 15 PHÚT NỮA!** 🚨';
        }

        const msg = formatMeetingMessage(meeting, prefix) + tagString;

        await SchedulerService.botInstance.api.sendMessage(targetChatId, msg, {
          parse_mode: 'Markdown',
          reply_markup: getMeetingKeyboard(meeting.id),
        }).catch(console.error);

        MeetingService.markReminded(meeting.id, type);
      }
    } catch (error) {
      console.error('Error during meeting reminder check:', error);
    }
  }

  /**
   * Báo cáo công việc đầu ngày (08:30)
   */
  public static async sendMorningBriefing() {
    if (!SchedulerService.botInstance) return;

    try {
      const stats = TaskService.getStats();
      const overdue = TaskService.getOverdueTasks();
      const upcomingMeetings = MeetingService.getUpcoming(5);

      let msg = `☀️ **CHÀO BUỔI SÁNG - TỔNG HỢP CÔNG VIỆC & LỊCH HỌP HÔM NAY** ☀️\n\n`;
      msg += `📊 **Tiến độ công việc:**\n`;
      msg += `• ⏳ **${stats.pending || 0}** việc đang chờ nhận\n`;
      msg += `• ⚙️ **${stats.in_progress || 0}** việc đang thực hiện\n`;

      if (upcomingMeetings.length > 0) {
        msg += `\n📅 **Lịch họp sắp tới (${upcomingMeetings.length}):**\n`;
        for (const m of upcomingMeetings) {
          msg += `  • #${m.id}: **${m.title}** lúc \`${m.meeting_time}\`\n`;
        }
      }

      if (overdue.length > 0) {
        msg += `\n🔴 **Cảnh báo: ${overdue.length} việc đang bị trễ hạn:**\n`;
        for (const t of overdue.slice(0, 5)) {
          const tag = t.assignee_username ? `@${t.assignee_username}` : t.assignee_name;
          msg += `  - #${t.id}: ${t.title} (${tag}) | Hạn: \`${t.deadline}\`\n`;
        }
      }

      msg += `\n💪 Chúc toàn thể công ty một ngày làm việc hiệu quả và năng suất!`;

      if (CONFIG.MAIN_GROUP_ID) {
        await SchedulerService.botInstance.api.sendMessage(CONFIG.MAIN_GROUP_ID, msg, {
          parse_mode: 'Markdown',
        }).catch(console.error);
      }

      for (const adminId of CONFIG.ADMIN_IDS) {
        await SchedulerService.botInstance.api.sendMessage(adminId, msg, {
          parse_mode: 'Markdown',
        }).catch(console.error);
      }
    } catch (error) {
      console.error('Error sending morning briefing:', error);
    }
  }

  /**
   * Báo cáo tổng kết cuối ngày (17:30)
   */
  public static async sendEveningSummary() {
    if (!SchedulerService.botInstance) return;

    try {
      const stats = TaskService.getStats();

      let msg = `🌆 **BÁO CÁO TỔNG KẾT TIẾN ĐỘ CUỐI NGÀY** 🌆\n\n`;
      msg += `📈 **Kết quả hôm nay:**\n`;
      msg += `• ✅ **Hoàn thành:** ${stats.completed || 0} công việc\n`;
      msg += `• ⚙️ **Còn đang làm:** ${stats.in_progress || 0} công việc\n`;
      msg += `• ⏳ **Chưa nhận việc:** ${stats.pending || 0} công việc\n`;

      if (stats.overdue > 0) {
        msg += `• ⚠️ **Quá hạn:** 🔴 ${stats.overdue} công việc\n`;
      }

      msg += `\n👉 Gõ \`/all_tasks\` hoặc \`/stats\` để xem chi tiết từng công việc.`;

      if (CONFIG.MAIN_GROUP_ID) {
        await SchedulerService.botInstance.api.sendMessage(CONFIG.MAIN_GROUP_ID, msg, {
          parse_mode: 'Markdown',
        }).catch(console.error);
      }

      for (const adminId of CONFIG.ADMIN_IDS) {
        await SchedulerService.botInstance.api.sendMessage(adminId, msg, {
          parse_mode: 'Markdown',
        }).catch(console.error);
      }
    } catch (error) {
      console.error('Error sending evening summary:', error);
    }
  }
}
