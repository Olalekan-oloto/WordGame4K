import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// CORS configuration for GitHub Pages
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://olalekan-oloto.github.io,http://localhost:5173').split(',').map(x => x.trim()).filter(Boolean);
const allowedOrigin = (origin, callback) => { if (!origin || allowedOrigins.includes(origin)) return callback(null, true); callback(new Error('Origin not allowed by CORS')); };

app.use(cors({
origin: allowedOrigin,
methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
allowedHeaders: ['Content-Type', 'Authorization'],
credentials: false,
optionsSuccessStatus: 204
}));

app.options(/.*/, cors({
origin: allowedOrigin,
methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
allowedHeaders: ['Content-Type', 'Authorization'],
credentials: false
}));

app.disable('x-powered-by');

app.use((req, res, next) => {
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
res.setHeader('X-Frame-Options', 'DENY');
next();
});

const server = http.createServer(app);

const io = new Server(server, {
cors: {
origin: allowedOrigin,
methods: ['GET', 'POST'],
credentials: false
}
});

const PORT = process.env.PORT || 3001;
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'world.json');

fs.mkdirSync(dataDir, { recursive: true });

if (!fs.existsSync(dbPath)) {
fs.writeFileSync(
dbPath,
JSON.stringify({
users: [],
messages: [],
posts: [],
listings: [],
transactions: [],
sessions: []
}, null, 2)
);
}

const readDB = () => {
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

for (const k of [
'users',
'messages',
'posts',
'listings',
'transactions',
'sessions'
]) {
if (!Array.isArray(db[k])) db[k] = [];
}

return db;
};

const writeDB = db => {
const tmp = dbPath + '.tmp';
fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
fs.renameSync(tmp, dbPath);
};

const REGION = process.env.GAME_REGION || 'ALL';
const sessions = new Map(readDB().sessions.map(s => [s.token, s.userId]));
const onlineSockets = new Map();
const worldPositions = new Map();

app.use(express.json({ limit: '32kb' }));

// Lightweight per-process throttling for prototype auth endpoints.
const authAttempts = new Map();

app.use(['/api/register', '/api/login'], (req, res, next) => {
const key = req.ip || req.socket.remoteAddress || 'unknown';
const now = Date.now();

const recent = (authAttempts.get(key) || []).filter(
t => now - t < 60_000
);

if (recent.length >= 20) {
return res.status(429).json({
error: 'Too many sign-in attempts. Please wait a minute and try again.'
});
}

recent.push(now);
authAttempts.set(key, recent);
next();
});

const nigeriaStates = [
'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa',
'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo',
'Ekiti', 'Enugu', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano',
'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers',
'Sokoto', 'Taraba', 'Yobe', 'Zamfara', 'Federal Capital Territory'
];

const usStates = [
'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California',
'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas',
'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts',
'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana',
'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma',
'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
'District of Columbia'
];

const cities = {
Nigeria: [
'Lagos', 'Abuja', 'Kano', 'Ibadan', 'Port Harcourt',
'Benin City', 'Enugu', 'Calabar', 'Jos', 'Abeokuta',
'Warri', 'Uyo', 'Kaduna', 'Owerri', 'Ilorin'
],
USA: [
'New York City', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix',
'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'Austin',
'Miami', 'Atlanta', 'Seattle', 'Boston', 'Denver'
]
};

const publicUser = u => ({
id: u.id,
username: u.username,
country: u.country,
state: u.state,
city: u.city,
cash: u.cash,
bank: u.bank,
level: u.level,
job: u.job,
home: u.home,
car: u.car,
houseUpgrades: u.houseUpgrades || {},
needs: u.needs || { hunger: 100, energy: 100, fun: 100, hygiene: 100, social: 100, bathroom: 100 },
createdAt: u.createdAt
});

function auth(req, res, next) {
const token = (req.headers.authorization || '').replace(/^Bearer /, '');
const userId = sessions.get(token);

if (!userId) {
return res.status(401).json({ error: 'Please sign in again.' });
}

const db = readDB();
req.user = db.users.find(u => u.id === userId);

if (!req.user) {
return res.status(401).json({ error: 'Account not found.' });
}

next();
}

app.get('/api/health', (_, res) => {
res.json({ ok: true, name: 'WORLD LIFE 4K API', region: REGION });
});

app.use('/api', (req, res, next) => {
  if (REGION !== 'ALL' && req.body?.country && req.body.country !== REGION) return res.status(403).json({ error: `This is the ${REGION} game server.` });
  next();
});

