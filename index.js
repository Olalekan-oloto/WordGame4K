import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: false } });
const PORT = process.env.PORT || 3001;
const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'world.json');
fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({ users: [], messages: [], posts: [], listings: [], transactions: [], sessions: [] }, null, 2));
const readDB = () => { const db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); for (const k of ['users','messages','posts','listings','transactions','sessions']) if (!Array.isArray(db[k])) db[k] = []; return db; };
const writeDB = db => { const tmp = dbPath + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, dbPath); };
const sessions = new Map(readDB().sessions.map(s => [s.token, s.userId]));
const onlineSockets = new Map();
app.use(express.json({ limit: '32kb' }));
// Lightweight per-process throttling for prototype auth endpoints. Use a managed
// rate limiter and persistent database before opening a large public launch.
const authAttempts = new Map();
app.use(['/api/register', '/api/login'], (req, res, next) => {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const recent = (authAttempts.get(key) || []).filter(t => now - t < 60_000);
  if (recent.length >= 20) return res.status(429).json({ error: 'Too many sign-in attempts. Please wait a minute and try again.' });
  recent.push(now); authAttempts.set(key, recent); next();
});

const nigeriaStates = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara','Federal Capital Territory'];
const usStates = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming','District of Columbia'];
const cities = {
  Nigeria: ['Lagos','Abuja','Kano','Ibadan','Port Harcourt','Benin City','Enugu','Calabar','Jos','Abeokuta','Warri','Uyo','Kaduna','Owerri','Ilorin'],
  USA: ['New York City','Los Angeles','Chicago','Houston','Phoenix','Philadelphia','San Antonio','San Diego','Dallas','Austin','Miami','Atlanta','Seattle','Boston','Denver']
};
const publicUser = u => ({ id: u.id, username: u.username, country: u.country, state: u.state, city: u.city, cash: u.cash, bank: u.bank, level: u.level, job: u.job, home: u.home, car: u.car, createdAt: u.createdAt });
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const userId = sessions.get(token);
  if (!userId) return res.status(401).json({ error: 'Please sign in again.' });
  const db = readDB(); req.user = db.users.find(u => u.id === userId);
  if (!req.user) return res.status(401).json({ error: 'Account not found.' });
  next();
}
app.get('/api/health', (_, res) => res.json({ ok: true, name: 'WORLD LIFE 4K API' }));
app.get('/api/world', (_, res) => res.json({ countries: ['Nigeria','USA'], states: { Nigeria: nigeriaStates, USA: usStates }, cities }));
app.post('/api/register', async (req, res) => {
  const { username, email, password, country, state, city } = req.body || {};
  if (!username || !email || !password || !country || !state || !city) return res.status(400).json({ error: 'Complete every field.' });
  if (!/^[a-zA-Z0-9_ .-]{3,24}$/.test(String(username).trim())) return res.status(400).json({ error: 'Player name must be 3–24 characters and use letters, numbers, spaces, dots, dashes or underscores.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (!['Nigeria','USA'].includes(country)) return res.status(400).json({ error: 'Choose Nigeria or USA.' });
  const db = readDB();
  if (db.users.some(u => u.email.toLowerCase() === String(email).toLowerCase() || u.username.toLowerCase() === String(username).toLowerCase())) return res.status(409).json({ error: 'Email or username already exists.' });
  const user = { id: crypto.randomUUID(), username: String(username).slice(0,24), email: String(email).toLowerCase(), passwordHash: await bcrypt.hash(password, 10), country, state, city, cash: country === 'Nigeria' ? 50000 : 5000, bank: 0, level: 1, job: 'Unemployed', home: 'No home yet', car: 'On foot', createdAt: new Date().toISOString() };
  db.users.push(user); writeDB(db);
  const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, user.id); db.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() }); writeDB(db);
  res.json({ token, user: publicUser(user) });
});
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {}; const db = readDB();
  const user = db.users.find(u => u.email === String(email || '').toLowerCase());
  if (!user || !await bcrypt.compare(password || '', user.passwordHash)) return res.status(401).json({ error: 'Incorrect email or password.' });
  const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, user.id); db.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() }); writeDB(db);
  res.json({ token, user: publicUser(user) });
});
app.get('/api/me', auth, (req,res) => res.json({ user: publicUser(req.user) }));
app.post('/api/logout', auth, (req,res) => { const token = (req.headers.authorization || '').replace(/^Bearer /, ''); sessions.delete(token); const db = readDB(); db.sessions = db.sessions.filter(s => s.token !== token); writeDB(db); for (const [sid, info] of onlineSockets) if (info.userId === req.user.id) io.sockets.sockets.get(sid)?.disconnect(true); res.json({ ok: true }); });
app.get('/api/players/online', auth, (req,res) => { const seen = new Map(); for (const info of onlineSockets.values()) if (info.userId !== req.user.id) seen.set(info.userId, info.player); res.json({ players: [...seen.values()] }); });
app.get('/api/messages', auth, (req,res) => {
  const db = readDB(); res.json({ messages: db.messages.slice(-100).map(m => ({ ...m, mine: m.userId === req.user.id })) });
});
app.post('/api/messages', auth, (req,res) => {
  const text = String(req.body?.text || '').trim().slice(0,500);
  if (!text) return res.status(400).json({ error: 'Message cannot be empty.' });
  const db = readDB(); const message = { id: crypto.randomUUID(), userId: req.user.id, username: req.user.username, country: req.user.country, text, createdAt: new Date().toISOString() };
  db.messages.push(message); writeDB(db); io.emit('chat:message', message); res.json({ message });
});
app.post('/api/work', auth, (req,res) => {
  const jobs = { 'Delivery Rider': 1800, 'Shop Assistant': 2200, 'Software Developer': 5000, 'Taxi Driver': 2500, 'Real Estate Agent': 3500, 'Security Officer': 2000 };
  const job = String(req.body?.job || '');
  if (!jobs[job]) return res.status(400).json({ error: 'Choose a listed job.' });
  const db = readDB(), u = db.users.find(x => x.id === req.user.id);
  u.job = job; u.cash += jobs[job]; u.level += 1; writeDB(db);
  res.json({ user: publicUser(u), earned: jobs[job] });
});
app.post('/api/bank', auth, (req,res) => {
  const amount = Math.floor(Number(req.body?.amount)); const action = req.body?.action;
  if (!Number.isFinite(amount) || amount < 1 || amount > 100000000) return res.status(400).json({ error: 'Enter a valid amount.' });
  const db = readDB(), u = db.users.find(x => x.id === req.user.id);
  if (action === 'deposit') { if (u.cash < amount) return res.status(400).json({ error: 'Not enough cash.' }); u.cash -= amount; u.bank += amount; }
  else if (action === 'withdraw') { if (u.bank < amount) return res.status(400).json({ error: 'Not enough bank balance.' }); u.bank -= amount; u.cash += amount; }
  else return res.status(400).json({ error: 'Invalid bank action.' });
  db.transactions.push({ id: crypto.randomUUID(), userId: u.id, action, amount, at: new Date().toISOString() }); writeDB(db); res.json({ user: publicUser(u) });
});
app.post('/api/buy', auth, (req,res) => {
  const items = { 'Studio Apartment': {price: 25000, key:'home'}, 'Family House': {price: 100000, key:'home'}, 'Compact Car': {price: 18000, key:'car'}, 'Luxury Sedan': {price: 65000, key:'car'}, 'Motorcycle': {price: 6000, key:'car'} };
  const item = items[String(req.body?.item || '')];
  if (!item) return res.status(400).json({ error: 'Item not available.' });
  const db = readDB(), u = db.users.find(x => x.id === req.user.id);
  if (u.cash < item.price) return res.status(400).json({ error: 'Not enough in-game cash.' });
  u.cash -= item.price; u[item.key] = String(req.body.item); writeDB(db); res.json({ user: publicUser(u) });
});
app.post('/api/travel/quote', auth, (req,res) => {
  const destination = req.body?.destination;
  if (!['Nigeria','USA'].includes(destination)) return res.status(400).json({ error: 'Unknown destination.' });
  if (destination === req.user.country) return res.status(400).json({ error: 'You are already on this country server.' });
  res.json({ destination, priceUSD: 5, message: 'Payment provider must be configured before charging real money. No payment has been taken.' });
});
app.post('/api/travel/confirm', auth, (req,res) => res.status(501).json({ error: 'Real-money travel is disabled until a verified payment provider, refund flow, and server-side payment verification are configured. No charge was made.' }));
app.get('/api/feed', auth, (req,res) => { const db = readDB(); res.json({ posts: db.posts.slice(-50).reverse() }); });
app.post('/api/feed', auth, (req,res) => {
  const text = String(req.body?.text || '').trim().slice(0,500);
  if (!text) return res.status(400).json({ error: 'Write something first.' });
  const db = readDB(); const post = { id: crypto.randomUUID(), userId: req.user.id, username: req.user.username, country: req.user.country, text, createdAt: new Date().toISOString() }; db.posts.push(post); writeDB(db); res.json({ post });
});
app.get('/api/market', (_,res) => res.json({ listings: [
  { id:'m1', title:'Studio Apartment', category:'Property', price:25000, currency:'game cash' },
  { id:'m2', title:'Compact Car', category:'Vehicles', price:18000, currency:'game cash' },
  { id:'m3', title:'Motorcycle', category:'Vehicles', price:6000, currency:'game cash' },
  { id:'m4', title:'Family House', category:'Property', price:100000, currency:'game cash' },
  { id:'m5', title:'Luxury Sedan', category:'Vehicles', price:65000, currency:'game cash' }
] }));
io.use((socket, next) => { const token = socket.handshake.auth?.token; const userId = sessions.get(token); if (!userId) return next(new Error('Authentication required')); const db = readDB(); const user = db.users.find(u => u.id === userId); if (!user) return next(new Error('Account not found')); socket.data.player = { userId, player: { id: user.id, username: user.username, country: user.country, state: user.state, city: user.city, level: user.level } }; next(); });
io.on('connection', socket => { onlineSockets.set(socket.id, socket.data.player); io.emit('world:presence', { players: [...new Map([...onlineSockets.values()].map(x => [x.userId, x.player])).values()] }); socket.on('world:ping', () => socket.emit('world:pong', Date.now())); socket.on('disconnect', () => { onlineSockets.delete(socket.id); io.emit('world:presence', { players: [...new Map([...onlineSockets.values()].map(x => [x.userId, x.player])).values()] }); }); });
const dist = path.join(__dirname, '..', 'dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get('/api/*', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  app.get('*', (_req, res, next) => {
    res.sendFile(path.join(dist, 'index.html'), err => { if (err) next(err); });
  });
}
server.listen(PORT, '0.0.0.0', () => console.log(`WORLD LIFE 4K listening on port ${PORT}`));
