import { useState, useEffect } from 'react'
import './styles/index.css'
import { Room, OccupancyDataPoint, RoomStatus } from './models/types'
import { ExampleDataService } from './services/ExampleDataService'
import { Chatbot } from './components'

function App() {
  const [rooms] = useState<Room[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [occupancyData, setOccupancyData] = useState<OccupancyDataPoint[]>([])
  const [isExampleMode] = useState(false)
  const [exampleService] = useState(() => new ExampleDataService())

  // Get API key from environment variable
  const apiKey = import.meta.env.VITE_BEDROCK_API_KEY

  // Load example data on mount (commented out for default empty state)
  useEffect(() => {
    // Uncomment below to load example data
    /*
    const handleOccupancyUpdate = (update: OccupancyUpdate) => {
      // Update room list
      setRooms(prevRooms => 
        prevRooms.map(room => {
          if (room.id === update.roomId) {
            return {
              ...room,
              currentOccupancy: update.data.currentOccupancy,
              lastUpdated: new Date(update.data.timestamp),
              status: calculateRoomStatus(update.data.currentOccupancy, room.maxCapacity)
            }
          }
          return room
        })
      )

      // Update graph data if this is the selected room
      setOccupancyData(prevData => {
        if (selectedRoomId === update.roomId) {
          const newPoint: OccupancyDataPoint = {
            timestamp: new Date(update.data.timestamp),
            count: update.data.currentOccupancy,
            roomId: update.roomId
          }
          return [...prevData, newPoint].slice(-25) // Keep last 25 points
        }
        return prevData
      })
    }

  // Load example data on mount (commented out for default empty state)
  useEffect(() => {
    // Uncomment below to load example data
    /*
    const exampleRooms = exampleService.getExampleRooms()
    setRooms(exampleRooms)
    
    // Auto-select first room
    if (exampleRooms.length > 0) {
      setSelectedRoomId(exampleRooms[0].id)
      const data = exampleService.getExampleOccupancyData(exampleRooms[0].id)
      setOccupancyData(data)
    }

    // Start simulation
    exampleService.simulateRealTimeUpdates((update: OccupancyUpdate) => {
      handleOccupancyUpdate(update)
    })
    */

    return () => {
      exampleService.stopSimulation()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoomId(roomId)
    const data = exampleService.getExampleOccupancyData(roomId)
    setOccupancyData(data)
  }

  const getStatusColor = (status: RoomStatus): string => {
    switch (status) {
      case RoomStatus.EMPTY:
        return '#34C759' // Green
      case RoomStatus.MODERATE:
        return '#FFD60A' // Yellow
      case RoomStatus.FULL:
        return '#FF3B30' // Red
      default:
        return '#8E8E93' // Gray
    }
  }

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId)
  const currentOccupancy =
    occupancyData.length > 0
      ? occupancyData[occupancyData.length - 1].count
      : selectedRoom?.currentOccupancy || 0

  return (
    <div className="app">
      {isExampleMode && (
        <div className="example-banner">Using example data</div>
      )}

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
              <>
                <div className="graph-header">
                  <h2 className="room-name">No Room Selected</h2>
                  <div className="current-occupancy">
                    <span className="occupancy-number">0</span>
                    <span className="occupancy-label">/ 0 people</span>
                  </div>
                </div>
                <div className="graph-container">
                  <OccupancyGraph data={[]} maxCapacity={100} />
                </div>
              </>
            )}
          </div>

          {/* Room Status List */}
          <div className="room-list-section">
            <h3 className="room-list-title">Rooms</h3>
            {rooms.length > 0 ? (
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
            ) : (
              <div className="no-rooms-message">No rooms to show</div>
            )}
          </div>
        </div>

        {/* Chatbot Section */}
        <div className="chatbot-section">
          <Chatbot apiKey={apiKey} />
        </div>
      </div>
    </div>
  )
}

// Simple SVG-based occupancy graph component
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

  // Show flat line at zero when no data
  if (data.length === 0) {
    return (
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="occupancy-graph"
      >
        <defs>
          <linearGradient
            id="occupancyGradient"
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#32CD32" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#32CD32" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        <g transform={`translate(${padding.left}, ${padding.top})`}>
          {/* Y-axis grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <g key={ratio}>
              <line
                x1={0}
                y1={graphHeight - graphHeight * ratio}
                x2={graphWidth}
                y2={graphHeight - graphHeight * ratio}
                stroke="#E5E5EA"
                strokeWidth="1"
              />
              <text
                x={-10}
                y={graphHeight - graphHeight * ratio}
                textAnchor="end"
                alignmentBaseline="middle"
                fontSize="12"
                fill="#8E8E93"
              >
                {Math.round(maxCapacity * ratio)}
              </text>
            </g>
          ))}

          {/* Flat line at zero */}
          <line
            x1={0}
            y1={graphHeight}
            x2={graphWidth}
            y2={graphHeight}
            stroke="#32CD32"
            strokeWidth="3"
            strokeLinecap="round"
            strokeOpacity="0.3"
          />

          {/* Empty state message */}
          <text
            x={graphWidth / 2}
            y={graphHeight / 2}
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize="16"
            fill="#86868b"
          >
            No data available
          </text>
        </g>
      </svg>
    )
  }

  // Calculate scales
  const xScale = (index: number) => (index / (data.length - 1)) * graphWidth
  const yScale = (value: number) =>
    graphHeight - (value / maxCapacity) * graphHeight

  // Generate path for line
  const linePath = data
    .map((point, index) => {
      const x = xScale(index)
      const y = yScale(point.count)
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  // Generate path for gradient fill
  const areaPath = `${linePath} L ${xScale(data.length - 1)} ${graphHeight} L 0 ${graphHeight} Z`

  // Format time labels
  const getTimeLabel = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      className="occupancy-graph"
    >
      <defs>
        <linearGradient
          id="occupancyGradient"
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#32CD32" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#32CD32" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      <g transform={`translate(${padding.left}, ${padding.top})`}>
        {/* Y-axis grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <g key={ratio}>
            <line
              x1={0}
              y1={yScale(maxCapacity * ratio)}
              x2={graphWidth}
              y2={yScale(maxCapacity * ratio)}
              stroke="#E5E5EA"
              strokeWidth="1"
            />
            <text
              x={-10}
              y={yScale(maxCapacity * ratio)}
              textAnchor="end"
              alignmentBaseline="middle"
              fontSize="12"
              fill="#8E8E93"
            >
              {Math.round(maxCapacity * ratio)}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#occupancyGradient)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#32CD32"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {data.map((point, index) => (
          <circle
            key={index}
            cx={xScale(index)}
            cy={yScale(point.count)}
            r="4"
            fill="#32CD32"
            className="data-point"
          />
        ))}

        {/* X-axis labels */}
        {data.length > 0 && (
          <>
            <text
              x={0}
              y={graphHeight + 25}
              textAnchor="start"
              fontSize="12"
              fill="#8E8E93"
            >
              {getTimeLabel(data[0].timestamp)}
            </text>
            <text
              x={graphWidth}
              y={graphHeight + 25}
              textAnchor="end"
              fontSize="12"
              fill="#8E8E93"
            >
              {getTimeLabel(data[data.length - 1].timestamp)}
            </text>
          </>
        )}
      </g>
    </svg>
  )
}

export default App
