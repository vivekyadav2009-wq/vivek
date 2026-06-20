import './style.css';

// FIX 1: Dynamic URL selection reading Vercel variables or falling back to local simulation
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
let originalPlayersState = []; 
let players = [];
let systemData = { testers: [], pendingApprovals: [], backups: [] };
let currentView = 'overall'; 
let adminSubView = 'players'; 
let selectedGamemode = 'vanilla';
let userRole = null; 
let pollInterval = null;

const tierPoints = { HT1: 60, LT1: 45, HT2: 40, LT2: 20, HT3: 10, LT3: 6, HT4: 4, LT4: 3, HT5: 2, LT5: 1 };
const gamemodes = ['vanilla', 'uhc', 'pot', 'nethop', 'smp', 'sword', 'axe', 'mace'];

function computePoints(player) {
  return Object.values(player.tiers).reduce((sum, tier) => sum + (tierPoints[tier] || 0), 0);
}

function initTheme() {
  const savedTheme = localStorage.getItem('venomTheme') || 'dark';
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

function toggleTheme() {
  if (document.documentElement.classList.contains('dark')) {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('venomTheme', 'light');
  } else {
    document.documentElement.classList.add('dark');
    localStorage.setItem('venomTheme', 'dark');
  }
}

async function fetchPlayers() {
  try {
    const res = await fetch(`${API_URL}/players`);
    if (!res.ok) throw new Error();
    players = await res.json();
    players.forEach(p => { p.points = computePoints(p); });
    originalPlayersState = JSON.parse(JSON.stringify(players));
  } catch (err) {
    console.error("Failed to fetch players:", err);
  }
}

async function fetchSystemData() {
  try {
    const token = sessionStorage.getItem('venomToken');
    if (!token || userRole !== 'owner') return;
    // FIX 2A: Sending token formatted securely with standard Bearer syntax scheme
    const res = await fetch(`${API_URL}/admin/system`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      systemData = { testers: data.testers || [], pendingApprovals: data.pendingApprovals || [], backups: data.backups || [] };
    }
  } catch (err) {
    console.error("Failed to fetch system data:", err);
  }
}

function startLivePolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(async () => {
    if (currentView === 'admin' && userRole === 'owner') {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT')) {
        return; 
      }

      await fetchPlayers();
      await fetchSystemData();
      renderOnlyDynamicContainers();
    }
  }, 5000);
}

window.addEventListener('hashchange', () => {
  currentView = window.location.hash === '#/adminabuse' ? (userRole ? 'admin' : 'login') : 'overall';
  render();
});

async function init() {
  initTheme();
  showLoadingScreen(); 
  await fetchPlayers();
  currentView = window.location.hash === '#/adminabuse' ? (userRole ? 'admin' : 'login') : 'overall';
  setTimeout(() => { hideLoadingScreen(); render(); startLivePolling(); }, 1200);
}

function showLoadingScreen() {
  let loader = document.getElementById('loading-overlay');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'loading-overlay';
    loader.className = 'fixed inset-0 bg-slate-950 z-50 flex flex-col items-center justify-center font-mono select-none overflow-hidden';
    loader.innerHTML = `
      <div class="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]"></div>
      <div class="relative flex flex-col items-center gap-6 z-10">
        <div class="relative w-20 h-20">
          <div class="absolute inset-0 rounded-full border-2 border-blue-500/10"></div>
          <div class="absolute inset-0 rounded-full border-2 border-t-blue-500 border-r-purple-500 animate-spin" style="animation-duration: 1s;"></div>
          <div class="absolute inset-2 rounded-full border border-dashed border-cyan-500/30 animate-spin" style="animation-duration: 3s; animation-direction: reverse;"></div>
        </div>
        <div class="text-center space-y-1">
          <h2 class="text-xs font-black tracking-[0.3em] bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent uppercase">VENOM TIERLIST</h2>
          <p class="text-[9px] text-slate-500 uppercase tracking-widest font-bold animate-pulse">Synchronizing Grid Cores...</p>
        </div>
      </div>
    `;
    document.body.appendChild(loader);
  }
}

function hideLoadingScreen() { document.getElementById('loading-overlay')?.remove(); }

