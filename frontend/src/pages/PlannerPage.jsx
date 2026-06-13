import { useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_API_URL ?? ''
import TripForm from '../components/TripForm'
import MapView from '../components/MapView'
import { MOCK_TRIP } from '../utils/mockData'
import { renderDayLog, calcCanvasHeight } from '../utils/renderLog'
import { useNavigate } from 'react-router-dom'

const EASE = 'cubic-bezier(0.22,1,0.36,1)'

const KEYFRAMES = `
  @keyframes glowPulse { 0%,100% { opacity:0.5; } 50% { opacity:1; } }
  .map-tip { background: rgba(13,15,23,0.92) !important; border: 1px solid rgba(255,255,255,0.12) !important; border-radius: 6px !important; padding: 6px 10px !important; box-shadow: 0 4px 16px rgba(0,0,0,0.5) !important; }
  .map-tip::before { border-top-color: rgba(13,15,23,0.92) !important; }
`

// ── Icons ─────────────────────────────────────────────────────────────────────
const TruckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" rx="1"/>
    <path d="M16 8h4l3 5v4h-7V8z"/>
    <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
)
const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)
const ArrowRight = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
)

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBarTop({ isLoading }) {
  const [phase, setPhase] = useState(null)
  const prevRef = useRef(false)
  useEffect(() => {
    if (isLoading) {
      setPhase('filling'); prevRef.current = true
    } else if (prevRef.current) {
      setPhase('complete')
      setTimeout(() => setPhase('fade'), 200)
      setTimeout(() => setPhase(null), 700)
      prevRef.current = false
    }
  }, [isLoading])
  if (!phase) return null
  return (
    <div style={{ position:'absolute', top:0, left:0, right:0, height:3, zIndex:2000, background:'rgba(255,255,255,0.08)' }}>
      <div style={{
        height:'100%', background:'#FFFFFF',
        width: phase === 'filling' ? '80%' : '100%',
        opacity: phase === 'fade' ? 0 : 1,
        transition: phase === 'filling' ? 'width 3s ease-out' : phase === 'complete' ? 'width 0.2s ease' : 'opacity 0.5s ease',
      }} />
    </div>
  )
}