app.get('/api/world', (_, res) => {
res.json({
countries: ['Nigeria', 'USA'],
states: { Nigeria: nigeriaStates, USA: usStates },
cities
});
});

app.post('/api/register', async (req, res) => {
try {
const { username, email, password, country, state, city } = req.body || {};

if (!username || !email || !password || !country || !state || !city) {
  return res.status(400).json({ error: 'Complete every field.' });
}

if (!/^[a-zA-Z0-9_ .-]{3,24}$/.test(String(username).trim())) {
  return res.status(400).json({
    error: 'Player name must be 3–24 characters and use letters, numbers, spaces, dots, dashes or underscores.'
  });
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
  return res.status(400).json({ error: 'Enter a valid email address.' });
}

if (String(password).length < 8) {
  return res.status(400).json({
    error: 'Password must be at least 8 characters.'
  });
}

if (!['Nigeria', 'USA'].includes(country)) {
  return res.status(400).json({ error: 'Choose Nigeria or USA.' });
}
if (REGION !== 'ALL' && country !== REGION) return res.status(403).json({ error: `Please register on the ${REGION} server.` });

const db = readDB();

if (db.users.some(u =>
  u.email.toLowerCase() === String(email).toLowerCase() ||
  u.username.toLowerCase() === String(username).toLowerCase()
)) {
  return res.status(409).json({
    error: 'Email or username already exists.'
  });
}

const user = {
  id: crypto.randomUUID(),
  username: String(username).trim().slice(0, 24),
  email: String(email).toLowerCase(),
  passwordHash: await bcrypt.hash(password, 10),
  country,
  state,
  city,
  cash: 1000000,
  bank: 0,
  level: 1,
  job: 'Unemployed',
  home: 'Free Starter House',
  car: 'Free Starter Car',
  houseUpgrades: { bed: 1, kitchen: 1, bathroom: 1, entertainment: 0, decor: 0 },
  needs: { hunger: 100, energy: 100, fun: 100, hygiene: 100, social: 100, bathroom: 100 },
  createdAt: new Date().toISOString()
};

db.users.push(user);
writeDB(db);

const token = crypto.randomBytes(32).toString('hex');
sessions.set(token, user.id);

db.sessions.push({
  token,
  userId: user.id,
  createdAt: new Date().toISOString()
});

writeDB(db);

res.json({ token, user: publicUser(user) });

} catch (error) {
console.error('Registration error:', error);
res.status(500).json({ error: 'Registration failed. Please try again.' });
}
});

app.post('/api/login', async (req, res) => {
try {
const { email, password } = req.body || {};
const db = readDB();

const user = db.users.find(
  u => u.email === String(email || '').toLowerCase()
);

if (!user || !await bcrypt.compare(password || '', user.passwordHash)) {
  return res.status(401).json({ error: 'Incorrect email or password.' });
}
if (REGION !== 'ALL' && user.country !== REGION) return res.status(403).json({ error: `This account belongs to the ${user.country} server. Switch game region and try again.` });

const token = crypto.randomBytes(32).toString('hex');
sessions.set(token, user.id);

db.sessions.push({
  token,
  userId: user.id,
  createdAt: new Date().toISOString()
});

writeDB(db);

res.json({ token, user: publicUser(user) });

} catch (error) {
console.error('Login error:', error);
res.status(500).json({ error: 'Login failed. Please try again.' });
}
});

app.get('/api/me', auth, (req, res) => {
  // Needs decline with elapsed play time (capped to avoid huge offline penalties).
  const db = readDB();
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Player profile not found.' });
  user.needs ||= { hunger: 100, energy: 100, fun: 100, hygiene: 100, social: 100, bathroom: 100 };
  const now = Date.now();
  const previous = Number(user.needsUpdatedAt || now);
  const elapsedMinutes = Math.max(0, Math.min(180, Math.floor((now - previous) / 60000)));
  if (elapsedMinutes > 0) {
    const decay = { hunger: 1.2, energy: 0.8, fun: 0.5, hygiene: 0.45, social: 0.35, bathroom: 0.7 };
    for (const [need, rate] of Object.entries(decay)) user.needs[need] = Math.max(0, Number(user.needs[need] ?? 100) - elapsedMinutes * rate);
    user.needsUpdatedAt = now;
    writeDB(db);
  }
  res.json({ user: publicUser(user) });
});

