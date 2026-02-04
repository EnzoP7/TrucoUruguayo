# Truco Multiplayer E2E Test

## Overview

This end-to-end test validates the complete multiplayer flow for the Truco Uruguayo card game using Playwright.

## Test Flow

The test simulates two players:

### Player 1 (Host)
1. Navigate to lobby
2. Enter name "Jugador1"
3. Select 1v1 room size
4. Create game
5. Wait in lobby
6. Start game when Player 2 joins
7. Play a card (if it's their turn)

### Player 2 (Guest)
1. Navigate to lobby in new browser page
2. Enter name "Jugador2"
3. See available games
4. Join Player 1's game
5. Wait for game to start

### Verification Points

The test checks:
- Lobby page loads correctly
- Players can create games
- Games appear in "Partidas Disponibles" list
- Players can join existing games
- Both players navigate to game page
- Game starts when host clicks "Iniciar Partida"
- Cards are dealt to players (3 cards each)
- Muestra (trump card) is visible
- Players can play cards
- Played cards appear on the mesa
- Turn rotation works
- No console errors

## Prerequisites

1. **Server must be running** at `http://localhost:3000`
   ```bash
   npm run dev
   ```

2. **Playwright installed**
   ```bash
   npm install
   ```

3. **Playwright browsers installed**
   ```bash
   npx playwright install chromium
   ```

## Running the Test

### Standard Run
```bash
npm run test:e2e
```

### UI Mode (Interactive)
```bash
npm run test:e2e:ui
```

### Debug Mode (Step-by-step)
```bash
npm run test:e2e:debug
```

### View Results
After running, open the HTML report:
```bash
npx playwright show-report
```

## Screenshots

The test captures screenshots at key points:

1. `01-player1-lobby.png` - Player 1 in lobby
2. `02-player1-waiting-room.png` - Player 1 waiting for others
3. `03-player2-lobby-with-games.png` - Player 2 sees available games
4. `04-player2-joined.png` - Player 2 joined game
5. `05-player1-both-players-joined.png` - Player 1 sees both players
6. `06-player1-game-started.png` - Game started (Player 1 view)
7. `07-player1-game-view.png` - Player 1's cards and game state
8. `08-player2-game-view.png` - Player 2's cards and game state
9. `09-player1-after-card-played.png` - After playing a card (Player 1)
10. `10-player2-after-card-played.png` - After playing a card (Player 2)

Screenshots are saved to `./screenshots/` directory.

## Troubleshooting

### Server not running
```
Error: page.goto: net::ERR_CONNECTION_REFUSED
```
Solution: Start the dev server with `npm run dev`

### Timeout waiting for elements
```
Error: Timeout 5000ms exceeded waiting for element
```
Possible causes:
- Socket.IO connection issues
- Game state not updating
- Frontend rendering issues
- Check browser console for errors

### Cards not visible
Check:
- Card images are in `Cartasimg/` directory
- Image paths are correct (format: `{valor}-{palo}.png`)
- Game state has dealt cards (`mesa.jugadores[X].mano`)

### Session storage issues
The app uses `sessionStorage` to persist:
- `truco_nombre` - Player name
- `truco_mesaId` - Game ID

These are set automatically by the frontend after creating/joining a game.

## Test Configuration

Configuration is in `playwright.config.ts`:
- `testDir: './tests'` - Test directory
- `workers: 1` - Single worker (tests run sequentially)
- `fullyParallel: false` - No parallel execution
- `baseURL: 'http://localhost:3000'` - Dev server URL
- Video and screenshots captured on failure

## What's Being Tested

### Socket.IO Events
- `join-lobby`
- `crear-partida`
- `unirse-partida`
- `iniciar-partida`
- `jugar-carta`

### Game Logic
- Team assignment (Player 1 = Team 1, Player 2 = Team 2)
- Card dealing (3 cards per player)
- Muestra selection
- Turn rotation
- Card validation
- Card play

### UI Components
- Lobby page
- Game creation form
- Available games list
- Waiting room
- Game table
- Player hands
- Mesa (played cards area)
- Muestra display

## Notes

- The test uses a single browser context with two pages to simulate two different players
- Both pages share the same browser but have separate sessionStorage
- Socket.IO connections are independent per page
- The test is deterministic but card dealing is random