function render() {
  const app = document.getElementById('app');
  if (!app) return;
  
  app.innerHTML = `
    <header class="glass sticky top-0 z-40 px-6 py-4 flex justify-between items-center bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-900/50">
      <div class="cursor-pointer" id="logoBtn">
        <h1 class="text-xl font-black bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent tracking-tight">VENOM TIERLIST</h1>
        <p class="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">The Official 1.9+ PvP Tierlist</p>
      </div>
      <div class="flex items-center gap-3">
        <button id="themeToggle" class="p-2 text-sm bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-xl hover:scale-105 transition">🌓</button>
        <a href="https://discord.gg/aznmtaHXYV" target="_blank" class="bg-blue-600 text-white px-4 py-2 text-xs font-bold rounded-xl tracking-wide hover:bg-blue-500 shadow-md shadow-blue-600/20 transition">Join Discord</a>
      </div>
    </header>
    <main class="max-w-7xl mx-auto px-4 py-8">${renderSubView()}</main>
    <div id="globalModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 hidden flex items-center justify-center p-4 transition-opacity duration-150 opacity-0"></div>
  `;

  document.getElementById('logoBtn').addEventListener('click', () => { window.location.hash = ''; currentView = 'overall'; render(); });
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  attachViewEventListeners();
}

function renderOnlyDynamicContainers() {
  const container = document.getElementById('adminPanelContainer');
  if (!container) return;
  if (adminSubView === 'testers') container.innerHTML = renderAdminTesters();
  else if (adminSubView === 'queue') container.innerHTML = renderAdminQueue();
  else if (adminSubView === 'rollback') container.innerHTML = renderAdminRollback();
  else container.innerHTML = renderAdminPlayers();
  rebindDynamicEvents();
}

function renderSubView() {
  if (currentView === 'login') return renderLoginView();
  if (currentView === 'admin') return renderAdminView();
  return `
    <div class="flex flex-col md:flex-row gap-4 justify-between items-center mb-8 bg-slate-200/50 dark:bg-slate-900/40 p-2 rounded-2xl border border-slate-300 dark:border-slate-800/50">
      <div class="flex p-1 bg-white dark:bg-slate-950 rounded-xl w-full md:w-auto">
        <button id="tab-overall" class="px-5 py-2 rounded-lg font-bold text-xs ${currentView === 'overall' ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}">Overall</button>
        <button id="tab-gamemodes" class="px-5 py-2 rounded-lg font-bold text-xs ${currentView === 'gamemode' ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}">Gamemodes</button>
      </div>
      <input type="text" id="searchBar" placeholder="Search Players..." class="p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs w-full md:w-72 text-slate-900 dark:text-white outline-none focus:border-blue-500 dark:focus:border-blue-500 transition">
    </div>
    ${currentView === 'gamemode' ? `
      <div class="flex justify-center gap-3 flex-wrap mb-8 p-3 glass rounded-2xl border border-slate-300 dark:border-slate-800">
        ${gamemodes.map(mode => `
          <button data-mode="${mode}" class="mode-btn p-2 rounded-xl transition ${selectedGamemode === mode ? 'bg-blue-500/10 border border-blue-500/40 scale-105' : 'opacity-60'}">
            <img src="https://mctiers.com/tier_icons/${mode}.svg" onerror="this.onerror=null; this.src='https://api.dicebear.com/7.x/identicon/svg?seed=${mode}';" class="w-8 h-8 object-contain">
          </button>
        `).join('')}
      </div>
    ` : ''}
    <div id="viewContainer">${currentView === 'overall' ? renderOverallList() : renderGamemodeMatrix()}</div>
  `;
}

