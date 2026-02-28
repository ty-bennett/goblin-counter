# Implementation Plan: Room Occupancy Dashboard

## Overview

This implementation plan breaks down the Room Occupancy Dashboard into incremental coding tasks. The dashboard features a real-time WebSocket connection to AWS backend, an Apple-inspired centered layout with a lime green gradient occupancy graph, and a color-coded room status list. Each task builds on previous work, with property-based tests included as optional sub-tasks to validate correctness properties.

## Tasks

- [x] 1. Set up project structure and TypeScript configuration
  - Create React project with TypeScript support
  - Configure ESLint, Prettier, and TypeScript compiler options
  - Set up testing framework (Jest + React Testing Library)
  - Install dependencies: React 18+, D3.js or Recharts, date-fns, fast-check
  - Create directory structure: components/, services/, models/, utils/, styles/
  - _Requirements: 8.1, 8.4_

- [ ] 2. Implement data models and type definitions
  - [-] 2.1 Create TypeScript interfaces for all data models
    - Define Room, RoomStatus, OccupancyDataPoint, OccupancyUpdate, WebSocketMessage interfaces
    - Implement validation functions for each model
    - _Requirements: 7.1, 7.2, 1.3_

  - [ ]* 2.2 Write property test for occupancy bounds validation
    - **Property 1: Occupancy Bounds**
    - **Validates: Requirements 7.1, 7.2**

  - [ ]* 2.3 Write property test for status color calculation
    - **Property 2: Status Color Consistency**
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [ ] 3. Implement WebSocketService component
  - [ ] 3.1 Create WebSocketService class with connection management
    - Implement connect(), disconnect(), subscribe(), unsubscribe() methods
    - Add connection state tracking (isConnected property)
    - Implement message parsing and callback system (onMessage, onError)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 3.2 Implement reconnection logic with exponential backoff
    - Add retry mechanism starting at 1 second
    - Cap maximum retry delay at 30 seconds
    - Track reconnection attempts and state
    - _Requirements: 6.1, 6.2_

  - [ ]* 3.3 Write property test for WebSocket subscription round-trip
    - **Property 10: WebSocket Subscription Round-Trip**
    - **Validates: Requirements 5.2, 5.3**

  - [ ]* 3.4 Write property test for connection resilience
    - **Property 11: Connection Resilience**
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 3.5 Write unit tests for WebSocketService
    - Mock WebSocket API
    - Test connection lifecycle, message parsing, error handling
    - Test reconnection backoff timing
    - _Requirements: 5.1, 6.1, 6.2_

- [ ] 4. Checkpoint - Ensure WebSocket tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement ExampleDataService component
  - [x] 5.1 Create ExampleDataService class with example data constants
    - Define example room data with at least two rooms (distinct names, capacities)
    - Define example occupancy time-series data with timestamp, occupancy, and status fields
    - Ensure all example data points have occupancy within room capacity
    - Calculate status colors based on occupancy thresholds (green: 0-40%, yellow: 41-75%, red: 76-100%)
    - Store all data as in-memory constants (no persistence to local storage)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 5.2 Implement getExampleRooms() and getExampleOccupancyData() methods
    - Return example rooms array from in-memory constants
    - Return filtered occupancy data for specified room and time range (default 24 hours)
    - Transform example data to match Room and OccupancyDataPoint interfaces
    - _Requirements: 11.1, 11.2_

  - [x] 5.3 Implement simulateRealTimeUpdates() and stopSimulation() methods
    - Create optional simulation that generates periodic occupancy updates
    - Use callback pattern to deliver simulated updates
    - Implement stop mechanism to halt simulation
    - _Requirements: 11.7_

  - [ ]* 5.4 Write property test for example data isolation
    - **Property 20: Example Data Isolation**
    - **Validates: Requirements 10.4**

  - [ ]* 5.5 Write property test for example data status consistency
    - **Property 21: Example Data Status Consistency**
    - **Validates: Requirements 11.3**

  - [ ]* 5.6 Write unit tests for ExampleDataService
    - Test getExampleRooms() returns valid room data
    - Test getExampleOccupancyData() filters by room and time range
    - Test simulateRealTimeUpdates() generates valid updates
    - Test stopSimulation() halts update generation
    - Verify no data persistence occurs
    - _Requirements: 11.1, 11.2, 11.4, 11.5, 11.7_

