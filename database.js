const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data.json');

function generateCode(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getDefaultData() {
  return {
    admins: [
      { id: 1, username: 'admin', password_hash: bcrypt.hashSync('admin123', 10), created_at: new Date().toISOString() }
    ],
    users: [],
    ads: [
      { id: 1, title: 'Download App & Earn', description: 'Watch this ad and earn rewards instantly!', reward: 0.0020, url: 'https://example.com/ad1', duration: 15, status: 'active', created_at: new Date().toISOString() },
      { id: 2, title: 'Survey Complete', description: 'Complete a quick survey to earn!', reward: 0.0020, url: 'https://example.com/ad2', duration: 15, status: 'active', created_at: new Date().toISOString() },
      { id: 3, title: 'Watch Video Ad', description: 'Watch this short video and earn!', reward: 0.0020, url: 'https://example.com/ad3', duration: 15, status: 'active', created_at: new Date().toISOString() },
      { id: 4, title: 'Visit Sponsor', description: 'Visit our sponsor page to earn!', reward: 0.0020, url: 'https://example.com/ad4', duration: 15, status: 'active', created_at: new Date().toISOString() },
      { id: 5, title: 'Play Mini Game', description: 'Play a quick game and earn rewards!', reward: 0.0020, url: 'https://example.com/ad5', duration: 15, status: 'active', created_at: new Date().toISOString() }
    ],
    tasks: [
      { id: 1, title: 'Follow on Twitter', description: 'Follow our official Twitter account', reward: 0.05, type: 'social', status: 'active', created_at: new Date().toISOString() },
      { id: 2, title: 'Join Telegram Group', description: 'Join our Telegram community group', reward: 0.05, type: 'social', status: 'active', created_at: new Date().toISOString() },
      { id: 3, title: 'Share with Friends', description: 'Share EarnHub with 3 friends', reward: 0.10, type: 'referral', status: 'active', created_at: new Date().toISOString() }
    ],
    withdrawals: [],
    giftCodes: [],
    adViews: [],
    taskCompletions: [],
    settings: {
      site_name: 'EarnHub',
      tagline: 'Watch Ads. Earn Money. Withdraw Instantly.',
      ad_reward: 0.0020,
      min_withdrawal: 1.00,
      referral_commission: 10,
      withdraw_method: 'USDT BEP20'
    }
  };
}

class Database {
  constructor() {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      this.data = JSON.parse(raw);
      if (!this.data.adViews) this.data.adViews = [];
      if (!this.data.taskCompletions) this.data.taskCompletions = [];
      if (!this.data.giftCodes) this.data.giftCodes = [];
      if (!this.data.withdrawals) this.data.withdrawals = [];
      if (!this.data.ads) this.data.ads = getDefaultData().ads;
      if (!this.data.tasks) this.data.tasks = getDefaultData().tasks;
    } else {
      this.data = getDefaultData();
      this.save();
    }
  }

  save() {
    fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2));
  }

  getNextId(collection) {
    const items = this.data[collection];
    if (!items || items.length === 0) return 1;
    return Math.max(...items.map(i => i.id)) + 1;
  }

  // Admin
  findAdmin(username) { return this.data.admins.find(a => a.username === username); }

  // Users
  getUsers() { return this.data.users; }
  findUser(id) { return this.data.users.find(u => u.id === id); }
  findUserByEmail(email) { return this.data.users.find(u => u.email === email); }
  findUserByPhone(phone) { return this.data.users.find(u => u.phone === phone); }
  findUserByTelegramId(tgId) { return this.data.users.find(u => u.telegram_id === tgId); }
  findUserByReferralCode(code) { return this.data.users.find(u => u.referral_code === code); }

  createUser(data) {
    const referralCode = 'EH' + generateCode(6);
    const user = {
      id: this.getNextId('users'),
      name: data.name,
      email: data.email,
      phone: data.phone,
      password_hash: data.password_hash,
      balance: 0,
      total_earned: 0,
      referral_code: referralCode,
      referred_by: data.referred_by || null,
      referral_earnings: 0,
      telegram_id: data.telegram_id || null,
      status: 'active',
      created_at: new Date().toISOString()
    };
    this.data.users.push(user);
    this.save();
    return user;
  }

  updateUser(id, updates) {
    const user = this.findUser(id);
    if (user) { Object.assign(user, updates); this.save(); }
    return user;
  }

  // Ads
  getAds() { return this.data.ads; }
  getActiveAds() { return this.data.ads.filter(a => a.status === 'active'); }
  findAd(id) { return this.data.ads.find(a => a.id === id); }
  createAd(data) {
    const ad = { id: this.getNextId('ads'), ...data, status: 'active', created_at: new Date().toISOString() };
    this.data.ads.push(ad);
    this.save();
    return ad;
  }
  updateAd(id, updates) {
    const ad = this.findAd(id);
    if (ad) { Object.assign(ad, updates); this.save(); }
    return ad;
  }
  deleteAd(id) {
    this.data.ads = this.data.ads.filter(a => a.id !== id);
    this.save();
  }

  // Ad Views
  hasViewedAd(userId, adId) {
    const today = new Date().toISOString().split('T')[0];
    return this.data.adViews.some(v => v.user_id === userId && v.ad_id === adId && v.viewed_at.startsWith(today));
  }
  recordAdView(userId, adId) {
    this.data.adViews.push({ user_id: userId, ad_id: adId, viewed_at: new Date().toISOString() });
    this.save();
  }
  getUserAdViewsToday(userId) {
    const today = new Date().toISOString().split('T')[0];
    return this.data.adViews.filter(v => v.user_id === userId && v.viewed_at.startsWith(today)).length;
  }

  // Tasks
  getTasks() { return this.data.tasks; }
  getActiveTasks() { return this.data.tasks.filter(t => t.status === 'active'); }
  findTask(id) { return this.data.tasks.find(t => t.id === id); }
  createTask(data) {
    const task = { id: this.getNextId('tasks'), ...data, status: 'active', created_at: new Date().toISOString() };
    this.data.tasks.push(task);
    this.save();
    return task;
  }
  updateTask(id, updates) {
    const task = this.findTask(id);
    if (task) { Object.assign(task, updates); this.save(); }
    return task;
  }
  deleteTask(id) {
    this.data.tasks = this.data.tasks.filter(t => t.id !== id);
    this.save();
  }

  // Task Completions
  hasCompletedTask(userId, taskId) {
    return this.data.taskCompletions.some(c => c.user_id === userId && c.task_id === taskId);
  }
  recordTaskCompletion(userId, taskId) {
    this.data.taskCompletions.push({ user_id: userId, task_id: taskId, completed_at: new Date().toISOString() });
    this.save();
  }

  // Withdrawals
  getWithdrawals() { return this.data.withdrawals; }
  findWithdrawal(id) { return this.data.withdrawals.find(w => w.id === id); }
  getUserWithdrawals(userId) { return this.data.withdrawals.filter(w => w.user_id === userId); }
  createWithdrawal(data) {
    const w = { id: this.getNextId('withdrawals'), ...data, method: 'USDT BEP20', status: 'pending', created_at: new Date().toISOString() };
    this.data.withdrawals.push(w);
    this.save();
    return w;
  }
  updateWithdrawal(id, updates) {
    const w = this.findWithdrawal(id);
    if (w) { Object.assign(w, updates); this.save(); }
    return w;
  }

  // Gift Codes
  getGiftCodes() { return this.data.giftCodes; }
  findGiftCode(code) { return this.data.giftCodes.find(g => g.code === code); }
  findGiftCodeById(id) { return this.data.giftCodes.find(g => g.id === id); }
  createGiftCode(data) {
    const gc = {
      id: this.getNextId('giftCodes'),
      code: data.code || generateCode(8),
      amount: data.amount,
      max_uses: data.max_uses || 1,
      used_count: 0,
      used_by: [],
      status: 'active',
      created_at: new Date().toISOString()
    };
    this.data.giftCodes.push(gc);
    this.save();
    return gc;
  }
  useGiftCode(code, userId) {
    const gc = this.findGiftCode(code);
    if (!gc) return { success: false, message: 'Invalid gift code' };
    if (gc.status !== 'active') return { success: false, message: 'Gift code is inactive' };
    if (gc.used_count >= gc.max_uses) return { success: false, message: 'Gift code has been fully used' };
    if (gc.used_by.includes(userId)) return { success: false, message: 'You already used this gift code' };

    gc.used_count++;
    gc.used_by.push(userId);
    if (gc.used_count >= gc.max_uses) gc.status = 'used';

    const user = this.findUser(userId);
    if (user) {
      user.balance += gc.amount;
      user.total_earned += gc.amount;
    }
    this.save();
    return { success: true, amount: gc.amount };
  }
  deleteGiftCode(id) {
    this.data.giftCodes = this.data.giftCodes.filter(g => g.id !== id);
    this.save();
  }

  // Settings
  getSettings() { return this.data.settings; }
  updateSettings(updates) {
    Object.assign(this.data.settings, updates);
    this.save();
    return this.data.settings;
  }

  // Stats
  getStats() {
    const users = this.data.users;
    const withdrawals = this.data.withdrawals;
    const today = new Date().toISOString().split('T')[0];
    return {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.status === 'active').length,
      bannedUsers: users.filter(u => u.status === 'banned').length,
      totalEarned: users.reduce((s, u) => s + u.total_earned, 0),
      totalBalance: users.reduce((s, u) => s + u.balance, 0),
      pendingWithdrawals: withdrawals.filter(w => w.status === 'pending').length,
      approvedWithdrawals: withdrawals.filter(w => w.status === 'approved').reduce((s, w) => s + w.amount, 0),
      todayAdViews: this.data.adViews.filter(v => v.viewed_at.startsWith(today)).length,
      totalAds: this.data.ads.length,
      totalTasks: this.data.tasks.length,
      totalGiftCodes: this.data.giftCodes.length,
      activeGiftCodes: this.data.giftCodes.filter(g => g.status === 'active').length
    };
  }

  getReferrals(userId) {
    return this.data.users.filter(u => u.referred_by === userId);
  }
}

module.exports = new Database();
