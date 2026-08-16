import { InlineKeyboard } from 'grammy';
import { Meeting, MeetingService } from './service';

export function getMeetingKeyboard(meetingId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Tham gia', `meeting:confirm:${meetingId}`)
    .text('❌ Báo vắng', `meeting:decline:${meetingId}`)
    .row()
    .text('📋 Xem người tham gia', `meeting:list:${meetingId}`);
}

export function formatMeetingMessage(meeting: Meeting, customPrefix?: string): string {
  const prefix = customPrefix || '📢 **THÔNG BÁO CUỘC HỌP MỚI**';
  const participants = MeetingService.getParticipants(meeting.id);

  let targetDisplay = 'Toàn thể công ty';
  if (meeting.target_type === 'DEPARTMENT' && meeting.target_value) {
    targetDisplay = `Phòng ${meeting.target_value.toUpperCase()}`;
  } else if (meeting.target_type === 'USERS' && meeting.target_value) {
    targetDisplay = meeting.target_value;
  }

  let msg = `${prefix}\n\n`;
  msg += `📌 **Chủ đề:** **${meeting.title}**\n`;
  msg += `⏰ **Thời gian:** \`${meeting.meeting_time}\`\n`;
  if (meeting.location) {
    msg += `📍 **Địa điểm / Link:** ${meeting.location}\n`;
  }
  msg += `👥 **Đối tượng:** ${targetDisplay}\n`;
  msg += `👤 **Người chủ trì:** ${meeting.creator_name || 'Ban Giám Đốc'}\n\n`;

  msg += `📊 **Điểm danh (${participants.confirmed.length} tham gia | ${participants.declined.length} vắng):**\n`;
  if (participants.confirmed.length > 0) {
    msg += `• Có mặt: ${participants.confirmed.map(p => p.username ? `@${p.username}` : p.full_name).join(', ')}\n`;
  }
  if (participants.declined.length > 0) {
    msg += `• Báo vắng: ${participants.declined.map(p => p.username ? `@${p.username}` : p.full_name).join(', ')}\n`;
  }

  return msg;
}