function renderOverallList() {
  const sorted = [...players].sort((a, b) => b.points - a.points);
  return `
    <div class="space-y-3">
      ${sorted.map((p, idx) => {
        let rankBadge = `<span class="font-mono text-slate-400 dark:text-slate-500 text-xs w-6">#${idx + 1}</span>`;
        if (idx === 0) rankBadge = `<span class="text-lg w-6 flex items-center justify-center animate-bounce">🥇</span>`;
        if (idx === 1) rankBadge = `<span class="text-lg w-6 flex items-center justify-center">🥈</span>`;
        if (idx === 2) rankBadge = `<span class="text-lg w-6 flex items-center justify-center">🥉</span>`;

        return `
          <div class="glass p-5 flex items-center justify-between rounded-2xl player-row border border-slate-200 dark:border-slate-800/60 cursor-pointer transition-all duration-300 hover:translate-x-1.5 hover:border-blue-500/40 hover:bg-slate-100/30 dark:hover:bg-slate-900/40 shadow-sm" data-name="${p.name}">
            <div class="flex items-center gap-4 min-w-0">
              ${rankBadge}
              <img src="https://mc-heads.net/avatar/${p.name}" class="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 pointer-events-none" />
              <div>
                <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 group-hover:text-blue-500 transition-colors duration-150">${p.name}</h3>
                <div class="flex flex-wrap gap-2 mt-2">
                  ${Object.entries(p.tiers).map(([mode, tier]) => `
                    <span class="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 px-2.5 py-1 text-[11px] border border-slate-200 dark:border-slate-800 font-semibold uppercase">
                      <img src="https://mctiers.com/tier_icons/${mode}.svg" class="w-3.5 h-3.5 object-contain opacity-80">
                      <span class="text-blue-500 dark:text-blue-400 font-bold font-mono">${tier}</span>
                    </span>
                  `).join('')}
                </div>
              </div>
            </div>
            <div class="text-right"><span class="text-emerald-500 dark:text-emerald-400 font-black text-lg font-mono">${p.points}</span></div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderGamemodeMatrix() {
  const structuralTiers = ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5'];
  const matrix = { 'Tier 1': [], 'Tier 2': [], 'Tier 3': [], 'Tier 4': [], 'Tier 5': [] };
  players.forEach(p => {
    const rawTier = p.tiers[selectedGamemode];
    if (!rawTier) return;
    const cleanRank = rawTier.includes('1') ? 'Tier 1' : rawTier.includes('2') ? 'Tier 2' : rawTier.includes('3') ? 'Tier 3' : rawTier.includes('4') ? 'Tier 4' : 'Tier 5';
    matrix[cleanRank].push({ name: p.name, raw: rawTier });
  });
  return `
    <div class="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
      ${structuralTiers.map(tKey => `
        <div class="glass rounded-xl p-3">
          <h3 class="font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-200 dark:border-slate-800 pb-1">${tKey} (${matrix[tKey].length})</h3>
          <ul class="space-y-1.5">
            ${matrix[tKey].map(item => `
              <li class="p-2 rounded-lg flex items-center gap-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer transition-all duration-200 hover:translate-x-1 hover:border-blue-500/40 player-row" data-name="${item.name}">
                <img src="https://mc-heads.net/avatar/${item.name}" class="w-5 h-5 rounded pointer-events-none">
                <span class="truncate flex-1 text-slate-700 dark:text-slate-300 font-semibold">${item.name}</span>
                <span class="text-[9px] px-1 rounded bg-blue-500/10 text-blue-500 dark:text-blue-400 font-bold font-mono">${item.raw}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `).join('')}
    </div>
  `;
}

function renderLoginView() {
  return `<form id="loginForm" class="max-w-sm mx-auto space-y-4 p-8 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-900 shadow-xl"><div class="text-center space-y-1"><h2 class="text-xs font-black tracking-widest text-blue-500 uppercase">ACCESS DECRYPTOR</h2><p class="text-[11px] text-slate-400 font-medium">Verify system architecture identity tokens</p></div><input type="text" id="loginUser" placeholder="NODE IDENTITY LOG" required class="w-full p-3 bg-slate-100/70 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono outline-none focus:border-blue-500"><input type="password" id="loginPass" placeholder="SECURITY DEPLOYMENT ACCESS" required class="w-full p-3 bg-slate-100/70 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono outline-none focus:border-blue-500"><button type="submit" class="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:opacity-90 transition">PROCEED SYNC</button></form>`;
}

function renderAdminView() {
  const isOwner = userRole === 'owner';
  return `
    <div class="p-8 bg-slate-100/50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-900/80 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8 relative overflow-hidden shadow-inner">
      <div class="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-blue-500/10 to-purple-500/0 rounded-full blur-2xl pointer-events-none"></div>
      <div>
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <h2 class="text-[10px] font-mono font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Mainframe Operations Console</h2>
        </div>
        <h1 class="text-xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
          ${isOwner ? '👑 SYSTEM ARCHITECT' : '🛠️ NODE OPERATOR'} <span class="text-xs font-mono font-normal opacity-40">v4.0.2-live</span>
        </h1>
      </div>
      
      <div class="flex flex-wrap gap-1.5 p-1 bg-white dark:bg-slate-900 rounded-2xl w-full lg:w-auto border border-slate-200/60 dark:border-slate-800/60">
        <button id="adminTabPlayers" class="px-4 py-2 rounded-xl text-xs font-bold uppercase transition ${adminSubView === 'players' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'}">Rosters</button>
        ${isOwner ? `
          <button id="adminTabTesters" class="px-4 py-2 rounded-xl text-xs font-bold uppercase transition ${adminSubView === 'testers' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'}">Staff Keys</button>
          <button id="adminTabQueue" class="px-4 py-2 rounded-xl text-xs font-bold uppercase transition ${adminSubView === 'queue' ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'}">Approvals Queue</button>
          <button id="adminTabRollback" class="px-4 py-2 rounded-xl text-xs font-bold uppercase transition ${adminSubView === 'rollback' ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'}">Snapshots</button>
        ` : ''}
        <button id="saveDbBtn" class="ml-auto lg:ml-4 px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-xs rounded-xl uppercase tracking-wider shadow-lg shadow-emerald-500/10 hover:opacity-95 transition">Commit Pipeline</button>
      </div>
    </div>

    ${adminSubView === 'players' ? `
      <div class="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <button id="addPlayerBtn" class="px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 text-xs uppercase font-black tracking-wide shadow-sm hover:border-slate-400 dark:hover:border-slate-700 transition">➕ Provision Entry</button>
        <input type="text" id="adminSearchBar" placeholder="Filter active matrix instances..." class="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white w-full sm:w-72 outline-none focus:border-blue-500 transition">
      </div>
    ` : ''}

    <div id="adminPanelContainer" class="transition-all duration-300">${adminSubView === 'testers' && isOwner ? renderAdminTesters() : adminSubView === 'queue' && isOwner ? renderAdminQueue() : adminSubView === 'rollback' && isOwner ? renderAdminRollback() : renderAdminPlayers()}</div>
  `;
}

function updateAdminTabsUI() {
  const tabs = {
    players: { id: 'adminTabPlayers', activeClass: 'bg-blue-600 text-white shadow-md shadow-blue-600/20' },
    testers: { id: 'adminTabTesters', activeClass: 'bg-blue-600 text-white shadow-md shadow-blue-600/20' },
    queue: { id: 'adminTabQueue', activeClass: 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20' },
    rollback: { id: 'adminTabRollback', activeClass: 'bg-purple-600 text-white shadow-md shadow-purple-600/20' }
  };

  Object.entries(tabs).forEach(([viewKey, config]) => {
    const btn = document.getElementById(config.id);
    if (!btn) return;
    if (adminSubView === viewKey) {
      btn.className = `px-4 py-2 rounded-xl text-xs font-bold uppercase transition ${config.activeClass}`;
    } else {
      btn.className = `px-4 py-2 rounded-xl text-xs font-bold uppercase transition text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50`;
    }
  });
}

function renderAdminPlayers() {
  return `<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">${players.map(p => `<div class="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl flex justify-between items-center text-xs admin-player-row cursor-pointer group hover:border-blue-500/50 hover:translate-y-[-2px] transition-all duration-200 shadow-sm" data-name="${p.name}"><div class="flex items-center gap-3"><img src="https://mc-heads.net/avatar/${p.name}" class="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 pointer-events-none"><span class="font-mono font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-400 transition-colors duration-150">${p.name}</span></div>${userRole === 'owner' ? `<button class="delete-player-btn text-[10px] text-red-500 font-bold opacity-0 group-hover:opacity-100 transition duration-150 uppercase tracking-wide px-2 py-1 bg-red-500/10 rounded-md border border-red-500/20 hover:bg-red-500 hover:text-white" data-name="${p.name}">Purge</button>` : ''}</div>`).join('')}</div>`;
}

function renderAdminTesters() {
  return `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 shadow-sm">
        <h3 class="text-xs font-black tracking-widest text-slate-400 uppercase mb-2">Registered Testing Node Directory</h3>
        ${systemData.testers.length === 0 ? '<p class="text-xs font-mono text-slate-500 italic py-4 text-center">No authorized staff nodes provisioned.</p>' : ''}
        ${systemData.testers.map(t => `<div class="flex justify-between items-center p-3.5 bg-slate-100/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/50 rounded-xl font-mono text-xs"><span class="font-bold text-slate-800 dark:text-slate-300">${t.username}</span><button class="remove-tester-btn bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-600 hover:text-white px-3 py-1 rounded-lg uppercase text-[10px] tracking-wider transition" data-username="${t.username}">Revoke Access</button></div>`).join('')}
      </div>
      <div class="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl h-fit shadow-sm">
        <h3 class="text-xs font-black tracking-widest text-slate-400 uppercase mb-4">Provision Operational Node</h3>
        <form id="createTesterForm" class="space-y-3">
          <input type="text" id="testerUser" placeholder="Assign Username Token" required class="w-full p-2.5 bg-slate-100/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white outline-none font-mono focus:border-blue-500">
          <input type="password" id="testerPass" placeholder="Assign Security Password" required class="w-full p-2.5 bg-slate-100/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white outline-none font-mono focus:border-blue-500">
          <button type="submit" class="w-full py-2.5 bg-blue-600 text-white text-xs font-black uppercase rounded-xl tracking-wider shadow-md hover:bg-blue-500 transition">Inject Config Credentials</button>
        </form>
      </div>
    </div>
  `;
}

function renderAdminQueue() {
  return `
    <div class="max-w-2xl mx-auto p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
      <div class="border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
        <h3 class="text-xs font-black tracking-widest uppercase text-cyan-500">Sandbox Log Verification Stream</h3>
        <p class="text-[11px] text-slate-500 font-medium">Unverified tester logs drop off live lists and auto-expire after 8 hours.</p>
      </div>
      <div class="space-y-3">
        ${systemData.pendingApprovals.length === 0 ? '<div class="text-center py-10 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl"><p class="text-xs text-slate-500 italic font-mono">Data pipeline clear.</p></div>' : ''}
        ${systemData.pendingApprovals.map(req => `
          <div class="p-4 bg-slate-100/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div class="font-mono text-xs flex-1 min-w-0">
              <span class="font-black text-slate-800 dark:text-slate-200">${req.by}</span>
              <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded text-[11px] text-slate-600 dark:text-slate-400 my-2 overflow-x-auto whitespace-pre-wrap break-all">${req.description}</div>
            </div>
            <div class="flex gap-2 shrink-0 self-end sm:self-center">
              <button class="approve-btn bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider hover:bg-emerald-600 hover:text-white transition" data-id="${req.id}">Verify</button>
              <button class="reject-btn bg-red-600/10 text-red-500 dark:text-red-400 border border-red-500/20 px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider hover:bg-red-600 hover:text-white transition" data-id="${req.id}">Revert</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderAdminRollback() {
  return `
    <div class="max-w-2xl mx-auto p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
      <div class="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
        <div>
          <h3 class="text-xs font-black tracking-widest uppercase text-purple-500">System State Historical Logs</h3>
          <p class="text-[11px] text-slate-500 font-medium">Rewind deployment records across past nodes.</p>
        </div>
        ${systemData.backups.length > 0 ? `<button id="nukeAllBtn" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-[10px] font-black uppercase rounded-lg shadow-md transition tracking-wider">⚠️ Revert All 24h Changes</button>` : ''}
      </div>
      <div class="space-y-3">
        ${systemData.backups.length === 0 ? '<div class="text-center py-10 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl"><p class="text-xs text-slate-500 italic font-mono">No restore snapshots logged.</p></div>' : ''}
        ${[...systemData.backups].reverse().map(b => `
          <div class="p-4 bg-slate-100/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-center gap-4">
            <div class="font-mono text-xs min-w-0 flex-1">
              <p class="text-slate-700 dark:text-slate-300 font-semibold bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 break-words">${b.description}</p>
              <p class="text-[10px] text-slate-400 dark:text-slate-500 mt-1">⏱️ Snapshot Node: ${new Date(b.timestamp).toLocaleTimeString()}</p>
            </div>
            <button class="rollback-btn bg-purple-600/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 px-4 py-1.5 text-[10px] uppercase font-black tracking-wider rounded-lg shrink-0 hover:bg-purple-600 hover:text-white transition" data-id="${b.id}">Rollback</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function calculateChangeLogSummary() {
  let descriptions = [];
  originalPlayersState.forEach(oldP => {
    if (!players.some(p => p.name.toLowerCase() === oldP.name.toLowerCase())) descriptions.push(`Purged [${oldP.name}]`);
  });
  players.forEach(p => {
    const oldP = originalPlayersState.find(x => x.name.toLowerCase() === p.name.toLowerCase());
    if (!oldP) descriptions.push(`Registered [${p.name}]`);
    else {
      let mods = [];
      gamemodes.forEach(m => {
        if ((oldP.tiers[m] || 'None') !== (p.tiers[m] || 'None')) mods.push(`${m.toUpperCase()}: ${oldP.tiers[m] || 'None'}➔${p.tiers[m] || 'None'}`);
      });
      if (mods.length > 0) descriptions.push(`Updated [${p.name}] (${mods.join(', ')})`);
    }
  });
  return descriptions.length === 0 ? "Manual matrix patch save event." : descriptions.join(' | ');
}

async function submitMutationsToServer() {
  const token = sessionStorage.getItem('venomToken');
  const patchDescription = calculateChangeLogSummary();
  try {
    const res = await fetch(`${API_URL}/players/mutate`, {
      method: 'POST',
      // FIX 2B: Added standard Bearer authorization packaging context here too
      headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
      body: JSON.stringify({ players: players, description: patchDescription })
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    alert(data.message);
    await fetchPlayers();
    await fetchSystemData();
    render(); 
  } catch (err) { 
    alert("Pipeline execution failed. Verify that your server process is active."); 
  }
}

function attachViewEventListeners() {
  const oTab = document.getElementById('tab-overall');
  const gTab = document.getElementById('tab-gamemodes');
  if (oTab && gTab) {
    oTab.addEventListener('click', () => { currentView = 'overall'; render(); });
    gTab.addEventListener('click', () => { currentView = 'gamemode'; render(); });
  }

  document.querySelectorAll('.player-row').forEach(row => {
    row.addEventListener('click', () => {
      openPublicPlayerProfileModal(row.getAttribute('data-name'));
    });
  });

  const sBar = document.getElementById('searchBar');
  if (sBar) {
    sBar.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll('.player-row').forEach(card => {
        const name = card.getAttribute('data-name').toLowerCase();
        card.style.setProperty('display', name.includes(q) ? 'flex' : 'none', 'important');
      });
    });
  }

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedGamemode = btn.getAttribute('data-mode');
      render();
    });
  });

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await fetch(`${API_URL}/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: document.getElementById('loginUser').value, password: document.getElementById('loginPass').value })
        });
        const data = await res.json();
        if (data.success) {
          userRole = data.role;
          sessionStorage.setItem('venomToken', data.token);
          currentView = 'admin'; adminSubView = 'players';
          await fetchSystemData();
        } else alert(data.message);
        render();
      } catch (err) { alert("Auth system connection failure."); }
    });
  }

  if (currentView === 'admin') {
    document.getElementById('saveDbBtn').addEventListener('click', submitMutationsToServer);
    document.getElementById('adminTabPlayers').addEventListener('click', () => { adminSubView = 'players'; updateAdminTabsUI(); renderOnlyDynamicContainers(); });
    if (userRole === 'owner') {
      document.getElementById('adminTabTesters').addEventListener('click', () => { adminSubView = 'testers'; updateAdminTabsUI(); renderOnlyDynamicContainers(); });
      document.getElementById('adminTabQueue').addEventListener('click', () => { adminSubView = 'queue'; updateAdminTabsUI(); renderOnlyDynamicContainers(); });
      document.getElementById('adminTabRollback').addEventListener('click', () => { adminSubView = 'rollback'; updateAdminTabsUI(); renderOnlyDynamicContainers(); });
    }
    rebindDynamicEvents();
  }
}