- [ ] 6. Integrate ExampleDataService with WebSocketService
  - [ ] 6.1 Add ExampleDataService integration to WebSocketService
    - Add exampleDataService property to WebSocketService
    - Add useExampleData boolean flag to track current mode
    - Implement switchToExampleData() method for automatic fallback
    - Implement switchToLiveData() method for manual switch back
    - _Requirements: 10.1, 10.6, 10.7, 10.8_

  - [ ] 6.2 Implement automatic fallback after connection failures
    - Trigger switchToExampleData() after maximum retry attempts exhausted
    - Load example rooms and notify UI via existing callbacks
    - Optionally start real-time simulation
    - _Requirements: 10.1_

  - [ ] 6.3 Implement backend availability notification
    - Detect when backend becomes available while in example data mode
    - Notify user that live data is available (via callback or event)
    - _Requirements: 10.5_

  - [ ]* 6.4 Write property test for automatic fallback to example data
    - **Property 22: Automatic Fallback to Example Data**
    - **Validates: Requirements 10.1**

  - [ ]* 6.5 Write unit tests for example data integration
    - Test automatic fallback after connection failures
    - Test switchToExampleData() loads example rooms
    - Test switchToLiveData() reconnects to backend
    - Test mode switching stops/starts appropriate services
    - _Requirements: 10.1, 10.6, 10.7, 10.8_

- [ ] 7. Implement example data UI indicators and controls
  - [ ] 7.1 Create "Using example data" indicator banner component
    - Display persistent banner when in example data mode
    - Position banner prominently (top of dashboard)
    - Apply distinct styling to differentiate from live data mode
    - _Requirements: 10.2_

  - [ ] 7.2 Implement manual mode toggle control
    - Add UI control to switch between live and example data modes
    - Update control state based on current mode
    - Handle toggle events to call switchToExampleData() or switchToLiveData()
    - _Requirements: 10.6_

  - [ ] 7.3 Integrate indicator and toggle with DashboardContainer
    - Add example data mode state to DashboardContainer
    - Show/hide indicator based on mode
    - Wire toggle control to WebSocketService mode switching methods
    - _Requirements: 10.2, 10.6_

  - [ ]* 7.4 Write property test for example data indicator visibility
    - **Property 23: Example Data Indicator Visibility**
    - **Validates: Requirements 10.2**

  - [ ]* 7.5 Write unit tests for example data UI components
    - Test indicator banner displays when in example data mode
    - Test indicator banner hidden when in live data mode
    - Test toggle control switches modes correctly
    - Test toggle control updates visual state
    - _Requirements: 10.2, 10.6_

- [ ] 8. Checkpoint - Ensure example data feature tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement RoomStatusList component
  - [ ] 9.1 Create RoomStatusList React component
    - Render scrollable list of room cards
    - Display room name, current occupancy, and capacity
    - Implement getStatusColor() function for color coding
    - Handle room click events and selection state
    - Apply hover and selection styles with smooth transitions
    - _Requirements: 1.1, 1.3, 3.1, 3.2, 3.3, 4.1, 4.2, 8.4_

  - [ ]* 9.2 Write property test for status color consistency
    - **Property 2: Status Color Consistency** (integration test)
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [ ]* 9.3 Write property test for room selection highlighting
    - **Property 8: Room Selection Highlighting**
    - **Validates: Requirement 4.2**

  - [ ]* 9.4 Write unit tests for RoomStatusList
    - Test color calculation for various occupancy percentages
    - Test room selection and highlighting
    - Test rendering with empty room list
    - _Requirements: 3.1, 3.2, 3.3, 4.2, 9.4_

