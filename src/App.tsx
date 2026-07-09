import React, { useState, useEffect } from 'react';
import { 
  Bot, Terminal, Settings, Users, Database, Play, Square, RotateCw, 
  Shield, Activity, CheckCircle2, AlertCircle, Server, Cpu, Clock, 
  Save, RefreshCw, Layers, MessageSquare, Globe, ShieldAlert, Zap, Command, Trash2, UserX, UserCheck
} from 'lucide-react';

interface BotStatus {
  status: string;
  uptime: number;
  databaseType: string;
  userCount: number;
  threadCount: number;
  memoryUsage: { rss: number; heapUsed: number; heapTotal: number };
  nodeVersion: string;
}

interface AntiReactConfig {
  enable: boolean;
  onlyAdminBot: boolean;
  reactByUnsend: {
    enable: boolean;
    emojis: string[];
  };
  reactByRemove: {
    enable: boolean;
    emoji: string;
  };
}

interface BotConfig {
  databaseType: string;
  sqlitePath: string;
  botToken: string;
  mongoURI: string;
  prefix: string;
  adminId: string[];
  owner: string;
  onlyAdmin: boolean;
  port: string;
  botName: string;
  copyrightMark: string;
  greetNewMembers: { enabled: boolean; gifUrl: string };
  farewellMembers: { enabled: boolean; gifUrl: string };
  globalapi: { samirapi: string; pikachu: string };
  antiReact?: AntiReactConfig;
}

interface UserItem {
  userID: string;
  username: string;
  first_name?: string;
  last_name?: string;
  banned: boolean;
}

interface ThreadItem {
  chatId: string;
  sorthelp: boolean;
  usersCount: number;
}