app.post('/api/logout', auth, (req, res) => {
const token = (req.headers.authorization || '').replace(/^Bearer /, '');

sessions.delete(token);

const db = readDB();
db.sessions = db.sessions.filter(s => s.token !== token);
writeDB(db);

for (const [sid, info] of onlineSockets) {
if (info.userId === req.user.id) {
io.sockets.sockets.get(sid)?.disconnect(true);
}
}

res.json({ ok: true });
});

app.get('/api/players/online', auth, (req, res) => {
const seen = new Map();

for (const info of onlineSockets.values()) {
if (info.userId !== req.user.id && info.player.country === req.user.country) seen.set(info.userId, info.player);
}

res.json({ players: [...seen.values()] });
});

app.get('/api/messages', auth, (req, res) => {
const db = readDB();

res.json({
messages: db.messages.filter(m => m.country === req.user.country).slice(-100).map(m => ({
...m,
mine: m.userId === req.user.id
}))
});
});

app.post('/api/messages', auth, (req, res) => {
const text = String(req.body?.text || '').trim().slice(0, 500);

if (!text) {
return res.status(400).json({ error: 'Message cannot be empty.' });
}

const db = readDB();

const message = {
id: crypto.randomUUID(),
userId: req.user.id,
username: req.user.username,
country: req.user.country,
text,
createdAt: new Date().toISOString()
};

db.messages.push(message);
writeDB(db);
io.sockets.sockets.forEach(client => { if (client.data?.player?.player?.country === message.country) client.emit('chat:message', message); });

res.json({ message });
});

app.post('/api/work', auth, (req, res) => {
const nigeriaJobs = {
  'Delivery Rider': 1800, 'Market Trader': 2100, 'Danfo Driver': 2400,
  'Keke Rider': 2000, 'Jollof Chef': 2300, 'Software Developer': 5000
};
const usaJobs = {
  'Delivery Driver': 170, 'Retail Associate': 160, 'Rideshare Driver': 180,
  'EMT Assistant': 220, 'Real Estate Agent': 240, 'Software Developer': 300
};
const db = readDB();
const u = db.users.find(x => x.id === req.user.id);
if (!u) return res.status(404).json({ error: 'Player profile not found.' });
const jobs = u.country === 'Nigeria' ? nigeriaJobs : usaJobs;
const job = String(req.body?.job || '');
if (!Object.prototype.hasOwnProperty.call(jobs, job)) {
  return res.status(400).json({ error: `Choose a listed job for the ${u.country} region.` });
}
u.job = job;
u.cash += jobs[job];
u.level += 1;
writeDB(db);
res.json({ user: publicUser(u), earned: jobs[job] });
});

app.post('/api/needs', auth, (req, res) => {
  const actions = {
    eat: { need: 'hunger', amount: 35, cost: 500 },
    sleep: { need: 'energy', amount: 45, cost: 0 },
    shower: { need: 'hygiene', amount: 40, cost: 150 },
    bathroom: { need: 'bathroom', amount: 50, cost: 0 },
    play: { need: 'fun', amount: 30, cost: 250 },
    socialize: { need: 'social', amount: 25, cost: 100 }
  };
  const action = actions[String(req.body?.action || '')];
  if (!action) return res.status(400).json({ error: 'Choose a valid home activity.' });
  const db = readDB();
  const u = db.users.find(x => x.id === req.user.id);
  if (!u) return res.status(404).json({ error: 'Player profile not found.' });
  u.needs ||= { hunger: 100, energy: 100, fun: 100, hygiene: 100, social: 100, bathroom: 100 };
  const activityCost = u.country === 'USA' ? Math.round(action.cost / 100) : action.cost;
  if (u.cash < activityCost) return res.status(400).json({ error: 'Not enough in-game money for this activity.' });
  u.cash -= activityCost;
  u.needsUpdatedAt = Date.now();
  u.needs[action.need] = Math.min(100, (Number(u.needs[action.need]) || 0) + action.amount);
  writeDB(db);
  res.json({ user: publicUser(u), action: req.body.action, cost: activityCost });
});