- [ ] 10. Implement OccupancyGraph component
  - [ ] 10.1 Create OccupancyGraph React component with SVG rendering
    - Set up D3.js or Recharts for line chart
    - Implement time axis (x) and occupancy count axis (y)
    - Apply lime green stroke (#32CD32) with gradient fill
    - Display current occupancy value prominently
    - Handle responsive sizing
    - _Requirements: 2.2, 2.3, 2.5, 8.2_

  - [ ] 10.2 Implement data update and animation logic
    - Add updateData() method to handle new data points
    - Implement smooth transitions using CSS transforms and requestAnimationFrame
    - Ensure 60fps animation performance
    - Filter data to last 24 hours only
    - _Requirements: 2.1, 2.4, 8.3, 10.1, 10.3_

  - [ ]* 10.3 Write property test for data point ordering
    - **Property 3: Data Point Ordering**
    - **Validates: Requirement 2.2**

  - [ ]* 10.4 Write property test for historical data window
    - **Property 6: Historical Data Window**
    - **Validates: Requirements 2.1, 10.3**

  - [ ]* 10.5 Write unit tests for OccupancyGraph
    - Test data rendering with various datasets
    - Test gradient application
    - Test animation triggers
    - Test responsive sizing
    - _Requirements: 2.2, 2.3, 2.4, 8.2_

- [ ] 11. Checkpoint - Ensure component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Implement DashboardContainer component
  - [ ] 12.1 Create DashboardContainer React component
    - Set up state management for selectedRoomId, rooms, occupancyData
    - Implement Apple-style centered layout with appropriate spacing
    - Apply responsive design for different screen sizes
    - _Requirements: 4.4, 8.1, 8.5_

  - [ ] 12.2 Integrate WebSocketService into DashboardContainer
    - Initialize WebSocketService on component mount
    - Implement connectWebSocket() and disconnectWebSocket() lifecycle methods
    - Handle WebSocket message callbacks to update state
    - Implement connection status notifications (connection lost/restored)
    - Display cached data with timestamp during disconnection
    - _Requirements: 5.1, 5.4, 6.3, 6.4, 6.5, 1.4_

  - [ ] 12.3 Implement room selection logic
    - Create onRoomSelect() handler
    - Subscribe to selected room via WebSocketService
    - Unsubscribe from previously selected room
    - Update occupancyData state with room-specific data
    - Maintain selection state during session
    - _Requirements: 4.1, 4.3, 4.4, 5.2, 5.3_

  - [ ] 12.4 Implement data validation and error handling
    - Validate incoming occupancy updates (non-negative, within capacity)
    - Reject invalid updates and maintain previous valid state
    - Log errors for invalid data
    - Handle room unavailability with "Room unavailable" message
    - Auto-select first available room when selected room becomes unavailable
    - Refresh room list when room availability changes
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 9.1, 9.2, 9.3_

  - [ ] 12.5 Implement update rate limiting and performance optimizations
    - Debounce rapid occupancy updates to max 10 per second per room
    - Use React.memo to prevent unnecessary re-renders of room cards
    - Optimize room list rendering for non-visible rooms
    - _Requirements: 10.2, 10.4_

  - [ ]* 12.6 Write property test for occupancy update reflection
    - **Property 4: Occupancy Update Reflection**
    - **Validates: Requirements 1.2, 3.4**

  - [ ]* 12.7 Write property test for room display completeness
    - **Property 5: Room Display Completeness**
    - **Validates: Requirement 1.3**

  - [ ]* 12.8 Write property test for room selection graph update
    - **Property 7: Room Selection Graph Update**
    - **Validates: Requirements 4.1, 4.3**

  - [ ]* 12.9 Write property test for room selection persistence
    - **Property 9: Room Selection Persistence**
    - **Validates: Requirement 4.4**

  - [ ]* 12.10 Write property test for connection loss notification
    - **Property 12: Connection Loss Notification**
    - **Validates: Requirement 6.3**

  - [ ]* 12.11 Write property test for connection recovery
    - **Property 13: Connection Recovery**
    - **Validates: Requirement 6.4**

  - [ ]* 12.12 Write property test for cached data during disconnection
    - **Property 14: Cached Data During Disconnection**
    - **Validates: Requirement 6.5**

  - [ ]* 12.13 Write property test for invalid data rejection
    - **Property 15: Invalid Data Rejection**
    - **Validates: Requirements 7.1, 7.2, 7.3**

  - [ ]* 12.14 Write property test for invalid data logging
    - **Property 16: Invalid Data Logging**
    - **Validates: Requirement 7.4**

  - [ ]* 12.15 Write property test for unavailable room handling
    - **Property 17: Unavailable Room Handling**
    - **Validates: Requirements 9.1, 9.3**

  - [ ]* 12.16 Write property test for room list refresh on availability change
    - **Property 18: Room List Refresh on Availability Change**
    - **Validates: Requirement 9.2**

  - [ ]* 12.17 Write property test for update rate limiting
    - **Property 19: Update Rate Limiting**
    - **Validates: Requirement 10.2**

- [ ] 13. Wire all components together in main App
  - [ ] 13.1 Create main App component
    - Import and render DashboardContainer
    - Pass WebSocket connection URL from environment variables
    - Set up global styles and CSS variables for Apple aesthetics
    - _Requirements: 8.1, 8.3_

  - [ ] 13.2 Configure environment variables
    - Create .env file for WebSocket endpoint URL
    - Add authentication token configuration
    - Document required environment variables
    - _Requirements: 5.1_

  - [ ]* 13.3 Write integration tests for complete dashboard flow
    - Test WebSocket message reception triggers UI updates
    - Test room selection updates graph and subscribes correctly
    - Test multiple rapid updates don't cause race conditions
    - Test connection loss and recovery maintains data consistency
    - Use mocked WebSocket server
    - _Requirements: 1.2, 4.1, 4.3, 6.3, 6.4, 10.2_

- [ ] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- The implementation uses TypeScript as specified in the design document
- WebSocket connection must use WSS (secure WebSocket) protocol in production
- All sensitive configuration should be stored in environment variables
