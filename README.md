# CUHackit 26

Ty Bennett, Isaac Rostron, George Atkinson, Rayan Ahmed

## Room Occupancy Dashboard

A real-time monitoring system for tracking occupancy levels across multiple rooms with WebSocket connectivity to AWS backend.

### Features

- Real-time occupancy monitoring with WebSocket updates
- Time-series graph with lime green gradient visualization
- Color-coded room status list (green/yellow/red)
- Apple-inspired centered layout with clean aesthetics
- Responsive design for various screen sizes

### Tech Stack

- **React 18+** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Recharts** - Chart visualization library
- **date-fns** - Date manipulation
- **Vitest** - Unit testing framework
- **React Testing Library** - Component testing
- **fast-check** - Property-based testing
- **ESLint** - Code linting
- **Prettier** - Code formatting

### Project Structure

```
src/
├── components/     # React components
├── services/       # WebSocket and API services
├── models/         # TypeScript interfaces and types
├── utils/          # Utility functions
├── styles/         # Global styles
└── test/           # Test setup and utilities
```

### Getting Started

#### Prerequisites

- Node.js 18+ and npm

#### Installation

```bash
npm install
```

#### Development

```bash
npm run dev
```

#### Build

```bash
npm run build
```

#### Testing

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch
```

#### Linting and Formatting

```bash
# Run ESLint
npm run lint

# Format code with Prettier
npm run format
```
