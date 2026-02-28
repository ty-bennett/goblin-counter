import { fetchAuthSession } from 'aws-amplify/auth'

const API = import.meta.env.VITE_API_ENDPOINT?.replace(/\/$/, '')

// Returns auth header if the user is signed in, empty otherwise
async function authHeaders(): Promise<Record<string, string>> {
  try {
    const session = await fetchAuthSession()
    const token = session.tokens?.idToken?.toString()
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Location {
  locationId: string
  name: string
  maxCapacity: number
  description: string
  floor: string
  building: string
  latitude: string
  longitude: string
}

export interface LocationBusyness {
  locationId: string
  personCount: number
  direction?: string
  timestamp: string
}

export interface MetricsPoint {
  locationId: string
  personCount: number
  timestamp: string
}

export interface Device {
  deviceId: string
  name: string
  locationId: string
  description: string
  status: string
}

export interface ChatResponse {
  response: string
}

// ── Locations ──────────────────────────────────────────────────────────────────

export async function getLocations(): Promise<Location[]> {
  try {
    const res = await fetch(`${API}/locations`, { headers: await authHeaders() })
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

export async function getLocationBusyness(locationId: string): Promise<LocationBusyness | null> {
  try {
    const res = await fetch(`${API}/locations/${locationId}/busyness`, {
      headers: await authHeaders(),
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

export async function getLocationMetrics(locationId: string): Promise<MetricsPoint[]> {
  try {
    const res = await fetch(`${API}/locations/${locationId}/metrics`, {
      headers: await authHeaders(),
    })
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

export async function createLocation(data: {
  locationId: string
  name: string
  maxCapacity: number
  description?: string
  floor?: string
  building?: string
  latitude?: string
  longitude?: string
}): Promise<Location> {
  const res = await fetch(`${API}/locations`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? `Failed: ${res.status}`)
  }
  return res.json()
}

// ── Devices ────────────────────────────────────────────────────────────────────

export async function getDevices(): Promise<Device[]> {
  try {
    const res = await fetch(`${API}/devices`, { headers: await authHeaders() })
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

export async function createDevice(data: {
  deviceId: string
  name: string
  description?: string
  locationId?: string
}): Promise<Device> {
  const res = await fetch(`${API}/devices`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? `Failed: ${res.status}`)
  }
  return res.json()
}

export async function associateDevice(deviceId: string, locationId: string): Promise<void> {
  const res = await fetch(`${API}/devices/${deviceId}/location`, {
    method: 'PUT',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ locationId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? `Failed: ${res.status}`)
  }
}

// ── Chat ───────────────────────────────────────────────────────────────────────

export async function chat(message: string): Promise<ChatResponse> {
  const res = await fetch(`${API}/chat`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) throw new Error(`Chat failed: ${res.status}`)
  return res.json()
}