interface CommandItem {
  name: string;
  description?: string;
  category?: string;
  cooldown?: number;
  role?: number;
  onlyAdmin?: boolean;
  aliases?: string[];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'users' | 'threads' | 'commands' | 'logs'>('overview');
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [commands, setCommands] = useState<CommandItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchData = async () => {
    try {
      const [statusRes, configRes, logsRes, usersRes, threadsRes, cmdsRes] = await Promise.all([
        fetch('/api/status').then(r => r.json()),
        fetch('/api/config').then(r => r.json()),
        fetch('/api/logs').then(r => r.json()),
        fetch('/api/users').then(r => r.json()),
        fetch('/api/threads').then(r => r.json()),
        fetch('/api/commands').then(r => r.json()),
      ]);
      setStatus(statusRes);
      setConfig(configRes);
      setLogs(logsRes.logs || []);
      setUsers(usersRes || []);
      setThreads(threadsRes || []);
      setCommands(cmdsRes || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleBotControl = async (action: 'start' | 'stop' | 'restart') => {
    setLoading(true);
    try {
      const res = await fetch('/api/bot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Bot ${action} successful! Status: ${data.status}`);
        fetchData();
      } else {
        showToast(`Failed to ${action} bot.`);
      }
    } catch (e) {
      showToast('Error communicating with server.');
    }
    setLoading(false);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSavingConfig(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Config saved successfully!');
        fetchData();
      } else {
        showToast('Failed to save config.');
      }
    } catch (e) {
      showToast('Error saving configuration.');
    }
    setSavingConfig(false);
  };

  const handleToggleUserBan = async (userID: string, currentBanState: boolean) => {
    try {
      const res = await fetch('/api/users/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userID, banned: !currentBanState })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`User ${userID} ban status updated.`);
        fetchData();
      } else {
        showToast('Failed to update ban status.');
      }
    } catch (e) {
      showToast('Error updating user ban state.');
    }
  };

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  const formatBytes = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const filteredLogs = logs.filter(l => l.toLowerCase().includes(logFilter.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-indigo-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-indigo-400/30 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-indigo-200" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation / Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              {config?.botName || 'Yukai Bot'} 
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Advanced Control Center v2.5
              </span>
            </h1>
            <p className="text-xs text-slate-400">Telegram Bot Web Management, Anti-React Shield & Cluster Suite</p>
          </div>
        </div>

        {/* Status Badge & Global Actions */}
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700/60 text-xs">
            <span className={`w-2.5 h-2.5 rounded-full ${status?.status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="capitalize font-medium text-slate-300">
              {status?.status === 'running' ? 'Bot Active & Listening' : status?.status === 'waiting_for_token' ? 'Needs Token' : 'Stopped'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            <button 
              onClick={() => handleBotControl('start')}
              disabled={status?.status === 'running' || loading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 disabled:opacity-40 transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" /> Start
            </button>
            <button 
              onClick={() => handleBotControl('stop')}
              disabled={status?.status !== 'running' || loading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 disabled:opacity-40 transition-all cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" /> Stop
            </button>
            <button 
              onClick={() => handleBotControl('restart')}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 disabled:opacity-40 transition-all cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Restart
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto w-full px-6 py-8 flex-1 flex flex-col gap-6">
        
        {/* Navigation Tabs Bar */}
        <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'overview' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Activity className="w-4 h-4" /> Overview & Logs
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'config' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Settings className="w-4 h-4" /> Configuration & Anti-React
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'users' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Users className="w-4 h-4" /> Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('threads')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'threads' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" /> Chat Threads ({threads.length})
          </button>
          <button
            onClick={() => setActiveTab('commands')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'commands' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Command className="w-4 h-4" /> Commands ({commands.length})
          </button>
        </div>

        {/* TAB 1: OVERVIEW & LOGS */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Database Type</p>
                  <p className="text-xl font-bold text-white mt-1 uppercase flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-400" />
                    {status?.databaseType || 'sqlite'}
                  </p>
                </div>
                <span className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                  <Server className="w-6 h-6" />
                </span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Bot Uptime</p>
                  <p className="text-xl font-bold text-white mt-1">
                    {status?.uptime ? formatUptime(status.uptime) : '0s'}
                  </p>
                </div>
                <span className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                  <Clock className="w-6 h-6" />
                </span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Memory RSS / Heap</p>
                  <p className="text-xl font-bold text-white mt-1">
                    {status?.memoryUsage ? formatBytes(status.memoryUsage.rss) : '0 MB'}
                  </p>
                </div>
                <span className="p-3 bg-violet-500/10 rounded-xl text-violet-400 border border-violet-500/20">
                  <Cpu className="w-6 h-6" />
                </span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Users & Threads</p>
                  <p className="text-xl font-bold text-white mt-1">{status?.userCount || 0} / {status?.threadCount || 0}</p>
                </div>
                <span className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
                  <Users className="w-6 h-6" />
                </span>
              </div>
            </div>

            {/* Anti-React Status Card */}
            <div className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Anti-React Protection Shield 
                    <span className={`text-xs px-2 py-0.5 rounded-full ${config?.antiReact?.enable ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                      {config?.antiReact?.enable ? 'Active & Protecting' : 'Disabled'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Unsend message on reactions ({config?.antiReact?.reactByUnsend?.emojis?.join(', ') || '❌, 🗑️'}) and kick user on reaction ({config?.antiReact?.reactByRemove?.emoji || '🚫'}).
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab('config')}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-lg shadow-indigo-600/20 cursor-pointer shrink-0"
              >
                Configure Anti-React
              </button>
            </div>

            {/* Live Terminal Logs */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-base font-semibold text-white">Live Bot Terminal & Activity Logs</h2>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={logFilter}
                    onChange={e => setLogFilter(e.target.value)}
                    placeholder="Filter logs..."
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button 
                    onClick={fetchData}
                    className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 font-mono text-xs text-slate-300 h-96 overflow-y-auto flex flex-col gap-1.5 shadow-inner">
                {filteredLogs.length === 0 ? (
                  <span className="text-slate-500 italic">No logs recorded or matching filter yet...</span>
                ) : (
                  filteredLogs.map((log, idx) => (
                    <div key={idx} className="leading-relaxed border-b border-slate-900/50 pb-1 flex items-start gap-2">
                      <span className="text-indigo-400 shrink-0">{log.split(' ')[0]}</span> 
                      <span className="text-slate-300 break-all">{log.slice(log.indexOf(' ') + 1)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CONFIGURATION & ANTI-REACT MANAGER */}
        {activeTab === 'config' && config && (
          <form onSubmit={handleSaveConfig} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-indigo-400" /> Bot Configuration & Anti-React Shield Editor (`config.json`)
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Manage bot credentials, database, prefix, admin IDs, and Anti-React reaction rules.
                </p>
              </div>
              <button
                type="submit"
                disabled={savingConfig}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" /> {savingConfig ? 'Saving & Restarting...' : 'Save & Restart Bot'}
              </button>
            </div>

            {/* Anti-React Section */}
            <div className="bg-slate-950 border border-indigo-500/30 rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Anti-React Protection Shield Settings</h3>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.antiReact?.enable ?? true}
                    onChange={e => setConfig({
                      ...config,
                      antiReact: { ...(config.antiReact || { onlyAdminBot: true, reactByUnsend: { enable: true, emojis: ["❌", "🗑️"] }, reactByRemove: { enable: true, emoji: "🚫" } }), enable: e.target.checked }
                    })}
                    className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-semibold text-slate-200">Enable Anti-React</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                  <div>
                    <p className="text-xs font-semibold text-white">Only Admin / Bot Admin</p>
                    <p className="text-[11px] text-slate-400">Restrict anti-react actions to bot admins only</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.antiReact?.onlyAdminBot ?? true}
                    onChange={e => setConfig({
                      ...config,
                      antiReact: { ...(config.antiReact!), onlyAdminBot: e.target.checked }
                    })}
                    className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                  <div>
                    <p className="text-xs font-semibold text-white">Unsend via Reaction (`reactByUnsend`)</p>
                    <p className="text-[11px] text-slate-400">Unsend bot messages upon specific emoji reaction</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.antiReact?.reactByUnsend?.enable ?? true}
                    onChange={e => setConfig({
                      ...config,
                      antiReact: {
                        ...(config.antiReact!),
                        reactByUnsend: { ...(config.antiReact!.reactByUnsend), enable: e.target.checked }
                      }
                    })}
                    className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase text-slate-300">Unsend Emojis (comma separated)</label>
                  <input
                    type="text"
                    value={config.antiReact?.reactByUnsend?.emojis?.join(', ') || '❌, 🗑️'}
                    onChange={e => setConfig({
                      ...config,
                      antiReact: {
                        ...(config.antiReact!),
                        reactByUnsend: { ...(config.antiReact!.reactByUnsend), emojis: e.target.split(',').map(s => s.trim()).filter(Boolean) }
                      }
                    })}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                  <div>
                    <p className="text-xs font-semibold text-white">Remove User via Reaction (`reactByRemove`)</p>
                    <p className="text-[11px] text-slate-400">Kick user from chat when emoji is reacted</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.antiReact?.reactByRemove?.enable ?? true}
                    onChange={e => setConfig({
                      ...config,
                      antiReact: {
                        ...(config.antiReact!),
                        reactByRemove: { ...(config.antiReact!.reactByRemove), enable: e.target.checked }
                      }
                    })}
                    className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase text-slate-300">Kick Emoji</label>
                  <input
                    type="text"
                    value={config.antiReact?.reactByRemove?.emoji || '🚫'}
                    onChange={e => setConfig({
                      ...config,
                      antiReact: {
                        ...(config.antiReact!),
                        reactByRemove: { ...(config.antiReact!.reactByRemove), emoji: e.target.trim() }
                      }
                    })}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* General Config Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase text-slate-300">Database Type</label>
                <select
                  value={config.databaseType || 'sqlite'}
                  onChange={e => setConfig({ ...config, databaseType: e.target.value })}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="sqlite">SQLite (Default Local SQL Database)</option>
                  <option value="mongodb">MongoDB (Cloud / Remote Cluster)</option>
                </select>
                <p className="text-xs text-slate-500">SQLite is configured by default locally without needing external connection.</p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase text-slate-300">MongoDB URI (if mongodb selected)</label>
                <input
                  type="text"
                  value={config.mongoURI || ''}
                  onChange={e => setConfig({ ...config, mongoURI: e.target.value })}
                  placeholder="mongodb+srv://..."
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-xs font-semibold uppercase text-slate-300">Telegram Bot Token (from BotFather)</label>
                <input
                  type="text"
                  value={config.botToken || ''}
                  onChange={e => setConfig({ ...config, botToken: e.target.value })}
                  placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase text-slate-300">Bot Name</label>
                <input
                  type="text"
                  value={config.botName || ''}
                  onChange={e => setConfig({ ...config, botName: e.target.value })}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase text-slate-300">Command Prefix</label>
                <input
                  type="text"
                  value={config.prefix || '/'}
                  onChange={e => setConfig({ ...config, prefix: e.target.value })}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase text-slate-300">Copyright Mark</label>
                <input
                  type="text"
                  value={config.copyrightMark || ''}
                  onChange={e => setConfig({ ...config, copyrightMark: e.target.value })}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase text-slate-300">Owner User ID</label>
                <input
                  type="text"
                  value={config.owner || ''}
                  onChange={e => setConfig({ ...config, owner: e.target.value })}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </form>
        )}

        {/* TAB 3: USERS MANAGER */}
        {activeTab === 'users' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" /> Registered Bot Users
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">List of all users interacting with the bot. You can ban or unban users instantly.</p>
              </div>
              <button onClick={fetchData} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs flex items-center gap-1.5 cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-xs border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">User ID</th>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4">First Name</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 italic">No users recorded yet. Start interacting with the bot!</td>
                    </tr>
                  ) : (
                    users.map(u => (
                      <tr key={u.userID} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono text-xs text-indigo-400">{u.userID}</td>
                        <td className="py-3 px-4 font-medium text-white">@{u.username || 'N/A'}</td>
                        <td className="py-3 px-4">{u.first_name || '-'}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.banned ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                            {u.banned ? 'Banned' : 'Active'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleToggleUserBan(u.userID, u.banned)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 ml-auto transition-all cursor-pointer ${
                              u.banned 
                                ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30' 
                                : 'bg-rose-600/20 text-rose-400 hover:bg-rose-600/30'
                            }`}
                          >
                            {u.banned ? <><UserCheck className="w-3.5 h-3.5" /> Unban</> : <><UserX className="w-3.5 h-3.5" /> Ban</>}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: THREADS MANAGER */}
        {activeTab === 'threads' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-400" /> Active Chat Threads / Groups
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">List of group chats and private threads interacting with the bot.</p>
              </div>
              <button onClick={fetchData} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs flex items-center gap-1.5 cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-xs border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Chat ID</th>
                    <th className="py-3 px-4">Sort Help Mode</th>
                    <th className="py-3 px-4">Active Users Tracked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {threads.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-500 italic">No chat threads recorded yet.</td>
                    </tr>
                  ) : (
                    threads.map(t => (
                      <tr key={t.chatId} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono text-xs text-indigo-400">{t.chatId}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${t.sorthelp ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-400'}`}>
                            {t.sorthelp ? 'Categorized' : 'Pagination'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">{t.usersCount} users</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: COMMANDS CATALOG EXPLORER */}
        {activeTab === 'commands' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Command className="w-5 h-5 text-indigo-400" /> Loaded Bot Commands Explorer ({commands.length})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Explore all active commands loaded from `scripts/commands`.</p>
              </div>
              <button onClick={fetchData} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs flex items-center gap-1.5 cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {commands.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-500 italic">No commands found in scripts/commands.</div>
              ) : (
                commands.map((cmd, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-2 hover:border-indigo-500/50 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-indigo-400">/{cmd.name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 uppercase tracking-wider">
                        {cmd.category || 'general'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-2">{cmd.description || 'No description provided.'}</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-900 mt-auto">
                      <span>Cooldown: {cmd.cooldown || 3}s</span>
                      <span>{cmd.onlyAdmin ? 'Admin Only' : 'Public'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