app.post('/api/house/upgrade', auth, (req, res) => {
  const upgradeCosts = {
    bed: [{ name: 'Basic Bed', cost: 0 }, { name: 'Comfort Bed', cost: 12000 }, { name: 'Luxury Bed', cost: 35000 }],
    kitchen: [{ name: 'Basic Kitchen', cost: 0 }, { name: 'Modern Kitchen', cost: 18000 }, { name: 'Luxury Kitchen', cost: 45000 }],
    bathroom: [{ name: 'Basic Bathroom', cost: 0 }, { name: 'Modern Bathroom', cost: 15000 }, { name: 'Luxury Bathroom', cost: 40000 }],
    entertainment: [{ name: 'No Entertainment', cost: 0 }, { name: 'TV & Console', cost: 20000 }, { name: 'Home Cinema', cost: 60000 }],
    decor: [{ name: 'Simple Decor', cost: 0 }, { name: 'Designer Decor', cost: 10000 }, { name: 'Premium Decor', cost: 30000 }]
  };
  const key = String(req.body?.upgrade || '');
  const level = Number(req.body?.level);
  if (!upgradeCosts[key] || !Number.isInteger(level) || level < 1 || level > 3) return res.status(400).json({ error: 'Choose a valid home upgrade.' });
  const db = readDB();
  const u = db.users.find(x => x.id === req.user.id);
  if (!u) return res.status(404).json({ error: 'Player profile not found.' });
  u.houseUpgrades ||= { bed: 1, kitchen: 1, bathroom: 1, entertainment: 0, decor: 0 };
  const current = Number(u.houseUpgrades[key]) || 0;
  if (level !== current + 1) return res.status(400).json({ error: 'Upgrade one level at a time.' });
  const cost = u.country === 'USA' ? Math.round(upgradeCosts[key][level - 1].cost / 100) : upgradeCosts[key][level - 1].cost;
  if (u.cash < cost) return res.status(400).json({ error: 'Not enough in-game money for this upgrade.' });
  u.cash -= cost;
  u.houseUpgrades[key] = level;
  writeDB(db);
  res.json({ user: publicUser(u), cost, upgrade: key, level });
});

const cashPacks = {
  Nigeria: { starter: { amount: 500000, credit: 250000, currency: 'NGN' }, plus: { amount: 1000000, credit: 600000, currency: 'NGN' }, mega: { amount: 2000000, credit: 1400000, currency: 'NGN' } },
  USA: { starter: { amount: 500, credit: 250000, currency: 'USD' }, plus: { amount: 1000, credit: 600000, currency: 'USD' }, mega: { amount: 2000, credit: 1400000, currency: 'USD' } }
};

app.post('/api/store/checkout', auth, async (req, res) => {
  try {
    const packId = String(req.body?.packId || '');
    const pack = cashPacks[req.user.country]?.[packId];
    if (!pack) return res.status(400).json({ error: 'Unknown cash pack.' });
    const db = readDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'Player account not found.' });
    const reference = `wl4k_${crypto.randomUUID().replaceAll('-', '')}`;
    const frontendUrl = (process.env.FRONTEND_URL || 'https://olalekan-oloto.github.io/WordGame4K').replace(/\/+$/, '');
    let checkoutUrl;
    if (user.country === 'Nigeria') {
      if (!process.env.PAYSTACK_SECRET_KEY) return res.status(503).json({ error: 'Nigeria payments are not configured yet. Add PAYSTACK_SECRET_KEY to the Nigeria server.' });
      const response = await fetch('https://api.paystack.co/transaction/initialize', { method: 'POST', headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, amount: pack.amount, currency: 'NGN', reference, callback_url: `${frontendUrl}/?payment=success`, metadata: { userId: user.id, packId, region: user.country } }) });
      const data = await response.json();
      if (!response.ok || !data.status || !data.data?.authorization_url) return res.status(502).json({ error: data.message || 'Paystack could not start checkout.' });
      checkoutUrl = data.data.authorization_url;
    } else {
      if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'USA payments are not configured yet. Add STRIPE_SECRET_KEY to the USA server.' });
      const form = new URLSearchParams({ mode: 'payment', success_url: `${frontendUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${frontendUrl}/?payment=cancelled`, customer_email: user.email, 'line_items[0][price_data][currency]': 'usd', 'line_items[0][price_data][unit_amount]': String(pack.amount), 'line_items[0][price_data][product_data][name]': `WORLD LIFE 4K ${packId} cash pack`, 'metadata[userId]': user.id, 'metadata[packId]': packId, 'metadata[region]': user.country, client_reference_id: reference });
      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
      const data = await response.json();
      if (!response.ok || !data.url) return res.status(502).json({ error: data.error?.message || 'Stripe could not start checkout.' });
      checkoutUrl = data.url;
    }
    db.transactions.push({ id: reference, userId: user.id, action: 'cash-pack-pending', packId, amount: pack.amount, currency: pack.currency, credit: pack.credit, provider: user.country === 'Nigeria' ? 'paystack' : 'stripe', status: 'pending', at: new Date().toISOString() });
    writeDB(db);
    res.json({ checkoutUrl, reference });
  } catch (error) {
    console.error('Checkout initialization error:', error);
    res.status(500).json({ error: 'Could not start checkout. No game cash was added.' });
  }
});

