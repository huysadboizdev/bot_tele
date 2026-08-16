import { Context } from 'grammy';
import { MeetingService } from './service';
import { formatMeetingMessage, getMeetingKeyboard } from './keyboards';
import { UserService } from '../users/service';
import { DepartmentService } from '../departments/service';
import { TaskParser } from '../parser';

export class MeetingHandlers {
  /**
   * /meeting <tiêu đề> lúc: <thời gian> [tại: ...] [cho: ...]
   */
  public static async handleScheduleMeeting(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId) return;

    UserService.upsertUser(senderId, ctx.from.username, ctx.from.first_name);

    if (!UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Chỉ Quản trị viên (Sếp / Quản lý) mới có quyền tạo và lên lịch cuộc họp.');
      return;
    }

    const text = (ctx.message?.text || '').replace(/^\/meeting(@\w+)?\s*/i, '').trim();

    if (!text) {
      await ctx.reply(
        '👉 **CÚ PHÁP LÊN LỊCH CUỘC HỌP:**\n\n' +
        '`/meeting <Chủ đề> lúc: <Thời gian> [tại: Địa điểm/Link] [cho: all/mã_phòng/@user]`\n\n' +
        '**Ví dụ:**\n' +
        '1. `/meeting Họp giao ban đầu tuần lúc: 2026-08-20 09:00 tại: Phòng Họp Tầng 2 [cho: all]`\n' +
        '2. `/meeting Họp chiến dịch mới lúc: 14h30 tại: Google Meet: meet.google.com/xyz cho: marketing`\n' +
        '3. `/meeting Đánh giá tiến độ lúc: 16:00 cho: @Khoiimen`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Phân tích các trường thông tin trong câu lệnh
    let remaining = text;
    let location: string | undefined;
    let targetType: 'ALL' | 'DEPARTMENT' | 'USERS' = 'ALL';
    let targetValue: string | undefined;
    let meetingTimeStr: string | undefined;

    // 1. Trích xuất [cho: ...] hoặc cho: ...
    const forMatch = remaining.match(/(?:\[cho:\s*([^\]]+)\]|cho:\s*([^\s\[\]]+))/i);
    if (forMatch) {
      const rawTarget = (forMatch[1] || forMatch[2]).trim().toLowerCase();
      if (rawTarget === 'all' || rawTarget === 'tatca' || rawTarget === 'toanbo') {
        targetType = 'ALL';
      } else if (rawTarget.startsWith('@')) {
        targetType = 'USERS';
        targetValue = rawTarget;
      } else {
        const dept = DepartmentService.findByNameOrSlug(rawTarget);
        if (dept) {
          targetType = 'DEPARTMENT';
          targetValue = dept.id;
        } else {
          targetType = 'USERS';
          targetValue = rawTarget;
        }
      }
      remaining = remaining.replace(forMatch[0], '').trim();
    }

    // 2. Trích xuất tại: / o: / link:
    const locMatch = remaining.match(/(?:(?:tại|ở|link|location):\s*([^\[\]]+?)(?=\s*(?:lúc|hạn|cho|\[|$)))/i);
    if (locMatch) {
      location = locMatch[1].trim();
      remaining = remaining.replace(locMatch[0], '').trim();
    }

    // 3. Trích xuất lúc: / time: / vào lúc:
    const timeMatch = remaining.match(/(?:(?:lúc|time|vào lúc|ngày|hạn):\s*([^\[\]]+?)(?=\s*(?:tại|ở|link|cho|\[|$)))/i);
    if (timeMatch) {
      meetingTimeStr = timeMatch[1].trim();
      remaining = remaining.replace(timeMatch[0], '').trim();
    }

    // Tiêu đề là phần còn lại
    const title = remaining.replace(/^[,\-\s]+|[,\-\s]+$/g, '').trim();

    if (!title || !meetingTimeStr) {
      await ctx.reply(
        '⚠️ Vui lòng ghi rõ **Chủ đề** và **Thời gian** cuộc họp (`lúc: YYYY-MM-DD HH:mm` hoặc `lúc: 14h30`).',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const standardizedTime = TaskParser.standardizeDeadline(meetingTimeStr);
    const chatId = ctx.chat?.id ? String(ctx.chat.id) : undefined;

    const meeting = MeetingService.create({
      title,
      meetingTime: standardizedTime,
      location,
      targetType,
      targetValue,
      groupChatId: chatId,
      createdBy: senderId,
    });

    // Tạo chuỗi tag thành viên nếu có
    let tagString = '';
    if (targetType === 'DEPARTMENT' && targetValue) {
      const members = UserService.getByDepartment(targetValue);
      const tags = members.map(m => m.username ? `@${m.username}` : m.full_name).filter(Boolean);
      if (tags.length > 0) {
        tagString = `\n📢 **Mời các bạn tham gia:** ${tags.join(' ')}\n`;
      }
    } else if (targetType === 'USERS' && targetValue) {
      tagString = `\n📢 **Mời:** ${targetValue}\n`;
    }

    const msg = formatMeetingMessage(meeting) + tagString;
    await ctx.reply(msg, {
      parse_mode: 'Markdown',
      reply_markup: getMeetingKeyboard(meeting.id),
    });
  }

  /**
   * /meetings: Xem danh sách cuộc họp sắp diễn ra
   */
  public static async handleGetMeetings(ctx: Context) {
    const upcoming = MeetingService.getUpcoming(10);
    if (upcoming.length === 0) {
      await ctx.reply('✨ Hiện tại không có cuộc họp nào sắp tới.');
      return;
    }

    let msg = `📅 **DANH SÁCH CUỘC HỌP SẮP TỚI (${upcoming.length})**\n\n`;
    for (const m of upcoming) {
      let targetDisplay = 'Toàn công ty';
      if (m.target_type === 'DEPARTMENT' && m.target_value) {
        targetDisplay = `Phòng ${m.target_value.toUpperCase()}`;
      } else if (m.target_type === 'USERS' && m.target_value) {
        targetDisplay = m.target_value;
      }

      msg += `📌 **#${m.id}: ${m.title}**\n`;
      msg += `   ⏰ Lúc: \`${m.meeting_time}\`\n`;
      if (m.location) msg += `   📍 Tại: ${m.location}\n`;
      msg += `   👥 Đối tượng: ${targetDisplay}\n\n`;
    }

    msg += '👉 Dùng `/del_meeting <id>` nếu muốn hủy cuộc họp.';
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  /**
   * /del_meeting <id>
   */
  public static async handleDelMeeting(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId || !UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Chỉ Quản trị viên mới có quyền hủy cuộc họp.');
      return;
    }

    const text = (ctx.message?.text || '').replace(/^\/(del_meeting|cancel_meeting)(@\w+)?\s*/i, '').trim();
    const meetingId = Number(text);

    if (!text || isNaN(meetingId)) {
      await ctx.reply('👉 Cú pháp: `/del_meeting <id_cuộc_họp>`\nVí dụ: `/del_meeting 1`', { parse_mode: 'Markdown' });
      return;
    }

    const meeting = MeetingService.getById(meetingId);
    if (!meeting) {
      await ctx.reply(`❌ Không tìm thấy cuộc họp với ID #${meetingId}.`);
      return;
    }

    const success = MeetingService.delete(meetingId);
    if (success) {
      await ctx.reply(`🗑️ Đã hủy cuộc họp **#${meetingId}** ("${meeting.title}") thành công!`, {
        parse_mode: 'Markdown',
      });
    } else {
      await ctx.reply('❌ Hủy cuộc họp thất bại.');
    }
  }

  /**
   * Xử lý Callback nút bấm điểm danh cuộc họp
   */
  public static async handleCallback(ctx: Context) {
    const data = ctx.callbackQuery?.data;
    const userId = ctx.from?.id;
    if (!data || !userId) return;

    if (!data.startsWith('meeting:')) return;

    UserService.upsertUser(userId, ctx.from.username, ctx.from.first_name);

    const parts = data.split(':');
    const action = parts[1]; // confirm, decline, list
    const meetingId = Number(parts[2]);

    const meeting = MeetingService.getById(meetingId);
    if (!meeting) {
      await ctx.answerCallbackQuery({ text: 'Cuộc họp này không tồn tại hoặc đã bị hủy.' });
      return;
    }

    if (action === 'confirm') {
      MeetingService.setParticipantStatus(meetingId, userId, 'CONFIRMED');
      await ctx.answerCallbackQuery({ text: '✅ Bạn đã xác nhận SẼ THAM GIA cuộc họp!' });

      try {
        await ctx.editMessageText(formatMeetingMessage(meeting), {
          parse_mode: 'Markdown',
          reply_markup: getMeetingKeyboard(meetingId),
        });
      } catch (err) {
        // Message might be unchanged
      }
    } else if (action === 'decline') {
      MeetingService.setParticipantStatus(meetingId, userId, 'DECLINED');
      await ctx.answerCallbackQuery({ text: '❌ Bạn đã báo VẮNG MẶT cuộc họp này.' });

      try {
        await ctx.editMessageText(formatMeetingMessage(meeting), {
          parse_mode: 'Markdown',
          reply_markup: getMeetingKeyboard(meetingId),
        });
      } catch (err) {
        // Message might be unchanged
      }
    } else if (action === 'list') {
      const p = MeetingService.getParticipants(meetingId);
      let listMsg = `📋 **DANH SÁCH THAM GIA CUỘC HỌP #${meetingId}**\n\n`;
      listMsg += `✅ **Có mặt (${p.confirmed.length}):**\n`;
      listMsg += p.confirmed.length > 0 ? p.confirmed.map(u => `• ${u.full_name} (@${u.username || 'n/a'})`).join('\n') : '• Chưa có ai xác nhận\n';

      listMsg += `\n❌ **Báo vắng (${p.declined.length}):**\n`;
      listMsg += p.declined.length > 0 ? p.declined.map(u => `• ${u.full_name} (@${u.username || 'n/a'})`).join('\n') : '• Không có ai báo vắng\n';

      await ctx.answerCallbackQuery();
      await ctx.reply(listMsg, { parse_mode: 'Markdown' });
    }
  }
}