function rebindDynamicEvents() {
  const adminSBar = document.getElementById('adminSearchBar');
  if (adminSBar) {
    adminSBar.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll('.admin-player-row').forEach(row => {
        const name = row.getAttribute('data-name').toLowerCase();
        row.style.setProperty('display', name.includes(q) ? 'flex' : 'none', 'important');
      });
    });
  }

  document.querySelectorAll('.approve-btn').forEach(b => b.addEventListener('click', () => handleQueueAction('approve', b.getAttribute('data-id'))));
  document.querySelectorAll('.reject-btn').forEach(b => b.addEventListener('click', () => handleQueueAction('reject', b.getAttribute('data-id'))));
  document.querySelectorAll('.remove-tester-btn').forEach(b => b.addEventListener('click', () => removeTesterProfile(b.getAttribute('data-username'))));
  document.querySelectorAll('.rollback-btn').forEach(b => b.addEventListener('click', () => handleQueueAction('rollback', b.getAttribute('data-id'))));
  
  const tf = document.getElementById('createTesterForm');
  if (tf) tf.addEventListener('submit', createTesterProfile);
  
  const addBtn = document.getElementById('addPlayerBtn');
  if (addBtn) addBtn.addEventListener('click', openAddPlayerModal);
  
  document.querySelectorAll('.admin-player-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-player-btn')) return;
      openEditPlayerModal(row.getAttribute('data-name'));
    });
  });

  document.querySelectorAll('.delete-player-btn').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const t = b.getAttribute('data-name');
    if (confirm(`Purge profile ${t}?`)) { players = players.filter(p => p.name !== t); renderOnlyDynamicContainers(); }
  }));

  const nuke = document.getElementById('nukeAllBtn');
  if (nuke) {
    nuke.addEventListener('click', async () => {
      if (confirm("🔴 WARNING: This will permanently wipe all pending actions, clear all backups, and completely revert rosters back to the baseline setup. Continue?")) {
        await handleQueueAction('clearAllBackups', null);
      }
    });
  }
}

