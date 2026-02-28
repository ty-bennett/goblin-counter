import { useState, useEffect, useCallback } from 'react'
import { Authenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import './styles/index.css'
import { Room, OccupancyDataPoint, RoomStatus, calculateRoomStatus } from './models/types'
import { getLocationBusyness, chat } from './services/ApiService'

// Matches var.location_ids in Terraform
const LOCATIONS: { id: string; name: string; maxCapacity: number }[] = [
  { id: 'library-entrance',    name: 'Library',      maxCapacity: 80 },
  { id: 'cafeteria-entrance',  name: 'Cafeteria',    maxCapacity: 120 },
  { id: 'gym-entrance',        name: 'Gym',          maxCapacity: 60 },
  { id: 'study-room-a',        name: 'Study Room A', maxCapacity: 20 },
]

function Dashboard({ signOut }: { signOut?: () => void }) {
  const [rooms, setRooms] = useState<Room[]>(() =>
    LOCATIONS.map((l) => ({
      id: l.id,
      name: l.name,
      currentOccupancy: 0,
      maxCapacity: l.maxCapacity,
      lastUpdated: new Date(),
      status: RoomStatus.EMPTY,
    }))
  )
  const [selectedRoomId, setSelectedRoomId] = useState<string>(LOCATIONS[0].id)
  const [occupancyData, setOccupancyData] = useState<OccupancyDataPoint[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatResponse, setChatResponse] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const refreshBusyness = useCallback(async () => {
    const updates = await Promise.all(
      LOCATIONS.map((l) => getLocationBusyness(l.id))
    )
    setRooms((prev) =>
      prev.map((room, i) => {
        const update = updates[i]
        const count = update?.personCount ?? room.currentOccupancy
        return {
          ...room,
          currentOccupancy: count,
          lastUpdated: update ? new Date(update.timestamp) : room.lastUpdated,
          status: calculateRoomStatus(count, room.maxCapacity),
        }
      })
    )
  }, [])

  // Initial load + poll every 10 seconds
  useEffect(() => {
    refreshBusyness()
    const interval = setInterval(refreshBusyness, 10_000)
    return () => clearInterval(interval)
  }, [refreshBusyness])

  // Update graph history when selected room changes or occupancy updates
  useEffect(() => {
    const room = rooms.find((r) => r.id === selectedRoomId)
    if (!room) return
    setOccupancyData((prev) => {
      const point: OccupancyDataPoint = {
        timestamp: new Date(),
        count: room.currentOccupancy,
        roomId: room.id,
      }
      const filtered = prev.filter((p) => p.roomId === selectedRoomId)
      return [...filtered, point].slice(-25)
    })
  }, [rooms, selectedRoomId])

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoomId(roomId)
    setOccupancyData([])
  }

  const handleChat = async () => {
    if (!chatInput.trim()) return
    setChatLoading(true)
    setChatResponse('')
    try {
      const res = await chat(chatInput)
      setChatResponse(res.message ?? JSON.stringify(res))
    } catch (e) {
      setChatResponse('Error contacting assistant.')
    } finally {
      setChatLoading(false)
    }
  }

  const getStatusColor = (status: RoomStatus): string => {
    switch (status) {
      case RoomStatus.EMPTY:    return '#34C759'
      case RoomStatus.MODERATE: return '#FFD60A'
      case RoomStatus.FULL:     return '#FF3B30'
      default:                  return '#8E8E93'
    }
  }

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId)
  const currentOccupancy =
    occupancyData.length > 0
      ? occupancyData[occupancyData.length - 1].count
      : selectedRoom?.currentOccupancy ?? 0

  return (
    <div className="app">
      <button
        onClick={signOut}
        style={{ position: 'fixed', top: 12, right: 16, fontSize: 13, cursor: 'pointer' }}
      >
        Sign out
      </button>

      <div className="dashboard-container">
        <h1 className="dashboard-title">Room Occupancy</h1>

        <div className="dashboard-content">
          {/* Occupancy Graph */}
          <div className="graph-section">
            {selectedRoom ? (
              <>
                <div className="graph-header">
                  <h2 className="room-name">{selectedRoom.name}</h2>
                  <div className="current-occupancy">
                    <span className="occupancy-number">{currentOccupancy}</span>
                    <span className="occupancy-label">
                      / {selectedRoom.maxCapacity} people
                    </span>
                  </div>
                </div>
                <div className="graph-container">
                  <OccupancyGraph
                    data={occupancyData}
                    maxCapacity={selectedRoom.maxCapacity}
                  />
                </div>
              </>
            ) : (
              <div className="graph-empty">Select a room to view data</div>
            )}

            {/* Chat */}
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e5e5ea', paddingTop: '1.5rem' }}>
              <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', fontWeight: 600 }}>
                Ask about occupancy
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                  placeholder='e.g. "How busy is the cafeteria?"'
                  style={{
                    flex: 1, padding: '0.5rem 0.75rem', borderRadius: 8,
                    border: '1px solid #d1d1d6', fontSize: 14,
                  }}
                />
                <button
                  onClick={handleChat}
                  disabled={chatLoading}
                  style={{
                    padding: '0.5rem 1rem', borderRadius: 8, background: '#32cd32',
                    color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  {chatLoading ? '...' : 'Ask'}
                </button>
              </div>
              {chatResponse && (
                <p style={{ marginTop: '0.75rem', fontSize: 14, color: '#1d1d1f', lineHeight: 1.5 }}>
                  {chatResponse}
                </p>
              )}
            </div>
          </div>

          {/* Room List */}
          <div className="room-list-section">
            <h3 className="room-list-title">Locations</h3>
            <div className="room-list">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className={`room-card ${selectedRoomId === room.id ? 'selected' : ''}`}
                  onClick={() => handleRoomSelect(room.id)}
                >
                  <div
                    className="status-indicator"
                    style={{ backgroundColor: getStatusColor(room.status) }}
                  />
                  <div className="room-info">
                    <div className="room-name-small">{room.name}</div>
                    <div className="room-occupancy">
                      {room.currentOccupancy} / {room.maxCapacity}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <Authenticator>
      {({ signOut }: { signOut?: () => void }) => <Dashboard signOut={signOut} />}
    </Authenticator>
  )
}

// Occupancy graph — unchanged from original
function OccupancyGraph({
  data,
  maxCapacity,
}: {
  data: OccupancyDataPoint[]
  maxCapacity: number
}) {
  const width = 800
  const height = 300
  const padding = { top: 20, right: 20, bottom: 40, left: 50 }
  const graphWidth = width - padding.left - padding.right
  const graphHeight = height - padding.top - padding.bottom

  if (data.length === 0) {
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="occupancy-graph">
        <defs>
          <linearGradient id="occupancyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#32CD32" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#32CD32" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <g transform={`translate(${padding.left}, ${padding.top})`}>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <g key={ratio}>
              <line x1={0} y1={graphHeight - graphHeight * ratio} x2={graphWidth} y2={graphHeight - graphHeight * ratio} stroke="#E5E5EA" strokeWidth="1" />
              <text x={-10} y={graphHeight - graphHeight * ratio} textAnchor="end" alignmentBaseline="middle" fontSize="12" fill="#8E8E93">
                {Math.round(maxCapacity * ratio)}
              </text>
            </g>
          ))}
          <line x1={0} y1={graphHeight} x2={graphWidth} y2={graphHeight} stroke="#32CD32" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.3" />
          <text x={graphWidth / 2} y={graphHeight / 2} textAnchor="middle" alignmentBaseline="middle" fontSize="16" fill="#86868b">
            Waiting for data...
          </text>
        </g>
      </svg>
    )
  }

  const xScale = (index: number) => (index / (data.length - 1)) * graphWidth
  const yScale = (value: number) => graphHeight - (value / maxCapacity) * graphHeight
  const linePath = data.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(p.count)}`).join(' ')
  const areaPath = `${linePath} L ${xScale(data.length - 1)} ${graphHeight} L 0 ${graphHeight} Z`

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="occupancy-graph">
      <defs>
        <linearGradient id="occupancyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#32CD32" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#32CD32" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <g transform={`translate(${padding.left}, ${padding.top})`}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <g key={ratio}>
            <line x1={0} y1={yScale(maxCapacity * ratio)} x2={graphWidth} y2={yScale(maxCapacity * ratio)} stroke="#E5E5EA" strokeWidth="1" />
            <text x={-10} y={yScale(maxCapacity * ratio)} textAnchor="end" alignmentBaseline="middle" fontSize="12" fill="#8E8E93">
              {Math.round(maxCapacity * ratio)}
            </text>
          </g>
        ))}
        <path d={areaPath} fill="url(#occupancyGradient)" />
        <path d={linePath} fill="none" stroke="#32CD32" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((point, index) => (
          <circle key={index} cx={xScale(index)} cy={yScale(point.count)} r="4" fill="#32CD32" className="data-point" />
        ))}
        {data.length > 0 && (
          <>
            <text x={0} y={graphHeight + 25} textAnchor="start" fontSize="12" fill="#8E8E93">
              {data[0].timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </text>
            <text x={graphWidth} y={graphHeight + 25} textAnchor="end" fontSize="12" fill="#8E8E93">
              {data[data.length - 1].timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </text>
          </>
        )}
      </g>
    </svg>
  )
}

export default App
