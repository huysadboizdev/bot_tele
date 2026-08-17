import { Context, InlineKeyboard } from 'grammy';
import { MeetingService, Meeting } from './service';
import {
  formatMeetingMessage,
  getMeetingKeyboard,
  formatMeetingNotesMessage,
  getDateFilterKeyboard,
} from './keyboards';
import { UserService } from '../users/service';
import { DepartmentService } from '../departments/service';
import { TaskParser } from '../parser';
import { CONFIG } from '../../config/env';

export class MeetingHandlers {
  // Trạng thái chờ thư ký gửi nội dung biên bản cuộc họp (key: userId hoặc chatId)
  public static userPendingMeetingNotes = new Map<string, number>();

  // Trạng thái chờ người dùng gõ ngày cần tra cứu (key: userId hoặc chatId)
  public static userPendingDateFilter = new Set<string>();

  /**
   * /meeting <tiêu đề> lúc: <thời gian> [tại: ...] [cho: ...]
   */
  public static async handleScheduleMeeting(ctx: Context) {
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
      await ctx.reply('⚠️ Chỉ Quản trị viên (Sếp / Quản lý) mới có quyền tạo và lên lịch cuộc họp.');
      return;
    }

    const rawText = rawMsg?.text || '';
    const text = rawText.replace(/^\/meeting(@\w+)?\s*/i, '').trim();