function openPublicPlayerProfileModal(name) {
  const p = players.find(x => x.name === name);
  if (!p) return;
  const modal = document.getElementById('globalModal');
  modal.innerHTML = `
    <div class="glass max-w-sm w-full rounded-2xl p-6 bg-white dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-fadeIn relative overflow-hidden">
      <div class="absolute top-0 right-0 p-4"><button id="closeModal" class="opacity-40 hover:opacity-100 text-sm">✕</button></div>
      <div class="flex flex-col items-center text-center pb-4 border-b border-slate-100 dark:border-slate-900">
        <img src="https://mc-heads.net/body/${p.name}/right" class="h-32 object-contain mb-3 drop-shadow-md">
        <h2 class="text-base font-black tracking-tight">${p.name}</h2>
        <div class="mt-1 text-[10px] font-mono bg-emerald-500/10 text-emerald-500 px-2.5 py-0.5 rounded-full font-bold uppercase">${p.points} Combat Rating Points</div>
      </div>
      <div class="pt-4 space-y-2 max-h-[30vh] overflow-y-auto scrollbar-minimal">
        <h4 class="text-[10px] font-mono font-black text-slate-400 uppercase tracking-wider mb-1">Operational Tier Loadouts</h4>
        ${Object.keys(p.tiers).length === 0 ? '<p class="text-xs text-slate-400 italic">No rankings tracked.</p>' : ''}
        ${Object.entries(p.tiers).map(([mode, tier]) => `
          <div class="flex justify-between items-center p-2 bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 rounded-xl">
            <span class="text-xs font-bold uppercase text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <img src="https://mctiers.com/tier_icons/${mode}.svg" class="w-4 h-4 object-contain" onerror="this.src='https://api.dicebear.com/7.x/identicon/svg?seed=${mode}';">
              ${mode}
            </span>
            <span class="text-xs font-mono font-black text-blue-500 bg-blue-500/5 dark:bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">${tier}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  toggleGlobalModal(true);
}

