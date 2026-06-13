import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const EASE = 'cubic-bezier(0.22,1,0.36,1)'
const SLIDE_MS = 3000

const KEYFRAMES = `
  @keyframes glowPulse {
    0%,100% { opacity:0.5; } 50% { opacity:1; }
  }
  @keyframes shimmer {
    0%   { transform:translateX(-120%) skewX(-15deg); }
    100% { transform:translateX(340%)  skewX(-15deg); }
  }
  @keyframes pulseDot {
    0%,100% { box-shadow:0 0 0 0 rgba(74,222,128,0.45); }
    50%     { box-shadow:0 0 0 8px rgba(74,222,128,0); }
  }
  @keyframes pulseDotRed {
    0%,100% { box-shadow:0 0 0 0 rgba(248,113,113,0.45); }
    50%     { box-shadow:0 0 0 8px rgba(248,113,113,0); }
  }
  @keyframes textGlint {
    0%,100% { background-position: 200% center; }
    50%     { background-position: -100% center; }
  }
  @keyframes slideInRight {
    from { opacity:0; transform:translateX(18px); }
    to   { opacity:1; transform:translateX(0); }
  }
`

/* Each slide carries an atmospheric tint that washes the whole page */
const SLIDE_ATMOS = [
  'radial-gradient(ellipse 110% 110% at 78% 50%, rgba(74,222,128,0.055) 0%, transparent 58%)',   // route   — green
  'radial-gradient(ellipse 110% 110% at 78% 50%, rgba(96,165,250,0.065) 0%, transparent 58%)',   // timeline — blue
  'radial-gradient(ellipse 110% 110% at 78% 50%, rgba(255,255,255,0.03) 0%, transparent 58%)',   // how      — neutral
  'radial-gradient(ellipse 110% 110% at 78% 50%, rgba(74,222,128,0.055) 0%, transparent 58%)',   // compliance — green
  'radial-gradient(ellipse 110% 110% at 78% 50%, rgba(251,191,36,0.045) 0%, transparent 58%)',   // stats    — amber
]

/* ── helpers ──────────────────────────────────────────────────── */
function tr(delay, dur = 500) {
  return `opacity ${dur}ms ${EASE} ${delay}s, transform ${dur}ms ${EASE} ${delay}s`
}

function useWindowWidth() {
  const [w, setW] = useState(window.innerWidth)
  useEffect(() => {
    const h = () => setW(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return w
}

function useCountUp(target, ms = 900, active = false) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!active) return
    let t0 = null
    const tick = ts => {
      if (!t0) t0 = ts
      const p = Math.min((ts - t0) / ms, 1)
      setV(Math.round((1 - (1 - p) ** 3) * target))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [active])
  return v
}

/* ── Logo ─────────────────────────────────────────────────────── */
function Logo() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <div style={{
        width:30, height:30, borderRadius:6, flexShrink:0,
        background:'linear-gradient(145deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))',
        border:'1px solid rgba(255,255,255,0.14)',
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'inset 0 1px 0 rgba(255,255,255,0.14)',
      }}>
        <svg width="18" height="13" viewBox="0 0 18 13" fill="none">
          <rect x="0" y="1.5" width="11.5" height="7.5" rx="1.2" fill="rgba(255,255,255,0.88)"/>
          <path d="M11.5 2.5h4.5a.9.9 0 0 1 .85.62L17.8 7l.2 3H11.5V2.5z" fill="rgba(255,255,255,0.88)"/>
          <path d="M11.9 3.2h3.8l.65 3.1h-4.45V3.2z" fill="rgba(13,15,23,0.3)"/>
          <line x1="8.2" y1="1.5" x2="8.2" y2="9" stroke="rgba(13,15,23,0.18)" strokeWidth="0.7"/>
          <circle cx="3.6"  cy="11" r="1.85" fill="rgba(255,255,255,0.78)"/>
          <circle cx="9.1"  cy="11" r="1.85" fill="rgba(255,255,255,0.78)"/>
          <circle cx="15.5" cy="11" r="1.85" fill="rgba(255,255,255,0.78)"/>
          <circle cx="3.6"  cy="11" r="0.65" fill="rgba(13,15,23,0.45)"/>
          <circle cx="9.1"  cy="11" r="0.65" fill="rgba(13,15,23,0.45)"/>
          <circle cx="15.5" cy="11" r="0.65" fill="rgba(13,15,23,0.45)"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize:13, fontWeight:800, letterSpacing:'0.07em', color:'rgba(255,255,255,0.92)', lineHeight:1.1, fontFamily:"'DM Sans',sans-serif" }}>ELD LOGGER</div>
        <div style={{ fontSize:8.5, fontWeight:600, letterSpacing:'0.16em', color:'rgba(255,255,255,0.35)', lineHeight:1, fontFamily:"'DM Sans',sans-serif" }}>HOS COMPLIANCE</div>
      </div>
    </div>
  )
}

