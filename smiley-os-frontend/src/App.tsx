import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Paperclip,
  Terminal,
  Database,
  ShieldAlert,
  Cpu,
  Menu,
  X,
  MessageSquare,
  CheckCircle2,
  Network,
} from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import AcpPanel from './AcpPanel';

// ─── Constants ────────────────────────────────────────────────────────────────
const PROXY_URL   = 'http://localhost:3000/api/proxy';
const MESH_URL    = 'http://localhost:3000/api/mesh';
const ACP_URL     = 'http://localhost:3000/api/acp-proxy';
const TURNSTILE_SITEKEY = '0x4AAAAAADYJS9akmMBIzl-z';

type Role = 'user' | 'model';
interface Message { role: Role; content: string; }

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: 'SYSTEM ONLINE. Turnstile Active. Mesh-LLM + ACP ready. I am Smiley. What is our objective today?' }
  ]);
  const [inputText, setInputText]         = useState('');
  const [isLoading, setIsLoading]         = useState(false);
  const [activeTab, setActiveTab]         = useState('chat');
  const [isMobileMenuOpen, setMobileMenu] = useState(false);
  const [turnstileToken, setTurnstile]    = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(
    () => localStorage.getItem('smileyModel') || 'gemini-2.5-flash'
  );
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { localStorage.setItem('smileyModel', selectedModel); }, [selectedModel]);

  // ─── Routing Logic ──────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    if (!turnstileToken && !selectedModel.startsWith('mesh/') && !selectedModel.startsWith('acp/')) {
      setMessages(p => [...p, { role: 'model', content: '**SECURITY HALT:** Turnstile token missing. Please wait for the widget to verify.' }]);
      return;
    }

    const userPayload: Message = { role: 'user', content: inputText.trim() };
    setMessages(p => [...p, userPayload]);
    setInputText('');
    setIsLoading(true);

    try {
      let aiText = '';
      const history = [...messages, userPayload];

      // ── Branch 1: Mesh-LLM (local decentralized) ──
      if (selectedModel.startsWith('mesh/')) {
        const meshModel = selectedModel.replace('mesh/', '');
        const res = await fetch(MESH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: meshModel,
            messages: history.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content }))
          })
        });
        if (!res.ok) throw new Error(`Mesh-LLM Error ${res.status}`);
        const d = await res.json();
        aiText = d.choices?.[0]?.message?.content || 'Empty Mesh-LLM response.';

      // ── Branch 2: ACP (Claude Agent) ──
      } else if (selectedModel.startsWith('acp/')) {
        const agentUrl = selectedModel.replace('acp/', '');
        const res = await fetch(ACP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentUrl,
            messages: history.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content }))
          })
        });
        if (!res.ok) throw new Error(`ACP Error ${res.status}`);
        const d = await res.json();
        aiText = d.content || d.message || JSON.stringify(d);

      // ── Branch 3: Cloudflare Workers AI ──
      } else if (selectedModel.startsWith('@cf/')) {
        const res = await fetch(PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'cf-turnstile-response': turnstileToken! },
          body: JSON.stringify({
            model: selectedModel,
            messages: history.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content }))
          })
        });
        if (!res.ok) throw new Error((await res.text()) || `Proxy Error ${res.status}`);
        const d = await res.json();
        aiText = d.result?.response || 'Error parsing Cloudflare response.';

      // ── Branch 4: Google Gemini (default) ──
      } else {
        const res = await fetch(PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'cf-turnstile-response': turnstileToken! },
          body: JSON.stringify({
            model: selectedModel,
            geminiPayload: {
              contents: history.map(m => ({ role: m.role, parts: [{ text: m.content }] }))
            }
          })
        });
        if (!res.ok) throw new Error((await res.text()) || `Proxy Error ${res.status}`);
        const d = await res.json();
        aiText = d.candidates?.[0]?.content?.parts?.[0]?.text || 'Error parsing Gemini response.';
      }

      setMessages(p => [...p, { role: 'model', content: aiText }]);
    } catch (err: any) {
      setMessages(p => [...p, { role: 'model', content: `**CRITICAL ERROR:** ${err.message}\n\nCheck your rate limits, CORS config, or ensure the proxy/mesh is active.` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ─── Nav Item ────────────────────────────────────────────────────────────────
  const NavItem = ({ id, icon: Icon, label }: { id: string; icon: any; label: string }) => (
    <button
      onClick={() => { setActiveTab(id); setMobileMenu(false); }}
      className={`flex items-center w-full px-4 py-3 rounded-lg transition-all duration-200 group ${
        activeTab === id
          ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      }`}
    >
      <Icon size={20} className={`mr-3 ${activeTab === id ? 'text-yellow-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
      <span className="font-medium tracking-wide">{label}</span>
    </button>
  );

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden selection:bg-yellow-500/30 selection:text-yellow-200">

      {/* MOBILE HEADER */}
      <div className="md:hidden absolute top-0 w-full bg-slate-950/90 backdrop-blur-md border-b border-slate-800 z-50 flex items-center justify-between p-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-slate-950 font-bold">:)</div>
          <span className="font-bold text-lg tracking-wider text-slate-100">SMILEY OS</span>
        </div>
        <button onClick={() => setMobileMenu(!isMobileMenuOpen)} className="text-slate-400 hover:text-yellow-400">
          {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* SIDEBAR */}
      <aside className={`absolute md:relative z-40 w-72 h-full bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 pt-20 md:pt-6 border-b border-slate-800">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center text-slate-950 font-black text-xl shadow-[0_0_15px_rgba(234,179,8,0.4)]">:)</div>
            <div>
              <h1 className="font-black text-2xl tracking-widest text-slate-100">SMILEY</h1>
              <p className="text-xs text-yellow-500/80 font-mono tracking-widest uppercase">Singularity Build</p>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2 pl-2">System Core</p>
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-sm text-slate-300 rounded-lg p-2.5 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none transition-all cursor-pointer"
            >
              <optgroup label="─ Google Gemini">
                <option value="gemini-2.5-flash">Flash 2.5 (Fast / Free)</option>
                <option value="gemini-2.5-pro">Pro 2.5 (Reasoning)</option>
              </optgroup>
              <optgroup label="─ Cloudflare Edge">
                <option value="@cf/meta/llama-3.1-8b-instruct">Llama 3.1 8B (Edge)</option>
              </optgroup>
              <optgroup label="─ Mesh-LLM (Local)">
                <option value="mesh/GLM-4.7-Flash">GLM-4.7 Flash</option>
                <option value="mesh/Qwen-3.5">Qwen 3.5</option>
                <option value="mesh/auto">Auto (strongest)</option>
              </optgroup>
              <optgroup label="─ Claude Agent (ACP)">
                <option value="acp/http://localhost:3001">Claude Agent (local)</option>
              </optgroup>
            </select>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem id="chat"      icon={MessageSquare} label="Command Master" />
          <NavItem id="hopper"    icon={Database}      label="The Hopper" />
          <NavItem id="memory"    icon={Cpu}           label="Memory Banks" />
          <NavItem id="utilities" icon={Terminal}      label="Utilities" />
          <NavItem id="agents"    icon={Network}       label="ACP Agents" />
        </nav>

        <div className="p-4 border-t border-slate-800 text-xs font-mono text-center flex items-center justify-center space-x-2">
          {turnstileToken ? (
            <div className="flex items-center space-x-1 text-emerald-500"><CheckCircle2 size={14} /><span>SECURED BY TURNSTILE</span></div>
          ) : (
            <div className="flex items-center space-x-1 text-yellow-500/80"><ShieldAlert size={14} /><span>AWAITING VERIFICATION</span></div>
          )}
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col h-full bg-slate-950 pt-16 md:pt-0 relative overflow-hidden">

        {/* ── CHAT ── */}
        {activeTab === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] md:max-w-[75%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-yellow-500 text-slate-950 rounded-br-none' : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-lg'}`}>
                    <div className="flex items-center space-x-2 mb-2">
                      {msg.role === 'user'
                        ? <span className="text-xs font-bold uppercase tracking-wider text-slate-800 opacity-80">Director</span>
                        : <><Cpu size={14} className="text-yellow-500" /><span className="text-xs font-bold uppercase tracking-wider text-yellow-500">Smiley AI</span></>
                      }
                    </div>
                    <div className="whitespace-pre-wrap text-sm md:text-base leading-relaxed">{msg.content}</div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl rounded-bl-none flex items-center space-x-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800">
              <div className="max-w-4xl mx-auto flex flex-col space-y-3">
                {/* Turnstile — hide for mesh/acp routes */}
                {!selectedModel.startsWith('mesh/') && !selectedModel.startsWith('acp/') && (
                  <div className="flex justify-start h-16 w-full">
                    <Turnstile siteKey={TURNSTILE_SITEKEY} onSuccess={setTurnstile} options={{ theme: 'dark' }} />
                  </div>
                )}
                <div className="relative">
                  <textarea
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Execute command..."
                    disabled={isLoading || (!turnstileToken && !selectedModel.startsWith('mesh/') && !selectedModel.startsWith('acp/'))}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl pl-4 pr-32 py-4 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 resize-none h-16 shadow-inner disabled:opacity-50 transition-all placeholder:text-slate-600"
                  />
                  <div className="absolute right-2 top-2 flex space-x-2">
                    <button className="p-2.5 text-slate-500 hover:text-yellow-400 hover:bg-slate-800 rounded-lg transition-colors"><Paperclip size={20} /></button>
                    <button
                      onClick={handleSend}
                      disabled={isLoading || !inputText.trim() || (!turnstileToken && !selectedModel.startsWith('mesh/') && !selectedModel.startsWith('acp/'))}
                      className="p-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-yellow-500 hover:text-slate-950 disabled:opacity-50 transition-all duration-300"
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-[10px] text-slate-600 font-mono uppercase tracking-widest">
                    Routing via {selectedModel} | Smiley OS v2.0
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── ACP AGENTS ── */}
        {activeTab === 'agents' && (
          <div className="flex-1 overflow-y-auto">
            <AcpPanel />
          </div>
        )}

        {/* ── PLACEHOLDER TABS ── */}
        {(activeTab === 'hopper' || activeTab === 'memory' || activeTab === 'utilities') && (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
            <div className="w-24 h-24 mb-6 rounded-full border border-dashed border-slate-700 flex items-center justify-center bg-slate-900/50">
              {activeTab === 'hopper'    && <Database size={40} className="text-slate-600" />}
              {activeTab === 'memory'    && <Cpu      size={40} className="text-slate-600" />}
              {activeTab === 'utilities' && <Terminal size={40} className="text-slate-600" />}
            </div>
            <h2 className="text-2xl font-bold text-slate-300 mb-2 capitalize">{activeTab} Module</h2>
            <p className="max-w-md">This module is offline. Routing configuration pending for Phase 2 Deployment.</p>
          </div>
        )}

      </main>
    </div>
  );
}