function openAddPlayerModal() {
  const modal = document.getElementById('globalModal');
  modal.innerHTML = `
    <div class="glass max-w-sm w-full rounded-2xl p-6 bg-white dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col max-h-[80vh] shadow-2xl border border-slate-200 dark:border-slate-800 animate-fadeIn">
      <div class="flex justify-between items-center mb-4"><h3 class="text-xs font-black uppercase tracking-wider text-emerald-500">Add Entry</h3><button id="closeModal" class="opacity-50 hover:opacity-100">✕</button></div>
      <div class="overflow-y-auto space-y-4 flex-1 pr-1 scrollbar-minimal">
        <input type="text" id="newPlayerName" placeholder="Minecraft Account Username" class="w-full p-2.5 bg-slate-100/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs rounded-xl outline-none focus:border-emerald-500">
        <div class="grid grid-cols-2 gap-2">${gamemodes.map(m => `<div><label class="block text-[9px] text-slate-400 uppercase font-black tracking-wide mb-1">${m}</label><select data-mode="${m}" class="new-tier-select w-full p-1.5 bg-slate-100/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs rounded-lg text-slate-900 dark:text-white"><option value="">None</option>${Object.keys(tierPoints).map(t => `<option value="${t}">${t}</option>`).join('')}</select></div>`).join('')}</div>
        <button id="submitNewPlayer" class="w-full py-2.5 bg-emerald-600 text-white font-black text-xs uppercase rounded-xl tracking-wider shadow-lg shadow-emerald-600/10 hover:opacity-90 transition">Create Profile Entry</button>
      </div>
    </div>
  `;
  toggleGlobalModal(true);
  document.getElementById('submitNewPlayer').addEventListener('click', () => {
    const name = document.getElementById('newPlayerName').value.trim();
    if (!name) return;
    const tiers = {};
    document.querySelectorAll('.new-tier-select').forEach(s => { if (s.value) tiers[s.getAttribute('data-mode')] = s.value; });
    const np = { name, tiers }; np.points = computePoints(np);
    players.push(np); toggleGlobalModal(false); renderOnlyDynamicContainers();
  });
}

