import { useState } from 'react'
import { createLocation, getDevices, createDevice, associateDevice, Device } from '../services/ApiService'

interface AdminPanelProps {
  onClose: () => void
  onRefresh: () => void
}

type Tab = 'location' | 'device' | 'associate'

export function AdminPanel({ onClose, onRefresh }: AdminPanelProps) {
  const [tab, setTab] = useState<Tab>('location')
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Add Location form
  const [locForm, setLocForm] = useState({
    locationId: '', name: '', maxCapacity: '', building: '',
    floor: '', latitude: '', longitude: '', description: '',
  })

  // Add Device form
  const [devForm, setDevForm] = useState({ deviceId: '', name: '', description: '' })

  // Associate form
  const [assocDeviceId, setAssocDeviceId] = useState('')
  const [assocLocationId, setAssocLocationId] = useState('')
  const [devices, setDevices] = useState<Device[]>([])
  const [devicesLoaded, setDevicesLoaded] = useState(false)

  const flash = (type: 'success' | 'error', msg: string) => {
    setStatus({ type, msg })
    setTimeout(() => setStatus(null), 4000)
  }

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createLocation({
        locationId: locForm.locationId.trim(),
        name: locForm.name.trim(),
        maxCapacity: parseInt(locForm.maxCapacity, 10),
        building: locForm.building.trim() || undefined,
        floor: locForm.floor.trim() || undefined,
        latitude: locForm.latitude.trim() || undefined,
        longitude: locForm.longitude.trim() || undefined,
        description: locForm.description.trim() || undefined,
      })
      flash('success', `Location "${locForm.name}" created!`)
      setLocForm({ locationId: '', name: '', maxCapacity: '', building: '', floor: '', latitude: '', longitude: '', description: '' })
      onRefresh()
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Failed to create location')
    }
  }

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createDevice({
        deviceId: devForm.deviceId.trim(),
        name: devForm.name.trim(),
        description: devForm.description.trim() || undefined,
      })
      flash('success', `Device "${devForm.name}" registered!`)
      setDevForm({ deviceId: '', name: '', description: '' })
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Failed to create device')
    }
  }

  const loadDevices = async () => {
    if (devicesLoaded) return
    const list = await getDevices()
    setDevices(list)
    setDevicesLoaded(true)
  }

  const handleAssociate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await associateDevice(assocDeviceId.trim(), assocLocationId.trim())
      flash('success', 'Device associated with location!')
      setAssocDeviceId('')
      setAssocLocationId('')
      onRefresh()
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Failed to associate device')
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'location', label: 'Add Location' },
    { key: 'device',   label: 'Add Device' },
    { key: 'associate', label: 'Associate' },
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'white', borderRadius: 20, width: 500, maxHeight: '90vh',
        boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1d1d1f' }}>Admin Panel</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#86868b', fontSize: 22, lineHeight: 1,
          }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '12px 24px 0' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); if (t.key === 'associate') loadDevices() }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: tab === t.key ? '#32CD32' : '#f0f0f5',
                color: tab === t.key ? 'white' : '#555',
                transition: 'all 0.15s',
              }}
            >{t.label}</button>
          ))}
        </div>

        {/* Status flash */}
        {status && (
          <div style={{
            margin: '12px 24px 0', padding: '10px 14px', borderRadius: 10, fontSize: 13,
            background: status.type === 'success' ? '#e6fbe6' : '#ffeaea',
            color: status.type === 'success' ? '#1a6e1a' : '#c0392b',
            border: `1px solid ${status.type === 'success' ? '#9ee09e' : '#f5a5a5'}`,
          }}>{status.msg}</div>
        )}

        {/* Body */}
        <div style={{ padding: '16px 24px 24px', overflowY: 'auto' }}>

          {/* Add Location */}
          {tab === 'location' && (
            <form onSubmit={handleAddLocation} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Location ID *" placeholder="e.g. cooper-library" value={locForm.locationId} onChange={(v) => setLocForm({ ...locForm, locationId: v })} required />
              <Field label="Name *" placeholder="e.g. Cooper Library" value={locForm.name} onChange={(v) => setLocForm({ ...locForm, name: v })} required />
              <Field label="Max Capacity *" placeholder="e.g. 200" type="number" value={locForm.maxCapacity} onChange={(v) => setLocForm({ ...locForm, maxCapacity: v })} required />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Building" placeholder="e.g. Cooper" value={locForm.building} onChange={(v) => setLocForm({ ...locForm, building: v })} />
                <Field label="Floor" placeholder="e.g. 1" value={locForm.floor} onChange={(v) => setLocForm({ ...locForm, floor: v })} />
                <Field label="Latitude" placeholder="e.g. 34.6776" value={locForm.latitude} onChange={(v) => setLocForm({ ...locForm, latitude: v })} />
                <Field label="Longitude" placeholder="e.g. -82.8374" value={locForm.longitude} onChange={(v) => setLocForm({ ...locForm, longitude: v })} />
              </div>
              <Field label="Description" placeholder="Optional description" value={locForm.description} onChange={(v) => setLocForm({ ...locForm, description: v })} />
              <SubmitBtn>Create Location</SubmitBtn>
            </form>
          )}

          {/* Add Device */}
          {tab === 'device' && (
            <form onSubmit={handleAddDevice} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Device ID *" placeholder="e.g. raspberry-pi-003" value={devForm.deviceId} onChange={(v) => setDevForm({ ...devForm, deviceId: v })} required />
              <Field label="Name *" placeholder="e.g. Library Camera" value={devForm.name} onChange={(v) => setDevForm({ ...devForm, name: v })} required />
              <Field label="Description" placeholder="Optional description" value={devForm.description} onChange={(v) => setDevForm({ ...devForm, description: v })} />
              <SubmitBtn>Register Device</SubmitBtn>
            </form>
          )}

          {/* Associate Device */}
          {tab === 'associate' && (
            <form onSubmit={handleAssociate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Device ID *</label>
                {devices.length > 0 ? (
                  <select
                    value={assocDeviceId}
                    onChange={(e) => setAssocDeviceId(e.target.value)}
                    required
                    style={inputStyle}
                  >
                    <option value="">Select a device…</option>
                    {devices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>{d.name} ({d.deviceId})</option>
                    ))}
                  </select>
                ) : (
                  <input
                    style={inputStyle}
                    placeholder="e.g. raspberry-pi-001"
                    value={assocDeviceId}
                    onChange={(e) => setAssocDeviceId(e.target.value)}
                    required
                  />
                )}
              </div>
              <Field label="Location ID *" placeholder="e.g. cooper-library" value={assocLocationId} onChange={(v) => setAssocLocationId(v)} required />
              <SubmitBtn>Associate</SubmitBtn>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 10,
  border: '1.5px solid #e0e0e5', fontSize: 14, outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
}

function Field({
  label, placeholder, value, onChange, required, type = 'text',
}: {
  label: string; placeholder: string; value: string
  onChange: (v: string) => void; required?: boolean; type?: string
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        style={inputStyle}
      />
    </div>
  )
}

function SubmitBtn({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      style={{
        marginTop: 4, padding: '11px 0', borderRadius: 12, border: 'none',
        background: '#32CD32', color: 'white', fontWeight: 700,
        fontSize: 15, cursor: 'pointer', transition: 'opacity 0.15s',
      }}
    >{children}</button>
  )
}
