/**
 * LandingPage.jsx  —  TaxScale
 * Drop into: frontend/src/components/LandingPage.jsx
 */

import { useRef, useState } from "react";
// 1. Added import for PostHog
import { usePostHog } from "posthog-js/react";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  gold:       "#E8C547",
  goldDim:    "rgba(232,197,71,0.12)",
  goldBorder: "rgba(232,197,71,0.28)",
  bg:         "#09090E",
  surface:    "#0E0E16",
  surface2:   "#13131C",
  border:     "rgba(255,255,255,0.07)",
  borderMid:  "rgba(255,255,255,0.11)",
  text:       "#EDE8DF",
  textSub:    "#9A9AB2",
  textMut:    "#55556A",
  green:      "#3BB56A",
  greenDim:   "rgba(59,181,106,0.14)",
};

// ─── Inline SVG icons ────────────────────────────────────────────────────────
const Icon = {
  shield: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5L2.5 3.5V8C2.5 11.2 5 13.8 8 14.5C11 13.8 13.5 11.2 13.5 8V3.5L8 1.5Z"
        stroke={C.gold} strokeWidth="1.2" fill="none"/>
      <path d="M5.5 8L7.2 9.7L10.5 6.5" stroke={C.gold} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  upload: (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M11 14V4M11 4L7.5 7.5M11 4L14.5 7.5" stroke={C.gold} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 16V17.5C4 18.3 4.7 19 5.5 19H16.5C17.3 19 18 18.3 18 17.5V16" stroke={C.gold} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  bolt: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M9 1.5L4 8.5H7.5L6 13.5L12 6.5H8.5L10 1.5H9Z" stroke={C.gold} strokeWidth="1.2" fill="none" strokeLinejoin="round"/>
    </svg>
  ),
  lock: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="2.5" y="7" width="10" height="7" rx="1.5" stroke={C.gold} strokeWidth="1.2" fill="none"/>
      <path d="M5 7V5C5 3.3 10 3.3 10 5V7" stroke={C.gold} strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <circle cx="7.5" cy="10.5" r="1" fill={C.gold}/>
    </svg>
  ),
  scale: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 2V13M7.5 2L3 5.5L1.5 9H6M7.5 2L12 5.5L13.5 9H9" stroke={C.gold} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
};

const STEPS = [
  { n: "01", label: "Upload Form 16",   body: "Select the PDF statement issued by your employer to start formatting analysis." },
  { n: "02", label: "Verify figures",    body: "Confirm extracted values or correct them before the engine runs." },
  { n: "03", label: "Get your result",   body: "New vs. Old regime, slab breakdown, and the exact tax saving — instantly." },
];

const PROPS = [
  { icon: Icon.bolt,  title: "Real-time computation",   body: "AY 2026-27 slab rules applied instantly — no waiting." },
  { icon: Icon.lock,  title: "Computed in your browser", body: "Your Form 16 never leaves your device. No account needed." },
  { icon: Icon.scale, title: "Both regimes, side by side", body: "Full slab-wise breakdown so you can see exactly where each rupee falls." },
];

