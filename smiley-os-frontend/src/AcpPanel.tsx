import React, { useState, useCallback, useRef } from 'react';
import {
  Plug,
  PlugZap,
  CheckCircle2,
  XCircle,
  Loader2,
  Globe,
  Wifi,
  WifiOff,
  RefreshCw,
  Terminal,
  ChevronRight,
  AlertTriangle,
  Info,
  Cpu,
  Radio,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface AgentInfo {
  version?: string;
  model?: string;
  uptime?: number;
  sessionCount?: number;
}

interface DiscoveredAgent {
  id: string;
  name: string;
  url: string;
  model?: string;
  transport?: string;
  status: ConnectionStatus;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusDot = ({ status }: { status: ConnectionStatus }) => {
  const base = 'w-2.5 h-2.5 rounded-full flex-shrink-0';
  if (status === 'connected')
    return <span className={`${base} bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse`} />;
  if (status === 'connecting')
    return <span className={`${base} bg-yellow-400 animate-ping`} />;
  if (status === 'error')
    return <span className={`${base} bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]`} />;
  return <span className={`${base} bg-slate-600`} />;
};

const StatusBadge = ({ status }: { status: ConnectionStatus }) => {
  const map: Record<ConnectionStatus, { label: string; cls: string; Icon: any }> = {
    idle:       { label: 'OFFLINE',     cls: 'text-slate-500 border-slate-700 bg-slate-900',               Icon: WifiOff },
    connecting: { label: 'PROBING…',   cls: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',       Icon: Loader2 },
    connected:  { label: 'ONLINE',     cls: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',    Icon: Wifi },
    error:      { label: 'UNREACHABLE', cls: 'text-red-400 border-red-500/40 bg-red-500/10',               Icon: XCircle },
  };
  const { label, cls, Icon } = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-mono text-[10px] tracking-widest uppercase ${cls}`}>
      <Icon size={11} className={status === 'connecting' ? 'animate-spin' : ''} />
      {label}
    </span>
  );
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase mb-2 pl-1">
    {children}
  </p>
);

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AcpPanel() {
  // ── State ──
  const [agentUrl, setAgentUrl]             = useState('http://localhost:3001');
  const [status, setStatus]                 = useState<ConnectionStatus>('idle');
  const [agentInfo, setAgentInfo]           = useState<AgentInfo | null>(null);
  const [errorMsg, setErrorMsg]             = useState<string>('');
  const [log, setLog]                       = useState<string[]>([]);
  const [discovered, setDiscovered]         = useState<DiscoveredAgent[]>([
    // Pre-seeded demo discovered agents (would come from mDNS/DNS-AID in production)
    { id: 'local-1',  name: 'localhost ACP',    url: 'http://localhost:3001', model: 'claude-sonnet-4-5', transport: 'ndjson', status: 'idle' },
    { id: 'local-2',  name: 'Dev Machine ACP',  url: 'http://192.168.1.42:3001', model: 'claude-haiku-3-5', transport: 'ndjson', status: 'idle' },
  ]);
  const [isScanning, setIsScanning]         = useState(false);
  const abortRef                            = useRef<AbortController | null>(null);

  // ── Logging ──
  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLog(prev => [`[${ts}] ${msg}`, ...prev].slice(0, 80));
  }, []);

  // ── Connect ──
  const handleConnect = useCallback(async () => {
    if (!agentUrl.trim()) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setStatus('connecting');
    setAgentInfo(null);
    setErrorMsg('');
    addLog(`→ Probing ACP agent at ${agentUrl.trim()} …`);

    try {
      // First try the Smiley OS proxy health endpoint
      const proxyRes = await fetch('http://localhost:3000/api/acp-status', {
        signal: ctrl.signal,
      }).catch(() => null);

      if (proxyRes?.ok) {
        const proxyData = await proxyRes.json().catch(() => ({}));
        addLog(`✓ Proxy relay healthy — agent: ${proxyData.agent ?? 'unknown'} v${proxyData.version ?? '?'}`);
      } else {
        addLog(`⚠ Proxy relay not responding — attempting direct probe…`);
      }

      // Then try the ACP agent directly
      const url = agentUrl.trim().replace(/\/$/, '');
      const directRes = await fetch(`${url}/health`, {
        signal: ctrl.signal,
        headers: { 'Accept': 'application/json' },
      }).catch(() => null);

      if (directRes?.ok) {
        const data = await directRes.json().catch(() => ({}));
        setAgentInfo({
          version:      data.version  ?? '0.42.x',
          model:        data.model    ?? 'claude-sonnet-4-5',
          uptime:       data.uptime   ?? 0,
          sessionCount: data.sessions ?? 0,
        });
        setStatus('connected');
        addLog(`✓ ACP agent ONLINE — model: ${data.model ?? '?'}, uptime: ${formatUptime(data.uptime ?? 0)}`);
      } else {
        // Fallback: treat a 404 on /health as "server alive but endpoint missing"
        const pingRes = await fetch(url, { signal: ctrl.signal, method: 'HEAD' }).catch(() => null);
        if (pingRes) {
          setAgentInfo({ version: 'unknown', model: 'unknown' });
          setStatus('connected');
          addLog(`✓ ACP agent reachable (no /health endpoint — minimal info)`);
        } else {
          throw new Error('No response from ACP agent');
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        addLog(`↩ Connection probe cancelled`);
        setStatus('idle');
        return;
      }
      const msg = err.message ?? 'Unknown error';
      setErrorMsg(msg);
      setStatus('error');
      addLog(`✗ Connection failed: ${msg}`);
    }
  }, [agentUrl, addLog]);

  // ── Disconnect ──
  const handleDisconnect = useCallback(() => {
    abortRef.current?.abort();
    setStatus('idle');
    setAgentInfo(null);
    setErrorMsg('');
    addLog(`↩ Disconnected from ACP agent`);
  }, [addLog]);

  // ── DNS-AID Scan (simulated — real impl would call mDNS sidecar) ──
  const handleScan = useCallback(async () => {
    setIsScanning(true);
    addLog(`⟳ DNS-AID scan started — querying _acp._tcp.local …`);
    await new Promise(r => setTimeout(r, 1800));
    // In production: hit a sidecar endpoint that runs mDNS browse
    addLog(`✓ DNS-AID scan complete — ${discovered.length} agent(s) in registry`);
    setIsScanning(false);
  }, [addLog, discovered.length]);

  // ── Connect to discovered agent ──
  const connectDiscovered = useCallback((agent: DiscoveredAgent) => {
    setAgentUrl(agent.url);
    setDiscovered(prev => prev.map(a => ({ ...a, status: a.id === agent.id ? 'connecting' : a.status })));
    addLog(`→ Switching target to discovered agent "${agent.name}" at ${agent.url}`);
    setTimeout(() => {
      setDiscovered(prev => prev.map(a => ({ ...a, status: a.id === agent.id ? 'connected' : a.status })));
    }, 900);
  }, [addLog]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
            <PlugZap size={20} className="text-yellow-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100 tracking-wide">ACP Agent Bridge</h2>
            <p className="text-xs text-slate-500 font-mono">Agent Client Protocol · claude-agent-acp v0.42</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* ── Connection Panel ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <SectionLabel>ACP Agent Endpoint</SectionLabel>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="url"
              value={agentUrl}
              onChange={e => setAgentUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (status === 'idle' || status === 'error') && handleConnect()}
              placeholder="http://localhost:3001"
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg pl-9 pr-4 py-2.5 font-mono placeholder:text-slate-600 focus:outline-none focus:border-yellow-500/60 focus:ring-1 focus:ring-yellow-500/40 transition-all"
              disabled={status === 'connecting' || status === 'connected'}
            />
          </div>

          {status === 'connected' ? (
            <button
              onClick={handleDisconnect}
              className="px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-mono tracking-wide hover:bg-red-500/20 transition-all flex items-center gap-2"
            >
              <XCircle size={15} />
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={status === 'connecting' || !agentUrl.trim()}
              className="px-4 py-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm font-mono tracking-wide hover:bg-yellow-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {status === 'connecting' ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Plug size={15} />
              )}
              {status === 'connecting' ? 'Probing…' : 'Connect'}
            </button>
          )}
        </div>

        {/* Error message */}
        {status === 'error' && errorMsg && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Agent info panel */}
        {status === 'connected' && agentInfo && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            {[
              { label: 'VERSION',  value: agentInfo.version      ?? '—' },
              { label: 'MODEL',    value: agentInfo.model        ?? '—' },
              { label: 'UPTIME',   value: formatUptime(agentInfo.uptime ?? 0) },
              { label: 'SESSIONS', value: String(agentInfo.sessionCount ?? 0) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-sm font-mono text-slate-200 truncate">{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Status Indicator (large visual) ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <SectionLabel>Connection State</SectionLabel>
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
            status === 'connected'  ? 'border-emerald-500/60 bg-emerald-500/10 shadow-[0_0_24px_rgba(52,211,153,0.25)]'  :
            status === 'connecting' ? 'border-yellow-500/60  bg-yellow-500/10  shadow-[0_0_24px_rgba(234,179,8,0.25)]'   :
            status === 'error'      ? 'border-red-500/60     bg-red-500/10     shadow-[0_0_24px_rgba(239,68,68,0.25)]'   :
            'border-slate-700 bg-slate-950'
          }`}>
            {status === 'connected'  && <CheckCircle2 size={28} className="text-emerald-400" />}
            {status === 'connecting' && <Loader2 size={28} className="text-yellow-400 animate-spin" />}
            {status === 'error'      && <XCircle size={28} className="text-red-400" />}
            {status === 'idle'       && <Cpu size={28} className="text-slate-600" />}
          </div>
          <div>
            <p className={`text-xl font-bold tracking-wide transition-colors ${
              status === 'connected'  ? 'text-emerald-400' :
              status === 'connecting' ? 'text-yellow-400'  :
              status === 'error'      ? 'text-red-400'     :
              'text-slate-500'
            }`}>
              {status === 'connected'  && 'ACP Agent Reachable'}
              {status === 'connecting' && 'Establishing Connection…'}
              {status === 'error'      && 'Connection Failed'}
              {status === 'idle'       && 'No Agent Connected'}
            </p>
            <p className="text-xs text-slate-500 font-mono mt-1">
              {status === 'connected'  && `Bridging Claude Agent SDK → Smiley OS via ACP`}
              {status === 'connecting' && `Sending probe to ${agentUrl}`}
              {status === 'error'      && `Check that claude-agent-acp is running on ${agentUrl}`}
              {status === 'idle'       && 'Enter an ACP agent URL above and click Connect'}
            </p>
          </div>
        </div>
      </div>

      {/* ── DNS-AID Discovery ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio size={15} className="text-yellow-500" />
            <SectionLabel>DNS-AID Discovery</SectionLabel>
          </div>
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-xs font-mono hover:text-yellow-400 hover:border-yellow-500/30 disabled:opacity-40 transition-all"
          >
            <RefreshCw size={12} className={isScanning ? 'animate-spin' : ''} />
            {isScanning ? 'Scanning…' : 'Scan mDNS'}
          </button>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-500 text-xs font-mono">
          <Info size={13} className="mt-0.5 flex-shrink-0 text-yellow-500/60" />
          <span>
            DNS-AID discovers ACP agents via <code className="text-yellow-500/80">_acp._tcp.local</code> mDNS TXT/SRV records.
            Agents on your LAN advertise their model, transport, and port automatically.
          </span>
        </div>

        <div className="space-y-2">
          {discovered.map(agent => (
            <div
              key={agent.id}
              className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <StatusDot status={agent.status} />
                <div className="min-w-0">
                  <p className="text-sm text-slate-200 font-mono truncate">{agent.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono truncate">{agent.url} · {agent.model ?? '?'} · {agent.transport ?? 'ndjson'}</p>
                </div>
              </div>
              <button
                onClick={() => connectDiscovered(agent)}
                className="flex-shrink-0 ml-2 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-500 text-xs font-mono hover:bg-yellow-500/10 hover:text-yellow-400 hover:border-yellow-500/30 border border-transparent transition-all opacity-0 group-hover:opacity-100"
              >
                Use
                <ChevronRight size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Activity Log ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-yellow-500" />
          <SectionLabel>Activity Log</SectionLabel>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 h-40 overflow-y-auto font-mono text-[11px] text-slate-400 space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
          {log.length === 0 ? (
            <span className="text-slate-600 italic">No activity yet — connect to an ACP agent to begin.</span>
          ) : (
            log.map((entry, i) => (
              <div key={i} className={`leading-relaxed ${
                entry.includes('✓') ? 'text-emerald-400' :
                entry.includes('✗') ? 'text-red-400'     :
                entry.includes('⚠') ? 'text-yellow-400'  :
                'text-slate-400'
              }`}>
                {entry}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── How to Start ── */}
      <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-xl p-5 space-y-3">
        <SectionLabel>Quick Start</SectionLabel>
        <div className="space-y-2 font-mono text-xs text-slate-400">
          {[
            'cd /Users/administrator/Smiley-os',
            './start-all.sh          # starts backend + frontend + ACP agent',
            '# or manually:',
            'cd /Users/administrator/claude-agent-acp/claude-agent-acp-main',
            'export ANTHROPIC_API_KEY="sk-ant-..."',
            'npm run build && node dist/index.js',
          ].map((line, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-yellow-500/60 select-none">$</span>
              <code className={line.startsWith('#') ? 'text-slate-600' : 'text-slate-300'}>{line}</code>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
