import { fetchAuthSession } from 'aws-amplify/auth'

const API = import.meta.env.VITE_API_ENDPOINT?.replace(/\/$/, '')

async function authHeaders(): Promise<Record<string, string>> {
  const session = await fetchAuthSession()
  const token = session.tokens?.idToken?.toString()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export interface LocationBusyness {
  locationId: string
  personCount: number
  timestamp: string
}

export interface ChatResponse {
  message: string
  locationId?: string
  data?: unknown
}

export async function getLocationBusyness(
  locationId: string
): Promise<LocationBusyness | null> {
  try {
    const res = await fetch(`${API}/locations/${locationId}/busyness`, {
      headers: await authHeaders(),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function chat(message: string): Promise<ChatResponse> {
  const res = await fetch(`${API}/chat`, {
    method: 'POST',
    headers: {
      ...(await authHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) throw new Error(`Chat failed: ${res.status}`)
  return res.json()
}
