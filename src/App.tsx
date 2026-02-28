import { useState, useEffect, useCallback } from 'react'
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react'
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface RoomRow {
  id: string
  name: string
  currentOccupancy: number
  maxCapacity: number
  lastUpdated: Date
  status: RoomStatus
  latitude: string
  longitude: string
}

// ── Dashboard (always visible publicly) ──────────────────────────────────────

function Dashboard() {
  const { user, signOut } = useAuthenticator((ctx) => [ctx.user])
  const isAdmin = !!user

  const [locations, setLocations]         = useState<Location[]>([])
  const [busyness, setBusyness]           = useState<Record<string, LocationBusyness>>({})
  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [occupancyData, setOccupancyData] = useState<OccupancyDataPoint[]>([])
  const [metrics, setMetrics]             = useState<MetricsPoint[]>([])
  const [showAdmin, setShowAdmin]         = useState(false)
  const [showLogin, setShowLogin]         = useState(false)

  // ── Fetch locations ──────────────────────────────────────────────────────────

  const fetchLocations = useCallback(async () => {
    const locs = await getLocations()
    setLocations(locs)
  }, [])

  useEffect(() => { fetchLocations() }, [fetchLocations])

  // ── Poll busyness ────────────────────────────────────────────────────────────

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

  // ── Metrics for selected location ─────────────────────────────────────────

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

  // Close login overlay when user logs in successfully
  useEffect(() => {
    if (isAdmin) setShowLogin(false)
  }, [isAdmin])

  // ── Derived data ─────────────────────────────────────────────────────────────

  const rooms: RoomRow[] = locations.map((loc) => {
    const b = busyness[loc.locationId]
    const count = b?.personCount ?? 0
    return {
      id:               loc.locationId,
      name:             loc.name,
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
  const busiest = rooms.reduce<RoomRow | null>((best, r) =>
    (!best || r.currentOccupancy > best.currentOccupancy) ? r : best, null)
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
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="header-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F56600" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div>
            <h1 className="app-title">Campus Occupancy</h1>
            <p className="app-subtitle">Clemson University · Live</p>
          </div>
        </div>
        <div className="header-right">
          {isAdmin ? (
            <>
              <span className="admin-badge">Admin</span>
              <button className="btn-admin" onClick={() => setShowAdmin(true)}>Manage</button>
              <button className="btn-signout" onClick={signOut}>Sign Out</button>
            </>
          ) : (
            <button className="btn-admin" onClick={() => setShowLogin(true)}>Admin Login</button>
          )}
        </div>
      </header>

      {/* Metrics row */}
      <div className="metrics-row">
        <MetricCard label="People on Campus" value={totalPeople.toString()} sub={`across ${rooms.length} locations`} color="#F56600" />
        <MetricCard label="Avg Occupancy" value={`${avgPct}%`} sub="of total capacity" color="#FFD60A" />
        <MetricCard label="Busiest Spot" value={busiest?.name ?? '—'} sub={busiest ? `${busiest.currentOccupancy} / ${busiest.maxCapacity}` : 'No data'} color="#FF6B35" />
        <MetricCard label="At Capacity" value={fullCount.toString()} sub={`location${fullCount === 1 ? '' : 's'} currently full`} color="#FF3B30" />
      </div>

      {/* Main content */}
      <div className="main-grid">
        <div className="map-panel">
          <MapView locations={mapLocations} selectedId={selectedId} onSelect={handleSelect} />
        </div>

        <div className="sidebar">
          <div className="room-list-section">
            <h3 className="room-list-title">Locations</h3>
            <div className="room-list">
              {rooms.length === 0 && <div className="no-rooms-message">Loading locations…</div>}
              {rooms.map((room) => (
                <div
                  key={room.id}
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
              ))}
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

      {/* Admin manage modal (requires login) */}
      {showAdmin && isAdmin && (
        <AdminPanel onClose={() => setShowAdmin(false)} onRefresh={fetchLocations} />
      )}

      {/* Admin login overlay */}
      {showLogin && !isAdmin && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={(e) => e.target === e.currentTarget && setShowLogin(false)}
        >
          <div style={{ background: 'white', borderRadius: 20, padding: 32, width: 420, boxShadow: '0 16px 48px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1d1d1f' }}>Admin Login</h2>
                <p style={{ fontSize: 13, color: '#86868b', marginTop: 2 }}>Requires a @clemson.edu email</p>
              </div>
              <button onClick={() => setShowLogin(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#aaa' }}>×</button>
            </div>
            <Authenticator
              hideSignUp={false}
              components={{
                Header() {
                  return null
                },
              }}
            />
          </div>
        </div>
      )}

      <ChatbotPopup />
    </div>
  )
}

// ── Helper components ─────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="metric-card">
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

// ── Occupancy graph ───────────────────────────────────────────────────────────

function OccupancyGraph({ data, maxCapacity }: { data: OccupancyDataPoint[]; maxCapacity: number }) {
  const width = 560, height = 200
  const pad = { top: 16, right: 16, bottom: 32, left: 42 }
  const gw = width - pad.left - pad.right
  const gh = height - pad.top - pad.bottom

  if (data.length === 0) {
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="occupancy-graph">
        <defs>
          <linearGradient id="og" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#F56600" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#F56600" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <g transform={`translate(${pad.left},${pad.top})`}>
          {[0, 0.5, 1].map((r) => (
            <g key={r}>
              <line x1={0} y1={gh - gh * r} x2={gw} y2={gh - gh * r} stroke="#E5E5EA" strokeWidth="1" />
              <text x={-8} y={gh - gh * r} textAnchor="end" alignmentBaseline="middle" fontSize="11" fill="#aaa">{Math.round(maxCapacity * r)}</text>
            </g>
          ))}
          <text x={gw / 2} y={gh / 2} textAnchor="middle" alignmentBaseline="middle" fontSize="13" fill="#aaa">Waiting for data…</text>
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
          <stop offset="0%" stopColor="#F56600" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#F56600" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <g transform={`translate(${pad.left},${pad.top})`}>
        {[0, 0.5, 1].map((r) => (
          <g key={r}>
            <line x1={0} y1={yScale(maxCapacity * r)} x2={gw} y2={yScale(maxCapacity * r)} stroke="#E5E5EA" strokeWidth="1" />
            <text x={-8} y={yScale(maxCapacity * r)} textAnchor="end" alignmentBaseline="middle" fontSize="11" fill="#aaa">{Math.round(maxCapacity * r)}</text>
          </g>
        ))}
        <path d={area} fill="url(#og)" />
        <path d={line} fill="none" stroke="#F56600" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((p, i) => <circle key={i} cx={xScale(i)} cy={yScale(p.count)} r="3.5" fill="#F56600" />)}
        {data.length > 0 && (
          <>
            <text x={0} y={gh + 22} textAnchor="start" fontSize="11" fill="#aaa">
              {data[0].timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </text>
            <text x={gw} y={gh + 22} textAnchor="end" fontSize="11" fill="#aaa">
              {data[data.length - 1].timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </text>
          </>
        )}
      </g>
    </svg>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────────

function App() {
  return (
    <Authenticator.Provider>
      <Dashboard />
    </Authenticator.Provider>
  )
}

export default App
