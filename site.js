const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../database');
const { userAuth } = require('../middleware/auth');

router.get('/', (req, res) => {
  const settings = db.getSettings();
  if (req.session.userId) {
    const user = db.findUser(req.session.userId);
    if (!user || user.status === 'banned') {
      req.session.destroy();
      return res.redirect('/login');
    }
    const todayViews = db.getUserAdViewsToday(user.id);
    const referrals = db.getReferrals(user.id);
    return res.render('site/dashboard', { user, settings, todayViews, referrals });
  }
  res.render('site/index', { settings });
});

router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('site/login', { error: null, settings: db.getSettings() });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.findUserByEmail(email);
  if (!user) {
    return res.render('site/login', { error: 'Invalid email or password', settings: db.getSettings() });
  }
  if (user.status === 'banned') {
    return res.render('site/login', { error: 'Your account has been banned', settings: db.getSettings() });
  }
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.render('site/login', { error: 'Invalid email or password', settings: db.getSettings() });
  }
  req.session.userId = user.id;
  res.redirect('/');
});

router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  const ref = req.query.ref || '';
  res.render('site/register', { error: null, settings: db.getSettings(), ref });
});

router.post('/register', (req, res) => {
  const { name, email, phone, password, confirm_password, referral_code } = req.body;
  const settings = db.getSettings();

  if (!name || !email || !phone || !password) {
    return res.render('site/register', { error: 'All fields are required', settings, ref: referral_code || '' });
  }
  if (password !== confirm_password) {
    return res.render('site/register', { error: 'Passwords do not match', settings, ref: referral_code || '' });
  }
  if (password.length < 6) {
    return res.render('site/register', { error: 'Password must be at least 6 characters', settings, ref: referral_code || '' });
  }
  if (db.findUserByEmail(email)) {
    return res.render('site/register', { error: 'Email already registered', settings, ref: referral_code || '' });
  }

  let referredBy = null;
  if (referral_code) {
    const referrer = db.findUserByReferralCode(referral_code);
    if (referrer) referredBy = referrer.id;
  }

  const hash = bcrypt.hashSync(password, 10);
  const user = db.createUser({ name, email, phone, password_hash: hash, referred_by: referredBy });
  req.session.userId = user.id;
  res.redirect('/');
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Telegram WebApp auto-login
router.get('/tg', (req, res) => {
  const { uid, tgid, page } = req.query;
  if (uid && tgid) {
    const user = db.findUser(parseInt(uid));
    if (user && user.telegram_id === parseInt(tgid)) {
      req.session.userId = user.id;
      return res.redirect(page === 'withdraw' ? '/withdraw' : '/');
    }
  }
  res.redirect('/login');
});

// Ads
router.get('/ads', userAuth, (req, res) => {
  const user = db.findUser(req.session.userId);
  const ads = db.getActiveAds();
  const viewedAds = ads.map(ad => ({ ...ad, viewed: db.hasViewedAd(user.id, ad.id) }));
  const todayViews = db.getUserAdViewsToday(user.id);
  res.render('site/ads', { user, ads: viewedAds, settings: db.getSettings(), todayViews });
});

router.post('/ads/:id/view', userAuth, (req, res) => {
  const user = db.findUser(req.session.userId);
  const ad = db.findAd(parseInt(req.params.id));

  if (!ad || ad.status !== 'active') {
    return res.json({ success: false, message: 'Ad not found' });
  }
  if (db.hasViewedAd(user.id, ad.id)) {
    return res.json({ success: false, message: 'Already viewed today' });
  }

  const reward = ad.reward;
  db.recordAdView(user.id, ad.id);
  db.updateUser(user.id, {
    balance: +(user.balance + reward).toFixed(4),
    total_earned: +(user.total_earned + reward).toFixed(4)
  });

  // Referral commission
  if (user.referred_by) {
    const referrer = db.findUser(user.referred_by);
    if (referrer && referrer.status !== 'banned') {
      const commission = +(reward * db.getSettings().referral_commission / 100).toFixed(4);
      db.updateUser(referrer.id, {
        balance: +(referrer.balance + commission).toFixed(4),
        total_earned: +(referrer.total_earned + commission).toFixed(4),
        referral_earnings: +((referrer.referral_earnings || 0) + commission).toFixed(4)
      });
    }
  }

  res.json({ success: true, earned: reward, balance: +(user.balance + reward).toFixed(4) });
});

// Tasks
router.get('/tasks', userAuth, (req, res) => {
  const user = db.findUser(req.session.userId);
  const tasks = db.getActiveTasks();
  const taskList = tasks.map(t => ({ ...t, completed: db.hasCompletedTask(user.id, t.id) }));
  res.render('site/tasks', { user, tasks: taskList, settings: db.getSettings() });
});

router.post('/tasks/:id/complete', userAuth, (req, res) => {
  const user = db.findUser(req.session.userId);
  const task = db.findTask(parseInt(req.params.id));

  if (!task || task.status !== 'active') {
    return res.json({ success: false, message: 'Task not found' });
  }
  if (db.hasCompletedTask(user.id, task.id)) {
    return res.json({ success: false, message: 'Task already completed' });
  }

  db.recordTaskCompletion(user.id, task.id);
  db.updateUser(user.id, {
    balance: +(user.balance + task.reward).toFixed(4),
    total_earned: +(user.total_earned + task.reward).toFixed(4)
  });

  if (user.referred_by) {
    const referrer = db.findUser(user.referred_by);
    if (referrer && referrer.status !== 'banned') {
      const commission = +(task.reward * db.getSettings().referral_commission / 100).toFixed(4);
      db.updateUser(referrer.id, {
        balance: +(referrer.balance + commission).toFixed(4),
        total_earned: +(referrer.total_earned + commission).toFixed(4),
        referral_earnings: +((referrer.referral_earnings || 0) + commission).toFixed(4)
      });
    }
  }

  res.json({ success: true, earned: task.reward, balance: +(user.balance + task.reward).toFixed(4) });
});

// Profile
router.get('/profile', userAuth, (req, res) => {
  const user = db.findUser(req.session.userId);
  const withdrawals = db.getUserWithdrawals(user.id);
  const referrals = db.getReferrals(user.id);
  res.render('site/profile', { user, withdrawals, referrals, settings: db.getSettings() });
});

// Withdraw
router.get('/withdraw', userAuth, (req, res) => {
  const user = db.findUser(req.session.userId);
  const withdrawals = db.getUserWithdrawals(user.id);
  res.render('site/withdraw', { user, withdrawals, settings: db.getSettings(), error: null, success: null });
});

router.post('/withdraw', userAuth, (req, res) => {
  const user = db.findUser(req.session.userId);
  const { amount, wallet_address } = req.body;
  const withdrawals = db.getUserWithdrawals(user.id);
  const settings = db.getSettings();
  const amt = parseFloat(amount);

  if (user.balance < settings.min_withdrawal) {
    return res.render('site/withdraw', { user, withdrawals, settings, error: `You need at least $${settings.min_withdrawal.toFixed(2)} to withdraw. Current balance: $${user.balance.toFixed(4)}`, success: null });
  }
  if (!amt || amt < settings.min_withdrawal) {
    return res.render('site/withdraw', { user, withdrawals, settings, error: `Minimum withdrawal is $${settings.min_withdrawal.toFixed(2)}`, success: null });
  }
  if (amt > user.balance) {
    return res.render('site/withdraw', { user, withdrawals, settings, error: 'Insufficient balance', success: null });
  }

  const addr = (wallet_address || '').trim();
  if (!addr || addr.length < 20) {
    return res.render('site/withdraw', { user, withdrawals, settings, error: 'Please enter a valid USDT BEP20 wallet address', success: null });
  }
  const isEthStyle = /^0x[a-fA-F0-9]{40}$/.test(addr);
  if (isEthStyle) {
    return res.render('site/withdraw', { user, withdrawals, settings, error: 'Invalid address! Please enter a valid USDT BEP20 (BSC) wallet address. Ethereum (0x) addresses are not accepted.', success: null });
  }
  if (!/^(bnb|bc|tb)[a-zA-Z0-9]{30,}$/.test(addr) && !addr.startsWith('T')) {
    return res.render('site/withdraw', { user, withdrawals, settings, error: 'Invalid USDT BEP20 wallet address format. Please check and try again.', success: null });
  }

  const pending = withdrawals.filter(w => w.status === 'pending');
  if (pending.length > 0) {
    return res.render('site/withdraw', { user, withdrawals, settings, error: 'You already have a pending withdrawal', success: null });
  }

  db.updateUser(user.id, { balance: +(user.balance - amt).toFixed(4) });
  db.createWithdrawal({ user_id: user.id, amount: amt, wallet_address });

  const updatedUser = db.findUser(user.id);
  const updatedWithdrawals = db.getUserWithdrawals(user.id);
  res.render('site/withdraw', { user: updatedUser, withdrawals: updatedWithdrawals, settings, error: null, success: `Withdrawal of $${amt.toFixed(4)} submitted successfully!` });
});

// Gift Code
router.post('/giftcode/claim', userAuth, (req, res) => {
  const { code } = req.body;
  const result = db.useGiftCode(code, req.session.userId);
  res.json(result);
});

// Referral
router.get('/referral', userAuth, (req, res) => {
  const user = db.findUser(req.session.userId);
  const referrals = db.getReferrals(user.id);
  res.render('site/referral', { user, referrals, settings: db.getSettings() });
});

module.exports = router;