// ── Compact summary (shown in card after generation) ──────────────────────────
function CompactCard({ formData, display, onNewTrip }) {
  const from  = formData?.current_location || '—'
  const pick  = formData?.pickup_location  || '—'
  const to    = formData?.dropoff_location || '—'
  const miles = display?.route?.total_miles?.toFixed(0) ?? '—'
  const days  = display?.schedule?.total_days ?? '—'
  const hrs   = display?.schedule?.total_driving_hrs?.toFixed(1) ?? '—'

  return (
    <div>
      {/* Route stops */}
      <div style={{ marginBottom:14 }}>
        {[
          { label:'FROM',   value: from },
          { label:'PICKUP', value: pick },
          { label:'TO',     value: to   },
        ].map(({ label, value }, i) => (
          <div key={label} style={{ marginBottom: i < 2 ? 10 : 0 }}>
            <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.1em', color:'rgba(255,255,255,0.35)', marginBottom:2, fontFamily:"'DM Sans',sans-serif" }}>{label}</div>
            <div style={{ fontSize:12.5, fontWeight:600, color:'#FFFFFF', lineHeight:1.3, fontFamily:"'DM Sans',sans-serif" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display:'flex', paddingTop:12, marginBottom:14, borderTop:'1px solid rgba(255,255,255,0.07)' }}>
        {[
          { val: miles, unit:'mi',  label:'Distance'  },
          { val: days,  unit:'d',   label:'Days'      },
          { val: hrs,   unit:'hrs', label:'Drive Time' },
        ].map(({ val, unit, label }, i) => (
          <div key={label} style={{
            flex:1, textAlign:'center',
            borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.07)' : 'none',
            paddingLeft: i > 0 ? 10 : 0,
          }}>
            <div style={{ fontSize:17, fontWeight:800, color:'#FFFFFF', letterSpacing:'-0.02em', lineHeight:1, fontFamily:"'DM Sans',sans-serif" }}>
              {val}<span style={{ fontSize:9, color:'rgba(255,255,255,0.32)', marginLeft:2 }}>{unit}</span>
            </div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.32)', letterSpacing:'0.07em', marginTop:3, textTransform:'uppercase', fontFamily:"'DM Sans',sans-serif" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* New trip */}
      <button onClick={onNewTrip} style={{
        background:'none', border:'none', cursor:'pointer',
        fontSize:11.5, color:'rgba(255,255,255,0.35)',
        fontFamily:"'DM Sans',sans-serif", padding:0,
        transition:'color 150ms ease',
      }}
        onMouseOver={e => (e.currentTarget.style.color='rgba(255,255,255,0.7)')}
        onMouseOut={e  => (e.currentTarget.style.color='rgba(255,255,255,0.35)')}
      >← New Trip</button>
    </div>
  )
}

// ── Log panel (right side after generation) ───────────────────────────────────
function LogPanel({ schedule, usingMock, mockReason, display, formData, onNewTrip, active }) {
  const [currentDay, setCurrentDay] = useState(0)
  const [dayVisible, setDayVisible] = useState(true)
  const canvasRef = useRef(null)
  const wrapRef   = useRef(null)

  const days = schedule?.days || []
  const day  = days[currentDay]

  const rollingOnDuty = days
    .slice(0, currentDay)
    .reduce((sum, d) => sum + (d.total_on_duty_hrs || 0), 0)

  const tripMeta = {
    total_miles: schedule?.total_miles_today?.[currentDay] ?? 0,
    // Day 1 starts where the driver currently is (current_location), not the
    // first block's destination. Subsequent days correctly use the block location.
    from: currentDay === 0
      ? (formData?.current_location || day?.blocks?.[0]?.location || '')
      : (day?.blocks?.[0]?.location || ''),
    to: day?.blocks?.[day?.blocks?.length - 1]?.location || '',
  }

  useEffect(() => {
    if (!canvasRef.current || !day) return
    const canvas = canvasRef.current
    canvas.height = calcCanvasHeight(day)
    renderDayLog(canvas, day, tripMeta, rollingOnDuty)
  }, [currentDay, day])

  function changeDay(i) {
    setDayVisible(false)
    setTimeout(() => { setCurrentDay(i); setDayVisible(true) }, 100)
  }

  async function handleDownload() {
    if (!canvasRef.current || !day) return
    try {
      const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'), import('html2canvas'),
      ])
      const cvs = await html2canvas(canvasRef.current, { scale:2.5, useCORS:true, logging:false })
      const img = cvs.toDataURL('image/png')
      const pdf = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' })
      const pW = pdf.internal.pageSize.getWidth()
      const pH = pdf.internal.pageSize.getHeight()
      const ratio = cvs.height / cvs.width
      const imgH = Math.min((pW - 20) * ratio, pH - 20)
      pdf.addImage(img, 'PNG', 10, 10, pW - 20, imgH)
      pdf.save(`ELD-Log-Day-${currentDay + 1}.pdf`)
    } catch (err) { console.error('PDF export failed', err) }
  }

  return (
    <div style={{
      width:'100%', height:'100%',
      display:'flex', flexDirection:'column',
      background:'rgba(10,12,20,0.97)',
      borderLeft:'1px solid rgba(255,255,255,0.07)',
      opacity: active ? 1 : 0,
      transform: active ? 'none' : 'translateX(20px)',
      transition:`opacity 550ms ${EASE}, transform 550ms ${EASE}`,
    }}>

      {/* Mock notice */}
      {usingMock && (
        <div style={{
          padding:'7px 20px', flexShrink:0,
          background:'rgba(251,191,36,0.07)',
          borderBottom:'1px solid rgba(251,191,36,0.14)',
          fontSize:11, color:'rgba(251,191,36,0.72)',
          fontFamily:"'DM Sans',sans-serif",
        }}>
          Showing sample route data.{mockReason ? ` Reason: ${mockReason}` : ' Live routing unavailable.'}
        </div>
      )}

      {/* Trip summary */}
      <div style={{ padding:'14px 20px 12px', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10, flexWrap:'wrap' }}>
          <span style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.88)', fontFamily:"'DM Sans',sans-serif" }}>
            {formData?.current_location || '—'}
          </span>
          <span style={{ color:'rgba(255,255,255,0.25)' }}><ArrowRight /></span>
          <span style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.88)', fontFamily:"'DM Sans',sans-serif" }}>
            {formData?.dropoff_location || '—'}
          </span>
        </div>
        <div style={{ display:'flex', gap:18 }}>
          {[
            { val:`${display?.route?.total_miles?.toFixed(0)} mi`,            label:'Distance'  },
            { val:`${display?.schedule?.total_days} days`,                     label:'Days'      },
            { val:`${display?.schedule?.total_driving_hrs?.toFixed(1)} hrs`,  label:'Drive Time' },
          ].map(({ val, label }) => (
            <div key={label}>
              <div style={{ fontSize:14, fontWeight:800, color:'#FFFFFF', letterSpacing:'-0.02em', lineHeight:1, fontFamily:"'DM Sans',sans-serif" }}>{val}</div>
              <div style={{ fontSize:9, fontWeight:600, color:'rgba(255,255,255,0.32)', letterSpacing:'0.07em', marginTop:3, textTransform:'uppercase', fontFamily:"'DM Sans',sans-serif" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Day tabs + download */}
      <div style={{
        display:'flex', alignItems:'center', gap:6,
        padding:'10px 20px',
        borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0,
      }}>
        <div style={{ display:'flex', gap:6, flex:1 }}>
          {days.map((_, i) => {
            const sel = i === currentDay
            return (
              <button key={i} onClick={() => changeDay(i)} style={{
                padding:'5px 14px', borderRadius:6, border:'none', cursor:'pointer',
                background: sel ? '#FFFFFF' : 'rgba(255,255,255,0.06)',
                color: sel ? '#0D0F17' : 'rgba(255,255,255,0.45)',
                fontWeight: sel ? 700 : 500, fontSize:12,
                fontFamily:"'DM Sans',sans-serif",
                transition:'background 180ms, color 180ms',
              }}
                onMouseOver={e => !sel && (e.currentTarget.style.background='rgba(255,255,255,0.1)')}
                onMouseOut={e  => !sel && (e.currentTarget.style.background='rgba(255,255,255,0.06)')}
              >Day {i + 1}</button>
            )
          })}
        </div>
        <button onClick={handleDownload} title="Download PDF" style={{
          display:'flex', alignItems:'center', gap:5,
          background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
          borderRadius:6, padding:'5px 12px', cursor:'pointer',
          color:'rgba(255,255,255,0.5)', fontSize:11, fontWeight:600,
          fontFamily:"'DM Sans',sans-serif",
          transition:'background 150ms, color 150ms',
        }}
          onMouseOver={e => { e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#FFFFFF' }}
          onMouseOut={e  => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='rgba(255,255,255,0.5)' }}
        >
          <DownloadIcon /> PDF
        </button>
      </div>

      {/* Canvas */}
      <div ref={wrapRef} style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
        <div style={{
          background:'#FAF8F4', borderRadius:8,
          boxShadow:'0 4px 32px rgba(0,0,0,0.6)',
          overflow:'hidden',
          opacity: dayVisible ? 1 : 0,
          transition:'opacity 100ms ease',
        }}>
          <canvas ref={canvasRef} width={900} style={{ width:'100%', display:'block' }} />
        </div>
      </div>

    </div>
  )
}

// ── Zoom controls ─────────────────────────────────────────────────────────────
function ZoomControls({ mapInstance, panelOpen }) {
  if (!mapInstance) return null
  const btn = (label, action) => (
    <button onClick={action} style={{
      width:36, height:36, background:'rgba(13,15,23,0.82)', backdropFilter:'blur(12px)',
      border:'1px solid rgba(255,255,255,0.09)', borderRadius:8,
      color:'#FFFFFF', fontSize:18, cursor:'pointer', lineHeight:1,
      fontFamily:'system-ui', transition:'background 150ms ease',
    }}
      onMouseOver={e => (e.currentTarget.style.background='rgba(255,255,255,0.1)')}
      onMouseOut={e  => (e.currentTarget.style.background='rgba(13,15,23,0.82)')}
    >{label}</button>
  )
  return (
    <div style={{
      position:'absolute',
      right: panelOpen ? 'calc(42% + 16px)' : 16,
      bottom:24, zIndex:500,
      display:'flex', flexDirection:'column', gap:4,
      transition:'right 700ms ease',
    }}>
      {btn('+', () => mapInstance.zoomIn())}
      {btn('−', () => mapInstance.zoomOut())}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PlannerPage() {
  const navigate = useNavigate()

  const [formActive,   setFormActive]   = useState(false)
  const [cardMoved,    setCardMoved]    = useState(false)
  const [cardContent,  setCardContent]  = useState('form')   // 'form' | 'summary'
  const [cardFade,     setCardFade]     = useState(true)     // inner content visible
  const [bgVisible,    setBgVisible]    = useState(true)     // dark overlay over map
  const [panelMounted, setPanelMounted] = useState(false)
  const [panelVisible, setPanelVisible] = useState(false)
  const [tripData,     setTripData]     = useState(null)
  const [isLoading,    setIsLoading]    = useState(false)
  const [usingMock,    setUsingMock]    = useState(false)
  const [mockReason,   setMockReason]   = useState('')
  const [formData,     setFormData]     = useState(null)
  const [mapInstance,  setMapInstance]  = useState(null)
  const [formKey,      setFormKey]      = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setFormActive(true), 80)
    return () => clearTimeout(t)
  }, [])

  async function handleSubmit(data) {
    setFormData(data)
    setIsLoading(true)
    let result = null, mock = false, reason = ''
    try {
      const res  = await fetch(`${API}/api/trip/plan/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        result = MOCK_TRIP; mock = true
        reason = json.error || 'Routing service returned an error'
      } else {
        result = json
      }
    } catch {
      result = MOCK_TRIP; mock = true
      reason = 'Could not reach the server — showing sample route'
    } finally {
      setIsLoading(false)
    }

    setTripData(result)
    setUsingMock(mock)
    setMockReason(reason)

    // ── Transition sequence ──────────────────────────────────────
    // t=0:   card begins sliding to upper-left, dark bg starts fading out
    setBgVisible(false)
    setCardMoved(true)

    // t=300: fade out form content inside the card
    setTimeout(() => setCardFade(false), 300)

    // t=500: swap to compact summary, fade it in
    setTimeout(() => { setCardContent('summary'); setCardFade(true) }, 500)

    // t=350: mount log panel
    // t=450: fade log panel in
    setTimeout(() => setPanelMounted(true), 350)
    setTimeout(() => setPanelVisible(true),  450)
  }

  function handleNewTrip() {
    // ── Reverse sequence ─────────────────────────────────────────
    // t=0: panel slides out
    setPanelVisible(false)

    // t=200: fade out summary content
    setTimeout(() => setCardFade(false), 200)

    // t=350: unmount panel, swap content back to form, move card to center, bg fades in
    setTimeout(() => {
      setPanelMounted(false)
      setCardContent('form')
      setCardMoved(false)
      setCardFade(true)
      setBgVisible(true)
      setFormKey(k => k + 1)
    }, 350)

    // t=1000: clear trip data after card arrives back
    setTimeout(() => {
      setTripData(null)
      setUsingMock(false)
      setMockReason('')
    }, 1000)
  }

  const display  = tripData || MOCK_TRIP
  const schedule = {
    ...display.schedule,
    total_miles_today: display.schedule.days.map(d => Math.round(d.total_driving_hrs * 55)),
  }

  // Card position — CSS transitions handle the physical movement
  const cardPos = cardMoved
    ? { top:'92px', left:'24px', transform:'translate(0,0)', width:'280px', maxHeight:'none', overflowY:'visible' }
    : { top:'calc(50% + 26px)', left:'50%', transform:'translate(-50%,-50%)', width:'420px', maxHeight:'calc(100vh - 80px)', overflowY:'auto' }

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={{ height:'100vh', overflow:'hidden', background:'#0D0F17', fontFamily:"'DM Sans',sans-serif" }}>

        <ProgressBarTop isLoading={isLoading} />

        {/* ── Map — always rendered beneath everything ───────────── */}
        <div style={{ position:'absolute', inset:0, zIndex:0 }}>
          <MapView
            route={display.route}
            animate={!!tripData}
            onMapReady={setMapInstance}
            isLoading={isLoading}
            panelOpen={panelMounted && panelVisible}
          />
        </div>

        {/* ── Map legend — only shows types present in this trip ──── */}
        {panelMounted && (() => {
          const ALL_LEGEND = [
            { type:'start',   color:'#FFFFFF', label:'Start'     },
            { type:'pickup',  color:'#4ADE80', label:'Pickup'    },
            { type:'dropoff', color:'#F87171', label:'Dropoff'   },
            { type:'rest',    color:'#94A3B8', label:'Rest Stop' },
            { type:'fuel',    color:'#F59E0B', label:'Fuel Stop' },
          ]
          const presentTypes = new Set((display.route?.stops || []).map(s => s.type))
          const items = ALL_LEGEND.filter(i => presentTypes.has(i.type))
          if (!items.length) return null
          return (
            <div style={{
              position:'absolute', bottom:24, left:16, zIndex:500,
              background:'rgba(13,15,23,0.82)', backdropFilter:'blur(12px)',
              border:'1px solid rgba(255,255,255,0.09)', borderRadius:8,
              padding:'10px 14px',
              opacity: panelVisible ? 1 : 0,
              transition:'opacity 500ms ease',
            }}>
              <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.1em', color:'rgba(255,255,255,0.3)', marginBottom:8, fontFamily:"'DM Sans',sans-serif" }}>MAP LEGEND</div>
              {items.map(({ color, label }) => (
                <div key={label} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:color, border:'1px solid rgba(255,255,255,0.2)', flexShrink:0 }} />
                  <span style={{ fontSize:11, color:'rgba(255,255,255,0.6)', fontFamily:"'DM Sans',sans-serif" }}>{label}</span>
                </div>
              ))}
            </div>
          )
        })()}

        {/* ── Dark bg overlay — fades out to reveal map ─────────── */}
        <div style={{
          position:'absolute', inset:0, zIndex:1,
          background:'#0D0F17', pointerEvents:'none',
          opacity: bgVisible ? 1 : 0,
          transition:'opacity 900ms ease',
        }} />

        {/* ── Grid ─────────────────────────────────────────────── */}
        <div style={{
          position:'absolute', inset:0, zIndex:2, pointerEvents:'none',
          backgroundImage:[
            'linear-gradient(rgba(255,255,255,0.032) 1px,transparent 1px)',
            'linear-gradient(90deg,rgba(255,255,255,0.032) 1px,transparent 1px)',
          ].join(','),
          backgroundSize:'52px 52px',
          opacity: bgVisible ? 1 : 0,
          transition:'opacity 900ms ease',
        }} />

        {/* ── Left spotlight ────────────────────────────────────── */}
        <div style={{
          position:'absolute', inset:0, zIndex:2, pointerEvents:'none',
          background:'radial-gradient(ellipse 55% 70% at 35% 50%,rgba(255,255,255,0.055) 0%,transparent 68%)',
          opacity: bgVisible ? 1 : 0,
          transition:'opacity 900ms ease',
        }} />

        {/* ── Header ────────────────────────────────────────────── */}
        <div style={{
          position:'absolute', top:0, left:0, right:0, zIndex:1000,
          height:52, display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'0 32px',
          borderBottom:'1px solid rgba(255,255,255,0.055)',
          background:'rgba(13,15,23,0.65)', backdropFilter:'blur(12px)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{
              width:26, height:26, borderRadius:5,
              background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)',
              display:'flex', alignItems:'center', justifyContent:'center', color:'#E8EDF5',
            }}><TruckIcon /></div>
            <span style={{ color:'rgba(255,255,255,0.8)', fontWeight:700, fontSize:'0.82rem', letterSpacing:'0.05em' }}>
              ELD LOGGER / HOS COMPLIANCE
            </span>
          </div>
          <button
            onClick={() => navigate('/')}
            style={{
              background:'transparent', border:'1px solid rgba(255,255,255,0.12)',
              color:'rgba(255,255,255,0.45)', borderRadius:5,
              padding:'4px 12px', fontSize:'0.75rem', cursor:'pointer',
              fontFamily:"'DM Sans',sans-serif",
              transition:'border-color 0.2s, color 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.3)'; e.currentTarget.style.color='#FFFFFF' }}
            onMouseOut={e  => { e.currentTarget.style.borderColor='rgba(255,255,255,0.12)'; e.currentTarget.style.color='rgba(255,255,255,0.45)' }}
          >← Back</button>
        </div>

        {/* ── Log panel (mounts on result, unmounts on new trip) ── */}
        {panelMounted && (
          <div style={{
            position:'absolute', top:52, right:0, bottom:0, width:'42%', zIndex:100,
          }}>
            <LogPanel
              schedule={schedule}
              usingMock={usingMock}
              mockReason={mockReason}
              display={display}
              formData={formData}
              onNewTrip={handleNewTrip}
              active={panelVisible}
            />
          </div>
        )}

        {/* ── Zoom controls ────────────────────────────────────── */}
        <ZoomControls mapInstance={mapInstance} panelOpen={panelMounted && panelVisible} />

        {/* ── Floating card — position animates center → upper-left ─ */}
        <div style={{
          position:'fixed', zIndex:600,
          background:'rgba(13,15,23,0.92)',
          backdropFilter:'blur(20px) saturate(180%)',
          border:'1px solid rgba(255,255,255,0.09)',
          borderRadius:14, padding:'20px 24px',
          boxShadow:'0 8px 40px rgba(0,0,0,0.5)',
          // ── animated position ──
          ...cardPos,
          transition:`top 700ms ${EASE}, left 700ms ${EASE}, transform 700ms ${EASE}, width 550ms ${EASE}, opacity 400ms ease`,
          // ── entrance ──
          opacity: formActive ? 1 : 0,
        }}>

          {/* Card label */}
          <div style={{
            fontSize:10, fontWeight:700, letterSpacing:'0.12em',
            color:'rgba(255,255,255,0.38)', marginBottom:14,
            fontFamily:"'DM Sans',sans-serif",
          }}>
            {cardContent === 'form' ? 'PLAN A TRIP' : 'ROUTE SUMMARY'}
          </div>

          {/* Content — cross-fades when content type swaps */}
          <div style={{ opacity: cardFade ? 1 : 0, transition:'opacity 200ms ease' }}>
            {cardContent === 'form'
              ? <TripForm key={formKey} onSubmit={handleSubmit} isLoading={isLoading} initialValues={formData || {}} />
              : <CompactCard formData={formData} display={display} onNewTrip={handleNewTrip} />
            }
          </div>

        </div>

      </div>
    </>
  )
}
