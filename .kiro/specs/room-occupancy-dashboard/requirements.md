# Requirements Document

## Introduction

The Room Occupancy Dashboard is a real-time monitoring system that enables facility managers and staff to track occupancy levels across multiple rooms. The system provides immediate visibility into room utilization through an intuitive visual interface, helping optimize space usage and ensure capacity compliance. The dashboard displays a time-series graph for detailed occupancy trends and a color-coded room list for at-a-glance status assessment.

## Glossary

- **Dashboard**: The main user interface component that displays occupancy information
- **Room**: A physical space being monitored for occupancy
- **Occupancy_Count**: The current number of people in a room
- **Capacity**: The maximum number of people allowed in a room
- **Status_Indicator**: A color-coded visual element showing room occupancy level (green/yellow/red)
- **Occupancy_Graph**: A time-series line chart showing occupancy trends over time
- **WebSocket_Service**: The real-time communication channel between frontend and backend
- **Backend**: The AWS-based server infrastructure providing occupancy data
- **Occupancy_Update**: A real-time message containing current occupancy information
- **Room_List**: The scrollable list of rooms with status indicators
- **Example_Data**: Pre-defined mock data stored in-memory for development, testing, and fallback scenarios
- **Example_Data_Service**: The service component that provides example data when the backend is unavailable
- **Example_Data_Mode**: The operational state where the dashboard displays example data instead of live backend data
- **Live_Data_Mode**: The operational state where the dashboard displays real-time data from the backend

## Requirements

### Requirement 1: Display Real-Time Occupancy Data

**User Story:** As a facility manager, I want to see current occupancy levels for all rooms, so that I can monitor space utilization in real-time.

#### Acceptance Criteria

1. WHEN the Dashboard loads, THE Dashboard SHALL display a list of all available rooms with their current occupancy counts
2. WHEN an Occupancy_Update is received, THE Dashboard SHALL update the displayed occupancy count within 500ms
3. THE Dashboard SHALL display each room's Capacity alongside its Occupancy_Count
4. WHEN occupancy data is unavailable, THE Dashboard SHALL display the last known occupancy with a timestamp

### Requirement 2: Visualize Occupancy Trends

**User Story:** As a facility manager, I want to see occupancy trends over time, so that I can identify usage patterns and plan accordingly.

#### Acceptance Criteria

1. WHEN a user selects a room, THE Occupancy_Graph SHALL display occupancy data for the last 24 hours
2. THE Occupancy_Graph SHALL render data points in chronological order with timestamps on the x-axis
3. THE Occupancy_Graph SHALL display occupancy counts on the y-axis with appropriate scale
4. WHEN new data arrives, THE Occupancy_Graph SHALL animate the transition smoothly
5. THE Occupancy_Graph SHALL display the current occupancy value prominently

### Requirement 3: Indicate Room Status with Color Coding

**User Story:** As a staff member, I want to quickly identify which rooms are available or full, so that I can make immediate decisions without analyzing numbers.

#### Acceptance Criteria

1. WHEN a room's occupancy is 40% or less of capacity, THE Status_Indicator SHALL display green
2. WHEN a room's occupancy is between 41% and 75% of capacity, THE Status_Indicator SHALL display yellow
3. WHEN a room's occupancy is above 75% of capacity, THE Status_Indicator SHALL display red
4. THE Room_List SHALL update Status_Indicator colors immediately when occupancy changes

### Requirement 4: Enable Room Selection

**User Story:** As a facility manager, I want to select specific rooms to view detailed occupancy trends, so that I can focus on rooms of interest.

#### Acceptance Criteria

1. WHEN a user clicks a room in the Room_List, THE Dashboard SHALL display that room's occupancy graph
2. WHEN a room is selected, THE Dashboard SHALL highlight the selected room in the Room_List
3. WHEN a user selects a different room, THE Occupancy_Graph SHALL transition to show the new room's data
4. THE Dashboard SHALL maintain room selection state during the user session

### Requirement 5: Maintain Real-Time Connection

**User Story:** As a facility manager, I want the dashboard to stay connected to the backend, so that I receive continuous occupancy updates without manual refresh.

#### Acceptance Criteria

1. WHEN the Dashboard loads, THE WebSocket_Service SHALL establish a connection to the Backend
2. WHEN a room is selected, THE WebSocket_Service SHALL subscribe to that room's occupancy updates
3. WHEN a room is deselected, THE WebSocket_Service SHALL unsubscribe from that room's updates
4. WHEN the Dashboard closes, THE WebSocket_Service SHALL disconnect gracefully

### Requirement 6: Handle Connection Failures

**User Story:** As a facility manager, I want the dashboard to recover from connection issues automatically, so that I don't lose monitoring capability during network disruptions.

#### Acceptance Criteria