app.post('/api/store/confirm', auth, async (req, res) => {
  try {
    const reference = String(req.body?.reference || '');
    const sessionId = String(req.body?.sessionId || '');
    const db = readDB();
    let pending;
    let verified = false;
    let metadata = {};
    if (req.user.country === 'Nigeria' && reference && process.env.PAYSTACK_SECRET_KEY) {
      pending = db.transactions.find(t => t.id === reference && t.userId === req.user.id && t.action === 'cash-pack-pending');
      if (!pending) return res.status(404).json({ error: 'Payment reference not found.' });
      const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } });
      const data = await response.json();
      verified = Boolean(response.ok && data.status && data.data?.status === 'success' && Number(data.data.amount) === pending.amount && data.data.currency === 'NGN' && data.data.metadata?.userId === req.user.id && data.data.metadata?.packId === pending.packId);
    } else if (req.user.country === 'USA' && sessionId && process.env.STRIPE_SECRET_KEY) {
      const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } });
      const data = await response.json();
      if (!response.ok) return res.status(502).json({ error: data.error?.message || 'Could not verify Stripe payment.' });
      metadata = data.metadata || {};
      pending = db.transactions.find(t => t.userId === req.user.id && t.action === 'cash-pack-pending' && t.id === data.client_reference_id);
      verified = Boolean(pending && data.payment_status === 'paid' && data.currency === 'usd' && Number(data.amount_total) === pending.amount && metadata.userId === req.user.id && metadata.packId === pending.packId && metadata.region === 'USA');
    }
    if (!pending) return res.status(404).json({ error: 'Pending payment not found. Please contact support if you were charged.' });
    if (pending.status === 'paid') return res.json({ user: publicUser(db.users.find(u => u.id === req.user.id)), credited: pending.credit, alreadyCredited: true });
    if (!verified) return res.status(402).json({ error: 'Payment is not verified as successful. No game cash was credited.' });
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'Player account not found.' });
    user.cash += pending.credit;
    pending.status = 'paid';
    pending.paidAt = new Date().toISOString();
    pending.providerReference = reference || sessionId;
    writeDB(db);
    res.json({ user: publicUser(user), credited: pending.credit });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Payment verification failed. If you were charged, contact support with your receipt.' });
  }
});

app.post('/api/bank', auth, (req, res) => {
const amount = Math.floor(Number(req.body?.amount));
const action = req.body?.action;

if (!Number.isFinite(amount) || amount < 1 || amount > 100000000) {
return res.status(400).json({ error: 'Enter a valid amount.' });
}

const db = readDB();
const u = db.users.find(x => x.id === req.user.id);

if (action === 'deposit') {
if (u.cash < amount) {
return res.status(400).json({ error: 'Not enough cash.' });
}

u.cash -= amount;
u.bank += amount;

} else if (action === 'withdraw') {
if (u.bank < amount) {
return res.status(400).json({ error: 'Not enough bank balance.' });
}

u.bank -= amount;
u.cash += amount;

} else {
return res.status(400).json({ error: 'Invalid bank action.' });
}

db.transactions.push({
id: crypto.randomUUID(),
userId: u.id,
action,
amount,
at: new Date().toISOString()
});

writeDB(db);

res.json({ user: publicUser(u) });
});

app.post('/api/buy', auth, (req, res) => {
const items = {
'Studio Apartment': { price: 25000, key: 'home' },
'Family House': { price: 100000, key: 'home' },
'Compact Car': { price: 18000, key: 'car' },
'Luxury Sedan': { price: 65000, key: 'car' },
'Motorcycle': { price: 6000, key: 'car' }
};

const item = items[String(req.body?.item || '')];

if (!item) {
return res.status(400).json({ error: 'Item not available.' });
}

const db = readDB();
const u = db.users.find(x => x.id === req.user.id);

if (u.cash < item.price) {
return res.status(400).json({ error: 'Not enough in-game cash.' });
}

u.cash -= item.price;
u[item.key] = String(req.body.item);

writeDB(db);

res.json({ user: publicUser(u) });
});