/* ── Shared slide header label ────────────────────────────────── */
function SlideLabel({ text, active }) {
  return (
    <div style={{
      fontSize:11, fontWeight:700, letterSpacing:'0.13em',
      color:'rgba(255,255,255,0.42)', marginBottom:22,
      opacity:active ? 1 : 0,
      transition:`opacity 300ms ease 0.08s`,
      fontFamily:"'DM Sans',sans-serif",
    }}>
      {text}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 1 — Route Visualization
══════════════════════════════════════════════════════════════ */
function RouteSlide({ active }) {
  const stops = [
    { label:'CURRENT LOCATION', city:'Chicago, IL',   tag:'Origin', color:'rgba(255,255,255,0.92)', dot:'rgba(255,255,255,0.85)', pulse:null,         dist:null     },
    { label:'PICKUP STOP',      city:'St. Louis, MO', tag:'Day 1',  color:'#4ADE80',               dot:'#4ADE80',               pulse:'pulseDot',    dist:'417 mi' },
    { label:'DROPOFF',          city:'Dallas, TX',    tag:'Day 2',  color:'#F87171',               dot:'#F87171',               pulse:'pulseDotRed', dist:'504 mi' },
  ]
  return (
    <div>
      <div style={{ position:'relative', padding:'4px 0 4px 6px' }}>
        <svg style={{ position:'absolute', left:13, top:22, pointerEvents:'none' }} width="2" height="186" viewBox="0 0 2 186" preserveAspectRatio="none">
          <line x1="1" y1="0" x2="1" y2="248"
            stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" strokeLinecap="round"
            style={{
              strokeDasharray:600,
              strokeDashoffset: active ? 0 : 600,
              transition: active ? `stroke-dashoffset 1.2s ${EASE} 0.3s` : 'none',
            }}
          />
        </svg>

        {stops.map(({ label, city, tag, color, dot, pulse, dist }, i) => (
          <div key={city}>
            {dist && (
              <div style={{
                display:'flex', alignItems:'center', gap:8,
                paddingLeft:36, marginBottom:14, marginTop:14,
                opacity:active?1:0,
                transition:`opacity 400ms ease ${0.65+i*0.15}s`,
              }}>
                <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.09)' }} />
                <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', color:'rgba(255,255,255,0.42)', fontFamily:"'JetBrains Mono',monospace" }}>{dist}</span>
                <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.09)' }} />
              </div>
            )}
            <div style={{
              display:'flex', alignItems:'center', gap:16,
              position:'relative', zIndex:1,
              opacity:active?1:0, transform:active?'none':'translateX(-10px)',
              transition:tr(0.44+i*0.18),
            }}>
              <div style={{
                width:14, height:14, borderRadius:'50%', flexShrink:0,
                border:`2px solid ${dot}`,
                background: i===0 ? 'transparent' : dot,
                animation: pulse ? `${pulse} 2.4s ease-in-out ${i*0.8}s infinite` : 'none',
              }} />
              <div>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', color:'rgba(255,255,255,0.4)', marginBottom:4, fontFamily:"'DM Sans',sans-serif" }}>{label}</div>
                <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
                  <span style={{ fontSize:22, fontWeight:800, color, letterSpacing:'-0.02em', lineHeight:1, fontFamily:"'DM Sans',sans-serif" }}>{city}</span>
                  <span style={{ fontSize:10.5, fontWeight:600, color:'rgba(255,255,255,0.32)', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, padding:'2px 8px', fontFamily:"'DM Sans',sans-serif" }}>{tag}</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        <div style={{
          marginTop:24, display:'inline-flex', alignItems:'center', gap:8,
          background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.22)', borderRadius:7, padding:'9px 14px',
          opacity:active?1:0, transition:`opacity 500ms ease 1.1s`,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          <span style={{ fontSize:12, fontWeight:700, color:'#4ADE80', letterSpacing:'0.05em', fontFamily:"'DM Sans',sans-serif" }}>HOS COMPLIANT — All 7 rules checked</span>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 2 — Day Hours Timeline
══════════════════════════════════════════════════════════════ */
const TIMELINE_ROWS = [
  { label:'Off Duty', color:'rgba(255,255,255,0.2)',  segs:[{s:0,e:6.5},{s:20,e:24}] },
  { label:'Sleeper',  color:'#818CF8',                segs:[]                          },
  { label:'Driving',  color:'#4ADE80',                segs:[{s:7,e:17.5}]              },
  { label:'On Duty',  color:'#60A5FA',                segs:[{s:6.5,e:7},{s:17.5,e:20}] },
]
const HOUR_TICKS = ['12A','3','6','9','12P','3','6','9','12A']

function TimelineSlide({ active }) {
  return (
    <div style={{ width:'100%' }}>

      {TIMELINE_ROWS.map(({ label, color, segs }, ri) => (
        <div key={label} style={{
          display:'flex', alignItems:'center', gap:10, marginBottom:12,
          opacity:active?1:0, transform:active?'none':'translateX(10px)',
          transition:tr(0.2+ri*0.09),
        }}>
          <div style={{ fontSize:10.5, fontWeight:600, color:'rgba(255,255,255,0.45)', width:56, flexShrink:0, textAlign:'right', fontFamily:"'DM Sans',sans-serif" }}>{label}</div>
          <div style={{ flex:1, height:20, borderRadius:4, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', overflow:'hidden', position:'relative' }}>
            {segs.map((seg, si) => (
              <div key={si} style={{
                position:'absolute', top:0, bottom:0,
                left:`${(seg.s/24)*100}%`,
                width: active ? `${((seg.e-seg.s)/24)*100}%` : '0%',
                background:color, borderRadius:3,
                transition: active ? `width 750ms ${EASE} ${0.3+si*0.13+ri*0.07}s` : 'none',
              }} />
            ))}
          </div>
        </div>
      ))}

      <div style={{
        display:'flex', justifyContent:'space-between',
        paddingLeft:66, marginTop:8,
        opacity:active?1:0, transition:`opacity 400ms ease 0.72s`,
      }}>
        {HOUR_TICKS.map((h,i) => (
          <span key={i} style={{ fontSize:9, color:'rgba(255,255,255,0.3)', fontFamily:"'JetBrains Mono',monospace", fontWeight:500 }}>{h}</span>
        ))}
      </div>

      <div style={{
        display:'flex', gap:16, marginTop:18, paddingLeft:66, flexWrap:'wrap',
        opacity:active?1:0, transition:`opacity 400ms ease 0.82s`,
      }}>
        {[
          {c:'#4ADE80',               l:'Driving (10.5 hr)'},
          {c:'#60A5FA',               l:'On Duty (3.5 hr)'},
          {c:'rgba(255,255,255,0.2)', l:'Off Duty (10 hr)'},
        ].map(({c,l}) => (
          <div key={l} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:9, height:9, borderRadius:2, background:c, flexShrink:0 }} />
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.52)', fontWeight:500, fontFamily:"'DM Sans',sans-serif" }}>{l}</span>
          </div>
        ))}
      </div>

      <div style={{
        display:'flex', justifyContent:'space-between',
        marginTop:22, padding:'13px 16px',
        background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8,
        opacity:active?1:0, transition:`opacity 400ms ease 1.0s`,
      }}>
        {[
          {n:'417 mi', l:'Day Miles'},
          {n:'10:30h',  l:'Drive Time'},
          {n:'3:30h',   l:'On Duty'},
          {n:'10:00h',  l:'Rest'},
        ].map(({n,l}) => (
          <div key={l} style={{ textAlign:'center' }}>
            <div style={{ fontSize:17, fontWeight:800, color:'#FFFFFF', letterSpacing:'-0.02em', lineHeight:1, fontFamily:"'DM Sans',sans-serif" }}>{n}</div>
            <div style={{ fontSize:9.5, color:'rgba(255,255,255,0.42)', fontWeight:600, letterSpacing:'0.07em', marginTop:4, textTransform:'uppercase', fontFamily:"'DM Sans',sans-serif" }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 3 — How It Works
══════════════════════════════════════════════════════════════ */
const HOW_STEPS = [
  { n:'01', title:'Enter Your Route',       desc:"Origin, pickup, and dropoff. Takes under 30 seconds." },
  { n:'02', title:'HOS Engine Calculates',  desc:'All 7 FMCSA rules enforced — limits, breaks, rest windows, and the 70-hr cycle.' },
  { n:'03', title:'Download Your ELD Logs', desc:'One complete log sheet per day, print-ready or export as PDF.' },
]

function HowSlide({ active }) {
  return (
    <div>
      <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
        {HOW_STEPS.map(({ n, title, desc }, i) => (
          <div key={n} style={{
            display:'flex', gap:16,
            opacity:active?1:0, transform:active?'none':'translateX(12px)',
            transition:tr(0.19+i*0.14),
          }}>
            <div style={{
              width:36, height:36, borderRadius:8, flexShrink:0,
              border:'1px solid rgba(255,255,255,0.12)',
              background:'rgba(255,255,255,0.05)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:11, fontWeight:800, color:'rgba(255,255,255,0.52)',
              fontFamily:"'JetBrains Mono',monospace",
            }}>{n}</div>
            <div style={{ paddingTop:2 }}>
              <div style={{ fontSize:15, fontWeight:700, color:'rgba(255,255,255,0.92)', marginBottom:5, fontFamily:"'DM Sans',sans-serif" }}>{title}</div>
              <div style={{ fontSize:13, lineHeight:1.62, color:'rgba(255,255,255,0.52)', fontFamily:"'DM Sans',sans-serif" }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop:28, display:'flex', alignItems:'center', gap:10,
        padding:'12px 16px',
        background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8,
        opacity:active?1:0, transition:`opacity 400ms ease 0.75s`,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span style={{ fontSize:12.5, color:'rgba(255,255,255,0.52)', fontFamily:"'DM Sans',sans-serif" }}>
          Average generation time: <span style={{ color:'rgba(255,255,255,0.85)', fontWeight:700 }}>under 3 seconds</span>
        </span>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 4 — Compliance Rules
══════════════════════════════════════════════════════════════ */
const COMPLIANCE_RULES = [
  { rule:'11-Hour Driving Limit',     desc:'Maximum driving per on-duty shift'          },
  { rule:'14-Hour On-Duty Window',    desc:'Shift clock starts the moment you sign on'  },
  { rule:'30-Minute Break Required',  desc:'Mandatory after 8 hours of cumulative drive' },
  { rule:'10-Hour Off-Duty Reset',    desc:'Minimum rest required before next shift'    },
  { rule:'70-Hr / 8-Day Cycle',       desc:'Running total tracked continuously'         },
  { rule:'Fuel & Rest Stop Planning', desc:'Factored into your route automatically'     },
]

function ComplianceSlide({ active }) {
  return (
    <div>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {COMPLIANCE_RULES.map(({ rule, desc }, i) => (
          <div key={rule} style={{
            display:'flex', alignItems:'flex-start', gap:11,
            opacity:active?1:0, transform:active?'none':'translateX(12px)',
            transition:tr(0.13+i*0.08),
          }}>
            <div style={{
              width:20, height:20, marginTop:1, flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'center',
              background:'rgba(74,222,128,0.1)', borderRadius:5, border:'1px solid rgba(74,222,128,0.22)',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <div style={{ fontSize:13.5, fontWeight:700, color:'rgba(255,255,255,0.9)', fontFamily:"'DM Sans',sans-serif" }}>{rule}</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.45)', marginTop:2, fontFamily:"'DM Sans',sans-serif" }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 5 — Trip Summary
══════════════════════════════════════════════════════════════ */
const TRIP_STATS = [
  { val:'921',  unit:'miles', label:'Total Trip Distance',  color:'rgba(255,255,255,0.92)' },
  { val:'2',    unit:'days',  label:'Days of Driving',      color:'#4ADE80'                },
  { val:'3',    unit:'stops', label:'Origin + Stops',       color:'rgba(255,255,255,0.92)' },
  { val:'21h',  unit:'total', label:'Total Drive Hours',    color:'#60A5FA'                },
]

function TripStatsSlide({ active }) {
  return (
    <div>
      <div style={{ display:'flex', flexDirection:'column' }}>
        {TRIP_STATS.map(({ val, unit, label, color }, i) => (
          <div key={label} style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'15px 0',
            borderBottom:'1px solid rgba(255,255,255,0.07)',
            opacity:active?1:0, transform:active?'none':'translateY(8px)',
            transition:tr(0.16+i*0.1),
          }}>
            <span style={{ fontSize:14, color:'rgba(255,255,255,0.58)', fontWeight:500, fontFamily:"'DM Sans',sans-serif" }}>{label}</span>
            <div style={{ display:'flex', alignItems:'baseline', gap:5 }}>
              <span style={{ fontSize:24, fontWeight:800, color, letterSpacing:'-0.03em', lineHeight:1, fontFamily:"'DM Sans',sans-serif" }}>{val}</span>
              <span style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.32)', fontFamily:"'JetBrains Mono',monospace" }}>{unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop:22, display:'flex', alignItems:'center', gap:10,
        padding:'12px 16px',
        background:'rgba(74,222,128,0.06)', border:'1px solid rgba(74,222,128,0.18)', borderRadius:8,
        opacity:active?1:0, transition:`opacity 400ms ease 0.9s`,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <span style={{ fontSize:12.5, color:'rgba(255,255,255,0.55)', fontFamily:"'DM Sans',sans-serif" }}>
          Full log sheets generated for <span style={{ color:'#4ADE80', fontWeight:700 }}>all driving days</span>
        </span>
      </div>
    </div>
  )
}

/* ── Stat item (left column) ──────────────────────────────────── */
function StatItem({ value, suffix, label, delay, active, numColor = '#FFFFFF' }) {
  const n = useCountUp(value, 900, active)
  return (
    <div style={{ opacity:active?1:0, transform:active?'none':'translateY(6px)', transition:tr(delay) }}>
      <div style={{ fontSize:28, fontWeight:800, color:numColor, lineHeight:1, letterSpacing:'-0.03em', fontFamily:"'DM Sans',sans-serif" }}>
        {n}<span style={{ fontSize:15, fontWeight:600, color:'rgba(255,255,255,0.35)', marginLeft:2 }}>{suffix}</span>
      </div>
      <div style={{ fontSize:9.5, fontWeight:600, color:'rgba(255,255,255,0.32)', letterSpacing:'0.08em', marginTop:3, textTransform:'uppercase', fontFamily:"'DM Sans',sans-serif" }}>{label}</div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Right panel — slideshow
══════════════════════════════════════════════════════════════ */
const SLIDES = [
  { id:'route',      label:'Route Preview'    },
  { id:'timeline',   label:'Day Breakdown'    },
  { id:'how',        label:'How It Works'     },
  { id:'compliance', label:'Compliance Rules' },
  { id:'stats',      label:'Trip Summary'     },
]

function RightPanel({ mobile, onSlideChange }) {
  const [slide, setSlide]             = useState(0)
  const [fading, setFading]           = useState(false)
  const [innerActive, setInnerActive] = useState(false) // false → entrance anim on slide 0
  const [panelVisible, setPanelVisible] = useState(false)

  const slideRef   = useRef(0)
  const fadingRef  = useRef(false)
  const pausedRef  = useRef(false)
  const timerRef   = useRef(null)

  /* single transition fn — pure refs, no stale closures */
  function doTransition(next) {
    if (fadingRef.current || next === slideRef.current) return
    fadingRef.current = true
    setFading(true)
    setInnerActive(false)
    setTimeout(() => {
      slideRef.current = next
      setSlide(next)
      onSlideChange(next)
      fadingRef.current = false
      setFading(false)
      setTimeout(() => setInnerActive(true), 40)
    }, 260)
  }

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      if (!pausedRef.current && !fadingRef.current) {
        doTransition((slideRef.current + 1) % SLIDES.length)
      }
    }, SLIDE_MS)
  }

  useEffect(() => {
    // panel + slide 0 entrance — fires together with left-column animations
    const enterT  = setTimeout(() => { setPanelVisible(true); setInnerActive(true) }, 120)
    // first auto-advance at 2s so user immediately sees the slideshow
    const firstT  = setTimeout(() => { doTransition(1); startTimer() }, 2000)
    return () => {
      clearTimeout(enterT)
      clearTimeout(firstT)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  /* manual dot nav resets the timer so selection isn't immediately overridden */
  function goTo(i) {
    doTransition(i)
    startTimer()
  }

  return (
    <div
      style={{
        flex: mobile ? 'none' : 1,
        display:'flex', flexDirection:'column', justifyContent:'center',
        padding: mobile ? '36px 24px 40px' : '0 52px',
        position:'relative', overflow:'hidden',
        minHeight: mobile ? 420 : 0,
        opacity: panelVisible ? 1 : 0,
        transform: panelVisible ? 'none' : 'translateX(16px)',
        transition: `opacity 550ms ${EASE} 0.22s, transform 550ms ${EASE} 0.22s`,
      }}
      onMouseEnter={() => { pausedRef.current = true }}
      onMouseLeave={() => { pausedRef.current = false }}
    >
      {/* grouped: nav label sits just above slide content, both centered as one unit */}
      <div style={{ display:'flex', flexDirection:'column' }}>

        {/* nav label + dots */}
        <div style={{
          display:'flex', alignItems:'center', gap:12,
          paddingBottom:12,
        }}>
          <span style={{
            fontSize:11, fontWeight:600,
            color:'rgba(255,255,255,0.3)',
            letterSpacing:'0.08em', flex:1,
            fontFamily:"'DM Sans',sans-serif",
          }}>
            {SLIDES[slide].label.toUpperCase()}
          </span>
          <div style={{ display:'flex', gap:6 }}>
            {SLIDES.map((_,i) => (
              <button key={i} onClick={() => goTo(i)} style={{
                height:5, borderRadius:3, border:'none', cursor:'pointer', padding:0,
                width: i === slide ? 20 : 5,
                background: i === slide ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.18)',
                transition:'width 300ms ease, background 300ms ease',
              }} />
            ))}
          </div>
        </div>

        {/* separator */}
        <div style={{ height:1, background:'rgba(255,255,255,0.07)', marginBottom:22 }} />

        {/* slide content — fixed height keeps the group vertically stable */}
        <div style={{
          height: mobile ? 'auto' : 360,
          overflow:'hidden',
          opacity:fading?0:1,
          transform:fading?'translateX(10px)':'translateX(0)',
          transition:'opacity 260ms ease, transform 260ms ease',
        }}>
          {slide === 0 && <RouteSlide      active={innerActive} />}
          {slide === 1 && <TimelineSlide   active={innerActive} />}
          {slide === 2 && <HowSlide        active={innerActive} />}
          {slide === 3 && <ComplianceSlide active={innerActive} />}
          {slide === 4 && <TripStatsSlide  active={innerActive} />}
        </div>

      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Main
══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const navigate = useNavigate()
  const [active,     setActive]     = useState(false)
  const [isLeaving,  setIsLeaving]  = useState(false)
  const [slideIndex, setSlideIndex] = useState(0)
  const width  = useWindowWidth()
  const mobile = width < 768

  useEffect(() => {
    const t = setTimeout(() => setActive(true), 80)
    return () => clearTimeout(t)
  }, [])

  function go() {
    setIsLeaving(true)
    setTimeout(() => navigate('/planner'), 280)
  }

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        className={isLeaving ? 'page-exit' : ''}
        style={{
          background:'#0D0F17',
          height: mobile ? 'auto' : '100vh',
          minHeight:'100vh',
          overflow: mobile ? 'auto' : 'hidden',
          display:'flex', flexDirection:'column',
          fontFamily:"'DM Sans',sans-serif",
          position:'relative',
        }}
      >
        {/* ── base grid ──────────────────────────────────────── */}
        <div style={{
          position:'fixed', inset:0, zIndex:0, pointerEvents:'none',
          backgroundImage:[
            'linear-gradient(rgba(255,255,255,0.032) 1px,transparent 1px)',
            'linear-gradient(90deg,rgba(255,255,255,0.032) 1px,transparent 1px)',
          ].join(','),
          backgroundSize:'52px 52px',
        }} />

        {/* ── left spotlight (always present) ──────────────── */}
        <div style={{
          position:'fixed', inset:0, zIndex:0, pointerEvents:'none',
          background:'radial-gradient(ellipse 52% 65% at 25% 46%,rgba(255,255,255,0.06) 0%,transparent 68%)',
        }} />

        {/* ── per-slide atmospheric tints (whole page) ─────── */}
        {SLIDE_ATMOS.map((grad, i) => (
          <div key={i} style={{
            position:'fixed', inset:0, zIndex:1, pointerEvents:'none',
            background:grad,
            opacity: slideIndex === i ? 1 : 0,
            transition:'opacity 1400ms ease',
          }} />
        ))}

        {/* ── Header ─────────────────────────────────────────── */}
        <div style={{
          position:'relative', zIndex:100, flexShrink:0,
          height:52, display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:`0 ${mobile?20:32}px`,
          borderBottom:'1px solid rgba(255,255,255,0.055)',
          background:'rgba(13,15,23,0.65)', backdropFilter:'blur(12px)',
          opacity:active?1:0, transition:'opacity 400ms ease',
        }}>
          <Logo />
          <div style={{
            display:'inline-flex', alignItems:'center', gap:6,
            background:'rgba(74,222,128,0.07)', border:'1px solid rgba(74,222,128,0.18)',
            borderRadius:20, padding:'4px 12px',
            fontSize:10.5, fontWeight:700, letterSpacing:'0.09em', color:'rgba(74,222,128,0.75)',
          }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background:'#4ADE80', animation:'glowPulse 2s ease-in-out infinite' }} />
            {mobile ? 'HOS ACTIVE' : 'HOS ENGINE ACTIVE'}
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────── */}
        <div style={{
          position:'relative', zIndex:10,
          flex:1, display:'flex',
          flexDirection: mobile ? 'column' : 'row',
          overflow: mobile ? 'visible' : 'hidden',
        }}>

          {/* Left column */}
          <div style={{
            flex: mobile ? 'none' : '0 0 50%',
            display:'flex', flexDirection:'column', justifyContent:'center',
            padding: mobile ? '44px 24px 36px' : '0 56px 0 64px',
          }}>
            {/* eyebrow */}
            <div style={{
              display:'inline-flex', alignItems:'center', gap:7, alignSelf:'flex-start',
              background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.09)',
              borderRadius:20, padding:'5px 14px', marginBottom:22,
              fontSize:10.5, fontWeight:700, letterSpacing:'0.1em', color:'rgba(255,255,255,0.48)',
              opacity:active?1:0, transform:active?'none':'translateY(10px)',
              transition:tr(0.1),
            }}>
              <span style={{ width:5, height:5, borderRadius:'50%', background:'#4ADE80', animation:'glowPulse 2s ease-in-out infinite' }} />
              ELD LOG GENERATOR
            </div>

            {/* headline */}
            <h1 style={{
              fontSize: mobile ? 'clamp(36px,9vw,52px)' : 'clamp(52px,4.2vw,72px)',
              fontWeight:800, lineHeight:1.06, letterSpacing:'-0.03em',
              margin:'0 0 18px', color:'#FFFFFF',
              opacity:active?1:0, transform:active?'none':'translateY(14px)',
              transition:tr(0.17, 650),
            }}>
              Know your{' '}
              <span style={{ color:'#4ADE80' }}>hours.</span>
              <br/>
              <span style={{ color:'rgba(255,255,255,0.58)', fontWeight:800 }}>Stay compliant.</span>
            </h1>

            {/* body */}
            <p style={{
              fontSize: mobile ? 14 : 15.5, lineHeight:1.7,
              color:'rgba(255,255,255,0.45)',
              margin:'0 0 34px', maxWidth:440,
              opacity:active?1:0, transform:active?'none':'translateY(10px)',
              transition:tr(0.27),
            }}>
              Enter your origin, pickup, and dropoff. The HOS engine generates a fully compliant ELD log sheet for every day of the trip.
            </p>

            {/* CTA */}
            <div style={{ opacity:active?1:0, transform:active?'none':'translateY(8px)', transition:tr(0.37) }}>
              <button
                onClick={go}
                style={{
                  display:'inline-flex', alignItems:'center', gap:10,
                  background:'#FFFFFF', color:'#0D0F17',
                  fontSize:14, fontWeight:700, padding:'13px 28px',
                  borderRadius:7, border:'none', cursor:'pointer',
                  position:'relative', overflow:'hidden',
                  fontFamily:"'DM Sans',sans-serif", letterSpacing:'-0.01em',
                  transition:'background 130ms ease,transform 130ms ease,box-shadow 130ms ease',
                }}
                onMouseOver={e => { e.currentTarget.style.background='rgba(255,255,255,0.9)'; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 12px 32px rgba(255,255,255,0.14)' }}
                onMouseOut={e  => { e.currentTarget.style.background='#FFFFFF'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none' }}
              >
                Generate My Logs
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
                <span style={{
                  position:'absolute', top:0, left:0, width:'38%', height:'100%',
                  background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.38),transparent)',
                  animation:'shimmer 3.5s ease-in-out infinite 2s', pointerEvents:'none',
                }} />
              </button>
              <p style={{ fontSize:11.5, color:'rgba(255,255,255,0.25)', margin:'10px 0 0', fontFamily:"'DM Sans',sans-serif" }}>
                No account needed — enter a route and generate in seconds
              </p>
            </div>

            {/* stats strip */}
            <div style={{
              display:'flex', alignItems:'center', gap:24,
              marginTop:36, paddingTop:24,
              borderTop:'1px solid rgba(255,255,255,0.07)',
              opacity:active?1:0, transition:`opacity 500ms ease 0.6s`,
            }}>
              <StatItem value={70}  suffix="hr" label="Cycle Limit"    delay={0.52} active={active} />
              <div style={{ width:1, height:36, background:'rgba(255,255,255,0.08)', flexShrink:0 }} />
              <StatItem value={11}  suffix="hr" label="Daily Max"      delay={0.60} active={active} />
              <div style={{ width:1, height:36, background:'rgba(255,255,255,0.08)', flexShrink:0 }} />
              <StatItem value={100} suffix="%" label="FMCSA Compliant" delay={0.68} active={active} numColor="#4ADE80" />
            </div>
          </div>

          {/* Right panel */}
          <RightPanel mobile={mobile} onSlideChange={setSlideIndex} />
        </div>
      </div>
    </>
  )
}
