import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl } from 'react-leaflet'
import { RoomStatus } from '../models/types'

export interface MapLocation {
  locationId: string
  name: string
  latitude: string
  longitude: string
  personCount: number
  maxCapacity: number
  status: RoomStatus
}

const STATUS_COLOR: Record<RoomStatus, string> = {
  [RoomStatus.EMPTY]:    '#34C759',
  [RoomStatus.MODERATE]: '#FFD60A',
  [RoomStatus.FULL]:     '#FF3B30',
}

const STATUS_LABEL: Record<RoomStatus, string> = {
  [RoomStatus.EMPTY]:    'Available',
  [RoomStatus.MODERATE]: 'Moderate',
  [RoomStatus.FULL]:     'Busy',
}

interface MapViewProps {
  locations: MapLocation[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function MapView({ locations, selectedId, onSelect }: MapViewProps) {
  const validLocations = locations.filter(
    (l) => l.latitude && l.longitude && !isNaN(parseFloat(l.latitude))
  )

  const center: [number, number] =
    validLocations.length > 0
      ? [parseFloat(validLocations[0].latitude), parseFloat(validLocations[0].longitude)]
      : [34.6776, -82.8374]

  return (
    <MapContainer
      center={center}
      zoom={15}
      style={{ height: '100%', width: '100%', borderRadius: 14 }}
      scrollWheelZoom
      zoomControl={false}
    >
      <ZoomControl position="topright" />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {validLocations.map((loc) => {
        const color = STATUS_COLOR[loc.status]
        const isSelected = loc.locationId === selectedId
        const pct = loc.maxCapacity > 0 ? Math.round((loc.personCount / loc.maxCapacity) * 100) : 0
        return (
          <CircleMarker
            key={loc.locationId}
            center={[parseFloat(loc.latitude), parseFloat(loc.longitude)]}
            radius={isSelected ? 18 : 13}
            pathOptions={{
              color: isSelected ? '#fff' : color,
              fillColor: color,
              fillOpacity: 0.9,
              weight: isSelected ? 3 : 1.5,
            }}
            eventHandlers={{ click: () => onSelect(loc.locationId) }}
          >
            <Popup>
              <div style={{ minWidth: 160 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{loc.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span
                    style={{
                      display: 'inline-block', width: 8, height: 8,
                      borderRadius: '50%', background: color,
                    }}
                  />
                  <span style={{ fontSize: 12, color: '#666' }}>{STATUS_LABEL[loc.status]}</span>
                </div>
                <div style={{ fontSize: 13 }}>
                  <strong>{loc.personCount}</strong>
                  <span style={{ color: '#888' }}> / {loc.maxCapacity} people</span>
                </div>
                <div style={{ marginTop: 6, background: '#eee', borderRadius: 4, height: 6 }}>
                  <div
                    style={{
                      width: `${pct}%`, height: '100%',
                      background: color, borderRadius: 4,
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{pct}% capacity</div>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
