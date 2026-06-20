import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

const app = express();

// Dynamic Port selection for Render environment binding
const PORT = process.env.PORT || 5000; 
const JWT_SECRET = process.env.JWT_SECRET || "venom_secret_key_98765"; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'database.json');

// Full CORS Configuration + Headers Whitelisting
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Explicit Preflight Handler for OPTIONS Requests
app.options('*', cors()); 

app.use(express.json());

// Helper to safely read database records
function readDatabase() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const initialStructure = { players: [], testers: [], pendingApprovals: [], backups: [] };
      fs.writeFileSync(DB_PATH, JSON.stringify(initialStructure, null, 2));
      return initialStructure;
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (error) {
    console.error("Database read error:", error);
    return { players: [], testers: [], pendingApprovals: [], backups: [] };
  }
}

// Helper to safely write database records
function writeDatabase(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error("Database write error:", error);
    return false;
  }
}

// Middleware to authorize session requests securely
function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1] || req.headers['authorization'];
  if (!token) return res.status(401).json({ message: "Access Token Required" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Session expired or invalid" });
    req.user = user;
    next();
  });
}

// Public: Get Players
app.get('/api/players', (req, res) => {
  const db = readDatabase();
  res.json(db.players || []);
});

// Expanded Auth route paths to capture both styles of requests cleanly
app.post(['/api/auth', '/api/auth/login'], (req, res) => {
  const { username, password } = req.body;
  const db = readDatabase();

  if (username === 'owner' && password === 'owner123') {
    const token = jwt.sign({ username: 'owner', role: 'owner' }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ success: true, role: 'owner', token });
  }

  const tester = (db.testers || []).find(t => t.username === username && t.password === password);
  if (tester) {
    const token = jwt.sign({ username: tester.username, role: 'tester' }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ success: true, role: 'tester', token });
  }

  res.status(401).json({ success: false, message: "Invalid system credentials" });
});

// Mutate Players Route
app.post('/api/players/mutate', authenticateToken, (req, res) => {
  try {
    const db = readDatabase();
    const incomingPlayers = req.body.players;
    const description = req.body.description || "Manual override modification";
    
    if (!Array.isArray(incomingPlayers)) {
      return res.status(400).json({ message: "Invalid configuration format." });
    }

    if (req.user.role === 'owner') {
      db.players = incomingPlayers;
      db.backups = db.backups || [];
      db.backups.push({ 
        id: Date.now().toString(), 
        timestamp: Date.now(), 
        description, 
        state: JSON.parse(JSON.stringify(incomingPlayers)) 
      });
      if (db.backups.length > 24) db.backups.shift();
      writeDatabase(db);
      return res.json({ message: "Changes permanently committed to platform databases!" });
    } else {
      const currentBackupState = JSON.parse(JSON.stringify(db.players));
      db.pendingApprovals = db.pendingApprovals || [];
      db.pendingApprovals.push({ 
        id: Date.now().toString(), 
        timestamp: Date.now(), 
        by: req.user.username, 
        description, 
        proposedState: incomingPlayers, 
        previousState: currentBackupState 
      });
      
      db.players = incomingPlayers;
      writeDatabase(db);
      return res.json({ message: "Changes are now live! Added to approval queue pipeline." });
    }
  } catch (error) { 
    console.error(error);
    res.status(500).json({ message: "Mutation channel exception." }); 
  }
});

// Admin System Node Telemetry Readout
app.get('/api/admin/system', authenticateToken, (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ message: "Access Denied" });
  const db = readDatabase();
  res.json({ 
    testers: db.testers || [], 
    pendingApprovals: db.pendingApprovals || [], 
    backups: db.backups || [] 
  });
});

// Control Matrix Dispatch Actions
app.post('/api/admin/action', authenticateToken, (req, res) => {
  try {
    const db = readDatabase();
    const { actionType, payload } = req.body;
    if (req.user.role !== 'owner') return res.status(403).json({ message: "Access Denied" });

    switch (actionType) {
      case 'addTester':
        db.testers = db.testers || [];
        if (db.testers.some(t => t.username === payload.username)) {
          return res.status(400).json({ message: "Tester already exists" });
        }
        db.testers.push({ username: payload.username, password: payload.password });
        break;
      case 'removeTester':
        db.testers = (db.testers || []).filter(t => t.username !== payload.username);
        break;
      case 'approve':
        db.pendingApprovals = (db.pendingApprovals || []).filter(x => x.id !== payload.id);
        break;
      case 'reject':
        const rejected = (db.pendingApprovals || []).find(x => x.id === payload.id);
        if (rejected?.previousState) db.players = rejected.previousState;
        db.pendingApprovals = (db.pendingApprovals || []).filter(x => x.id !== payload.id);
        break;
      case 'rollback':
        const backupPoint = (db.backups || []).find(x => x.id === payload.id);
        if (backupPoint) db.players = backupPoint.state;
        break;
      case 'clearAllBackups':
        if (db.backups && db.backups.length > 0) {
          db.players = db.backups[0].state; 
        }
        db.backups = [];
        db.pendingApprovals = [];
        break;
      default:
        return res.status(400).json({ message: "Unknown action path directive." });
    }
    writeDatabase(db);
    res.json({ success: true, message: "Action successfully updated system database entries." });
  } catch (error) { 
    console.error(error);
    res.status(500).json({ message: "Server action processing exception." }); 
  }
});

// BACKGROUND PROCESS: Evaluate 8-hour live tester verification TTL blocks
setInterval(() => {
  try {
    const db = readDatabase();
    let changed = false;
    if (db.pendingApprovals?.length > 0) {
      const expired = db.pendingApprovals.filter(req => (Date.now() - req.timestamp) >= 8 * 60 * 60 * 1000);
      if (expired.length > 0) {
        for (const item of expired.reverse()) { 
          if (item.previousState) db.players = item.previousState; 
        }
        db.pendingApprovals = db.pendingApprovals.filter(req => (Date.now() - req.timestamp) < 8 * 60 * 60 * 1000);
        changed = true;
      }
    }
    if (changed) writeDatabase(db);
  } catch (err) {
    console.error("TTL thread processing fault caught safely:", err);
  }
}, 60000);

// Bind network interface listener directly to global tracking address 0.0.0.0
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Venom Service Engine active on port ${PORT}`);
});
