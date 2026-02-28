/**
 * Data models for Room Occupancy Dashboard
 * Defines TypeScript interfaces and validation functions for all data types
 */

/**
 * Room status enum based on occupancy percentage
 * - EMPTY: 0-40% occupancy (green indicator)
 * - MODERATE: 41-75% occupancy (yellow indicator)
 * - FULL: 76-100% occupancy (red indicator)
 */
export enum RoomStatus {
  EMPTY = 'empty',
  MODERATE = 'moderate',
  FULL = 'full',
}

/**
 * Room interface representing a physical space being monitored
 */
export interface Room {
  id: string
  name: string
  currentOccupancy: number
  maxCapacity: number
  lastUpdated: Date
  status: RoomStatus
}

/**
 * OccupancyDataPoint interface for time-series graph data
 */
export interface OccupancyDataPoint {
  timestamp: Date
  count: number
  roomId: string
}

/**
 * OccupancyUpdate interface for real-time WebSocket messages
 */
export interface OccupancyUpdate {
  type: 'occupancy_change' | 'room_status'
  roomId: string
  data: {
    currentOccupancy: number
    timestamp: string
    changeType?: 'entry' | 'exit'
  }
}

/**
 * WebSocketMessage interface for client-to-server messages
 */
export interface WebSocketMessage {
  action: 'subscribe' | 'unsubscribe' | 'ping'
  roomId?: string
  timestamp: string
}

/**
 * Validation error type
 */
export interface ValidationError {
  field: string
  message: string
}

/**
 * Validation result type
 */
export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

/**
 * Calculate room status based on occupancy percentage
 * @param currentOccupancy - Current number of people in the room
 * @param maxCapacity - Maximum capacity of the room
 * @returns RoomStatus enum value
 */
export function calculateRoomStatus(
  currentOccupancy: number,
  maxCapacity: number
): RoomStatus {
  if (maxCapacity <= 0) {
    return RoomStatus.EMPTY
  }

  const percentage = (currentOccupancy / maxCapacity) * 100

  if (percentage <= 40) {
    return RoomStatus.EMPTY
  } else if (percentage <= 75) {
    return RoomStatus.MODERATE
  } else {
    return RoomStatus.FULL
  }
}

/**
 * Validate Room object
 * Requirements: 7.1, 7.2, 1.3
 */
