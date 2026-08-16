import { Context, InlineKeyboard } from 'grammy';
import { AccountingService } from './service';
import {
  formatTransactionMessage,
  getTransactionKeyboard,
  formatIncomeMessage,
} from './keyboards';
import { UserService } from '../users/service';
import { DepartmentService } from '../departments/service';

export class AccountingHandlers {
  /**
   * /chi <Tên tài nguyên> <Số tiền> [ai_trả: @username] [qua: bank/tien_mat] [cho: @user1 @user2...]
   */
  public static async handleExpense(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId) return;

    UserService.upsertUser(senderId, ctx.from.username, ctx.from.first_name);

    if (!UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Chỉ Quản trị viên (Sếp / Quản lý / Kế toán) mới có quyền ghi nhận khoản chi.');
      return;
    }

    const text = (ctx.message?.text || '').replace(/^\/chi(@\w+)?\s*/i, '').trim();

    if (!text) {
      await ctx.reply(
        '👉 **CÚ PHÁP GHI KHOẢN CHI & TỰ ĐỘNG CHIA ĐỀU TIỀN:**\n\n' +
        '`/chi <Tên tài nguyên> <Số tiền> [ai_trả: @user] [qua: bank/tien_mat] [cho: @user1 @user2...]`\n\n' +
        '**Ví dụ thực tế:**\n' +
        '1. `/chi Mua tài khoản Claude Pro 500k ai_trả: @sep_tong qua: bank cho: @nam @hoa`\n' +
        '2. `/chi Tiền ăn trưa 600k ai_trả: @nam qua: tien_mat cho: marketing`\n' +
        '3. `/chi Mua hosting VPS tháng 8 1.2tr qua: bank`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    let remaining = text;
    let paymentMethod: 'BANK' | 'CASH' = 'BANK';
    let payerName = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    let payerId: number | undefined = senderId;
    let splitType: 'ALL' | 'DEPARTMENT' | 'CUSTOM' | 'NONE' = 'CUSTOM';
    let splitTarget: string | undefined;
    let targetUsernames: string[] = [];

    // 1. Trích xuất [cho: ...] hoặc cho: ...
    const forMatch = remaining.match(/(?:\[cho:\s*([^\]]+)\]|cho:\s*([^\s\[\]]+(?:@[^\s\[\]]+)*))/i);
    if (forMatch) {
      const rawTarget = (forMatch[1] || forMatch[2]).trim();
      if (/^(all|tatca|toanbo|toàn bộ|công ty)$/i.test(rawTarget)) {
        splitType = 'ALL';
      } else {
        const dept = DepartmentService.findByNameOrSlug(rawTarget);
        if (dept) {
          splitType = 'DEPARTMENT';
          splitTarget = dept.id;
        } else {
          splitType = 'CUSTOM';
          targetUsernames = rawTarget.match(/@\w+/g) || [];
          if (targetUsernames.length === 0) {
            targetUsernames = rawTarget.split(/\s+/).map(u => (u.startsWith('@') ? u : `@${u}`));
          }
        }
      }
      remaining = remaining.replace(forMatch[0], '').trim();
    }

    // 2. Trích xuất [ai_trả: ...] hoặc [người_trả: ...]
    const payerMatch = remaining.match(/(?:\[(?:ai_trả|ai_tra|người_trả|nguoi_tra|payer):\s*([^\]]+)\]|(?:ai_trả|ai_tra|người_trả|nguoi_tra|payer):\s*([^\s\[\]]+))/i);
    if (payerMatch) {
      const rawPayer = (payerMatch[1] || payerMatch[2]).trim();
      if (/^(cty|cong_ty|công ty|quỹ)$/i.test(rawPayer)) {
        payerName = 'Quỹ Công Ty';
        payerId = undefined;
      } else {
        payerName = rawPayer.startsWith('@') ? rawPayer : `@${rawPayer}`;
        const u = UserService.getByUsername(rawPayer.replace(/^@/, ''));
        if (u) payerId = u.telegram_id;
      }
      remaining = remaining.replace(payerMatch[0], '').trim();
    }

