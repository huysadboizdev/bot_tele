import { InlineKeyboard } from 'grammy';
import { Task } from './service';

export function getTaskKeyboard(task: Task): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (task.status === 'PENDING') {
    keyboard
      .text('🚀 Nhận việc', `task:accept:${task.id}`)
      .text('❌ Hủy', `task:cancel:${task.id}`);
  } else if (task.status === 'IN_PROGRESS') {
    keyboard
      .text('📝 Báo tiến độ', `task:progress:${task.id}`)
      .text('✅ Hoàn thành', `task:complete:${task.id}`)
      .row()
      .text('❌ Hủy task', `task:cancel:${task.id}`);
  } else {
    keyboard.text('📋 Xem chi tiết', `task:detail:${task.id}`);
  }

  return keyboard;
}

export function formatTaskMessage(task: Task, extraNote?: string): string {
  const statusEmoji = {
    PENDING: '⏳ Đang chờ nhận việc',
    IN_PROGRESS: '⚙️ Đang xử lý',
    COMPLETED: '✅ Đã hoàn thành',
    CANCELLED: '🚫 Đã hủy',
  }[task.status];

  const priorityEmoji = {
    LOW: '🟢 Thấp',
    NORMAL: '🔵 Bình thường',
    HIGH: '🟠 Cao',
    URGENT: '🔴 KHẨN CẤP',
  }[task.priority || 'NORMAL'];

  let targetDisplay = '';
  if (task.assignee_username) {
    targetDisplay = `@${task.assignee_username} (${task.assignee_name})`;
  } else if (task.assignee_name) {
    targetDisplay = `${task.assignee_name}`;
  } else if (task.department_name) {
    targetDisplay = `👥 Toàn bộ [Phòng ${task.department_name}]`;
  } else {
    targetDisplay = 'Chưa chỉ định';
  }

  const assignerDisplay = task.assigner_username 
    ? `@${task.assigner_username} (${task.assigner_name})`
    : task.assigner_name || 'Quản trị viên';

  let msg = `📌 **CÔNG VIỆC #${task.id}: ${task.title}**\n\n`;
  if (task.description) {
    msg += `📝 **Nội dung:** ${task.description}\n`;
  }
  msg += `👤 **Người giao:** ${assignerDisplay}\n`;
  msg += `🎯 **Người nhận:** ${targetDisplay}\n`;
  msg += `📊 **Trạng thái:** ${statusEmoji}\n`;
  msg += `⚡ **Mức độ:** ${priorityEmoji}\n`;

  if (task.deadline) {
    msg += `⏰ **Hạn chót:** \`${task.deadline}\`\n`;
  }

  if (task.completed_at) {
    msg += `🎉 **Hoàn thành lúc:** \`${task.completed_at}\`\n`;
  }

  if (extraNote) {
    msg += `\n💬 **Ghi chú:** ${extraNote}\n`;
  }

  return msg;
}
