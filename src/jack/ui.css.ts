// JACK — injected global styles (JARVIS-inspired dark HUD theme).
// Kept as a TS string so the boilerplate stays CSS-file-free per project convention.

export const JACK_CSS = `
:root {
  --bg: #060912;
  --panel: rgba(14, 22, 40, 0.72);
  --panel-solid: #0c1426;
  --line: rgba(56, 189, 248, 0.18);
  --cyan: #38bdf8;
  --cyan-dim: #0ea5e9;
  --text: #d7e6f5;
  --muted: #7c8ba1;
  --danger: #f87171;
  --ok: #34d399;
  --warn: #fbbf24;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background:
    radial-gradient(1200px 700px at 80% -10%, rgba(56,189,248,0.10), transparent 60%),
    radial-gradient(900px 600px at -10% 110%, rgba(167,139,250,0.10), transparent 55%),
    var(--bg);
  color: var(--text);
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.jack-mono { font-family: 'SFMono-Regular', ui-monospace, Menlo, Consolas, monospace; }

@keyframes jpulse { 0%,100% { opacity:.35; transform:scale(.85);} 50% { opacity:1; transform:scale(1);} }
@keyframes jspin { to { transform: rotate(360deg); } }
@keyframes jfade { from { opacity:0; transform: translateY(6px);} to { opacity:1; transform:none;} }
@keyframes jscan { 0%{ background-position: 0 -100%;} 100%{ background-position: 0 200%;} }

.jack-dot { width:9px;height:9px;border-radius:50%;background:var(--ok);animation:jpulse 1.8s infinite; box-shadow:0 0 10px var(--ok); }
.jack-msg { animation: jfade .25s ease both; }
.jack-ring {
  width:74px;height:74px;border-radius:50%;
  border:2px solid rgba(56,189,248,0.25);
  border-top-color: var(--cyan);
  animation: jspin 3.5s linear infinite;
  display:flex;align-items:center;justify-content:center;
}
.jack-ring .core { width:34px;height:34px;border-radius:50%;
  background: radial-gradient(circle at 50% 40%, var(--cyan), #0b2a44 70%);
  box-shadow: 0 0 22px rgba(56,189,248,0.7);
}
::-webkit-scrollbar { width:9px; height:9px; }
::-webkit-scrollbar-thumb { background: rgba(56,189,248,0.25); border-radius:9px; }
::-webkit-scrollbar-track { background: transparent; }

.jack-tab { cursor:pointer; padding:10px 14px; border-radius:10px; color:var(--muted);
  border:1px solid transparent; font-size:14px; transition:.15s; user-select:none; }
.jack-tab:hover { color:var(--text); background:rgba(56,189,248,0.06); }
.jack-tab.active { color:var(--cyan); border-color:var(--line); background:rgba(56,189,248,0.08); }

.jack-btn { cursor:pointer; border:1px solid var(--line); background:rgba(56,189,248,0.08);
  color:var(--text); padding:9px 16px; border-radius:10px; font-size:14px; transition:.15s; }
.jack-btn:hover { background:rgba(56,189,248,0.18); border-color:var(--cyan); }
.jack-btn.primary { background:var(--cyan-dim); border-color:var(--cyan); color:#021018; font-weight:600; }
.jack-btn.primary:hover { background:var(--cyan); }
.jack-btn.danger { border-color:rgba(248,113,113,0.4); background:rgba(248,113,113,0.10); color:#fecaca; }
.jack-btn.danger:hover { background:rgba(248,113,113,0.2); }
.jack-btn.ghost { background:transparent; }

.jack-input { flex:1; background:rgba(2,8,18,0.6); border:1px solid var(--line); color:var(--text);
  padding:14px 16px; border-radius:12px; font-size:15px; outline:none; transition:.15s; }
.jack-input:focus { border-color:var(--cyan); box-shadow:0 0 0 3px rgba(56,189,248,0.12); }

.jack-code { background:#020814; border:1px solid var(--line); border-radius:10px; padding:14px;
  overflow:auto; font-size:12.5px; line-height:1.55; color:#bfe3ff; max-height:340px; }
.jack-bar-track { background:rgba(2,8,18,0.7); border-radius:8px; height:10px; overflow:hidden; border:1px solid var(--line); }
.jack-bar-fill { height:100%; border-radius:8px; transition: width .6s ease, background .3s; }
`
