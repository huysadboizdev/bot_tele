import { InlineKeyboard } from 'grammy';
import { FinancialTransaction, TransactionSplit, AccountingService } from './service';

export function getTransactionKeyboard(txId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('💸 Tôi đã chuyển khoản / đóng tiền', `acc:pay:${txId}`)
    .row()
    .text('✅ Người thanh toán duyệt nhận', `acc:confirm_menu:${txId}`)
    .row()
    .text('📊 Chi tiết công nợ', `acc:detail:${txId}`);
}

export function formatTransactionMessage(tx: FinancialTransaction, splits?: TransactionSplit[]): string {
  const methodText = tx.payment_method === 'BANK' ? 'Chuyển khoản (Bank)' : 'Tiền mặt (Cash)';
  const formattedTotal = AccountingService.formatMoney(tx.amount);
  const formattedPerPerson = AccountingService.formatMoney(tx.amount_per_person);

  let msg = `💰 **KHOẢN CHI TIÊU & CHIA TIỀN #${tx.id}** 💰\n\n`;
  msg += `📌 **Tài nguyên / Món chi:** **${tx.title}**\n`;
  msg += `⏰ **Thời gian:** \`${tx.created_at}\`\n`;
  msg += `💵 **Tổng giá tiền:** **${formattedTotal}**\n`;
  msg += `👤 **Người thanh toán:** ${tx.payer_name || 'Quản trị viên'}\n`;
  msg += `💳 **Hình thức:** ${methodText}\n\n`;

  if (splits && splits.length > 0) {
    const paidCount = splits.filter(s => s.is_paid === 1).length;
    msg += `👥 **KẾT QUẢ CHIA ĐỀU (${splits.length} người - Mỗi người: ${formattedPerPerson}):**\n`;
    msg += `📊 _Tiến độ thu: ${paidCount}/${splits.length} người đã đóng_\n`;

    for (const s of splits) {
      const statusIcon = s.is_paid === 1 ? '🟢' : '🔴';
      const statusText = s.is_paid === 1 ? '✅ Đã đóng' : '⏳ Chưa đóng';
      const userTag = `@${s.username}`;
      msg += `  • ${statusIcon} ${userTag} (${s.full_name || 'Thành viên'}) - ${statusText} (\`${AccountingService.formatMoney(s.amount_owed)}\`)\n`;
    }
  }

  return msg;
}

export function formatIncomeMessage(tx: FinancialTransaction): string {
  const methodText = tx.payment_method === 'BANK' ? 'Chuyển khoản (Bank)' : 'Tiền mặt (Cash)';
  const formattedTotal = AccountingService.formatMoney(tx.amount);

  let msg = `💵 **GHI NHẬN KHOẢN THU TIỀN #${tx.id}** 💵\n\n`;
  msg += `📌 **Nguồn thu / Lý do:** **${tx.title}**\n`;
  msg += `⏰ **Thời gian:** \`${tx.created_at}\`\n`;
  msg += `💰 **Số tiền thu:** 🟢 **+${formattedTotal}**\n`;
  msg += `👤 **Người nộp / Đối tác:** ${tx.payer_name || 'Khách hàng / Đối tác'}\n`;
  msg += `💳 **Hình thức:** ${methodText}\n`;
  return msg;
}