export default function LandingPage({ onEnterDashboard }) {
  // 2. Initialize PostHog hook
  const posthog = usePostHog();
  const fileInputRef = useRef(null);
  const [drag,    setDrag]   = useState(false);
  const [hover,   setHover]  = useState(false);
  const [btnHov, setBtnHov] = useState(false);

  const handleActionClick = () => {
    // 3. Capture the event in PostHog
    posthog.capture("user_started_analysis");
    
    if (typeof onEnterDashboard === "function") {
      onEnterDashboard();
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text,
      fontFamily:"'Inter', system-ui, sans-serif", display:"flex", flexDirection:"column" }}>

      <header style={{ display:"flex", alignItems:"center", padding:"18px 32px",
        borderBottom:`1px solid ${C.border}`, gap:10 }}>
        <div style={{ width:32, height:32, background:C.gold, display:"flex",
          alignItems:"center", justifyContent:"center", fontSize:12,
          fontWeight:700, color:C.bg, flexShrink:0, letterSpacing:"0.02em" }}>TS</div>
        <span style={{ fontFamily:"'DM Serif Display', Georgia, serif",
          fontSize:18, color:C.text, letterSpacing:"0.01em" }}>TaxScale</span>
      </header>

      <main style={{ flex:1, display:"flex", flexDirection:"column",
        alignItems:"center", padding:"52px 24px 40px", textAlign:"center" }}>

        <div style={{ display:"flex", alignItems:"center", gap:7,
          fontSize:10, letterSpacing:"0.16em", textTransform:"uppercase",
          color:C.gold, marginBottom:20 }}>
          <span style={{ width:5, height:5, borderRadius:"50%", background:C.gold }} />
          Indian Income Tax · AY 2026-27
        </div>

        <h1 style={{ fontFamily:"'DM Serif Display', Georgia, serif",
          fontSize:"clamp(28px, 5.5vw, 46px)", lineHeight:1.14,
          letterSpacing:"-0.01em", margin:"0 0 20px", maxWidth:520 }}>
          Know exactly which{" "}
          <span style={{ color:C.gold, fontStyle:"italic" }}>tax regime</span>
          <br/>saves you more.
        </h1>

        <p style={{ fontSize:"clamp(13px, 2vw, 15px)", lineHeight:1.75,
          color:C.textSub, maxWidth:440, margin:"0 auto 36px" }}>
          Upload your employer-issued Form 16. TaxScale computes your liability
          under both regimes, shows a full slab breakdown, and estimates your potential tax refund or balance payable.
        </p>

        <div
          role="button" tabIndex={0}
          aria-label="Launch TaxScale Analyzer Pipeline"
          onClick={handleActionClick}
          onKeyDown={e => e.key==="Enter" && handleActionClick()}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); handleActionClick(); }}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          style={{
            width:"100%", maxWidth:420,
            border:`1.5px dashed ${drag||hover ? C.gold : C.goldBorder}`,
            borderRadius:4, padding:"28px 24px",
            display:"flex", flexDirection:"column", alignItems:"center", gap:14,
            cursor:"pointer", transition:"border-color 0.18s, background 0.18s",
            background: drag ? "rgba(232,197,71,0.09)" : hover ? "rgba(232,197,71,0.05)" : "rgba(232,197,71,0.025)",
            marginBottom:10,
          }}>

          <div style={{ width:44, height:44, borderRadius:"50%",
            background:C.goldDim, display:"flex", alignItems:"center",
            justifyContent:"center" }}>
            {Icon.upload}
          </div>

          <p style={{ fontSize:13, fontWeight:500, color:C.text, margin:0 }}>
            {drag ? "Drop your Form 16 here" : "Upload Form 16"}
          </p>
          <p style={{ fontSize:11, color:C.textMut, margin:0 }}>
            PDF · Drag &amp; drop or click to browse
          </p>

          <button
            style={{
              background: C.gold, color: C.bg, border:"none", borderRadius:2,
              padding:"11px 28px", fontSize:13, fontWeight:600,
              letterSpacing:"0.04em", cursor:"pointer",
              display:"flex", alignItems:"center", gap:8,
              transition:"opacity 0.15s, transform 0.1s",
              opacity: btnHov ? 0.88 : 1,
              transform: btnHov ? "scale(0.98)" : "scale(1)",
            }}
            onMouseEnter={() => setBtnHov(true)}
            onMouseLeave={() => setBtnHov(false)}
            onClick={e => { e.stopPropagation(); handleActionClick(); }}
          >
            Upload Form 16 &amp; Calculate
            <span aria-hidden="true">→</span>
          </button>

          <div style={{ display:"flex", alignItems:"center", gap:6,
            fontSize:10, color:C.textMut }}>
            {Icon.shield}
            Computed entirely in your browser
          </div>
        </div>

        <div style={{ width:"100%", maxWidth:600, margin:"44px 0 0" }}>
          <div style={{ display:"flex", alignItems:"center", gap:16,
            marginBottom:24 }}>
            <div style={{ flex:1, height:1, background:C.border }} />
            <span style={{ fontSize:10, letterSpacing:"0.12em",
              textTransform:"uppercase", color:C.textMut }}>How it works</span>
            <div style={{ flex:1, height:1, background:C.border }} />
          </div>

          <div style={{ display:"grid",
            gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))",
            gap:1, border:`1px solid ${C.border}`, overflow:"hidden" }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{
                background: C.surface, padding:"20px 18px",
                borderRight: i < STEPS.length-1 ? `1px solid ${C.border}` : "none",
                textAlign:"left",
              }}>
                <div style={{ fontSize:11, fontFamily:"'JetBrains Mono', monospace",
                  color:C.gold, marginBottom:10, letterSpacing:"0.06em" }}>{s.n}</div>
                <p style={{ fontSize:12, fontWeight:600, color:C.text,
                  margin:"0 0 6px", letterSpacing:"0.01em" }}>{s.label}</p>
                <p style={{ fontSize:11, color:C.textMut, lineHeight:1.6, margin:0 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ width:"100%", maxWidth:600, margin:"32px 0 0",
          display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))",
          gap:1, border:`1px solid ${C.border}`, overflow:"hidden" }}>
          {PROPS.map((p, i) => (
            <div key={p.title} style={{
              background: C.surface2, padding:"20px 18px",
              borderRight: i < PROPS.length-1 ? `1px solid ${C.border}` : "none",
              textAlign:"left", display:"flex", flexDirection:"column", gap:8,
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                {p.icon}
              </div>
              <p style={{ fontSize:12, fontWeight:600, color:C.text,
                margin:0, letterSpacing:"0.01em" }}>{p.title}</p>
              <p style={{ fontSize:11, color:C.textMut, lineHeight:1.6, margin:0 }}>{p.body}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop:32, width:"100%", maxWidth:600,
          border:`1px solid ${C.border}`, background:C.surface,
          padding:"16px 20px", display:"flex", alignItems:"flex-start",
          gap:12, textAlign:"left" }}>
          <div style={{ flexShrink:0, marginTop:1 }}>{Icon.shield}</div>
          <div>
            <p style={{ fontSize:11, fontWeight:600, color:C.text,
              margin:"0 0 4px", letterSpacing:"0.02em" }}>
              Built on Indian tax law
            </p>
            <p style={{ fontSize:11, color:C.textMut, lineHeight:1.6, margin:0 }}>
              Slab rates, standard deduction, Section 87A rebate, Health &amp; Education
              Cess — all sourced from the Finance Act and verified against the
              Income Tax Department's AY 2026-27 notifications.
            </p>
          </div>
        </div>

      </main>

      <footer style={{ borderTop:`1px solid ${C.border}`,
        padding:"14px 32px", display:"flex", alignItems:"center",
        justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ width:6, height:6, borderRadius:"50%",
            background:C.green, flexShrink:0 }} />
          <span style={{ fontSize:9, letterSpacing:"0.1em",
            textTransform:"uppercase", color:C.textMut }}>
            Runs in your browser
          </span>
        </div>
        <p style={{ fontSize:10, color:C.textMut, letterSpacing:"0.02em",
          margin:0, textAlign:"center", flex:1, minWidth:200 }}>
          Informational use only — not a substitute for professional tax advice.
          Verify all figures with a qualified CA before filing.
        </p>
        <span style={{ fontSize:9, letterSpacing:"0.1em",
          textTransform:"uppercase", color:C.textMut,
          border:`1px solid ${C.border}`, padding:"3px 9px" }}>
          AY 2026-27
        </span>
      </footer>

      <style>{`
        @media (max-width: 600px) {
          header { padding: 14px 16px !important; }
          main { padding: 32px 16px 24px !important; }
          footer { padding: 16px !important; flex-direction: column; text-align: center; gap: 14px; }
          footer p { display: none; }
          div[role="button"] { padding: 20px 16px !important; }
        }
        @media (max-width: 440px) {
          h1 { font-size: 24px !important; line-height: 1.25 !important; }
          button { 
            width: 100%; 
            justify-content: center; 
            padding: 12px 16px !important; 
            font-size: 12px !important; 
          }
        }
        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
}