    if (!text) {
      await ctx.reply(
        '👉 **CÚ PHÁP LÊN LỊCH CUỘC HỌP:**\n\n' +
        '`/meeting <Chủ đề> lúc: <Thời gian> [tại: Địa điểm/Link] [cho: all/mã_phòng/@user]`\n\n' +
        '**Ví dụ:**\n' +
        '1. `/meeting Họp giao ban đầu tuần lúc: 2026-08-20 09:00 tại: Phòng Họp Tầng 2 [cho: all]`\n' +
        '2. `/meeting Họp chiến dịch mới lúc: 14h30 tại: Google Meet cho: marketing`\n' +
        '3. `/meeting Đánh giá tiến độ lúc: 16:00 cho: @nam`',
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

    // 1. Trích xuất [cho: ...] hoặc cho: ... hoặc [cho ...] hoặc cho ...
    const forMatch = remaining.match(/(?:\[(?:cho|to|target):?\s*([^\]]+)\]|(?:cho|to|target):?\s*([^\s\[\]]+))/i);
    if (forMatch) {
      const rawTarget = (forMatch[1] || forMatch[2]).trim().toLowerCase();
      if (rawTarget === 'all' || rawTarget === 'tatca' || rawTarget === 'toanbo' || rawTarget === 'toàn bộ') {
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

    // 2. Trích xuất tại: / ở: / link: / location: (dấu hai chấm là tùy chọn)
    const locMatch = remaining.match(/(?:(?:tại|ở|link|location):?\s*([^\[\]]+?)(?=\s*(?:lúc|time|vào lúc|ngày|hạn|cho|\[|$)))/i);
    if (locMatch) {
      location = locMatch[1].trim();
      remaining = remaining.replace(locMatch[0], '').trim();
    }

    // 3. Trích xuất lúc: / time: / vào lúc: / hạn: / ngày: (dấu hai chấm là tùy chọn)
    const timeMatch = remaining.match(/(?:(?:lúc|time|vào lúc|ngày|hạn):?\s*([^\[\]]+?)(?=\s*(?:tại|ở|link|cho|location|\[|$)))/i);
    if (timeMatch) {
      meetingTimeStr = timeMatch[1].trim();
      remaining = remaining.replace(timeMatch[0], '').trim();
    }

    // 4. Nếu chưa tìm thấy, quét tìm thời gian tự do trong câu (14h30, 21:00, mai 9h, 2026-08-20...)
    if (!meetingTimeStr) {
      const inlineTimeRegex = /(\b\d{4}-\d{2}-\d{2}(?:\s+\d{1,2}(?:h|:)\d{0,2})?|\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{4})?(?:\s+\d{1,2}(?:h|:)\d{0,2})?|\b(?:mai|ngày\s+mai|hôm\s+nay)\s+\d{1,2}(?:h|:)\d{0,2}|\b\d{1,2}h\d{0,2}\b|\b\d{1,2}:\d{2}\b)/i;
      const inlineMatch = remaining.match(inlineTimeRegex);
      if (inlineMatch) {
        meetingTimeStr = inlineMatch[1].trim();
        remaining = remaining.replace(inlineMatch[0], '').trim();
      }
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

    try {
      const meeting = MeetingService.create({
        title,
        meetingTime: standardizedTime,
        location,
        targetType,
        targetValue,
        groupChatId: chatId,
        createdBy: senderId,
      });

      let tagString = '';
      if (targetType === 'DEPARTMENT' && targetValue) {
        const members = UserService.getByDepartment(targetValue);
        const tags = members.map(m => m.username ? `@${m.username.replace(/_/g, '\\_')}` : m.full_name).filter(Boolean);
        if (tags.length > 0) tagString = `\n📢 **Mời các bạn tham gia:** ${tags.join(' ')}\n`;
      } else if (targetType === 'USERS' && targetValue) {
        tagString = `\n📢 **Mời:** ${targetValue.replace(/_/g, '\\_')}\n`;
      }

      const msg = formatMeetingMessage(meeting) + tagString;

      await ctx.reply(msg, {
        parse_mode: 'Markdown',
        reply_markup: getMeetingKeyboard(meeting.id),
      });
    } catch (err: any) {
      console.error('Lỗi khi tạo cuộc họp:', err);
      await ctx.reply(`❌ Lỗi khi lên lịch cuộc họp: ${err?.message || 'Vui lòng thử lại sau.'}`);
    }
  }

  /**
   * /meetings [ngày / today / hom_nay / YYYY-MM-DD]: Tra cứu danh sách cuộc họp theo ngày
   */
  public static async handleGetMeetings(ctx: Context) {
    const rawMsg = ctx.message || ctx.channelPost;
    const rawArg = (rawMsg?.text || '').replace(/^\/meetings(@\w+)?\s*/i, '').trim();

    if (rawArg) {
      let targetDate = rawArg;
      const todayStr = new Date().toISOString().slice(0, 10);

      if (/^(today|hom_nay|hôm nay)$/i.test(rawArg)) {
        targetDate = todayStr;
      } else if (/^(yesterday|hom_qua|hôm qua)$/i.test(rawArg)) {
        const yDate = new Date();
        yDate.setDate(yDate.getDate() - 1);
        targetDate = yDate.toISOString().slice(0, 10);
      } else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(rawArg)) {
        // DD/MM/YYYY -> YYYY-MM-DD
        const parts = rawArg.split(/[\/\-]/);
        targetDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }

      const meetings = MeetingService.getByDate(targetDate);
      await MeetingHandlers.renderMeetingsByDateList(ctx, targetDate, meetings);
      return;
    }

    // Nếu không truyền tham số, hiển thị các cuộc họp sắp tới + bảng chọn ngày
    const upcoming = MeetingService.getUpcoming(10);

    let msg = `📅 **DANH SÁCH CUỘC HỌP SẮP DIỄN RA (${upcoming.length})**\n\n`;

    if (upcoming.length === 0) {
      msg += `✨ Hiện không có cuộc họp nào sắp tới.\n`;
    } else {
      for (const m of upcoming) {
        const hasNotes = m.minutes ? '📝 (Đã có biên bản)' : '⏳ (Chưa có biên bản)';
        msg += `• **#${m.id}:** **${m.title}**\n`;
        msg += `  ⏰ Lúc: \`${m.meeting_time}\` | ${hasNotes}\n`;
        if (m.location) msg += `  📍 Tại: ${m.location}\n`;
        msg += `\n`;
      }
    }

    msg += `👉 **Tra cứu nội dung theo ngày:** Chạm vào các nút bên dưới hoặc gõ \`/meetings YYYY-MM-DD\``;

    await ctx.reply(msg, {
      parse_mode: 'Markdown',
      reply_markup: getDateFilterKeyboard(),
    });
  }

  /**
   * /meeting_notes <id> [nội dung biên bản mới]: Xem hoặc nhập biên bản cuộc họp
   */
  public static async handleMeetingNotes(ctx: Context) {
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

    const text = (rawMsg?.text || '').replace(/^\/(meeting_notes|minutes|bien_ban)(@\w+)?\s*/i, '').trim();
    const parts = text.split(/\s+/);
    const meetingId = Number(parts[0]);

    if (!text || isNaN(meetingId)) {
      await ctx.reply(
        '👉 **Cú pháp xem/nhập biên bản cuộc họp:**\n\n' +
        '1. **Xem biên bản:** `/minutes <id_cuộc_họp>` (Ví dụ: `/minutes 1`)\n' +
        '2. **Nhập nhanh biên bản:** `/minutes <id_cuộc_họp> <Toàn văn nội dung kết luận...>`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const meeting = MeetingService.getById(meetingId);
    if (!meeting) {
      await ctx.reply(`❌ Không tìm thấy cuộc họp với ID #${meetingId}.`);
      return;
    }

    // Nếu có nội dung phía sau -> Cập nhật biên bản luôn
    if (parts.length > 1) {
      const minutesContent = parts.slice(1).join(' ');
      const updated = MeetingService.updateMinutes(meetingId, minutesContent, senderId);
      if (updated) {
        await ctx.reply(`✅ **Đã cập nhật nội dung biên bản cuộc họp #${meetingId} thành công!**\n\n` + formatMeetingNotesMessage(updated), {
          parse_mode: 'Markdown',
          reply_markup: getMeetingKeyboard(meetingId),
        });
      }
      return;
    }

    // Nếu chỉ có ID -> Hiển thị biên bản
    if (!meeting.minutes) {
      await ctx.reply(
        `ℹ️ Cuộc họp **#${meetingId}: "${meeting.title}"** (Ngày \`${meeting.meeting_time}\`) hiện chưa có biên bản ghi chép.\n\n` +
        `👉 Thư ký vui lòng gõ: \`/minutes ${meetingId} <Nội dung biên bản>\` để bổ sung.`,
        {
          parse_mode: 'Markdown',
          reply_markup: getMeetingKeyboard(meetingId),
        }
      );
      return;
    }

    await ctx.reply(formatMeetingNotesMessage(meeting), {
      parse_mode: 'Markdown',
      reply_markup: getMeetingKeyboard(meetingId),
    });
  }

  /**
   * /del_meeting <id>
   */
  public static async handleDelMeeting(ctx: Context) {
    const isChannel = ctx.chat?.type === 'channel';
    const rawMsg = ctx.message || ctx.channelPost;
    let senderId = ctx.from?.id;

    if (isChannel && !senderId) {
      senderId = CONFIG.ADMIN_IDS[0] || (ctx.chat?.id ? Math.abs(ctx.chat.id) : 111111);
    }

    if (!senderId || (!isChannel && !UserService.isAdmin(senderId))) {
      await ctx.reply('⚠️ Chỉ Quản trị viên mới có quyền hủy cuộc họp.');
      return;
    }

    const text = (rawMsg?.text || '').replace(/^\/(del_meeting|cancel_meeting)(@\w+)?\s*/i, '').trim();
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
   * Xử lý Callback nút bấm cuộc họp & biên bản
   */
  public static async handleCallback(ctx: Context) {
    const data = ctx.callbackQuery?.data;
    const userId = ctx.from?.id;
    if (!data || !userId) return;

    if (!data.startsWith('meeting:')) return;

    UserService.upsertUser(userId, ctx.from.username, ctx.from.first_name);

    const parts = data.split(':');
    const action = parts[1];
    const meetingId = Number(parts[2]);

    // 1. Điểm danh Có mặt
    if (action === 'confirm') {
      const meeting = MeetingService.getById(meetingId);
      if (!meeting) {
        await ctx.answerCallbackQuery({ text: 'Cuộc họp này không tồn tại hoặc đã bị hủy.' });
        return;
      }

      MeetingService.setParticipantStatus(meetingId, userId, 'CONFIRMED');
      await ctx.answerCallbackQuery({ text: '✅ Bạn đã xác nhận SẼ THAM GIA cuộc họp!' });

      const updatedMeeting = MeetingService.getById(meetingId) || meeting;
      try {
        await ctx.editMessageText(formatMeetingMessage(updatedMeeting), {
          parse_mode: 'Markdown',
          reply_markup: getMeetingKeyboard(meetingId),
        });
      } catch (_) {}
    }

    // 2. Điểm danh Báo vắng
    else if (action === 'decline') {
      const meeting = MeetingService.getById(meetingId);
      if (!meeting) {
        await ctx.answerCallbackQuery({ text: 'Cuộc họp này không tồn tại hoặc đã bị hủy.' });
        return;
      }

      MeetingService.setParticipantStatus(meetingId, userId, 'DECLINED');
      await ctx.answerCallbackQuery({ text: '❌ Bạn đã báo VẮNG MẶT cuộc họp này.' });

      const updatedMeeting = MeetingService.getById(meetingId) || meeting;
      try {
        await ctx.editMessageText(formatMeetingMessage(updatedMeeting), {
          parse_mode: 'Markdown',
          reply_markup: getMeetingKeyboard(meetingId),
        });
      } catch (_) {}
    }

    // 3. Xem danh sách người tham gia
    else if (action === 'list') {
      const p = MeetingService.getParticipants(meetingId);
      let listMsg = `📋 **DANH SÁCH THAM GIA CUỘC HỌP #${meetingId}**\n\n`;
      listMsg += `✅ **Có mặt (${p.confirmed.length}):**\n`;
      listMsg += p.confirmed.length > 0 ? p.confirmed.map(u => `• ${u.full_name} (@${(u.username || 'n/a').replace(/_/g, '\\_')})`).join('\n') : '• Chưa có ai xác nhận\n';

      listMsg += `\n❌ **Báo vắng (${p.declined.length}):**\n`;
      listMsg += p.declined.length > 0 ? p.declined.map(u => `• ${u.full_name} (@${(u.username || 'n/a').replace(/_/g, '\\_')})`).join('\n') : '• Không có ai báo vắng\n';

      await ctx.answerCallbackQuery();
      await ctx.reply(listMsg, { parse_mode: 'Markdown' });
    }

    // 4. Bấm [ 📑 Xem Nội Dung ]
    else if (action === 'view_notes') {
      const meeting = MeetingService.getById(meetingId);
      if (!meeting) {
        await ctx.answerCallbackQuery({ text: 'Cuộc họp không tồn tại.' });
        return;
      }

      await ctx.answerCallbackQuery();

      if (!meeting.minutes) {
        await ctx.reply(
          `ℹ️ Cuộc họp **#${meetingId}: "${meeting.title}"** (Ngày \`${meeting.meeting_time}\`) chưa có nội dung ghi chép.\n\n` +
          `👉 Thư ký vui lòng bấm nút **[✍️ Nhập Nội Dung]** bên dưới để nộp biên bản.`,
          {
            parse_mode: 'Markdown',
            reply_markup: getMeetingKeyboard(meetingId),
          }
        );
      } else {
        await ctx.reply(formatMeetingNotesMessage(meeting), {
          parse_mode: 'Markdown',
          reply_markup: getMeetingKeyboard(meetingId),
        });
      }
    }

    // 5. Bấm [ ✍️ Nhập Nội Dung ]
    else if (action === 'input_notes') {
      const meeting = MeetingService.getById(meetingId);
      if (!meeting) {
        await ctx.answerCallbackQuery({ text: 'Cuộc họp không tồn tại.' });
        return;
      }

      // Lưu trạng thái chờ theo cả userId và chatId để nhận diện được trong cả Group và Kênh
      MeetingHandlers.userPendingMeetingNotes.set(String(userId), meetingId);
      if (ctx.chat?.id) {
        MeetingHandlers.userPendingMeetingNotes.set(String(ctx.chat.id), meetingId);
      }

      await ctx.answerCallbackQuery();

      await ctx.reply(
        `✍️ **NHẬP NỘI DUNG / BIÊN BẢN CHO CUỘC HỌP #${meetingId}**\n\n` +
        `📌 **Chủ đề:** **${meeting.title}**\n` +
        `📅 **Ngày & Giờ họp:** \`${meeting.meeting_time}\`\n\n` +
        `👉 Vui lòng gửi một tin nhắn văn bản chứa toàn bộ **Nội dung / Kết luận cuộc họp** để lưu trữ:\n` +
        `_(Ví dụ: Các mục đã thảo luận, phân công công việc, quyết định của Ban Giám Đốc... hoặc gõ /minutes ${meetingId} <nội dung>)_`,
        { parse_mode: 'Markdown' }
      );
    }

    // 6. Bộ lọc ngày: Hôm nay, Hôm qua, 7 ngày, Tất cả
    else if (action === 'filter_date') {
      const filterType = parts[2];
      await ctx.answerCallbackQuery();

      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);

      if (filterType === 'today') {
        const meetings = MeetingService.getByDate(todayStr);
        await MeetingHandlers.renderMeetingsByDateList(ctx, todayStr, meetings, true);
      } else if (filterType === 'yesterday') {
        const yDate = new Date();
        yDate.setDate(yDate.getDate() - 1);
        const yStr = yDate.toISOString().slice(0, 10);
        const meetings = MeetingService.getByDate(yStr);
        await MeetingHandlers.renderMeetingsByDateList(ctx, yStr, meetings, true);
      } else if (filterType === 'last_7_days') {
        const start = new Date();
        start.setDate(start.getDate() - 7);
        const startStr = start.toISOString().slice(0, 10);
        const meetings = MeetingService.getByDateRange(startStr, todayStr);
        await MeetingHandlers.renderMeetingsByDateList(ctx, `7 Ngày Gần Nhất (${startStr} ~ ${todayStr})`, meetings, true);
      } else if (filterType === 'all') {
        const meetings = MeetingService.getAll(30);
        await MeetingHandlers.renderMeetingsByDateList(ctx, 'Tất Cả Các Ngày', meetings, true);
      }
    }

    // 7. Nhập ngày tùy ý
    else if (action === 'filter_custom_prompt') {
      MeetingHandlers.userPendingDateFilter.add(String(userId));
      if (ctx.chat?.id) {
        MeetingHandlers.userPendingDateFilter.add(String(ctx.chat.id));
      }
      await ctx.answerCallbackQuery();
      await ctx.reply(
        `🔍 <b>TRA CỨU CUỘC HỌP THEO NGÀY TÙY Ý:</b>\n\n` +
        `👉 Vui lòng gửi tin nhắn chứa ngày bạn muốn xem theo định dạng: <code>YYYY-MM-DD</code> hoặc <code>DD/MM/YYYY</code>\n` +
        `💡 <i>Ví dụ:</i> <code>2026-08-16</code> hoặc <code>16/08/2026</code>`,
        { parse_mode: 'HTML' }
      );
    }

    // 8. Xác nhận Hủy cuộc họp
    else if (action === 'del_confirm') {
      const isAdmin = UserService.isAdmin(userId);
      if (!isAdmin) {
        await ctx.answerCallbackQuery({ text: '⚠️ Chỉ Quản trị viên mới có quyền hủy cuộc họp.', show_alert: true });
        return;
      }

      const confirmKb = new InlineKeyboard()
        .text('⚠️ Xác Nhận Hủy Cuộc Họp', `meeting:delete_confirmed:${meetingId}`)
        .text('Quay Lại', `meeting:confirm:${meetingId}`);

      await ctx.answerCallbackQuery();
      await ctx.editMessageReplyMarkup({ reply_markup: confirmKb });
    }

    // 9. Đã xác nhận Hủy cuộc họp
    else if (action === 'delete_confirmed') {
      const isAdmin = UserService.isAdmin(userId);
      if (!isAdmin) {
        await ctx.answerCallbackQuery({ text: '⚠️ Bạn không có quyền hủy.', show_alert: true });
        return;
      }

      const meeting = MeetingService.getById(meetingId);
      MeetingService.delete(meetingId);
      await ctx.answerCallbackQuery({ text: 'Đã hủy cuộc họp thành công!' });
      await ctx.editMessageText(`🗑️ <b>Cuộc họp #${meetingId} ("${meeting?.title || ''}") đã được hủy bởi Admin.</b>`, {
        parse_mode: 'HTML',
      });
    }
  }

  /**
   * Bắt tin nhắn văn bản khi người dùng đang nhập biên bản họp hoặc nhập ngày lọc
   */
  public static async handleTextMessage(ctx: Context): Promise<boolean> {
    const rawMsg = ctx.message || ctx.channelPost;
    const text = rawMsg?.text?.trim();
    if (!text) return false;

    // Bỏ qua nếu là câu lệnh bắt đầu bằng /
    if (text.startsWith('/')) return false;

    const userIdStr = ctx.from?.id ? String(ctx.from.id) : undefined;
    const chatIdStr = ctx.chat?.id ? String(ctx.chat.id) : undefined;

    // 1. Nếu đang chờ thư ký gửi nội dung biên bản cuộc họp
    let meetingId: number | undefined;
    if (userIdStr && MeetingHandlers.userPendingMeetingNotes.has(userIdStr)) {
      meetingId = MeetingHandlers.userPendingMeetingNotes.get(userIdStr);
      MeetingHandlers.userPendingMeetingNotes.delete(userIdStr);
      if (chatIdStr) MeetingHandlers.userPendingMeetingNotes.delete(chatIdStr);
    } else if (chatIdStr && MeetingHandlers.userPendingMeetingNotes.has(chatIdStr)) {
      meetingId = MeetingHandlers.userPendingMeetingNotes.get(chatIdStr);
      MeetingHandlers.userPendingMeetingNotes.delete(chatIdStr);
    }

    if (meetingId) {
      const authorId = ctx.from?.id || (CONFIG.ADMIN_IDS[0] || 111111);
      const updated = MeetingService.updateMinutes(meetingId, text, authorId);
      if (updated) {
        const userName = ctx.from?.username 
          ? `@${ctx.from.username.replace(/_/g, '\\_')}` 
          : (ctx.from?.first_name || ctx.chat?.title || 'Thư ký / Ban Giám Đốc');

        let confirmMsg = `✅ **ĐÃ LƯU BIÊN BẢN CUỘC HỌP #${meetingId} THÀNH CÔNG!**\n\n`;
        confirmMsg += `📌 **Chủ đề:** **${updated.title}**\n`;
        confirmMsg += `📅 **Ngày họp:** \`${updated.meeting_time}\`\n`;
        confirmMsg += `✍️ **Người ghi chép:** ${userName}\n`;
        confirmMsg += `🕒 **Thời gian lưu:** \`${new Date().toLocaleString('vi-VN', { timeZone: CONFIG.TIMEZONE })}\`\n\n`;
        confirmMsg += `━━━━━━━━━━━━━━━━━━━━━\n`;
        confirmMsg += `📝 **Nội dung tóm tắt:**\n${text}\n`;
        confirmMsg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        confirmMsg += `👉 _Mọi người có thể bấm [📑 Xem Nội Dung] trên thông báo cuộc họp để xem lại bất cứ lúc nào!_`;

        await ctx.reply(confirmMsg, {
          parse_mode: 'Markdown',
          reply_markup: getMeetingKeyboard(meetingId),
        });
      } else {
        await ctx.reply(`❌ Lưu nội dung cuộc họp #${meetingId} thất bại.`);
      }
      return true;
    }

    // 2. Nếu đang chờ nhập ngày tra cứu
    let hasDateFilter = false;
    if (userIdStr && MeetingHandlers.userPendingDateFilter.has(userIdStr)) {
      hasDateFilter = true;
      MeetingHandlers.userPendingDateFilter.delete(userIdStr);
      if (chatIdStr) MeetingHandlers.userPendingDateFilter.delete(chatIdStr);
    } else if (chatIdStr && MeetingHandlers.userPendingDateFilter.has(chatIdStr)) {
      hasDateFilter = true;
      MeetingHandlers.userPendingDateFilter.delete(chatIdStr);
    }

    if (hasDateFilter) {
      let targetDate = text;
      if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(text)) {
        const parts = text.split(/[\/\-]/);
        targetDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }

      const meetings = MeetingService.getByDate(targetDate);
      await MeetingHandlers.renderMeetingsByDateList(ctx, targetDate, meetings);
      return true;
    }

    return false;
  }

  private static async renderMeetingsByDateList(
    ctx: Context,
    dateTitle: string,
    meetings: Meeting[],
    isEdit: boolean = false
  ) {
    let msg = `📅 **DANH SÁCH CUỘC HỌP - NGÀY: ${dateTitle} (${meetings.length})**\n\n`;

    if (meetings.length === 0) {
      msg += `✨ Không có cuộc họp nào được ghi nhận trong thời gian này.\n\n`;
    } else {
      for (const m of meetings) {
        const hasNotes = m.minutes ? '✅ Đã có biên bản' : '⏳ Chưa có biên bản';
        msg += `📌 **#${m.id}: ${m.title}**\n`;
        msg += `   ⏰ Giờ họp: \`${m.meeting_time}\`\n`;
        if (m.location) msg += `   📍 Tại: ${m.location}\n`;
        msg += `   📝 Tình trạng: _${hasNotes}_\n`;

        if (m.minutes) {
          const preview = m.minutes.length > 80 ? m.minutes.substring(0, 80) + '...' : m.minutes;
          msg += `   💬 _"${preview}"_\n`;
          msg += `   👉 Xem toàn văn: \`/minutes ${m.id}\`\n`;
        }
        msg += `\n`;
      }
    }

    msg += `👉 Chọn mốc thời gian khác bên dưới:`;

    if (isEdit && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(msg, {
          parse_mode: 'Markdown',
          reply_markup: getDateFilterKeyboard(),
        });
        return;
      } catch (_) {}
    }

    await ctx.reply(msg, {
      parse_mode: 'Markdown',
      reply_markup: getDateFilterKeyboard(),
    });
  }
}