function openEditPlayerModal(name) {
  const p = players.find(x => x.name === name);
  if (!p) return;
  const modal = document.getElementById('globalModal');
  modal.innerHTML = `
    <div class="glass max-w-sm w-full rounded-2xl p-6 bg-white dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col max-h-[80vh] shadow-2xl border border-slate-200 dark:border-slate-800 animate-fadeIn">
      <div class="flex justify-between items-center mb-4"><h3 class="text-xs font-black uppercase tracking-wider text-blue-500">Modify Instance: ${p.name}</h3><button id="closeModal" class="opacity-50 hover:opacity-100">✕</button></div>
      <div class="overflow-y-auto space-y-4 flex-1 pr-1 scrollbar-minimal">
        <div class="grid grid-cols-2 gap-2">${gamemodes.map(m => `<div><label class="block text-[9px] text-slate-400 uppercase font-black tracking-wide mb-1">${m}</label><select data-mode="${m}" class="edit-tier-select w-full p-1.5 bg-slate-100/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs rounded-lg text-slate-900 dark:text-white"><option value="">None</option>${Object.keys(tierPoints).map(t => `<option value="${t}" ${p.tiers[m] === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`).join('')}</div>
        <button id="submitEditPlayer" class="w-full py-2.5 bg-blue-600 text-white font-black text-xs uppercase rounded-xl tracking-wider shadow-lg shadow-blue-600/10 hover:opacity-90 transition">Confirm Changes</button>
      </div>
    </div>
  `;
  toggleGlobalModal(true);
  document.getElementById('submitEditPlayer').addEventListener('click', () => {
    const ut = {};
    document.querySelectorAll('.edit-tier-select').forEach(s => { if (s.value) ut[s.getAttribute('data-mode')] = s.value; });
    p.tiers = ut; p.points = computePoints(p);
    toggleGlobalModal(false); renderOnlyDynamicContainers();
  });
}

function toggleGlobalModal(show) {
  const m = document.getElementById('globalModal');
  if (show) { m.classList.remove('hidden'); setTimeout(() => m.classList.add('opacity-100'), 10); document.getElementById('closeModal').addEventListener('click', () => toggleGlobalModal(false)); }
  else { m.classList.remove('opacity-100'); setTimeout(() => m.classList.add('hidden'), 150); }
}

async function createTesterProfile(e) {
  e.preventDefault();
  const token = sessionStorage.getItem('venomToken');
  const username = document.getElementById('testerUser').value.trim();
  const password = document.getElementById('testerPass').value.trim();
  // FIX 2C: Wrapped token in standard Bearer format context
  const res = await fetch(`${API_URL}/admin/action`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' }, body: JSON.stringify({ actionType: 'addTester', payload: { username, password } }) });
  if (res.ok) { await fetchSystemData(); renderOnlyDynamicContainers(); } else alert((await res.json()).message);
}

async function removeTesterProfile(username) {
  const token = sessionStorage.getItem('venomToken');
  // FIX 2D: Wrapped token in standard Bearer format context
  const res = await fetch(`${API_URL}/admin/action`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' }, body: JSON.stringify({ actionType: 'removeTester', payload: { username } }) });
  if (res.ok) { await fetchSystemData(); renderOnlyDynamicContainers(); }
}

async function handleQueueAction(actionType, id) {
  const token = sessionStorage.getItem('venomToken');
  // FIX 2E: Wrapped token in standard Bearer format context
  const res = await fetch(`${API_URL}/admin/action`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' }, body: JSON.stringify({ actionType, payload: { id } }) });
  if (res.ok) { await fetchPlayers(); await fetchSystemData(); renderOnlyDynamicContainers(); }
}

init();
