import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ── Pin marker factory ────────────────────────────────────────────────────────

const PIN_FILLS = {
  start:   '#FFFFFF',
  pickup:  '#4ADE80',
  dropoff: '#F87171',
  rest:    '#1E2235',
  fuel:    '#1E2235',
}

function makePinIcon(type, animate = false, index = 0) {
  const fill   = PIN_FILLS[type] || '#94A3B8'
  const isStart = type === 'start'
  const isDark  = type === 'rest' || type === 'fuel'
  const delayMs = animate ? index * 100 : 0

  const animStyle = animate
    ? `style="animation:markerBounceIn 350ms cubic-bezier(0.34,1.56,0.64,1) ${delayMs}ms both;"`
    : ''

  let inner = ''
  if (isStart) {
    inner = `<circle cx="10" cy="10" r="4" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="2"/>`
  } else if (isDark) {
    const sym = type === 'rest' ? '⏸' : '⛽'
    inner = `<text x="10" y="14" text-anchor="middle" font-size="9" fill="#FFFFFF" font-family="DM Sans,sans-serif">${sym}</text>`
  } else {
    inner = `
      <circle cx="10" cy="10" r="4" fill="rgba(0,0,0,0.15)"/>
      <circle cx="10" cy="10" r="3.5" fill="rgba(255,255,255,0.9)"/>
      <text x="10" y="13.5" text-anchor="middle" font-size="6" font-weight="700" fill="${fill}" font-family="DM Sans,sans-serif">
        ${type === 'pickup' ? 'P' : 'D'}
      </text>`
  }

  const svg = `
    <svg ${animStyle} width="20" height="32" viewBox="0 0 20 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 0C4.477 0 0 4.477 0 10c0 7.18 10 22 10 22S20 17.18 20 10C20 4.477 15.523 0 10 0z"
        fill="${fill}" stroke="rgba(255,255,255,0.9)" stroke-width="1.5"/>
      ${inner}
    </svg>
  `
  return L.divIcon({
    className: '',
    html: svg,
    iconSize: [20, 32],
    iconAnchor: [10, 32],
    popupAnchor: [0, -34],
  })
}

// ── Fit bounds + animate polyline ─────────────────────────────────────────────

function FitAndAnimate({ coords, animate, panelOpen }) {
  const map = useMap()
  const animated = useRef(false)

  useEffect(() => {
    if (!coords || coords.length < 2) return
    const latLngs = coords.map(([lon, lat]) => [lat, lon])
    // When the log panel is open (42% right), shift the visible center left
    const rightPad = panelOpen ? Math.round(window.innerWidth * 0.42) + 40 : 60
    map.fitBounds(L.latLngBounds(latLngs), {
      paddingTopLeft:     [60, 60],
      paddingBottomRight: [rightPad, 60],
      animate: true,
    })

    if (animate && !animated.current) {
      animated.current = true
      setTimeout(() => {
        const paths = map.getContainer().querySelectorAll('.leaflet-overlay-pane path')
        paths.forEach(path => {
          try {
            const len = path.getTotalLength()
            path.style.strokeDasharray = len
            path.style.strokeDashoffset = len
            path.getBoundingClientRect()
            path.style.transition = 'stroke-dashoffset 1400ms ease-in-out'
            path.style.strokeDashoffset = 0
          } catch (_) {}
        })
      }, 400)
    }
  }, [coords, animate, map, panelOpen])

  return null
}

// ── Map ready callback ────────────────────────────────────────────────────────

function MapReadyCallback({ onMapReady }) {
  const map = useMap()
  useEffect(() => {
    if (onMapReady) onMapReady(map)
    return () => { if (onMapReady) onMapReady(null) }
  }, [map, onMapReady])
  return null
}

// ── MapView ───────────────────────────────────────────────────────────────────

export default function MapView({ route, animate = false, onMapReady, isLoading = false, panelOpen = false }) {
  const coords   = route?.geometry?.coordinates || []
  const polyline = coords.map(([lon, lat]) => [lat, lon])
  const center   = polyline[Math.floor(polyline.length / 2)] || [39.5, -98.35]
  const mappable = (route?.stops || []).filter(s => s.lat != null && s.lon != null)

  return (
    <MapContainer
      center={center}
      zoom={5}
      style={{
        height: '100%',
        width: '100%',
        filter: isLoading ? 'brightness(0.7)' : 'brightness(1)',
        transition: 'filter 300ms ease',
      }}
      scrollWheelZoom
      zoomControl={false}
    >
      {/* Stadia Alidade Smooth Dark */}
      <TileLayer
        attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
      />

      {/* White route line */}
      {polyline.length > 1 && (
        <Polyline
          positions={polyline}
          pathOptions={{ color: '#FFFFFF', weight: 3, opacity: 0.95 }}
        />
      )}

      {/* Markers */}
      {mappable.map((stop, i) => (
        <Marker key={i} position={[stop.lat, stop.lon]} icon={makePinIcon(stop.type, animate, i)}>
          <Tooltip direction="top" offset={[0, -34]} className="map-tip">
            <strong style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.82rem', color: '#FFFFFF' }}>{stop.label}</strong>
            {stop.time && (
              <><br /><span style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.5)', fontFamily: "'DM Sans', sans-serif" }}>{_fmt(stop.time)}</span></>
            )}
          </Tooltip>
        </Marker>
      ))}

      <FitAndAnimate coords={coords} animate={animate} panelOpen={panelOpen} />
      <MapReadyCallback onMapReady={onMapReady} />
    </MapContainer>
  )
}

function _fmt(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}
