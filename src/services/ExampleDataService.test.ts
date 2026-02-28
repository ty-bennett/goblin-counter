/**
 * Unit tests for ExampleDataService
 * Requirements: 11.1, 11.2, 11.4, 11.5, 11.7
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ExampleDataService } from './ExampleDataService'
import { RoomStatus, OccupancyUpdate } from '../models/types'

describe('ExampleDataService', () => {
  let service: ExampleDataService

  beforeEach(() => {
    service = new ExampleDataService()
  })

  afterEach(() => {
    service.stopSimulation()
  })

  describe('getExampleRooms', () => {
    it('should return at least two example rooms', () => {
      const rooms = service.getExampleRooms()
      expect(rooms.length).toBeGreaterThanOrEqual(2)
    })

    it('should return rooms with distinct names', () => {
      const rooms = service.getExampleRooms()
      const names = rooms.map((room) => room.name)
      const uniqueNames = new Set(names)
      expect(uniqueNames.size).toBe(names.length)
    })

    it('should return rooms with distinct capacities', () => {
      const rooms = service.getExampleRooms()
      const capacities = rooms.map((room) => room.maxCapacity)
      const uniqueCapacities = new Set(capacities)
      expect(uniqueCapacities.size).toBeGreaterThan(1)
    })

    it('should return rooms with valid data', () => {
      const rooms = service.getExampleRooms()
      rooms.forEach((room) => {
        expect(room.id).toBeTruthy()
        expect(room.name).toBeTruthy()
        expect(room.currentOccupancy).toBeGreaterThanOrEqual(0)
        expect(room.maxCapacity).toBeGreaterThan(0)
        expect(room.currentOccupancy).toBeLessThanOrEqual(room.maxCapacity)
        expect(room.lastUpdated).toBeInstanceOf(Date)
        expect(Object.values(RoomStatus)).toContain(room.status)
      })
    })

    it('should calculate status correctly based on occupancy', () => {
      const rooms = service.getExampleRooms()
      rooms.forEach((room) => {
        const percentage = (room.currentOccupancy / room.maxCapacity) * 100
        if (percentage <= 40) {
          expect(room.status).toBe(RoomStatus.EMPTY)
        } else if (percentage <= 75) {
          expect(room.status).toBe(RoomStatus.MODERATE)
        } else {
          expect(room.status).toBe(RoomStatus.FULL)
        }
      })
    })
  })

  describe('getExampleOccupancyData', () => {
    it('should return empty array for non-existent room', () => {
      const data = service.getExampleOccupancyData('non-existent-room')
      expect(data).toEqual([])
    })

    it('should return data for valid room', () => {
      const rooms = service.getExampleRooms()
      const roomId = rooms[0].id
      const data = service.getExampleOccupancyData(roomId)
      expect(data.length).toBeGreaterThan(0)
    })

    it('should return data within specified time range', () => {
      const rooms = service.getExampleRooms()
      const roomId = rooms[0].id
      const hours = 12
      const data = service.getExampleOccupancyData(roomId, hours)

      const now = new Date()
      const cutoffTime = new Date(now.getTime() - hours * 60 * 60 * 1000)

      data.forEach((dataPoint) => {
        expect(dataPoint.timestamp.getTime()).toBeGreaterThanOrEqual(
          cutoffTime.getTime()
        )
      })
    })

    it('should return data with correct structure', () => {
      const rooms = service.getExampleRooms()
      const roomId = rooms[0].id
      const data = service.getExampleOccupancyData(roomId)

      data.forEach((dataPoint) => {
        expect(dataPoint).toHaveProperty('timestamp')
        expect(dataPoint).toHaveProperty('count')
        expect(dataPoint).toHaveProperty('roomId')
        expect(dataPoint.timestamp).toBeInstanceOf(Date)
        expect(typeof dataPoint.count).toBe('number')
        expect(dataPoint.count).toBeGreaterThanOrEqual(0)
        expect(dataPoint.roomId).toBe(roomId)
      })
    })

    it('should return data in chronological order', () => {
      const rooms = service.getExampleRooms()
      const roomId = rooms[0].id
      const data = service.getExampleOccupancyData(roomId)

      for (let i = 1; i < data.length; i++) {
        expect(data[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          data[i - 1].timestamp.getTime()
        )
      }
    })

    it('should default to 24 hours when hours parameter is not provided', () => {
      const rooms = service.getExampleRooms()
      const roomId = rooms[0].id
      const data = service.getExampleOccupancyData(roomId)

      const now = new Date()
      const cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      data.forEach((dataPoint) => {
        expect(dataPoint.timestamp.getTime()).toBeGreaterThanOrEqual(
          cutoffTime.getTime()
        )
      })
    })
  })

  describe('simulateRealTimeUpdates', () => {
    it('should call callback with valid updates', async () => {
      const updates: OccupancyUpdate[] = []
      const callback = vi.fn((update: OccupancyUpdate) => {
        updates.push(update)
      })

      service.simulateRealTimeUpdates(callback)

      // Wait for at least one update (5 seconds + buffer)
      await new Promise((resolve) => setTimeout(resolve, 5500))

      service.stopSimulation()

      expect(callback).toHaveBeenCalled()
      expect(updates.length).toBeGreaterThan(0)

      updates.forEach((update) => {
        expect(update).toHaveProperty('type')
        expect(update.type).toBe('occupancy_change')
        expect(update).toHaveProperty('roomId')
        expect(update).toHaveProperty('data')
        expect(update.data).toHaveProperty('currentOccupancy')
        expect(update.data).toHaveProperty('timestamp')
        expect(update.data).toHaveProperty('changeType')
        expect(typeof update.data.currentOccupancy).toBe('number')
        expect(update.data.currentOccupancy).toBeGreaterThanOrEqual(0)
        expect(['entry', 'exit']).toContain(update.data.changeType)
      })
    }, 10000)

    it('should generate updates for valid room IDs', async () => {
      const rooms = service.getExampleRooms()
      const roomIds = rooms.map((room) => room.id)
      const updates: OccupancyUpdate[] = []

      service.simulateRealTimeUpdates((update: OccupancyUpdate) => {
        updates.push(update)
      })

      await new Promise((resolve) => setTimeout(resolve, 5500))
      service.stopSimulation()

      updates.forEach((update) => {
        expect(roomIds).toContain(update.roomId)
      })
    }, 10000)

    it('should respect room capacity limits', async () => {
      const rooms = service.getExampleRooms()
      const roomCapacities = new Map(
        rooms.map((room) => [room.id, room.maxCapacity])
      )
      const updates: OccupancyUpdate[] = []

      service.simulateRealTimeUpdates((update: OccupancyUpdate) => {
        updates.push(update)
      })

      await new Promise((resolve) => setTimeout(resolve, 5500))
      service.stopSimulation()

      updates.forEach((update) => {
        const maxCapacity = roomCapacities.get(update.roomId)
        expect(maxCapacity).toBeDefined()
        expect(update.data.currentOccupancy).toBeLessThanOrEqual(maxCapacity!)
      })
    }, 10000)
  })

  describe('stopSimulation', () => {
    it('should stop generating updates', async () => {
      let updateCount = 0
      service.simulateRealTimeUpdates(() => {
        updateCount++
      })

      await new Promise((resolve) => setTimeout(resolve, 5500))
      const countAfterFirstInterval = updateCount

      service.stopSimulation()

      await new Promise((resolve) => setTimeout(resolve, 5500))
      const countAfterStop = updateCount

      expect(countAfterStop).toBe(countAfterFirstInterval)
    }, 15000)

    it('should be safe to call multiple times', () => {
      expect(() => {
        service.stopSimulation()
        service.stopSimulation()
        service.stopSimulation()
      }).not.toThrow()
    })

    it('should allow restarting simulation after stop', async () => {
      let updateCount = 0
      service.simulateRealTimeUpdates(() => {
        updateCount++
      })

      await new Promise((resolve) => setTimeout(resolve, 5500))
      service.stopSimulation()

      const countAfterStop = updateCount

      service.simulateRealTimeUpdates(() => {
        updateCount++
      })

      await new Promise((resolve) => setTimeout(resolve, 5500))
      service.stopSimulation()

      expect(updateCount).toBeGreaterThan(countAfterStop)
    }, 15000)
  })

  describe('data persistence', () => {
    it('should not persist data to local storage', () => {
      const localStorageSpy = vi.spyOn(Storage.prototype, 'setItem')

      service.getExampleRooms()
      service.getExampleOccupancyData('example-conference-a')

      expect(localStorageSpy).not.toHaveBeenCalled()

      localStorageSpy.mockRestore()
    })

    it('should keep data in memory only', () => {
      const rooms1 = service.getExampleRooms()
      const rooms2 = service.getExampleRooms()

      // Should return the same data structure
      expect(rooms1.length).toBe(rooms2.length)
      rooms1.forEach((room, index) => {
        expect(room.id).toBe(rooms2[index].id)
        expect(room.name).toBe(rooms2[index].name)
        expect(room.maxCapacity).toBe(rooms2[index].maxCapacity)
      })
    })
  })
})
