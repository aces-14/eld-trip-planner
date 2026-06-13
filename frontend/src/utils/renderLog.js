/*
 * renderLog.js — FMCSA Driver's Daily Log canvas renderer
 * Format matches standard FMCSA Driver's Daily Log form.
 */

// ── Layout ────────────────────────────────────────────────────────────────────
const LABEL_W    = 160   // row-label column (left)
const TOTAL_W    = 54    // "Total Hours" column (right)
const R_PAD      = 8     // right margin

const HDR_DARK   = 32    // dark title bar height
const HDR_ROW    = 36    // each white field row height
const HEADER_H   = HDR_DARK + HDR_ROW * 3   // 140

const COL_HDR_H  = 21
const GRID_TOP   = HEADER_H + COL_HDR_H     // 161
const ROW_H      = 37
const GRID_H     = ROW_H * 4                // 148
const GRID_BOT   = GRID_TOP + GRID_H        // 309

// Row config
const STATUS_ROW = { off_duty: 0, sleeper_berth: 1, driving: 2, on_duty: 3 }
const ROW_COLOR  = {
  off_duty:      '#60A5FA',   // blue
  sleeper_berth: '#94A3B8',   // slate
  driving:       '#4ADE80',   // green
  on_duty:       '#F59E0B',   // amber
}
const ROW_LABELS = [
  { num: '1.', a: 'Off Duty' },
  { num: '2.', a: 'Sleeper', b: 'Berth' },
  { num: '3.', a: 'Driving' },
  { num: '4.', a: 'On Duty', b: '(not driving)' },
]

// ── Font helpers ──────────────────────────────────────────────────────────────
const FB  = sz => `${sz}px "DM Sans", sans-serif`
const FM  = sz => `${sz}px "JetBrains Mono", monospace`
const FHB = sz => `bold ${sz}px "DM Sans", sans-serif`
const FBB = sz => `bold ${sz}px "DM Sans", sans-serif`

// ── Public exports ────────────────────────────────────────────────────────────

export function renderDayLog(canvas, day, tripMeta, rollingOnDuty = 0) {
  const W = canvas.width
  const tW = _tW(W)
  const ctx = canvas.getContext('2d')
  _setup(ctx, W, canvas.height)
  _drawHeader(ctx, W, tW, day, tripMeta)
  _drawColHeader(ctx, W, tW)
  _drawGrid(ctx, W, tW)
  _drawBlocks(ctx, tW, day)
  _drawTotalHours(ctx, W, tW, day)
  const y1 = _drawRemarks(ctx, W, day)
  const y2 = _drawShippingDocs(ctx, W, y1)
  _drawRecap(ctx, W, day, rollingOnDuty, y2)
}

export function renderDayLogAnimated(canvas, day, tripMeta, rollingOnDuty = 0) {
  const W = canvas.width
  const tW = _tW(W)
  const ctx = canvas.getContext('2d')
  _setup(ctx, W, canvas.height)
  _drawHeader(ctx, W, tW, day, tripMeta)
  _drawColHeader(ctx, W, tW)
  _drawGrid(ctx, W, tW)
  day.blocks.forEach((b, i) => setTimeout(() => _drawSingleBlock(ctx, tW, b), i * 110))
  setTimeout(() => {
    _drawTotalHours(ctx, W, tW, day)
    const y1 = _drawRemarks(ctx, W, day)
    const y2 = _drawShippingDocs(ctx, W, y1)
    _drawRecap(ctx, W, day, rollingOnDuty, y2)
  }, day.blocks.length * 110 + 120)
}

