import { useState, useEffect, useCallback } from 'react'
import { Authenticator, ThemeProvider, createTheme, useAuthenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import 'leaflet/dist/leaflet.css'
import './styles/index.css'
import { OccupancyDataPoint, RoomStatus, calculateRoomStatus } from './models/types'
import {
  getLocations, getLocationBusyness, getLocationMetrics,
  Location, LocationBusyness, MetricsPoint,
} from './services/ApiService'
import { MapView, MapLocation } from './components/MapView'
import { ChatbotPopup } from './components/ChatbotPopup'
import { AdminPanel } from './components/AdminPanel'

// ── Clemson theme ─────────────────────────────────────────────────────────────

const clemsonTheme = createTheme({
  name: 'clemson',
  tokens: {
    colors: {
      brand: {
        primary: {
          '10':  { value: '#fff3eb' },
          '20':  { value: '#ffe4cc' },
          '40':  { value: '#ffb380' },
          '60':  { value: '#F56600' },
          '80':  { value: '#d45a00' },
          '100': { value: '#9e3d00' },
        },
      },
    },
    components: {
      authenticator: {
        router: {
          borderWidth: { value: '0' },
          boxShadow:   { value: 'none' },
        },
      },
      button: {
        primary: {
          backgroundColor: { value: '#F56600' },
          _hover: { backgroundColor: { value: '#d45a00' } },
        },
        link: { color: { value: '#F56600' } },
      },
      fieldcontrol: {
        _focus: {
          borderColor: { value: '#F56600' },
          boxShadow:   { value: '0 0 0 2px rgba(245,102,0,0.2)' },
        },
      },
      tabs: {
        item: {
          _active: { color: { value: '#F56600' }, borderColor: { value: '#F56600' } },
          _hover:  { color: { value: '#F56600' } },
        },
      },
    },
  },
})

// ── Tiger paw SVG ─────────────────────────────────────────────────────────────

function TigerPaw({ size = 22, color = 'white', opacity = 1 }: { size?: number; color?: string; opacity?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill={color} opacity={opacity}>
      <ellipse cx="50" cy="67" rx="28" ry="22" />
      <ellipse cx="20" cy="44" rx="10" ry="13" transform="rotate(-20 20 44)" />
      <ellipse cx="38" cy="32" rx="10" ry="13" transform="rotate(-6 38 32)" />
      <ellipse cx="57" cy="32" rx="10" ry="13" transform="rotate(6 57 32)" />
      <ellipse cx="74" cy="44" rx="10" ry="13" transform="rotate(20 74 44)" />
    </svg>
  )
}

// ── Auth components ───────────────────────────────────────────────────────────

const authComponents = {
  Header() {
    return (
      <div className="login-header">
        <div className="login-header-paws">
          <TigerPaw size={28} color="white" opacity={0.8} />
          <TigerPaw size={36} color="white" />
          <TigerPaw size={28} color="white" opacity={0.8} />
        </div>
        <h1>Tiger Tracker</h1>
        <p>Clemson University · Real-time tracking</p>
      </div>
    )
  },
}

// ── App shell — shows splash when logged out, dashboard when logged in ─────────

function AppShell() {
  const { authStatus } = useAuthenticator((ctx) => [ctx.authStatus])

  if (authStatus !== 'authenticated') {
    return (
      <div className="login-splash">
        <div className="login-card">
          <Authenticator components={authComponents} hideSignUp={false}>
            {() => <></>}
          </Authenticator>
        </div>
      </div>
    )
  }

  return <Dashboard />
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface RoomRow {
  id: string
  name: string
  building: string
  currentOccupancy: number
  maxCapacity: number
  lastUpdated: Date
  status: RoomStatus
  latitude: string
  longitude: string
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard() {
  const { signOut } = useAuthenticator((ctx) => [ctx.user])

  const [locations, setLocations]         = useState<Location[]>([])
  const [busyness, setBusyness]           = useState<Record<string, LocationBusyness>>({})
  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [occupancyData, setOccupancyData] = useState<OccupancyDataPoint[]>([])
  const [metrics, setMetrics]             = useState<MetricsPoint[]>([])
  const [showAdmin, setShowAdmin]         = useState(false)

  const fetchLocations = useCallback(async () => {
    const locs = await getLocations()
    setLocations(locs)
  }, [])

  useEffect(() => { fetchLocations() }, [fetchLocations])

  const refreshBusyness = useCallback(async () => {
    if (locations.length === 0) return
    const results = await Promise.all(locations.map((l) => getLocationBusyness(l.locationId)))
    const map: Record<string, LocationBusyness> = {}
    results.forEach((b, i) => { if (b) map[locations[i].locationId] = b })
    setBusyness(map)
  }, [locations])

  useEffect(() => {
    refreshBusyness()
    const id = setInterval(refreshBusyness, 10_000)
    return () => clearInterval(id)
  }, [refreshBusyness])

  useEffect(() => {
    if (!selectedId) return
    getLocationMetrics(selectedId).then(setMetrics)
    setOccupancyData([])
  }, [selectedId])

  useEffect(() => {
    if (!selectedId) return
    const b = busyness[selectedId]
    if (!b) return
    setOccupancyData((prev) => {
      const point: OccupancyDataPoint = {
        timestamp: new Date(b.timestamp),
        count: b.personCount,
        roomId: selectedId,
      }
      return [...prev.filter((p) => p.roomId === selectedId), point].slice(-25)
    })
  }, [busyness, selectedId])

  const rooms: RoomRow[] = locations.map((loc) => {
    const b = busyness[loc.locationId]
    const count = b?.personCount ?? 0
    return {
      id:               loc.locationId,
      name:             loc.name,
      building:         loc.building ?? '',
      currentOccupancy: count,
      maxCapacity:      loc.maxCapacity,
      lastUpdated:      b ? new Date(b.timestamp) : new Date(),
      status:           calculateRoomStatus(count, loc.maxCapacity),
      latitude:         loc.latitude ?? '',
      longitude:        loc.longitude ?? '',
    }
  })

  const mapLocations: MapLocation[] = rooms
    .filter((r) => r.latitude && r.longitude)
    .map((r) => ({
      locationId:  r.id,
      name:        r.name,
      latitude:    r.latitude,
      longitude:   r.longitude,
      personCount: r.currentOccupancy,
      maxCapacity: r.maxCapacity,
      status:      r.status,
    }))

  const selectedRoom = rooms.find((r) => r.id === selectedId) ?? null

  const totalPeople = rooms.reduce((s, r) => s + r.currentOccupancy, 0)
  const avgPct = rooms.length
    ? Math.round(rooms.reduce((s, r) => s + (r.maxCapacity > 0 ? r.currentOccupancy / r.maxCapacity : 0), 0) / rooms.length * 100)
    : 0
  const pct = (r: RoomRow) => r.maxCapacity > 0 ? r.currentOccupancy / r.maxCapacity : 0
  const busiest = rooms.reduce<RoomRow | null>((best, r) =>
    (!best || pct(r) > pct(best)) ? r : best, null)
  const fullCount = rooms.filter((r) => r.status === RoomStatus.FULL).length

  const graphData: OccupancyDataPoint[] =
    occupancyData.length > 0
      ? occupancyData
      : metrics.map((m) => ({ timestamp: new Date(m.timestamp), count: m.personCount, roomId: m.locationId }))

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setOccupancyData([])
    setMetrics([])
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="header-paws">
            <TigerPaw size={16} color="white" opacity={0.6} />
            <TigerPaw size={20} color="white" opacity={0.9} />
            <TigerPaw size={16} color="white" opacity={0.6} />
          </div>
          <div>
            <div className="app-title">Tiger Tracker</div>
            <div className="app-subtitle">Clemson University · Live</div>
          </div>
        </div>
        <div className="header-right">
          <span className="admin-badge">Admin</span>
          <button className="btn-header-primary" onClick={() => setShowAdmin(true)}>Manage</button>
          <button className="btn-header-ghost" onClick={signOut}>Sign Out</button>
        </div>
      </header>

      <div className="metrics-row">
        <MetricCard label="People on Campus" value={totalPeople.toString()} sub={`across ${rooms.length} locations`}                                                   color="#F56600" border="#F56600" />
        <MetricCard label="Avg Occupancy"    value={`${avgPct}%`}          sub="of total capacity"                                                                    color="#FFD60A" border="#FFD60A" />
        <MetricCard label="Busiest Spot"     value={busiest?.name ?? '—'}  sub={busiest ? `${Math.round(pct(busiest) * 100)}% capacity` : 'No data'}                 color="#522D80" border="#522D80" />
        <MetricCard label="At Capacity"      value={fullCount.toString()}  sub={`location${fullCount === 1 ? '' : 's'} currently full`}                               color="#FF3B30" border="#FF3B30" />
      </div>

      <div className="main-grid">
        <div className="map-panel">
          <MapView locations={mapLocations} selectedId={selectedId} onSelect={handleSelect} />
        </div>

        <div className="sidebar">
          <div className="room-list-section">
            <h3 className="room-list-title">
              <TigerPaw size={13} color="#F56600" />
              Locations
            </h3>
            <div className="room-list">
              {rooms.length === 0 && <div className="no-rooms-message">Loading…</div>}
              {(() => {
                // Separate parent locations (name matches building) from sub-locations
                const parents = rooms.filter((r) => !r.building || r.name === r.building || !rooms.some((p) => p.name === r.building))
                const children = rooms.filter((r) => r.building && r.name !== r.building && rooms.some((p) => p.name === r.building))
                return parents.map((room) => {
                  const subs = children.filter((c) => c.building === room.name)
                  return (
                    <div key={room.id}>
                      <div
                        className={`room-card ${selectedId === room.id ? 'selected' : ''}`}
                        onClick={() => handleSelect(room.id)}
                      >
                        <div className="status-indicator" style={{ backgroundColor: statusColor(room.status) }} />
                        <div className="room-info">
                          <div className="room-name-small">{room.name}</div>
                          <div className="room-occupancy">{room.currentOccupancy} / {room.maxCapacity}</div>
                        </div>
                        <div className="room-pct" style={{ color: statusColor(room.status) }}>
                          {room.maxCapacity > 0 ? Math.round(room.currentOccupancy / room.maxCapacity * 100) : 0}%
                        </div>
                      </div>
                      {subs.map((sub) => (
                        <div
                          key={sub.id}
                          className={`room-card room-card-sub ${selectedId === sub.id ? 'selected' : ''}`}
                          onClick={() => handleSelect(sub.id)}
                        >
                          <div className="sub-indent">↳</div>
                          <div className="status-indicator" style={{ backgroundColor: statusColor(sub.status) }} />
                          <div className="room-info">
                            <div className="room-name-small">{sub.name.replace(` – ${sub.building}`, '').replace(` (${sub.building})`, '')}</div>
                            <div className="room-occupancy">{sub.currentOccupancy} / {sub.maxCapacity}</div>
                          </div>
                          <div className="room-pct" style={{ color: statusColor(sub.status) }}>
                            {sub.maxCapacity > 0 ? Math.round(sub.currentOccupancy / sub.maxCapacity * 100) : 0}%
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })
              })()}
            </div>
          </div>

          {selectedRoom && (
            <div className="graph-section">
              <div className="graph-header">
                <h2 className="room-name">{selectedRoom.name}</h2>
                <div className="current-occupancy">
                  <span className="occupancy-number">{selectedRoom.currentOccupancy}</span>
                  <span className="occupancy-label">/ {selectedRoom.maxCapacity} people</span>
                </div>
              </div>
              <div className="graph-container">
                <OccupancyGraph data={graphData} maxCapacity={selectedRoom.maxCapacity} />
              </div>
            </div>
          )}
        </div>
      </div>

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} onRefresh={fetchLocations} />}
      <ChatbotPopup />

      <footer className="app-footer">
        <div className="footer-buildings">
          <div className="footer-building">
            <img src="/cooper-library.svg" alt="Cooper Library" className="building-drawing" />
            <span className="footer-building-name">Cooper Library</span>
          </div>
          <div className="footer-center">
            <TigerPaw size={30} color="rgba(245,102,0,0.75)" />
            <span className="footer-tagline">Clemson University</span>
            <span className="footer-subtagline">Tiger Tracker · Real-time</span>
          </div>
          <div className="footer-building">
            <img src="/tillman-hall.svg" alt="Tillman Hall" className="building-drawing" />
            <span className="footer-building-name">Tillman Hall</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, color, border }: {
  label: string; value: string; sub: string; color: string; border: string
}) {
  return (
    <div className="metric-card" style={{ borderLeftColor: border }}>
      <div className="metric-value" style={{ color }}>{value}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-sub">{sub}</div>
    </div>
  )
}

function statusColor(status: RoomStatus): string {
  switch (status) {
    case RoomStatus.EMPTY:    return '#34C759'
    case RoomStatus.MODERATE: return '#FFD60A'
    case RoomStatus.FULL:     return '#FF3B30'
    default:                  return '#8E8E93'
  }
}

function OccupancyGraph({ data, maxCapacity }: { data: OccupancyDataPoint[]; maxCapacity: number }) {
  const width = 560, height = 180
  const pad = { top: 12, right: 12, bottom: 28, left: 38 }
  const gw = width - pad.left - pad.right
  const gh = height - pad.top - pad.bottom

  if (data.length === 0) {
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="occupancy-graph">
        <defs>
          <linearGradient id="og" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#F56600" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#F56600" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <g transform={`translate(${pad.left},${pad.top})`}>
          {[0, 0.5, 1].map((r) => (
            <g key={r}>
              <line x1={0} y1={gh - gh * r} x2={gw} y2={gh - gh * r} stroke="#E5E5EA" strokeWidth="1" />
              <text x={-6} y={gh - gh * r} textAnchor="end" alignmentBaseline="middle" fontSize="10" fill="#bbb">{Math.round(maxCapacity * r)}</text>
            </g>
          ))}
          <text x={gw / 2} y={gh / 2} textAnchor="middle" alignmentBaseline="middle" fontSize="12" fill="#ccc">Waiting for data…</text>
        </g>
      </svg>
    )
  }

  const xScale = (i: number) => data.length > 1 ? (i / (data.length - 1)) * gw : gw / 2
  const yScale = (v: number) => gh - (v / Math.max(maxCapacity, 1)) * gh
  const line = data.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(p.count)}`).join(' ')
  const area = `${line} L ${xScale(data.length - 1)} ${gh} L 0 ${gh} Z`

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="occupancy-graph">
      <defs>
        <linearGradient id="og" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F56600" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#F56600" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <g transform={`translate(${pad.left},${pad.top})`}>
        {[0, 0.5, 1].map((r) => (
          <g key={r}>
            <line x1={0} y1={yScale(maxCapacity * r)} x2={gw} y2={yScale(maxCapacity * r)} stroke="#E5E5EA" strokeWidth="1" />
            <text x={-6} y={yScale(maxCapacity * r)} textAnchor="end" alignmentBaseline="middle" fontSize="10" fill="#bbb">{Math.round(maxCapacity * r)}</text>
          </g>
        ))}
        <path d={area} fill="url(#og)" />
        <path d={line} fill="none" stroke="#F56600" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((p, i) => <circle key={i} cx={xScale(i)} cy={yScale(p.count)} r="3" fill="#F56600" />)}
        {data.length > 0 && (
          <>
            <text x={0} y={gh + 18} textAnchor="start" fontSize="10" fill="#bbb">
              {data[0].timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </text>
            <text x={gw} y={gh + 18} textAnchor="end" fontSize="10" fill="#bbb">
              {data[data.length - 1].timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </text>
          </>
        )}
      </g>
    </svg>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ThemeProvider theme={clemsonTheme}>
      <Authenticator.Provider>
        <AppShell />
      </Authenticator.Provider>
    </ThemeProvider>
  )
}
