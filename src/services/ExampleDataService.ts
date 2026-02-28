/**
 * ExampleDataService
 * Provides mock/example data for development, testing, and fallback scenarios
 * when the backend is unavailable.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
 */

import {
  Room,
  //RoomStatus,
  OccupancyDataPoint,
  OccupancyUpdate,
  calculateRoomStatus,
} from '../models/types'

/**
 * Example data point with status color
 */
interface ExampleDataPoint {
  time: Date
  occupancy: number
  status: 'green' | 'yellow' | 'red'
}

/**
 * Example room with pre-defined data
 */
interface ExampleRoom {
  id: string
  name: string
  maxCapacity: number
  exampleData: ExampleDataPoint[]
}

/**
 * Generate example occupancy data for a 24-hour period
 * Creates realistic occupancy patterns with proper status colors
 */
function generateExampleData(
  maxCapacity: number,
  pattern: 'busy' | 'moderate' | 'quiet'
): ExampleDataPoint[] {
  const data: ExampleDataPoint[] = []
  const now = new Date()
  const hoursToGenerate = 24

  for (let i = hoursToGenerate; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000)
    let occupancy: number

    // Generate different patterns based on room type
    const hour = time.getHours()
    if (pattern === 'busy') {
      // Busy room: peaks during work hours (9am-5pm)
      if (hour >= 9 && hour <= 17) {
        occupancy = Math.floor(maxCapacity * (0.6 + Math.random() * 0.35))
      } else {
        occupancy = Math.floor(maxCapacity * (0.1 + Math.random() * 0.2))
      }
    } else if (pattern === 'moderate') {
      // Moderate room: steady usage with some variation
      if (hour >= 9 && hour <= 17) {
        occupancy = Math.floor(maxCapacity * (0.3 + Math.random() * 0.4))
      } else {
        occupancy = Math.floor(maxCapacity * (0.05 + Math.random() * 0.15))
      }
    } else {
      // Quiet room: low usage throughout
      if (hour >= 9 && hour <= 17) {
        occupancy = Math.floor(maxCapacity * (0.1 + Math.random() * 0.25))
      } else {
        occupancy = Math.floor(maxCapacity * Math.random() * 0.1)
      }
    }

    // Ensure occupancy doesn't exceed capacity
    occupancy = Math.min(occupancy, maxCapacity)

    // Calculate status color based on occupancy percentage
    const percentage = (occupancy / maxCapacity) * 100
    let status: 'green' | 'yellow' | 'red'
    if (percentage <= 40) {
      status = 'green'
    } else if (percentage <= 75) {
      status = 'yellow'
    } else {
      status = 'red'
    }

    data.push({ time, occupancy, status })
  }

  return data
}

/**
 * Example rooms with pre-defined data
 * Stored as in-memory constants (never persisted)
 */
const EXAMPLE_ROOMS: ExampleRoom[] = [
  {
    id: 'example-conference-a',
    name: 'Conference Room A',
    maxCapacity: 50,
    exampleData: generateExampleData(50, 'busy'),
  },
  {
    id: 'example-meeting-b',
    name: 'Meeting Room B',
    maxCapacity: 20,
    exampleData: generateExampleData(20, 'moderate'),
  },
  {
    id: 'example-study-c',
    name: 'Study Room C',
    maxCapacity: 10,
    exampleData: generateExampleData(10, 'quiet'),
  },
]

/**
 * ExampleDataService class
 * Provides example data and optional real-time simulation
 */
export class ExampleDataService {
  private simulationInterval: NodeJS.Timeout | null = null
  private simulationCallback: ((update: OccupancyUpdate) => void) | null = null

  /**
   * Get all example rooms
   * Returns rooms with current occupancy from latest data point
   * Requirements: 11.1, 11.2
   */
  getExampleRooms(): Room[] {
    return EXAMPLE_ROOMS.map((exampleRoom) => {
      // Get the most recent data point (last in array)
      const latestData =
        exampleRoom.exampleData[exampleRoom.exampleData.length - 1]

      return {
        id: exampleRoom.id,
        name: exampleRoom.name,
        currentOccupancy: latestData.occupancy,
        maxCapacity: exampleRoom.maxCapacity,
        lastUpdated: latestData.time,
        status: calculateRoomStatus(
          latestData.occupancy,
          exampleRoom.maxCapacity
        ),
      }
    })
  }

  /**
   * Get example occupancy data for a specific room
   * Filters data to the specified time range (default 24 hours)
   * Requirements: 11.1, 11.2
   *
   * @param roomId - The room ID to get data for
   * @param hours - Number of hours of historical data (default 24)
   * @returns Array of occupancy data points
   */
  getExampleOccupancyData(
    roomId: string,
    hours: number = 24
  ): OccupancyDataPoint[] {
    const exampleRoom = EXAMPLE_ROOMS.find((room) => room.id === roomId)
    if (!exampleRoom) {
      return []
    }

    const now = new Date()
    const cutoffTime = new Date(now.getTime() - hours * 60 * 60 * 1000)

    // Filter data to the specified time range and transform to OccupancyDataPoint
    return exampleRoom.exampleData
      .filter((dataPoint) => dataPoint.time >= cutoffTime)
      .map((dataPoint) => ({
        timestamp: dataPoint.time,
        count: dataPoint.occupancy,
        roomId: exampleRoom.id,
      }))
  }

  /**
   * Simulate real-time occupancy updates
   * Generates periodic updates for testing animated transitions
   * Requirements: 11.7
   *
   * @param callback - Function to call with each simulated update
   */
  simulateRealTimeUpdates(callback: (update: OccupancyUpdate) => void): void {
    // Stop any existing simulation
    this.stopSimulation()

    this.simulationCallback = callback

    // Generate updates every 5 seconds
    this.simulationInterval = setInterval(() => {
      // Pick a random room
      const randomRoom =
        EXAMPLE_ROOMS[Math.floor(Math.random() * EXAMPLE_ROOMS.length)]

      // Get current occupancy
      const latestData =
        randomRoom.exampleData[randomRoom.exampleData.length - 1]
      let newOccupancy = latestData.occupancy

      // Randomly increase or decrease occupancy by 1-3 people
      const change = Math.floor(Math.random() * 3) + 1
      const isEntry = Math.random() > 0.5

      if (isEntry) {
        newOccupancy = Math.min(newOccupancy + change, randomRoom.maxCapacity)
      } else {
        newOccupancy = Math.max(newOccupancy - change, 0)
      }

      // Create update message
      const update: OccupancyUpdate = {
        type: 'occupancy_change',
        roomId: randomRoom.id,
        data: {
          currentOccupancy: newOccupancy,
          timestamp: new Date().toISOString(),
          changeType: isEntry ? 'entry' : 'exit',
        },
      }

      // Update the example data (in-memory only)
      randomRoom.exampleData.push({
        time: new Date(),
        occupancy: newOccupancy,
        status:
          (newOccupancy / randomRoom.maxCapacity) * 100 <= 40
            ? 'green'
            : (newOccupancy / randomRoom.maxCapacity) * 100 <= 75
              ? 'yellow'
              : 'red',
      })

      // Keep only last 25 hours of data
      if (randomRoom.exampleData.length > 25) {
        randomRoom.exampleData.shift()
      }

      // Call the callback with the update
      if (this.simulationCallback) {
        this.simulationCallback(update)
      }
    }, 5000)
  }

  /**
   * Stop the real-time simulation
   * Requirements: 11.7
   */
  stopSimulation(): void {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval)
      this.simulationInterval = null
    }
    this.simulationCallback = null
  }
}
