import { InlineKeyboard } from 'grammy';
import { Meeting, MeetingService } from './service';

function escapeHtml(str?: string | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function getMeetingKeyboard(meetingId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Tham gia', `meeting:confirm:${meetingId}`)
    .text('❌ Báo vắng', `meeting:decline:${meetingId}`)
    .row()
    .text('📑 Xem Biên Bản', `meeting:view_notes:${meetingId}`)
    .text('✍️ Nhập Biên Bản', `meeting:input_notes:${meetingId}`)
    .row()
    .text('👥 Điểm danh', `meeting:list:${meetingId}`)
    .text('🗑️ Hủy Cuộc Họp', `meeting:del_confirm:${meetingId}`);
}

export function getDateFilterKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📅 Hôm nay', 'meeting:filter_date:today')
    .text('📅 Hôm qua', 'meeting:filter_date:yesterday')
    .row()
    .text('📅 7 Ngày gần nhất', 'meeting:filter_date:last_7_days')
    .text('📅 Tất cả các ngày', 'meeting:filter_date:all')
    .row()
    .text('🔍 Nhập ngày cụ thể (YYYY-MM-DD)', 'meeting:filter_custom_prompt');
}

export function formatMeetingMessage(meeting: Meeting, customPrefix?: string): string {
  const prefix = customPrefix || '📢 <b>THÔNG BÁO CUỘC HỌP MỚI</b>';
  const participants = MeetingService.getParticipants(meeting.id);

  let targetDisplay = 'Toàn thể công ty';
  if (meeting.target_type === 'DEPARTMENT' && meeting.target_value) {
    targetDisplay = `Phòng ${escapeHtml(meeting.target_value.toUpperCase())}`;
  } else if (meeting.target_type === 'USERS' && meeting.target_value) {
    targetDisplay = escapeHtml(meeting.target_value);
  }

  let msg = `${prefix}\n\n`;
  msg += `📌 <b>Chủ đề:</b> <b>${escapeHtml(meeting.title)}</b>\n`;
  msg += `⏰ <b>Thời gian:</b> <code>${escapeHtml(meeting.meeting_time)}</code>\n`;
  if (meeting.location) {
    msg += `📍 <b>Địa điểm / Link:</b> ${escapeHtml(meeting.location)}\n`;
  }
  msg += `👥 <b>Đối tượng:</b> ${targetDisplay}\n`;
  msg += `👤 <b>Người chủ trì:</b> ${escapeHtml(meeting.creator_name) || 'Ban Giám Đốc'}\n`;

  if (meeting.minutes) {
    msg += `📝 <b>Biên bản:</b> <i>Đã có ghi chép</i> (bấm [📑 Xem Biên Bản] để đọc)\n`;
  } else {
    msg += `📝 <b>Biên bản:</b> <i>Chưa có (Thư ký bấm [✍️ Nhập Biên Bản] để ghi)</i>\n`;
  }

  msg += `\n📊 <b>Điểm danh (${participants.confirmed.length} tham gia | ${participants.declined.length} vắng):</b>\n`;
  if (participants.confirmed.length > 0) {
    msg += `• Có mặt: ${participants.confirmed.map(p => p.username ? `@${p.username}` : escapeHtml(p.full_name)).join(', ')}\n`;
  }
  if (participants.declined.length > 0) {
    msg += `• Báo vắng: ${participants.declined.map(p => p.username ? `@${p.username}` : escapeHtml(p.full_name)).join(', ')}\n`;
  }

  return msg;
}

export function formatMeetingNotesMessage(meeting: Meeting): string {
  const recorderDisplay = meeting.recorder_username 
    ? `@${meeting.recorder_username.replace(/_/g, '\\_')} (${meeting.recorder_name})`
    : (meeting.recorder_name || 'Thư ký / Người chủ trì');

  let msg = `📑 **NỘI DUNG & BIÊN BẢN CUỘC HỌP #${meeting.id}** 📑\n\n`;
  msg += `📌 **Chủ đề:** **${meeting.title}**\n`;
  msg += `📅 **Ngày & Giờ họp:** \`${meeting.meeting_time}\`\n`;
  if (meeting.location) {
    msg += `📍 **Địa điểm:** ${meeting.location}\n`;
  }
  msg += `✍️ **Người ghi chép:** ${recorderDisplay}\n`;
  if (meeting.minutes_at) {
    msg += `🕒 **Thời điểm lưu:** \`${meeting.minutes_at}\`\n`;
  }

  msg += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📝 **NỘI DUNG & KẾT LUẬN CHI TIẾT:**\n\n`;
  msg += `${meeting.minutes}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;

  return msg;
}
