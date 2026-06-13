import { useState, useRef, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL ?? ''

function LocationField({ label, value, onChange, placeholder }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen]               = useState(false)
  const debounce = useRef(null)
  const wrapRef  = useRef(null)

  function handleInput(e) {
    const q = e.target.value
    onChange(q)
    clearTimeout(debounce.current)
    if (q.length < 2) { setSuggestions([]); setOpen(false); return }
    debounce.current = setTimeout(async () => {
      try {
        const r    = await fetch(`${API}/api/geocode/?q=${encodeURIComponent(q)}`)
        const data = await r.json()
        setSuggestions(data.suggestions || [])
        setOpen(true)
      } catch { setSuggestions([]) }
    }, 280)
  }

  function pick(s) { onChange(s); setSuggestions([]); setOpen(false) }

  useEffect(() => {
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <label style={labelStyle}>{label}</label>
      <input
        type="text" value={value}
        onChange={handleInput}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="trip-input"
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul style={dropdownStyle}>
          {suggestions.map((s, i) => (
            <li key={i} onMouseDown={() => pick(s)} style={suggestionStyle}
              onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              onMouseOut={e  => (e.currentTarget.style.background = 'transparent')}
            >{s}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function TripForm({ onSubmit, isLoading, initialValues = {} }) {
  const [form, setForm] = useState({
    current_location:    initialValues.current_location    || '',
    pickup_location:     initialValues.pickup_location     || '',
    dropoff_location:    initialValues.dropoff_location    || '',
    // Default to 0 — most drivers start a fresh 70-hr cycle
    current_cycle_hours: initialValues.current_cycle_hours !== undefined
      ? String(initialValues.current_cycle_hours)
      : '0',
  })
  const [errors, setErrors] = useState({})

  // Clears the error for a field as soon as the user edits it
  const set = key => v => {
    setForm(f => ({ ...f, [key]: v }))
    setErrors(e => { const next = { ...e }; delete next[key]; return next })
  }

  function validate() {
    const e   = {}
    const hrs = parseFloat(form.current_cycle_hours)

    if (!form.current_location.trim())  e.current_location  = 'Enter your current city or address'
    if (!form.pickup_location.trim())   e.pickup_location   = 'Enter a pickup city or address'
    if (!form.dropoff_location.trim())  e.dropoff_location  = 'Enter a dropoff city or address'
    if (isNaN(hrs) || hrs < 0 || hrs > 70)
      e.current_cycle_hours = 'Enter a number from 0 to 70'

    return e
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    onSubmit({ ...form, current_cycle_hours: parseFloat(form.current_cycle_hours) })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        <div>
          <LocationField label="Current Location" value={form.current_location}
            onChange={set('current_location')} placeholder="e.g. Chicago, IL" />
          {errors.current_location && <FieldError msg={errors.current_location} />}
        </div>

        <div>
          <LocationField label="Pickup Location" value={form.pickup_location}
            onChange={set('pickup_location')} placeholder="e.g. St. Louis, MO" />
          {errors.pickup_location && <FieldError msg={errors.pickup_location} />}
        </div>

        <div>
          <LocationField label="Dropoff Location" value={form.dropoff_location}
            onChange={set('dropoff_location')} placeholder="e.g. Dallas, TX" />
          {errors.dropoff_location && <FieldError msg={errors.dropoff_location} />}
        </div>

        <div>
          <label style={labelStyle}>Cycle Hours Used</label>
          <input
            type="number" min={0} max={70} step={0.5}
            value={form.current_cycle_hours}
            onChange={e => set('current_cycle_hours')(e.target.value)}
            placeholder="0 – 70 hrs"
            className="trip-input"
          />
          {errors.current_cycle_hours && <FieldError msg={errors.current_cycle_hours} />}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          style={{
            marginTop: 4, padding: '12px',
            borderRadius: 8, border: 'none',
            background: isLoading ? 'rgba(255,255,255,0.7)' : '#FFFFFF',
            color: '#0D0F17', fontWeight: 600, fontSize: 14,
            fontFamily: "'DM Sans', sans-serif",
            cursor: isLoading ? 'not-allowed' : 'pointer',
            width: '100%', opacity: isLoading ? 0.7 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 150ms ease, opacity 150ms ease',
          }}
          onMouseOver={e => !isLoading && (e.currentTarget.style.background = 'rgba(255,255,255,0.9)')}
          onMouseOut={e  => !isLoading && (e.currentTarget.style.background = '#FFFFFF')}
        >
          {isLoading && <span className="btn-spinner" />}
          {isLoading ? 'Calculating…' : 'Generate Logs'}
        </button>

      </div>
    </form>
  )
}

function FieldError({ msg }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:5 }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink:0 }}>
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span style={{ color:'#F87171', fontSize:'0.7rem' }}>{msg}</span>
    </div>
  )
}

const labelStyle = {
  display: 'block', marginBottom: 6,
  fontSize: 11, fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.55)',
  fontFamily: "'DM Sans', sans-serif",
}

const dropdownStyle = {
  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1200,
  background: '#12151E',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, marginTop: 3, padding: 0, listStyle: 'none',
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  maxHeight: 200, overflowY: 'auto',
}

const suggestionStyle = {
  padding: '9px 14px', cursor: 'pointer',
  fontSize: 14, color: '#FFFFFF',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  background: 'transparent', transition: 'background 100ms',
}
