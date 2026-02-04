# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Real-time multiplayer Truco Uruguayo card game. Full-stack monolithic app with Next.js 14, TypeScript, Socket.IO, and Tailwind CSS. The codebase is in Spanish (variable names, comments, types, events).

## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

No test framework is configured.

## Architecture

**Server-authoritative model**: All game logic lives on the backend. The frontend only renders state received via Socket.IO and sends player intentions (never game logic).

### Data Flow

```
Browser (React pages) → Socket.IO events → API route handler → GameManager → TrucoEngine → Domain models
```

### Key Layers

- **`src/app/api/socket/route.ts`** — Socket.IO server endpoint. Handles all client-server events, instantiates a global `GameManager`, and broadcasts state changes to Socket.IO rooms. This is the only backend entry point.
- **`src/truco/game/GameManager.ts`** — Manages multiple concurrent game sessions. Maps player IDs to game IDs (`jugadoresEnPartida`). Handles player creation, lookup, removal, and cleanup of empty games.
- **`src/truco/engine/TrucoEngine.ts`** — Core game logic for a single match. Manages team assignment, card dealing, turn rotation, card validation, hand winner determination, and scoring. Operates on the `Mesa` state object.
- **`src/truco/models/Mazo.ts`** — Uruguayan deck (40 cards). Contains the full card power hierarchy (`poder` field). Fisher-Yates shuffle. Deals 3 cards per player.
- **`src/types/truco.ts`** — Domain types: `Carta`, `Jugador`, `Equipo`, `Mesa`, `Canto`, game/phase enums.
- **`src/types/socket.ts`** — Typed Socket.IO event interfaces (`ClientToServerEvents`, `ServerToClientEvents`).

### Frontend Pages

- **`/`** — Home page, links to lobby
- **`/lobby`** — Create or join games via Socket.IO
- **`/game?mesaId=XXX`** — Game table, renders state from server

### Socket.IO Communication

Events are in Spanish. Client-to-server: `join-lobby`, `crear-partida`, `unirse-partida`, `iniciar-partida`, `jugar-carta`. Server-to-client: `partidas-disponibles`, `partida-nueva`, `partida-creada`, `unido-partida`, `jugador-unido`, `partida-iniciada`, `carta-jugada`, `turno-cambiado`, `mano-finalizada`, `juego-finalizado`. All events are typed in `src/types/socket.ts`.

The socket client singleton lives in `src/lib/socket.ts` and connects to path `/api/socket/io`.

## Game Rules (Truco Uruguayo)

- 40-card Spanish deck (suits: oro, copa, espada, basto; values: 1-7, 10-12; no 8/9)
- Supports 1v1, 2v2, 3v3 (always 2 teams, generic engine)
- 3 cards dealt per player, best of 3 hands per round
- Game plays to 30 points
- Card power hierarchy (highest first): espada-1 (14), basto-1 (13), espada-7 (12), oro-7 (11), then 3s, 2s, 1s by suit, then 12s/11s/10s (all power 0)
- Full rules reference: `reglasDelTruco.txt`

## What's Not Yet Implemented

Cantos system (Truco/Retruco/Vale 4), Envido system, Flor, card animations, persistent rooms, ranking. The types for cantos exist in `src/types/truco.ts` but the engine doesn't process them yet.

## Key Conventions

- Path alias: `@/*` maps to `./src/*`
- `next.config.js` marks `socket.io` as external (required for Socket.IO in Next.js 14)
- Card images are in `Cartasimg/` as PNGs named `{valor}-{palo}.png`
- The first player to create a game is the host (`jugadores[0]`) and only they can start the game
- Teams are auto-assigned: first half of players → team 1, second half → team 2
