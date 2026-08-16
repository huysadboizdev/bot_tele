import { InlineKeyboard } from 'grammy';
import { Meeting, MeetingService } from './service';

export function getMeetingKeyboard(meetingId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Tham gia', `meeting:confirm:${meetingId}`)
    .text('❌ Báo vắng', `meeting:decline:${meetingId}`)
    .row()
    .text('📑 Xem Nội Dung', `meeting:view_notes:${meetingId}`)
    .text('✍️ Nhập Nội Dung', `meeting:input_notes:${meetingId}`)
    .row()
    .text('👥 Xem người tham gia', `meeting:list:${meetingId}`);
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
  const prefix = customPrefix || '📢 **THÔNG BÁO CUỘC HỌP MỚI**';
  const participants = MeetingService.getParticipants(meeting.id);

  let targetDisplay = 'Toàn thể công ty';
  if (meeting.target_type === 'DEPARTMENT' && meeting.target_value) {
    targetDisplay = `Phòng ${meeting.target_value.toUpperCase()}`;
  } else if (meeting.target_type === 'USERS' && meeting.target_value) {
    targetDisplay = meeting.target_value.replace(/_/g, '\\_');
  }

  let msg = `${prefix}\n\n`;
  msg += `📌 **Chủ đề:** **${meeting.title}**\n`;
  msg += `⏰ **Thời gian:** \`${meeting.meeting_time}\`\n`;
  if (meeting.location) {
    msg += `📍 **Địa điểm / Link:** ${meeting.location}\n`;
  }
  msg += `👥 **Đối tượng:** ${targetDisplay}\n`;
  msg += `👤 **Người chủ trì:** ${meeting.creator_name || 'Ban Giám Đốc'}\n`;

  if (meeting.minutes) {
    msg += `📝 **Biên bản:** _Đã có ghi chép_ (bấm [📑 Xem Nội Dung] để đọc)\n`;
  } else {
    msg += `📝 **Biên bản:** _Chưa có (Thư ký bấm [✍️ Nhập Nội Dung] để ghi)_\n`;
  }

  msg += `\n📊 **Điểm danh (${participants.confirmed.length} tham gia | ${participants.declined.length} vắng):**\n`;
  if (participants.confirmed.length > 0) {
    msg += `• Có mặt: ${participants.confirmed.map(p => p.username ? `@${p.username.replace(/_/g, '\\_')}` : p.full_name).join(', ')}\n`;
  }
  if (participants.declined.length > 0) {
    msg += `• Báo vắng: ${participants.declined.map(p => p.username ? `@${p.username.replace(/_/g, '\\_')}` : p.full_name).join(', ')}\n`;
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