1. IF the WebSocket connection fails, THEN THE WebSocket_Service SHALL attempt reconnection with exponential backoff starting at 1 second
2. WHEN reconnection attempts fail repeatedly, THE WebSocket_Service SHALL cap the retry delay at 30 seconds
3. IF the connection is lost, THEN THE Dashboard SHALL display a "Connection lost" notification
4. WHEN the connection is restored, THE Dashboard SHALL remove the notification and resume real-time updates
5. WHILE the connection is unavailable, THE Dashboard SHALL display cached data with the last update timestamp

### Requirement 7: Validate Occupancy Data

**User Story:** As a system administrator, I want the dashboard to reject invalid occupancy data, so that users see only accurate and reliable information.

#### Acceptance Criteria

1. WHEN an Occupancy_Update is received, THE Dashboard SHALL verify the occupancy count is non-negative
2. WHEN an Occupancy_Update is received, THE Dashboard SHALL verify the occupancy count does not exceed the room's Capacity
3. IF invalid data is received, THEN THE Dashboard SHALL reject the update and maintain the previous valid state
4. IF invalid data is received, THEN THE Dashboard SHALL log an error for system monitoring

### Requirement 8: Display User Interface with Apple Aesthetics

**User Story:** As a user, I want a clean and elegant interface, so that I can focus on the data without visual clutter.

#### Acceptance Criteria

1. THE Dashboard SHALL center all content with appropriate whitespace following Apple design principles
2. THE Occupancy_Graph SHALL use a lime green line with gradient fill
3. THE Dashboard SHALL use smooth animations for all state transitions
4. THE Room_List SHALL display room cards with clear typography and spacing
5. THE Dashboard SHALL be responsive and adapt to different screen sizes

### Requirement 9: Handle Missing or Unavailable Rooms

**User Story:** As a facility manager, I want clear feedback when a room becomes unavailable, so that I understand why data is not displayed.

#### Acceptance Criteria

1. IF a selected room is no longer available in the Backend, THEN THE Dashboard SHALL display a "Room unavailable" message
2. WHEN a room becomes unavailable, THE Dashboard SHALL refresh the Room_List from the Backend
3. IF the selected room becomes unavailable, THEN THE Dashboard SHALL automatically select the first available room
4. THE Dashboard SHALL handle empty room lists gracefully with an appropriate message

### Requirement 10: Provide Example Data Fallback

**User Story:** As a facility manager, I want the dashboard to display example data when the backend is unavailable, so that I can continue to evaluate the dashboard's functionality and interface.

#### Acceptance Criteria

1. WHEN the WebSocket_Service fails to connect after maximum retry attempts, THE Dashboard SHALL automatically switch to Example_Data_Mode
2. WHILE in Example_Data_Mode, THE Dashboard SHALL display a persistent "Using example data" indicator banner
3. WHILE in Example_Data_Mode, THE Dashboard SHALL display example rooms and occupancy data with the same visual presentation as Live_Data_Mode
4. WHEN displaying Example_Data, THE Dashboard SHALL never send data to or modify the Backend database
5. WHEN the Backend becomes available while in Example_Data_Mode, THE WebSocket_Service SHALL notify the user that live data is available
6. THE Dashboard SHALL provide a manual control to switch between Live_Data_Mode and Example_Data_Mode
7. WHEN switching from Example_Data_Mode to Live_Data_Mode, THE Dashboard SHALL establish a WebSocket connection and load live data
8. WHEN switching from Live_Data_Mode to Example_Data_Mode, THE Dashboard SHALL disconnect from the Backend and load Example_Data

### Requirement 11: Structure Example Data for Realistic Testing

**User Story:** As a developer, I want example data to be structured realistically, so that I can test and demonstrate the dashboard without requiring backend infrastructure.

#### Acceptance Criteria

1. THE Example_Data SHALL include at least two example rooms with distinct names and capacities
2. THE Example_Data SHALL include time-series data points with timestamp, occupancy count, and status fields
3. WHEN Example_Data is displayed, THE Status_Indicator colors SHALL match the occupancy thresholds (green: 0-40%, yellow: 41-75%, red: 76-100%)
4. THE Example_Data SHALL be stored as in-memory constants within the frontend codebase
5. THE Example_Data SHALL never be persisted to local storage or any external storage system
6. FOR ALL Example_Data occupancy values, the occupancy count SHALL not exceed the room's maximum capacity
7. THE Example_Data_Service SHALL optionally simulate real-time updates for testing animated transitions

### Requirement 12: Optimize Performance for Real-Time Updates

**User Story:** As a user, I want the dashboard to remain responsive during high-frequency updates, so that the interface doesn't lag or freeze.

#### Acceptance Criteria

1. THE Occupancy_Graph SHALL render animations at 60 frames per second
2. WHEN receiving rapid Occupancy_Updates, THE Dashboard SHALL debounce updates to maximum 10 per second per room
3. THE Dashboard SHALL limit historical data to the last 24 hours to maintain performance
4. THE Room_List SHALL prevent unnecessary re-renders when occupancy data updates for non-visible rooms
