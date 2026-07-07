const { TelegramBot } = require('node-telegram-bot-api');
const db = require('./database');
const bcrypt = require('bcryptjs');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8932261850:AAFDn7uS5yNkSVTWQ6b4_B-1y3lK-37y3ME';
const WEBAPP_URL = process.env.WEBAPP_URL || 'http://localhost:3000';

const bot = new TelegramBot(TOKEN, { polling: true });

bot.onText(/\/start(.*)/, (msg, match) => {
  const chatId = msg.chat.id;
  const telegramUser = msg.from;
  const refCode = (match[1] || '').trim();

  let user = db.findUserByTelegramId(telegramUser.id);

  if (!user) {
    const name = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') || 'User';
    const email = `tg_${telegramUser.id}@telegram.user`;
    const phone = `tg_${telegramUser.id}`;

    let referredBy = null;
    if (refCode) {
      const referrer = db.findUserByReferralCode(refCode);
      if (referrer) referredBy = referrer.id;
    }

    user = db.createUser({
      name,
      email,
      phone,
      password_hash: bcrypt.hashSync(String(telegramUser.id), 10),
      referred_by: referredBy,
      telegram_id: telegramUser.id
    });
  }

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💰 Open EarnHub', web_app: { url: `${WEBAPP_URL}/tg?uid=${user.id}&tgid=${telegramUser.id}` } }],
        [{ text: '📊 My Balance', callback_data: 'balance' }, { text: '👥 Referrals', callback_data: 'referrals' }],
        [{ text: '💸 Withdraw', callback_data: 'withdraw' }, { text: '🎁 Gift Code', callback_data: 'giftcode' }]
      ]
    }
  };

  bot.sendMessage(chatId,
    `🌟 *Welcome to EarnHub!*\n\n` +
    `Hey *${user.name}*! 👋\n\n` +
    `💰 Balance: *$${user.balance.toFixed(4)}*\n` +
    `📈 Total Earned: *$${user.total_earned.toFixed(4)}*\n` +
    `👥 Referrals: *${db.getReferrals(user.id).length}*\n\n` +
    `🔗 Your Referral Link:\n` +
    `\`https://t.me/earn_hub_task_bot?start=${user.referral_code}\`\n\n` +
    `Tap *Open EarnHub* to start earning!`,
    { parse_mode: 'Markdown', ...keyboard }
  );
});

bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const telegramId = query.from.id;
  const user = db.findUserByTelegramId(telegramId);

  if (!user) {
    bot.answerCallbackQuery(query.id, { text: 'Please /start first!' });
    return;
  }

  switch (query.data) {
    case 'balance':
      bot.answerCallbackQuery(query.id);
      bot.sendMessage(chatId,
        `💰 *Your Balance*\n\n` +
        `Balance: *$${user.balance.toFixed(4)}*\n` +
        `Total Earned: *$${user.total_earned.toFixed(4)}*\n` +
        `Referral Earned: *$${(user.referral_earnings || 0).toFixed(4)}*\n\n` +
        `Min Withdraw: *$1.00* via USDT BEP20`,
        { parse_mode: 'Markdown' }
      );
      break;

    case 'referrals':
      bot.answerCallbackQuery(query.id);
      const refs = db.getReferrals(user.id);
      let refText = `👥 *Your Referrals* (${refs.length})\n\n`;
      refText += `🔗 Your Code: \`${user.referral_code}\`\n`;
      refText += `💵 Commission: *10%* of referrals' earnings\n\n`;
      if (refs.length > 0) {
        refs.slice(0, 10).forEach((r, i) => {
          refText += `${i + 1}. ${r.name} - $${r.total_earned.toFixed(4)}\n`;
        });
      } else {
        refText += `_No referrals yet. Share your code!_`;
      }
      bot.sendMessage(chatId, refText, { parse_mode: 'Markdown' });
      break;

    case 'withdraw':
      bot.answerCallbackQuery(query.id);
      if (user.balance < 1) {
        bot.sendMessage(chatId,
          `❌ *Insufficient Balance*\n\n` +
          `You need at least *$1.00* to withdraw.\n` +
          `Current balance: *$${user.balance.toFixed(4)}*\n\n` +
          `Keep watching ads to earn more!`,
          { parse_mode: 'Markdown' }
        );
      } else {
        bot.sendMessage(chatId,
          `💸 *Withdraw*\n\n` +
          `Balance: *$${user.balance.toFixed(4)}*\n` +
          `Method: *USDT BEP20*\n` +
          `Min: *$1.00*\n\n` +
          `Open the app to submit withdrawal request.`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '💸 Open Withdraw Page', web_app: { url: `${WEBAPP_URL}/tg?uid=${user.id}&tgid=${telegramId}&page=withdraw` } }]
              ]
            }
          }
        );
      }
      break;

    case 'giftcode':
      bot.answerCallbackQuery(query.id);
      bot.sendMessage(chatId,
        `🎁 *Gift Code*\n\n` +
        `Open the app to claim your gift code!`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎁 Claim Gift Code', web_app: { url: `${WEBAPP_URL}/tg?uid=${user.id}&tgid=${telegramId}` } }]
            ]
          }
        }
      );
      break;
  }
});

bot.onText(/\/balance/, (msg) => {
  const user = db.findUserByTelegramId(msg.from.id);
  if (!user) return bot.sendMessage(msg.chat.id, 'Please /start first!');
  bot.sendMessage(msg.chat.id,
    `💰 Balance: *$${user.balance.toFixed(4)}*\n📈 Total: *$${user.total_earned.toFixed(4)}*`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/referral/, (msg) => {
  const user = db.findUserByTelegramId(msg.from.id);
  if (!user) return bot.sendMessage(msg.chat.id, 'Please /start first!');
  bot.sendMessage(msg.chat.id,
    `🔗 Your Referral Code: \`${user.referral_code}\`\n👥 Referrals: *${db.getReferrals(user.id).length}*\n💵 Earned: *$${(user.referral_earnings || 0).toFixed(4)}*`,
    { parse_mode: 'Markdown' }
  );
});

console.log('Telegram Bot started!');

module.exports = bot;