export function calcCanvasHeight(day) {
  const n = _remarkEntries(day).length
  const remarkH = 22 + Math.max(n, 2) * 15 + 16
  return GRID_BOT + remarkH + 78 + 112
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const _tW = W => W - LABEL_W - TOTAL_W - R_PAD

function _setup(ctx, W, H) {
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#FAF8F4'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = '#B8B0A0'
  ctx.lineWidth = 1.5
  ctx.strokeRect(1, 1, W - 2, H - 2)
}

// ── Header ────────────────────────────────────────────────────────────────────

function _drawHeader(ctx, W, tW, day, { total_miles = 0, from = '', to = '' } = {}) {
  const d = new Date(day.date + 'T12:00:00')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const dayN  = String(d.getDate()).padStart(2, '0')
  const year  = d.getFullYear()

  // ── Dark title bar ──
  ctx.fillStyle = '#12151E'
  ctx.fillRect(0, 0, W, HDR_DARK)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = FHB(12)
  ctx.textAlign = 'left'
  ctx.fillText("DRIVER'S DAILY LOG", 13, 18)
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.font = FB(9)
  ctx.fillText('(24 hours)', 13, HDR_DARK - 5)

  // Date
  const dc = W * 0.52
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = FB(8.5)
  ctx.textAlign = 'center'
  ctx.fillText('(month)', dc - 55, 13)
  ctx.fillText('(day)',   dc,      13)
  ctx.fillText('(year)',  dc + 55, 13)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = FBB(11)
  ctx.fillText(month, dc - 55, 26)
  ctx.fillText(dayN,  dc,      26)
  ctx.fillText(year,  dc + 55, 26)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.font = FB(11)
  ctx.fillText('/', dc - 28, 26)
  ctx.fillText('/', dc + 28, 26)

  // Original / Duplicate note
  ctx.fillStyle = 'rgba(255,255,255,0.38)'
  ctx.font = FB(8)
  ctx.textAlign = 'right'
  ctx.fillText('Original — File at home terminal.', W - 10, 13)
  ctx.fillText('Duplicate — Driver retains in possession for 8 days.', W - 10, 24)

  // ── Field rows (white, alternating) ──
  const rowBg = ['#FDFAF6', '#F7F3EC', '#FDFAF6']
  const sep = '#C8C0B0'

  for (let i = 0; i < 3; i++) {
    const ry = HDR_DARK + i * HDR_ROW
    ctx.fillStyle = rowBg[i]
    ctx.fillRect(0, ry, W, HDR_ROW)
    ctx.strokeStyle = sep; ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.moveTo(0, ry + HDR_ROW); ctx.lineTo(W, ry + HDR_ROW); ctx.stroke()
  }

  // Row 1: From | To
  _vLine(ctx, W * 0.45, HDR_DARK, HDR_DARK + HDR_ROW)
  _hField(ctx, 12, HDR_DARK + 11, HDR_DARK + 24, 'From:', from || '—')
  _hField(ctx, W * 0.45 + 10, HDR_DARK + 11, HDR_DARK + 24, 'To:', to || '—')

  // Row 2: Miles boxes | Carrier
  const r2 = HDR_DARK + HDR_ROW
  _vLine(ctx, W * 0.3,  r2, r2 + HDR_ROW)
  _vLine(ctx, W * 0.52, r2, r2 + HDR_ROW)
  _hField(ctx, 12, r2 + 11, r2 + 24, 'Total Miles Driving Today:', `${Math.round(total_miles)} mi`)
  _hField(ctx, W * 0.3 + 8, r2 + 11, r2 + 24, 'Total Mileage Today:', `${Math.round(total_miles)} mi`)
  _hField(ctx, W * 0.52 + 8, r2 + 11, r2 + 24, 'Name of Carrier or Carriers:', 'ELD Trip Planner')

  // Row 3: Truck | Office | Terminal
  const r3 = HDR_DARK + HDR_ROW * 2
  _vLine(ctx, W * 0.38, r3, r3 + HDR_ROW)
  _vLine(ctx, W * 0.65, r3, r3 + HDR_ROW)
  _hField(ctx, 12, r3 + 11, r3 + 24, 'Truck/Tractor and Trailer Numbers or License Plates:', '—')
  _hField(ctx, W * 0.38 + 8, r3 + 11, r3 + 24, 'Main Office Address:', '—')
  _hField(ctx, W * 0.65 + 8, r3 + 11, r3 + 24, 'Home Terminal Address:', '—')
}

function _hField(ctx, x, labelY, valY, label, value) {
  ctx.fillStyle = '#8A7A68'
  ctx.font = FB(8.5)
  ctx.textAlign = 'left'
  ctx.fillText(label, x, labelY)
  ctx.fillStyle = '#1A1410'
  ctx.font = FBB(10.5)
  ctx.fillText(value, x, valY)
}

function _vLine(ctx, x, y1, y2) {
  ctx.strokeStyle = '#C8C0B0'; ctx.lineWidth = 0.5
  ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke()
}

// ── Column header (hour labels) ───────────────────────────────────────────────

function _drawColHeader(ctx, W, tW) {
  const y = HEADER_H
  ctx.fillStyle = '#E4DDD2'
  ctx.fillRect(0, y, W, COL_HDR_H)

  ctx.strokeStyle = '#B8B0A0'; ctx.lineWidth = 0.8
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(0, y + COL_HDR_H); ctx.lineTo(W, y + COL_HDR_H); ctx.stroke()

  // "Total Hours" header
  ctx.fillStyle = '#4A3E30'
  ctx.font = FM(7.5)
  ctx.textAlign = 'center'
  const tcx = LABEL_W + tW + TOTAL_W / 2
  ctx.fillText('Total', tcx, y + 9)
  ctx.fillText('Hours', tcx, y + COL_HDR_H - 2)

  // Left label area header
  ctx.fillStyle = '#8A7A68'; ctx.font = FM(8); ctx.textAlign = 'right'
  ctx.fillText('Duty Status', LABEL_W - 8, y + COL_HDR_H / 2 + 3)

  // Hour labels: Mid-night, 1..11, Noon, 1..11, Mid-night
  for (let h = 0; h <= 24; h++) {
    const x = LABEL_W + (h / 24) * tW
    let lbl = ''
    if (h === 0 || h === 24) lbl = 'Mid-\nnite'
    else if (h === 12) lbl = 'Noon'
    else lbl = String(h < 12 ? h : h - 12)

    const bold = h === 0 || h === 12 || h === 24
    ctx.fillStyle = bold ? '#3A2E20' : '#7A6A58'
    ctx.font = bold ? FHB(7.5) : FM(8)
    ctx.textAlign = 'center'

    if (lbl.includes('\n')) {
      const [top, bot] = lbl.split('\n')
      ctx.fillText(top, x, y + 8)
      ctx.fillText(bot, x, y + COL_HDR_H - 2)
    } else {
      ctx.fillText(lbl, x, y + COL_HDR_H / 2 + 3)
    }
  }
}

// ── Grid ──────────────────────────────────────────────────────────────────────

function _drawGrid(ctx, W, tW) {
  for (let i = 0; i < 4; i++) {
    const y = GRID_TOP + i * ROW_H
    ctx.fillStyle = i % 2 === 0 ? '#F8F4EE' : '#F2EDE6'
    ctx.fillRect(0, y, W, ROW_H)
    ctx.fillStyle = i % 2 === 0 ? '#EAE4DB' : '#E4DDD3'
    ctx.fillRect(LABEL_W + tW, y, TOTAL_W + R_PAD, ROW_H)

    // Row label
    const { num, a, b } = ROW_LABELS[i]
    ctx.fillStyle = '#3A2E20'; ctx.font = FBB(9); ctx.textAlign = 'left'
    ctx.fillText(num, 8, y + ROW_H / 2 + (b ? 1 : 4))
    ctx.fillStyle = '#2A2018'; ctx.font = FB(9.5); ctx.textAlign = 'right'
    if (b) {
      ctx.fillText(a, LABEL_W - 8, y + ROW_H / 2 - 2)
      ctx.fillText(b, LABEL_W - 8, y + ROW_H / 2 + 10)
    } else {
      ctx.fillText(a, LABEL_W - 8, y + ROW_H / 2 + 4)
    }
  }

  // Horizontal row borders
  ctx.strokeStyle = '#C0B8A8'; ctx.lineWidth = 0.75
  for (let i = 0; i <= 4; i++) {
    const y = GRID_TOP + i * ROW_H
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }

  // Left label divider
  ctx.strokeStyle = '#9A8C7C'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(LABEL_W, GRID_TOP); ctx.lineTo(LABEL_W, GRID_BOT); ctx.stroke()
  // Total hours divider
  ctx.beginPath(); ctx.moveTo(LABEL_W + tW, GRID_TOP); ctx.lineTo(LABEL_W + tW, GRID_BOT); ctx.stroke()

  // Hour vertical lines + quarter ticks
  for (let h = 0; h <= 24; h++) {
    const x = LABEL_W + (h / 24) * tW
    ctx.strokeStyle = h % 6 === 0 ? '#9A8C7C' : '#D0C8BC'
    ctx.lineWidth   = h % 6 === 0 ? 1.2 : 0.5
    ctx.beginPath(); ctx.moveTo(x, GRID_TOP); ctx.lineTo(x, GRID_BOT); ctx.stroke()

    if (h < 24) {
      for (let q = 1; q <= 3; q++) {
        const qx = LABEL_W + ((h + q / 4) / 24) * tW
        for (let r = 0; r < 4; r++) {
          const ry = GRID_TOP + r * ROW_H
          const th = q === 2 ? ROW_H * 0.55 : ROW_H * 0.28
          ctx.strokeStyle = '#D8D0C4'; ctx.lineWidth = 0.4
          ctx.beginPath(); ctx.moveTo(qx, ry); ctx.lineTo(qx, ry + th); ctx.stroke()
        }
      }
    }
  }
}

// ── Status Blocks ─────────────────────────────────────────────────────────────

function _drawBlocks(ctx, tW, day) {
  day.blocks.forEach(b => _drawSingleBlock(ctx, tW, b))
}

function _drawSingleBlock(ctx, tW, block) {
  const row = STATUS_ROW[block.status]
  if (row === undefined) return
  const s = _mins(block.start), e = _mins(block.end)
  if (s >= e) return
  const x1 = LABEL_W + (s / 1440) * tW
  const x2 = LABEL_W + (e / 1440) * tW
  const y  = GRID_TOP + row * ROW_H + 4
  const h  = ROW_H - 8
  const color = ROW_COLOR[block.status] || '#E5E0D8'

  ctx.fillStyle = color
  ctx.beginPath(); ctx.roundRect(x1, y, x2 - x1, h, 2); ctx.fill()
  ctx.strokeStyle = _darken(color, 0.18); ctx.lineWidth = 1; ctx.stroke()
  ctx.strokeStyle = _darken(color, 0.32); ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(x1, y + h / 2); ctx.lineTo(x2, y + h / 2); ctx.stroke()
}

// ── Total Hours column ────────────────────────────────────────────────────────

function _drawTotalHours(ctx, W, tW, day) {
  const rowHours = [0, 0, 0, 0]
  day.blocks.forEach(b => {
    const r = STATUS_ROW[b.status]
    if (r !== undefined) {
      const s = _mins(b.start), e = _mins(b.end)
      if (e > s) rowHours[r] += (e - s) / 60
    }
  })
  const cx = LABEL_W + tW + TOTAL_W / 2
  for (let i = 0; i < 4; i++) {
    const y = GRID_TOP + i * ROW_H
    const hrs = rowHours[i]
    ctx.fillStyle = hrs > 0 ? '#1A1410' : '#B0A890'
    ctx.font = hrs > 0 ? FBB(10.5) : FB(9)
    ctx.textAlign = 'center'
    ctx.fillText(hrs > 0 ? hrs.toFixed(2) : '—', cx, y + ROW_H / 2 + 4)
  }
}

// ── Remarks ───────────────────────────────────────────────────────────────────

function _drawRemarks(ctx, W, day) {
  const top = GRID_BOT + 16
  const padX = 12
  const lineH = 15

  ctx.fillStyle = '#2A2018'; ctx.font = FHB(10); ctx.textAlign = 'left'
  ctx.fillText('Remarks', padX, top + 12)
  ctx.strokeStyle = '#C0B8A8'; ctx.lineWidth = 0.75
  ctx.beginPath(); ctx.moveTo(padX, top + 15); ctx.lineTo(W - R_PAD, top + 15); ctx.stroke()

  const entries = _remarkEntries(day)
  ctx.fillStyle = '#3D2B1F'; ctx.font = FM(9)
  entries.forEach((e, i) => ctx.fillText(e, padX + 4, top + 27 + i * lineH))

  // Two blank ruled lines after entries
  ctx.strokeStyle = '#D0C8B8'; ctx.lineWidth = 0.5
  for (let i = 0; i < 2; i++) {
    const ly = top + 27 + (entries.length + i) * lineH + 2
    ctx.beginPath(); ctx.moveTo(padX + 4, ly); ctx.lineTo(W - R_PAD - 4, ly); ctx.stroke()
  }

  return top + 27 + (entries.length + 2) * lineH + 10
}

function _remarkEntries(day) {
  const entries = []
  let prev = null
  day.blocks.forEach(b => {
    if (b.status !== prev || b.note) {
      const loc = b.location ? `  —  ${b.location}` : ''
      const note = b.note ? ` (${b.note})` : ''
      entries.push(`${_formatTime(b.start)}   ${_sLabel(b.status)}${note}${loc}`)
    }
    prev = b.status
  })
  return entries
}

// ── Shipping Documents ─────────────────────────────────────────────────────────

function _drawShippingDocs(ctx, W, topY) {
  const padX = 12
  ctx.strokeStyle = '#C0B8A8'; ctx.lineWidth = 0.75
  ctx.beginPath(); ctx.moveTo(padX, topY); ctx.lineTo(W - R_PAD, topY); ctx.stroke()

  ctx.fillStyle = '#2A2018'; ctx.font = FHB(10); ctx.textAlign = 'left'
  ctx.fillText('Shipping Documents:', padX, topY + 14)

  // Left column: DVL / Shipper fields
  ctx.fillStyle = '#6A5A4A'; ctx.font = FB(9)
  ctx.fillText('DVL or Manifest No.:', padX + 4, topY + 30)
  ctx.strokeStyle = '#C0B8A8'; ctx.lineWidth = 0.5
  ctx.beginPath(); ctx.moveTo(padX + 118, topY + 32); ctx.lineTo(W * 0.42, topY + 32); ctx.stroke()
  ctx.fillStyle = '#6A5A4A'; ctx.font = FB(8.5)
  ctx.fillText('or', padX + 4, topY + 46)
  ctx.fillText('Shipper & Commodity:', padX + 4, topY + 59)
  ctx.strokeStyle = '#C0B8A8'; ctx.lineWidth = 0.5
  ctx.beginPath(); ctx.moveTo(padX + 122, topY + 61); ctx.lineTo(W * 0.42, topY + 61); ctx.stroke()

  // Right column: instructions
  const ix = W * 0.42 + 12
  ctx.fillStyle = '#7A6A58'; ctx.font = FB(8.5); ctx.textAlign = 'left'
  ctx.fillText('Enter name of place you reported and where released from work', ix, topY + 24)
  ctx.fillText('and when and where each change of duty occurred.', ix, topY + 36)
  ctx.fillText('Use time standard of home terminal.', ix, topY + 48)

  return topY + 76
}

// ── Recap ─────────────────────────────────────────────────────────────────────

function _drawRecap(ctx, W, day, rolling, topY) {
  const padX = 12

  ctx.strokeStyle = '#C0B8A8'; ctx.lineWidth = 0.75
  ctx.beginPath(); ctx.moveTo(padX, topY); ctx.lineTo(W - R_PAD, topY); ctx.stroke()

  // Dark header band
  ctx.fillStyle = '#12151E'
  ctx.fillRect(0, topY, W, 22)
  ctx.fillStyle = '#FFFFFF'; ctx.font = FHB(9); ctx.textAlign = 'left'
  ctx.fillText('RECAP:  Complete at end of day', padX, topY + 14)

  const today  = day.total_on_duty_hrs || 0
  const total  = rolling + today
  const remain70 = Math.max(0, 70 - total)
  const remain60 = Math.max(0, 60 - total)
  const tY = topY + 26
  const tH = 66

  // 70-hr / 8-day panel
  const p1W = W / 2 - padX - 4
  ctx.fillStyle = '#F4F0E8'
  ctx.fillRect(padX, tY, p1W, tH)
  ctx.strokeStyle = '#C0B8A8'; ctx.lineWidth = 0.5
  ctx.strokeRect(padX, tY, p1W, tH)
  ctx.fillStyle = '#3A2E20'; ctx.font = FHB(8.5); ctx.textAlign = 'left'
  ctx.fillText('70 Hour / 8 Day', padX + 6, tY + 12)

  const cols70 = [
    ['A. On-duty\ntoday', today.toFixed(2)],
    ['B. Total on-duty\nprev 7 days', rolling.toFixed(2)],
    ['C. Total\n(A + B)', total.toFixed(2)],
    ['Available\ntomorrow', remain70.toFixed(2)],
  ]
  const cw70 = (p1W - 12) / 4
  _recapCols(ctx, padX + 6, tY, tH, cw70, cols70)

  // 60-hr / 7-day panel
  const p2X = W / 2 + 4
  const p2W = W - p2X - R_PAD
  ctx.fillStyle = '#EDE8E0'
  ctx.fillRect(p2X, tY, p2W, tH)
  ctx.strokeStyle = '#C0B8A8'
  ctx.strokeRect(p2X, tY, p2W, tH)
  ctx.fillStyle = '#3A2E20'; ctx.font = FHB(8.5); ctx.textAlign = 'left'
  ctx.fillText('60 Hour / 7 Day', p2X + 6, tY + 12)

  const cols60 = [
    ['A. On-duty\ntoday', today.toFixed(2)],
    ['B. Total on-duty\nprev 6 days', rolling.toFixed(2)],
    ['C. Total\n(A + B)', total.toFixed(2)],
    ['Available\ntomorrow', remain60.toFixed(2)],
  ]
  const cw60 = (p2W - 12) / 4
  _recapCols(ctx, p2X + 6, tY, tH, cw60, cols60)

  // Footnote
  ctx.fillStyle = '#8A7A68'; ctx.font = FM(7.5); ctx.textAlign = 'left'
  ctx.fillText('*If you took 34 consecutive hours off duty you have 60/70 hours available.', padX, tY + tH + 16)
}

function _recapCols(ctx, startX, tY, tH, cw, cols) {
  cols.forEach(([label, value], i) => {
    const cx = startX + i * cw
    const lines = label.split('\n')
    ctx.fillStyle = '#6A5A48'; ctx.font = FM(7.5); ctx.textAlign = 'left'
    lines.forEach((ln, li) => ctx.fillText(ln, cx, tY + 24 + li * 9))
    ctx.fillStyle = '#1A1410'; ctx.font = FBB(10.5)
    ctx.fillText(`${value} hrs`, cx, tY + tH - 10)
  })
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const _mins = iso => {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
}

const _formatTime = iso => new Date(iso).toLocaleTimeString('en-US', {
  hour: '2-digit', minute: '2-digit', hour12: true,
})

const _sLabel = s => ({
  off_duty: 'Off Duty', sleeper_berth: 'Sleeper Berth',
  driving: 'Driving', on_duty: 'On Duty (Not Driving)',
}[s] || s)

function _darken(hex, amount = 0.15) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (n >> 16) - Math.round(255 * amount))
  const g = Math.max(0, ((n >> 8) & 0xff) - Math.round(255 * amount))
  const b = Math.max(0, (n & 0xff) - Math.round(255 * amount))
  return `rgb(${r},${g},${b})`
}
