import React, { useEffect, useMemo, useState } from "react";

interface Config { exactPoints: number; resultPoints: number; }
interface Prediction { game: string; saju: string; joel: string; result: string; }
interface AppState { players: string[]; config: Config; predictions: Prediction[]; }

const LS_KEY = "arsenalPreds_v1";

export default function App() {
  // --- ESPN 2025–26 EPL fixtures (38) — names only, with (H)/(A) ---
  const espnFixtures = [
    "Man United (A)","Leeds United (H)","Liverpool (A)","Nottingham Forest (H)","Man City (H)",
    "Newcastle United (A)","West Ham United (H)","Fulham (A)","Crystal Palace (H)","Burnley (A)",
    "Sunderland (A)","Tottenham Hotspur (H)","Chelsea (A)","Brentford (H)","Aston Villa (A)",
    "Wolves (H)","Everton (A)","Brighton (H)","Aston Villa (H)","AFC Bournemouth (A)",
    "Liverpool (H)","Nottingham Forest (A)","Man United (H)","Leeds United (A)","Sunderland (H)",
    "Brentford (A)","Tottenham Hotspur (A)","Chelsea (H)","Brighton (A)","Everton (H)",
    "Wolves (A)","AFC Bournemouth (H)","Man City (A)","Newcastle United (H)","Fulham (H)",
    "West Ham United (A)","Burnley (H)","Crystal Palace (A)"
  ];

  // --- Inject small design system (no Tailwind/shadcn required) ---
  useEffect(() => {
    const css = `:root{--bg:#f6f8fb;--card:#ffffff;--ink:#0f172a;--muted:#64748b;--line:#e5e7eb;--brand:#e11d48;--brand-ink:#fff;}
    *{box-sizing:border-box}body{margin:0}
    .wrap{min-height:100vh;background:linear-gradient(#fff,var(--bg));padding:24px}
    .container{max-width:1000px;margin:0 auto;display:grid;gap:16px}
    .header{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;justify-content:space-between}
    .title{font-size:28px;font-weight:800;margin:0;color:var(--ink)}
    .sub{color:var(--muted);margin:6px 0 0}
    .toolbar{display:flex;gap:10px;align-items:center}
    .btn{appearance:none;border:1px solid var(--line);background:#f8fafc;border-radius:12px;padding:8px 12px;cursor:pointer;font-weight:600}
    .btn.primary{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
    .btn.danger{border-color:#fecaca}
    .grid{display:grid;gap:16px}
    .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px}
    .card h2{margin:0 0 8px}
    .row{display:grid;gap:12px}
    .row.cols-3{grid-template-columns:repeat(3,1fr)}
    .label{font-size:12px;color:#475569;margin:0 0 4px;display:block}
    .input{width:100%;padding:10px;border:1px solid var(--line);border-radius:10px;background:#fff}
    .pill{border:1px solid var(--line);border-radius:14px;padding:10px;display:flex;justify-content:space-between;align-items:center}
    .rank{width:28px;height:28px;border-radius:999px;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-weight:700;margin-right:10px}
    .muted{color:var(--muted)}
    .tabs{display:flex;gap:8px;border-bottom:1px solid var(--line)}
    .tab{padding:8px 12px;border:1px solid var(--line);border-bottom:none;border-radius:12px 12px 0 0;background:#f8fafc;cursor:pointer}
    .tab.active{background:#fff}
    .tabpan{border:1px solid var(--line);border-top:none;border-radius:0 12px 12px 12px;padding:16px;background:#fff}
    table{border-collapse:collapse;width:100%}th,td{padding:8px;border-top:1px solid var(--line);text-align:left}
    `;
    const tag = document.createElement('style');
    tag.setAttribute('data-arsenal-skin','1');
    tag.appendChild(document.createTextNode(css));
    document.head.appendChild(tag);
    return () => { tag.remove(); };
  }, []);

  // --- Tabs ---
  const [tab, setTab] = useState<'leaderboard'|'table'|'predictions'>('leaderboard');

  // --- App state + local storage bootstrap ---
  const [state, setState] = useState<AppState>(() => {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { try { return JSON.parse(raw) as AppState; } catch {} }
    return {
      players: ["Saju", "Joel"],
      config: { exactPoints: 3, resultPoints: 1 },
      predictions: espnFixtures.map(g => ({ game: g, saju: "", joel: "", result: "" }))
    };
  });
  useEffect(() => { localStorage.setItem(LS_KEY, JSON.stringify(state)); }, [state]);

  // --- Scoring helpers ---
  function parseScore(s: string): { a: number; b: number } | null {
    if (!s) return null;
    const cleaned = s.replace(/[–—:]/g, "-").replace(/\s+/g, "");
    const m = cleaned.match(/^(\d+)-(\d+)$/);
    if (!m) return null;
    const a = Number(m[1]); const b = Number(m[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return { a, b };
  }
  function outcome(a: number, b: number): "W" | "D" | "L" {
    return a > b ? "W" : a < b ? "L" : "D";
  }
  function pointsFor(pred: string, actual: string, cfg: Config): number {
    const p = parseScore(pred); const r = parseScore(actual);
    if (!p || !r) return 0;
    if (p.a === r.a && p.b === r.b) return cfg.exactPoints;
    return outcome(p.a, p.b) === outcome(r.a, r.b) ? cfg.resultPoints : 0;
  }

  // --- Leaderboard computed from predictions vs result ---
  const leaderboard = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const name of state.players) totals[name] = 0;

    for (const row of state.predictions) {
      for (const name of state.players) {
        const pred =
          name.toLowerCase() === "saju" ? row.saju :
          name.toLowerCase() === "joel" ? row.joel : "";
        totals[name] += pointsFor(pred, row.result, state.config);
      }
    }

    return Object.entries(totals)
      .map(([player, points]) => ({ player, points }))
      .sort((a, b) => b.points - a.points)
      .map((x, i) => ({ ...x, rank: i + 1 }));
  }, [state.players, state.predictions, state.config]);

  // --- Utilities / actions ---
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'arsenal_leaderboard.json'; a.click();
    URL.revokeObjectURL(url);
  };
  const importJSON = (file: File) => {
    const r = new FileReader();
    r.onload = () => { try { setState(JSON.parse(String(r.result))); } catch { alert('Invalid JSON'); } };
    r.readAsText(file);
  };
  const resetAll = () => {
    if (!confirm('Reset all data?')) return;
    localStorage.removeItem(LS_KEY);
    window.location.reload();
  };

  const addPrediction = () => {
    setState(p => ({...p, predictions:[...p.predictions, {game:"", saju:"", joel:"", result:""}]}));
  };
  const updatePrediction = (idx:number, field:keyof Prediction, value:string) => {
    setState(p => ({...p, predictions:p.predictions.map((pred,i)=> i===idx?{...pred,[field]:value}:pred)}));
  };
  const removePrediction = (idx:number) => {
    setState(p => ({...p, predictions:p.predictions.filter((_,i)=> i!==idx)}));
  };

  // --- UI ---
  return (
    <div className="wrap">
      <div className="container">
        {/* Header */}
        <div className="header">
          <div>
            <h1 className="title">Arsenal Predictions Leaderboard</h1>
            <p className="sub">Season 2025–26 • Players: {state.players.join(', ')}</p>
          </div>
          <div className="toolbar">
            <button className="btn" onClick={exportJSON}>Export</button>
            <label className="btn" style={{display:'inline-flex',alignItems:'center',gap:8}}>
              Import
              <input type="file" accept="application/json" style={{display:'none'}} onChange={(e)=>{const f=e.target.files?.[0]; if(f) importJSON(f);}} />
            </label>
            <button className="btn danger" onClick={resetAll}>Reset</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab ${tab==='leaderboard'?'active':''}`} onClick={()=>setTab('leaderboard')} style={{ color: "#fff", background: "#2563eb", fontWeight: "bold" }}>Leaderboard</button>
          <button className={`tab ${tab==='table'?'active':''}`} onClick={()=>setTab('table')}>Compact Table</button>
          <button className={`tab ${tab==='predictions'?'active':''}`} onClick={()=>setTab('predictions')}>Predictions</button>
        </div>

        <div className="tabpan">
          {tab==='leaderboard' && (
            <div className="card">
              <h2 style={{ color: "#e11d48" }}>Leaderboard</h2>
              <div className="grid">
                {leaderboard.map(row => (
                  <div key={row.player} className="pill">
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div className="rank">{row.rank}</div>
                      <div style={{fontWeight:600}}>{row.player}</div>
                    </div>
                    <div style={{fontWeight:800}}>{row.points}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab==='table' && (
            <div className="card">
              <h2>Compact Table</h2>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map(row => (
                    <tr key={row.player}>
                      <td>{row.rank}</td>
                      <td>{row.player}</td>
                      <td>{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab==='predictions' && (
            <div className="card" style={{ background: "#22c55e" }}>
              <h2>Predictions</h2>
              <p className="muted" style={{marginTop:-4, marginBottom:8}}>
                Enter scores as <strong>Arsenal–Opponent</strong> (e.g., <code>2-1</code>).
                After a match, fill the <strong>Result</strong> with the real final score.
              </p>
              <div style={{display:'flex',gap:8,marginBottom:12}}>
                <button className="btn" onClick={() => {
                  if (!confirm('Replace current list with ESPN 2025–26 EPL fixtures?')) return;
                  setState(p => ({ ...p, predictions: espnFixtures.map(g => ({ game: g, saju: '', joel: '', result:'' })) }));
                }}>Load ESPN Fixtures (38)</button>
                <button className="btn primary" onClick={addPrediction}>Add Game</button>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Game</th>
                    <th>Saju Prediction</th>
                    <th>Joel Prediction</th>
                    <th>Result</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {state.predictions.map((pred,idx)=>(
                    <tr key={idx}>
                      <td><input className="input" value={pred.game} onChange={(e)=>updatePrediction(idx,'game',e.target.value)} /></td>
                      <td><input className="input" placeholder="e.g. 2-1" value={pred.saju} onChange={(e)=>updatePrediction(idx,'saju',e.target.value)} /></td>
                      <td><input className="input" placeholder="e.g. 1-1" value={pred.joel} onChange={(e)=>updatePrediction(idx,'joel',e.target.value)} /></td>
                      <td><input className="input" placeholder="final e.g. 3-0" value={pred.result} onChange={(e)=>updatePrediction(idx,'result',e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Config */}
        <div className="card">
          <h2>Configuration</h2>
          <div className="row cols-3">
            <div>
              <label className="label">Points: Exact Score</label>
              <input className="input" type="number" value={state.config.exactPoints} onChange={(e) => setState(p => ({ ...p, config: { ...p.config, exactPoints: Number(e.target.value || 0) } }))} />
            </div>
            <div>
              <label className="label">Points: Correct Result</label>
              <input className="input" type="number" value={state.config.resultPoints} onChange={(e) => setState(p => ({ ...p, config: { ...p.config, resultPoints: Number(e.target.value || 0) } }))} />
            </div>
            <div>
              <label className="label">Players (comma-separated)</label>
              <input className="input" value={state.players.join(', ')} onChange={(e) => setState(p => ({ ...p, players: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} />
            </div>
          </div>
        </div>

        <div className="muted" style={{textAlign:'center',paddingTop:6}}>
          Data is saved in your browser (localStorage). Export a backup JSON if needed.
        </div>
      </div>
    </div>
  );
}