export function validateRoom(room: unknown): ValidationResult {
  const errors: ValidationError[] = []

  if (typeof room !== 'object' || room === null) {
    return {
      isValid: false,
      errors: [{ field: 'room', message: 'Room must be an object' }],
    }
  }

  const r = room as Partial<Room>

  // Validate id
  if (!r.id || typeof r.id !== 'string' || r.id.trim() === '') {
    errors.push({ field: 'id', message: 'id must be a non-empty string' })
  }

  // Validate name
  if (!r.name || typeof r.name !== 'string' || r.name.trim() === '') {
    errors.push({ field: 'name', message: 'name must be a non-empty string' })
  }

  // Validate currentOccupancy
  if (typeof r.currentOccupancy !== 'number') {
    errors.push({
      field: 'currentOccupancy',
      message: 'currentOccupancy must be a number',
    })
  } else if (r.currentOccupancy < 0) {
    errors.push({
      field: 'currentOccupancy',
      message: 'currentOccupancy must be non-negative',
    })
  } else if (!Number.isInteger(r.currentOccupancy)) {
    errors.push({
      field: 'currentOccupancy',
      message: 'currentOccupancy must be an integer',
    })
  }

  // Validate maxCapacity
  if (typeof r.maxCapacity !== 'number') {
    errors.push({
      field: 'maxCapacity',
      message: 'maxCapacity must be a number',
    })
  } else if (r.maxCapacity <= 0) {
    errors.push({
      field: 'maxCapacity',
      message: 'maxCapacity must be a positive integer',
    })
  } else if (!Number.isInteger(r.maxCapacity)) {
    errors.push({
      field: 'maxCapacity',
      message: 'maxCapacity must be an integer',
    })
  }

  // Validate occupancy does not exceed capacity
  if (
    typeof r.currentOccupancy === 'number' &&
    typeof r.maxCapacity === 'number' &&
    r.currentOccupancy > r.maxCapacity
  ) {
    errors.push({
      field: 'currentOccupancy',
      message: 'currentOccupancy must not exceed maxCapacity',
    })
  }

  // Validate lastUpdated
  if (!(r.lastUpdated instanceof Date)) {
    errors.push({
      field: 'lastUpdated',
      message: 'lastUpdated must be a Date object',
    })
  } else if (isNaN(r.lastUpdated.getTime())) {
    errors.push({
      field: 'lastUpdated',
      message: 'lastUpdated must be a valid Date',
    })
  }

  // Validate status
  if (
    !r.status ||
    !Object.values(RoomStatus).includes(r.status as RoomStatus)
  ) {
    errors.push({
      field: 'status',
      message: 'status must be a valid RoomStatus enum value',
    })
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Validate OccupancyDataPoint object
 * Requirements: 7.1, 7.2
 */
export function validateOccupancyDataPoint(
  dataPoint: unknown
): ValidationResult {
  const errors: ValidationError[] = []

  if (typeof dataPoint !== 'object' || dataPoint === null) {
    return {
      isValid: false,
      errors: [
        { field: 'dataPoint', message: 'OccupancyDataPoint must be an object' },
      ],
    }
  }

  const dp = dataPoint as Partial<OccupancyDataPoint>

  // Validate timestamp
  if (!(dp.timestamp instanceof Date)) {
    errors.push({
      field: 'timestamp',
      message: 'timestamp must be a Date object',
    })
  } else if (isNaN(dp.timestamp.getTime())) {
    errors.push({
      field: 'timestamp',
      message: 'timestamp must be a valid Date',
    })
  }

  // Validate count
  if (typeof dp.count !== 'number') {
    errors.push({ field: 'count', message: 'count must be a number' })
  } else if (dp.count < 0) {
    errors.push({ field: 'count', message: 'count must be non-negative' })
  } else if (!Number.isInteger(dp.count)) {
    errors.push({ field: 'count', message: 'count must be an integer' })
  }

  // Validate roomId
  if (!dp.roomId || typeof dp.roomId !== 'string' || dp.roomId.trim() === '') {
    errors.push({
      field: 'roomId',
      message: 'roomId must be a non-empty string',
    })
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Validate OccupancyUpdate object
 * Requirements: 7.1, 7.2
 */
export function validateOccupancyUpdate(update: unknown): ValidationResult {
  const errors: ValidationError[] = []

  if (typeof update !== 'object' || update === null) {
    return {
      isValid: false,
      errors: [
        { field: 'update', message: 'OccupancyUpdate must be an object' },
      ],
    }
  }

  const u = update as Partial<OccupancyUpdate>

  // Validate type
  if (u.type !== 'occupancy_change' && u.type !== 'room_status') {
    errors.push({
      field: 'type',
      message: "type must be 'occupancy_change' or 'room_status'",
    })
  }

  // Validate roomId
  if (!u.roomId || typeof u.roomId !== 'string' || u.roomId.trim() === '') {
    errors.push({
      field: 'roomId',
      message: 'roomId must be a non-empty string',
    })
  }

  // Validate data object
  if (typeof u.data !== 'object' || u.data === null) {
    errors.push({ field: 'data', message: 'data must be an object' })
  } else {
    // Validate currentOccupancy
    if (typeof u.data.currentOccupancy !== 'number') {
      errors.push({
        field: 'data.currentOccupancy',
        message: 'data.currentOccupancy must be a number',
      })
    } else if (u.data.currentOccupancy < 0) {
      errors.push({
        field: 'data.currentOccupancy',
        message: 'data.currentOccupancy must be non-negative',
      })
    } else if (!Number.isInteger(u.data.currentOccupancy)) {
      errors.push({
        field: 'data.currentOccupancy',
        message: 'data.currentOccupancy must be an integer',
      })
    }

    // Validate timestamp (ISO 8601 format)
    if (typeof u.data.timestamp !== 'string') {
      errors.push({
        field: 'data.timestamp',
        message: 'data.timestamp must be a string',
      })
    } else {
      const date = new Date(u.data.timestamp)
      if (isNaN(date.getTime())) {
        errors.push({
          field: 'data.timestamp',
          message: 'data.timestamp must be a valid ISO 8601 format string',
        })
      }
    }

    // Validate changeType (optional)
    if (
      u.data.changeType !== undefined &&
      u.data.changeType !== 'entry' &&
      u.data.changeType !== 'exit'
    ) {
      errors.push({
        field: 'data.changeType',
        message: "data.changeType must be 'entry' or 'exit' if provided",
      })
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Validate WebSocketMessage object
 */
export function validateWebSocketMessage(message: unknown): ValidationResult {
  const errors: ValidationError[] = []

  if (typeof message !== 'object' || message === null) {
    return {
      isValid: false,
      errors: [
        { field: 'message', message: 'WebSocketMessage must be an object' },
      ],
    }
  }

  const m = message as Partial<WebSocketMessage>

  // Validate action
  if (
    m.action !== 'subscribe' &&
    m.action !== 'unsubscribe' &&
    m.action !== 'ping'
  ) {
    errors.push({
      field: 'action',
      message: "action must be 'subscribe', 'unsubscribe', or 'ping'",
    })
  }

  // Validate roomId (required for subscribe/unsubscribe)
  if (m.action === 'subscribe' || m.action === 'unsubscribe') {
    if (!m.roomId || typeof m.roomId !== 'string' || m.roomId.trim() === '') {
      errors.push({
        field: 'roomId',
        message: 'roomId is required for subscribe/unsubscribe actions',
      })
    }
  }

  // Validate timestamp (ISO 8601 format)
  if (typeof m.timestamp !== 'string') {
    errors.push({
      field: 'timestamp',
      message: 'timestamp must be a string',
    })
  } else {
    const date = new Date(m.timestamp)
    if (isNaN(date.getTime())) {
      errors.push({
        field: 'timestamp',
        message: 'timestamp must be a valid ISO 8601 format string',
      })
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