app.post('/api/travel/quote', auth, (req, res) => {
const destination = req.body?.destination;

if (!['Nigeria', 'USA'].includes(destination)) {
return res.status(400).json({ error: 'Unknown destination.' });
}

if (destination === req.user.country) {
return res.status(400).json({
error: 'You are already on this country server.'
});
}

res.json({
destination,
priceUSD: 5,
message: 'Payment provider must be configured before charging real money. No payment has been taken.'
});
});

app.post('/api/travel/confirm', auth, (req, res) => {
res.status(501).json({
error: 'Real-money travel is disabled until a verified payment provider, refund flow, and server-side payment verification are configured. No charge was made.'
});
});

app.get('/api/feed', auth, (req, res) => {
const db = readDB();
res.json({ posts: db.posts.filter(p => p.country === req.user.country).slice(-50).reverse() });
});

app.post('/api/feed', auth, (req, res) => {
const text = String(req.body?.text || '').trim().slice(0, 500);

if (!text) {
return res.status(400).json({ error: 'Write something first.' });
}

const db = readDB();

const post = {
id: crypto.randomUUID(),
userId: req.user.id,
username: req.user.username,
country: req.user.country,
text,
createdAt: new Date().toISOString()
};

db.posts.push(post);
writeDB(db);

res.json({ post });
});

app.get('/api/market', (_, res) => {
res.json({
listings: [
{ id: 'm1', title: 'Studio Apartment', category: 'Property', price: 25000, currency: 'game cash' },
{ id: 'm2', title: 'Compact Car', category: 'Vehicles', price: 18000, currency: 'game cash' },
{ id: 'm3', title: 'Motorcycle', category: 'Vehicles', price: 6000, currency: 'game cash' },
{ id: 'm4', title: 'Family House', category: 'Property', price: 100000, currency: 'game cash' },
{ id: 'm5', title: 'Luxury Sedan', category: 'Vehicles', price: 65000, currency: 'game cash' }
]
});
});

// Socket.IO authentication
io.use((socket, next) => {
const token = socket.handshake.auth?.token;
const userId = sessions.get(token);

if (!userId) {
return next(new Error('Authentication required'));
}

const db = readDB();
const user = db.users.find(u => u.id === userId);

if (!user) {
return next(new Error('Account not found'));
}

socket.data.player = {
userId,
player: {
id: user.id,
username: user.username,
country: user.country,
state: user.state,
city: user.city,
level: user.level
}
};

next();
});

io.on('connection', socket => {
onlineSockets.set(socket.id, socket.data.player);

io.emit('world:presence', {
players: [
...new Map(
[...onlineSockets.values()].map(x => [x.userId, x.player])
).values()
]
});

socket.on('world:position', position => {
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return;
    const player = socket.data.player.player;
    worldPositions.set(player.id, {
      id: player.id, username: player.username, country: player.country,
      city: player.city, x: Math.max(-40, Math.min(40, position.x)),
      z: Math.max(-78, Math.min(78, position.z)),
      yaw: Number.isFinite(position.yaw) ? position.yaw : 0,
      updatedAt: Date.now()
    });
    // Broadcast only to players in the same country/city; regional isolation is enforced here.
    const room = `${player.country}:${player.city}`;
    socket.join(room);
    io.to(room).emit('world:positions', {
      players: [...worldPositions.values()].filter(p =>
        p.country === player.country && p.city === player.city &&
        Date.now() - p.updatedAt < 10000
      )
    });
  });

  socket.on('world:ping', () => {
socket.emit('world:pong', Date.now());
});

socket.on('disconnect', () => {
onlineSockets.delete(socket.id);

io.to(socket.data.player.player.country).emit('world:presence', {
  players: [
    ...new Map(
      [...onlineSockets.values()].filter(x => x.player.country === socket.data.player.player.country).map(x => [x.userId, x.player])
    ).values()
  ]
});

});
});

const dist = path.join(__dirname, '..', 'dist');

if (fs.existsSync(path.join(dist, 'index.html'))) {
app.use(express.static(dist, { index: false, maxAge: '1h' }));

app.get('/api/*', (_req, res) => {
res.status(404).json({ error: 'API route not found.' });
});

app.get('*', (_req, res, next) => {
res.sendFile(path.join(dist, 'index.html'), err => {
if (err) next(err);
});
});
}

server.listen(PORT, '0.0.0.0', () => {
console.log(`WORLD LIFE 4K listening on port ${PORT}`);
});
