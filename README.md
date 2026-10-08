# StudySwap

A peer-to-peer study material exchange platform built for campus communities. StudySwap enables students to share, discover, and request academic resources seamlessly.

This repository contains the frontend application, designed with a focus on performance, user experience, and a robust architecture.

## Features

- **Material Discovery:** Browse and filter notes, essays, and study guides by subject.
- **Swap Requests:** Request access to materials and manage incoming exchange requests.
- **User Reputation:** A credibility scoring system based on community ratings.
- **Interactive Dashboards:** Real-time metrics and dynamic data visualization.
- **Command Palette & Keyboard Shortcuts:** Navigate the app quickly with keyboard-first controls.

## Tech Stack

- **Frontend Framework:** Vite, React 18, React Router v6
- **Styling:** Plain CSS with CSS variables, fully responsive design
- **Icons & Data Visualization:** lucide-react, recharts
- **Data Layer:** Currently uses a sophisticated in-memory mock database that mirrors a relational SQL schema (with constraints, foreign keys, and indexes).

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/CH-0408/StudySwap.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:5173](http://localhost:5173) in your browser.

## Architecture & Codebase

The application is structured for scalability and separation of concerns:

```text
src/
  api/        # API client layer (ready for REST integration)
  components/ # UI primitives, layout wrappers, and domain-specific components
  context/    # React contexts for state management (Auth, Theme, etc.)
  data/       # In-memory mock database, schema definitions, and seed data
  hooks/      # Reusable React hooks
  pages/      # Route-level components
  styles/     # Global CSS and design tokens
```

- **`src/data/db.js`**: Enforces strict database rules (NOT NULL, CHECK, PRIMARY KEY, FOREIGN KEY) and simulates transactions, query planning, and indexing purely in the browser.
- **`src/api/client.js`**: The only file that interacts with the mock data layer. When connecting to a real REST API backend, only this file needs to be updated.

## Keyboard Shortcuts

- `Ctrl + K`: Open command palette
- `/`: Global search
- `g d`, `g b`, `g r`, `g m`, `g p`: Quick navigation
- `u`: Upload material
- `t`: Toggle theme
- `?`: View all shortcuts

## License

MIT License