    // 3. Trích xuất [qua: bank/tien_mat] hoặc [bằng: ...]
    const methodMatch = remaining.match(/(?:\[(?:qua|bằng|bang|method):\s*([^\]]+)\]|(?:qua|bằng|bang|method):\s*([^\s\[\]]+))/i);
    if (methodMatch) {
      const rawMethod = (methodMatch[1] || methodMatch[2]).trim().toLowerCase();
      if (/^(tien_mat|tiền mặt|cash|tienmat)$/i.test(rawMethod)) {
        paymentMethod = 'CASH';
      } else {
        paymentMethod = 'BANK';
      }
      remaining = remaining.replace(methodMatch[0], '').trim();
    }

    // 4. Trích xuất Số tiền (Ví dụ: 500k, 1.5tr, 1tr5, 2000000)
    const amountRegex = /(\b\d+(?:[.,]\d+)?\s*(?:k|tr|m|trieu|triệu|ngan|ngàn|nghin|nghìn)?\b|\b\d+tr\d+k?\b)/i;
    const amountMatch = remaining.match(amountRegex);

    if (!amountMatch) {
      await ctx.reply('⚠️ Vui lòng nhập rõ **Số tiền** cần chi (Ví dụ: `500k`, `1.5tr`, `2000000`).', {
        parse_mode: 'Markdown',
      });
      return;
    }

    const rawAmountStr = amountMatch[1];
    const amount = AccountingService.parseMoney(rawAmountStr);

    if (amount <= 0) {
      await ctx.reply('❌ Số tiền không hợp lệ. Vui lòng thử lại.');
      return;
    }

    // Tiêu đề là phần còn lại sau khi bỏ số tiền
    const title = remaining.replace(amountMatch[0], '').replace(/^[,\-\s]+|[,\-\s]+$/g, '').trim();

    if (!title) {
      await ctx.reply('⚠️ Vui lòng ghi rõ **Tên tài nguyên** hoặc nội dung khoản chi.');
      return;
    }

    const result = AccountingService.createExpense({
      title,
      amount,
      payerId,
      payerName,
      paymentMethod,
      splitType,
      splitTarget,
      targetUsernames,
      groupChatId: ctx.chat?.id ? String(ctx.chat.id) : undefined,
      createdBy: senderId,
    });

    const msg = formatTransactionMessage(result.transaction, result.splits);

    await ctx.reply(msg, {
      parse_mode: 'Markdown',
      reply_markup: getTransactionKeyboard(result.transaction.id),
    });
  }

  /**
   * /thu <Nội dung thu> <Số tiền> [người_nộp: @user] [qua: bank/tien_mat]
   */
  public static async handleIncome(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId) return;

    UserService.upsertUser(senderId, ctx.from.username, ctx.from.first_name);

    if (!UserService.isAdmin(senderId)) {
      await ctx.reply('⚠️ Chỉ Quản trị viên (Sếp / Quản lý / Kế toán) mới có quyền ghi nhận khoản thu.');
      return;
    }

    const text = (ctx.message?.text || '').replace(/^\/thu(@\w+)?\s*/i, '').trim();

    if (!text) {
      await ctx.reply(
        '👉 **CÚ PHÁP GHI KHOẢN THU TIỀN:**\n\n' +
        '`/thu <Nội dung / Nguồn thu> <Số tiền> [người_nộp: @user] [qua: bank/tien_mat]`\n\n' +
        '**Ví dụ:**\n' +
        '1. `/thu Thu tiền dự án Web App 15tr người_nộp: @khach_hang qua: bank`\n' +
        '2. `/thu Nộp tiền quỹ công ty 5tr người_nộp: @sep_tong qua: bank`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    let remaining = text;
    let paymentMethod: 'BANK' | 'CASH' = 'BANK';
    let payerName = 'Khách hàng / Đối tác';
    let payerId: number | undefined;

    // 1. Người nộp
    const payerMatch = remaining.match(/(?:\[(?:người_nộp|nguoi_nop|khách|from):\s*([^\]]+)\]|(?:người_nộp|nguoi_nop|khách|from):\s*([^\s\[\]]+))/i);
    if (payerMatch) {
      payerName = (payerMatch[1] || payerMatch[2]).trim();
      if (!payerName.startsWith('@')) payerName = `@${payerName}`;
      const u = UserService.getByUsername(payerName.replace(/^@/, ''));
      if (u) payerId = u.telegram_id;
      remaining = remaining.replace(payerMatch[0], '').trim();
    }

    // 2. Hình thức
    const methodMatch = remaining.match(/(?:\[(?:qua|bằng|bang|method):\s*([^\]]+)\]|(?:qua|bằng|bang|method):\s*([^\s\[\]]+))/i);
    if (methodMatch) {
      const rawMethod = (methodMatch[1] || methodMatch[2]).trim().toLowerCase();
      paymentMethod = /^(tien_mat|tiền mặt|cash|tienmat)$/i.test(rawMethod) ? 'CASH' : 'BANK';
      remaining = remaining.replace(methodMatch[0], '').trim();
    }

    // 3. Số tiền
    const amountRegex = /(\b\d+(?:[.,]\d+)?\s*(?:k|tr|m|trieu|triệu|ngan|ngàn|nghin|nghìn)?\b|\b\d+tr\d+k?\b)/i;
    const amountMatch = remaining.match(amountRegex);

    if (!amountMatch) {
      await ctx.reply('⚠️ Vui lòng nhập rõ **Số tiền thu** (Ví dụ: `15tr`, `500k`, `2000000`).');
      return;
    }

    const amount = AccountingService.parseMoney(amountMatch[1]);
    const title = remaining.replace(amountMatch[0], '').replace(/^[,\-\s]+|[,\-\s]+$/g, '').trim();

    if (!title) {
      await ctx.reply('⚠️ Vui lòng ghi rõ **Nội dung khoản thu**.');
      return;
    }

    const tx = AccountingService.createIncome({
      title,
      amount,
      payerId,
      payerName,
      paymentMethod,
      groupChatId: ctx.chat?.id ? String(ctx.chat.id) : undefined,
      createdBy: senderId,
    });

    await ctx.reply(formatIncomeMessage(tx), { parse_mode: 'Markdown' });
  }

  /**
   * /cong_no hoặc /debts: Xem bảng theo dõi công nợ tổng hợp
   */
  public static async handleDebts(ctx: Context) {
    const debts = AccountingService.getUnpaidDebts();

    let msg = `📊 **BẢNG THEO DÕI CÔNG NỢ DOANH NGHIỆP (${debts.length} khoản chưa đóng)**\n\n`;

    if (debts.length === 0) {
      msg += `✨ Tuyệt vời! Hiện không có công nợ nào chưa thanh toán.`;
    } else {
      let totalUnpaid = 0;
      for (const d of debts) {
        totalUnpaid += d.amount_owed;
        const formattedAmount = AccountingService.formatMoney(d.amount_owed);
        msg += `• 🔴 **@${d.username}** (${d.full_name || 'Thành viên'}): Nợ \`${formattedAmount}\`\n`;
        msg += `  📌 Khoản: _${d.transaction_title}_ (Ứng bởi: ${d.payer_name || 'Sếp'})\n`;
        msg += `  ⏰ Ngày chi: \`${d.created_at}\`\n\n`;
      }
      msg += `💰 **TỔNG CÔNG NỢ CHƯA THU:** 🔴 **${AccountingService.formatMoney(totalUnpaid)}**\n`;
      msg += `\n👉 Bấm \`/my_debts\` để xem riêng các khoản của bạn.`;
    }

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  /**
   * /my_debts: Cá nhân xem các khoản mình cần đóng
   */
  public static async handleMyDebts(ctx: Context) {
    const username = ctx.from?.username;
    if (!username) {
      await ctx.reply('⚠️ Vui lòng thiết lập Telegram @username để theo dõi công nợ cá nhân.');
      return;
    }

    const debts = AccountingService.getUnpaidDebts(username);

    let msg = `👤 **DANH SÁCH CÔNG NỢ CỦA BẠN (@${username})**\n\n`;

    if (debts.length === 0) {
      msg += `🎉 Tuyệt vời! Bạn không còn nợ khoản tiền nào!`;
    } else {
      let total = 0;
      for (const d of debts) {
        total += d.amount_owed;
        msg += `• 🔴 **${AccountingService.formatMoney(d.amount_owed)}**: _${d.transaction_title}_\n`;
        msg += `  👤 Cần chuyển cho: **${d.payer_name || 'Người ứng tiền'}** | ⏰ \`${d.created_at}\`\n\n`;
      }
      msg += `💰 **TỔNG TIỀN CẦN THANH TOÁN:** 🔴 **${AccountingService.formatMoney(total)}**`;
    }

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  /**
   * /so_quy hoặc /thu_chi: Xem sổ thu chi theo ngày
   */
  public static async handleLedger(ctx: Context) {
    const list = AccountingService.getAll(15);

    let msg = `📒 **SỔ THU CHI & GIAO DỊCH GẦN NHẤT (${list.length})**\n\n`;

    if (list.length === 0) {
      msg += `✨ Chưa có giao dịch thu chi nào được ghi nhận.`;
    } else {
      for (const item of list) {
        const icon = item.type === 'THU' ? '🟢 [THU]' : '🔴 [CHI]';
        const formattedAmount = AccountingService.formatMoney(item.amount);
        msg += `${icon} **#${item.id}: ${item.title}** (\`${formattedAmount}\`)\n`;
        msg += `   ⏰ Lúc: \`${item.created_at}\` | 👤 Người TT: ${item.payer_name || 'n/a'}\n`;
      }
    }

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  /**
   * /quy hoặc /funds: Báo cáo quỹ công ty
   */
  public static async handleFundReport(ctx: Context) {
    const summary = AccountingService.getFundSummary();

    let msg = `📈 **BÁO CÁO TÀI CHÍNH & TỒN QUỸ DOANH NGHIỆP** 📈\n\n`;
    msg += `💰 **TỒN QUỸ HIỆN TẠI:** 💵 **${AccountingService.formatMoney(summary.currentFund)}**\n\n`;
    msg += `• 🟢 **Tổng tiền đã thu:** +${AccountingService.formatMoney(summary.totalIncome)}\n`;
    msg += `• 🔴 **Tổng tiền đã chi:** -${AccountingService.formatMoney(summary.totalExpense)}\n`;
    msg += `• ⚠️ **Tổng công nợ chưa thu hồi:** ${AccountingService.formatMoney(summary.unpaidDebts)}\n\n`;
    msg += `👉 Gõ \`/cong_no\` để xem chi tiết danh sách người nợ.`;

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  /**
   * Xử lý Callback nút bấm thanh toán & xác nhận
   */
  public static async handleCallback(ctx: Context) {
    const data = ctx.callbackQuery?.data;
    const userId = ctx.from?.id;
    if (!data || !userId) return;

    if (!data.startsWith('acc:')) return;

    const parts = data.split(':');
    const action = parts[1];
    const txId = Number(parts[2]);

    const tx = AccountingService.getById(txId);
    if (!tx) {
      await ctx.answerCallbackQuery({ text: 'Giao dịch không tồn tại hoặc đã bị xóa.' });
      return;
    }

    const currentUsername = ctx.from.username ? ctx.from.username.toLowerCase() : '';

    // 1. Tôi đã chuyển khoản / đóng tiền
    if (action === 'pay') {
      if (!currentUsername) {
        await ctx.answerCallbackQuery({ text: '⚠️ Vui lòng đặt Telegram @username để xác nhận nợ.' });
        return;
      }

      const splits = AccountingService.getSplits(txId);
      const mySplit = splits.find(s => s.username.toLowerCase() === currentUsername);

      if (!mySplit) {
        await ctx.answerCallbackQuery({ text: 'Bạn không nằm trong danh sách chia tiền của khoản này.' });
        return;
      }

      AccountingService.markSplitPaid(txId, currentUsername, true, userId);
      await ctx.answerCallbackQuery({ text: '✅ Bạn đã xác nhận đã đóng tiền thành công!' });

      const updatedSplits = AccountingService.getSplits(txId);
      try {
        await ctx.editMessageText(formatTransactionMessage(tx, updatedSplits), {
          parse_mode: 'Markdown',
          reply_markup: getTransactionKeyboard(txId),
        });
      } catch (_) {}
    }

    // 2. Menu người thanh toán duyệt nhận tiền
    else if (action === 'confirm_menu') {
      const isAdmin = UserService.isAdmin(userId);
      const isPayer = tx.payer_id === userId;

      if (!isAdmin && !isPayer) {
        await ctx.answerCallbackQuery({ text: '⚠️ Chỉ người thanh toán hoặc Sếp mới có quyền duyệt nhận tiền.' });
        return;
      }

      const splits = AccountingService.getSplits(txId);
      const unpaid = splits.filter(s => s.is_paid === 0);

      if (unpaid.length === 0) {
        await ctx.answerCallbackQuery({ text: 'Tất cả mọi người đã hoàn thành đóng tiền!' });
        return;
      }

      const kb = new InlineKeyboard();
      for (const s of unpaid) {
        kb.text(`✅ Duyệt cho @${s.username}`, `acc:confirm_user:${txId}:${s.username}`).row();
      }
      kb.text('🔙 Đóng', `acc:close_menu`);

      await ctx.reply(`👉 Chọn thành viên bạn đã nhận được tiền:`, { reply_markup: kb });
      await ctx.answerCallbackQuery();
    }

    // 3. Xác nhận cho từng người
    else if (action === 'confirm_user') {
      const targetUser = parts[3];
      AccountingService.markSplitPaid(txId, targetUser, true, userId);
      await ctx.answerCallbackQuery({ text: `Đã xác nhận thanh toán cho @${targetUser}!` });

      await ctx.reply(`✅ Người thanh toán đã xác nhận nhận đủ tiền từ @${targetUser}!`);
    }

    // 4. Chi tiết công nợ
    else if (action === 'detail') {
      const splits = AccountingService.getSplits(txId);
      const msg = formatTransactionMessage(tx, splits);
      await ctx.answerCallbackQuery();
      await ctx.reply(msg, { parse_mode: 'Markdown' });
    }

    // 5. Đóng menu
    else if (action === 'close_menu') {
      await ctx.answerCallbackQuery();
      try {
        await ctx.deleteMessage();
      } catch (_) {}
    }
  }
}
