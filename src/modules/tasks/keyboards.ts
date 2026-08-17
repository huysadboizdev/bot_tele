import { InlineKeyboard } from 'grammy';
import { Task } from './service';

export function getTaskKeyboard(task: Task): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (task.status === 'PENDING') {
    keyboard
      .text('🚀 Nhận việc', `task:accept:${task.id}`)
      .text('❌ Hủy', `task:cancel:${task.id}`)
      .row()
      .text('✏️ Sửa', `task:edit:${task.id}`)
      .text('🗑️ Xóa', `task:del_confirm:${task.id}`);
  } else if (task.status === 'IN_PROGRESS') {
    keyboard
      .text('📝 Báo tiến độ', `task:progress:${task.id}`)
      .text('✅ Hoàn thành', `task:complete:${task.id}`)
      .row()
      .text('✏️ Sửa', `task:edit:${task.id}`)
      .text('🗑️ Xóa', `task:del_confirm:${task.id}`);
  } else {
    keyboard
      .text('📋 Chi tiết', `task:detail:${task.id}`)
      .text('🗑️ Xóa', `task:del_confirm:${task.id}`);
  }

  return keyboard;
}

export function getOverdueCheckKeyboard(taskId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Đã Xong', `task:overdue_done:${taskId}`)
    .text('⏳ Chưa Xong', `task:overdue_pending:${taskId}`);
}

export function getExtensionOptionsKeyboard(taskId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('⏱️ +2 Tiếng', `task:ext_opt:${taskId}:2h`)
    .text('⏱️ +4 Tiếng', `task:ext_opt:${taskId}:4h`)
    .row()
    .text('📅 +1 Ngày', `task:ext_opt:${taskId}:1d`)
    .text('📅 +2 Ngày', `task:ext_opt:${taskId}:2d`)
    .row()
    .text('✍️ Tự nhập hạn & lý do', `task:ext_custom:${taskId}`);
}

function escapeHtml(str?: string | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatOverduePromptMessage(task: Task): string {
  let targetDisplay = '';
  const titlePart = task.assignee_title ? ` - ${escapeHtml(task.assignee_title)}` : '';

  if (task.assignee_username) {
    targetDisplay = `@${task.assignee_username} (${escapeHtml(task.assignee_name)}${titlePart})`;
  } else if (task.assignee_name) {
    targetDisplay = `${escapeHtml(task.assignee_name)}${titlePart}`;
  } else if (task.department_name) {
    targetDisplay = `👥 Toàn bộ [Phòng ${escapeHtml(task.department_name)}]`;
  } else {
    targetDisplay = 'Chưa chỉ định';
  }

  let msg = `⏰ <b>THÔNG BÁO HẾT HẠN CÔNG VIỆC #${task.id}</b> ⏰\n\n`;
  msg += `📌 <b>Tiêu đề:</b> <b>${escapeHtml(task.title)}</b>\n`;
  if (task.description) {
    msg += `📝 <b>Nội dung:</b> <i>${escapeHtml(task.description)}</i>\n`;
  }
  msg += `🎯 <b>Người phụ trách:</b> ${targetDisplay}\n`;
  msg += `⏳ <b>Hạn chót:</b> <code>${escapeHtml(task.deadline)}</code>\n`;

  if (task.extension_count > 0) {
    msg += `🔄 <b>Đã xin gia hạn:</b> ${task.extension_count} lần\n`;
  }

  msg += `\n👉 <b>Vui lòng xác nhận kết quả thực hiện:</b>`;
  return msg;
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
  const titlePart = task.assignee_title ? ` - ${escapeHtml(task.assignee_title)}` : '';

  if (task.assignee_username) {
    targetDisplay = `@${task.assignee_username} (${escapeHtml(task.assignee_name)}${titlePart})`;
  } else if (task.assignee_name) {
    targetDisplay = `${escapeHtml(task.assignee_name)}${titlePart}`;
  } else if (task.department_name) {
    targetDisplay = `👥 Toàn bộ [Phòng ${escapeHtml(task.department_name)}]`;
  } else {
    targetDisplay = 'Chưa chỉ định';
  }

  const assignerDisplay = task.assigner_username 
    ? `@${task.assigner_username} (${escapeHtml(task.assigner_name)})`
    : escapeHtml(task.assigner_name) || 'Quản trị viên';

  let msg = `📌 <b>CÔNG VIỆC #${task.id}: ${escapeHtml(task.title)}</b>\n\n`;
  if (task.description) {
    msg += `📝 <b>Nội dung:</b> <i>${escapeHtml(task.description)}</i>\n`;
  }
  msg += `👤 <b>Người giao:</b> ${assignerDisplay}\n`;
  msg += `🎯 <b>Người nhận:</b> ${targetDisplay}\n`;
  msg += `📊 <b>Trạng thái:</b> ${statusEmoji}\n`;
  msg += `⚡ <b>Mức độ:</b> ${priorityEmoji}\n`;

  if (task.deadline) {
    msg += `⏰ <b>Hạn chót:</b> <code>${escapeHtml(task.deadline)}</code>\n`;
  }

  if (task.extension_count > 0) {
    msg += `🔄 <b>Gia hạn:</b> ${task.extension_count} lần (Lý do: <i>${escapeHtml(task.extension_reason || 'n/a')}</i>)\n`;
  }

  if (task.completed_at) {
    msg += `🎉 <b>Hoàn thành lúc:</b> <code>${escapeHtml(task.completed_at)}</code>\n`;
  }

  if (extraNote) {
    msg += `\n💬 <b>Ghi chú:</b> <i>${escapeHtml(extraNote)}</i>\n`;
  }

  return msg;
}
