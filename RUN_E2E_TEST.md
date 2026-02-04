# How to Run the E2E Test

## Quick Start

1. **Ensure the server is running** at http://localhost:3000
   ```bash
   npm run dev
   ```

2. **In a new terminal, run the E2E test:**
   ```bash
   npm run test:e2e
   ```

## What the Test Does

The test simulates a complete multiplayer game:

1. **Player 1** creates a 1v1 game
2. **Player 2** joins the game
3. **Player 1** starts the game
4. Both players see cards and the muestra (trump card)
5. One player plays a card
6. Screenshots are captured at each step

## View Results

### Screenshots
All screenshots are saved to `./screenshots/` folder:
- `01-player1-lobby.png`
- `02-player1-waiting-room.png`
- `03-player2-lobby-with-games.png`
- `04-player2-joined.png`
- `05-player1-both-players-joined.png`
- `06-player1-game-started.png`
- `07-player1-game-view.png`
- `08-player2-game-view.png`
- `09-player1-after-card-played.png`
- `10-player2-after-card-played.png`

### HTML Report
After running the test, view the detailed report:
```bash
npx playwright show-report
```

## Alternative Test Modes

### UI Mode (Interactive)
Run the test with a visual UI:
```bash
npm run test:e2e:ui
```

### Debug Mode (Step-by-step)
Run with debugging capabilities:
```bash
npm run test:e2e:debug
```

## Troubleshooting

### "Server not running" error
Make sure `npm run dev` is running in another terminal before running the test.

### Test timeout
Increase timeout in the test file if needed (default is 5 seconds for most waits).

### Screenshots not showing cards
Check that:
- Card images exist in `Cartasimg/` folder
- Image filenames match format: `{valor}-{palo}s.png` (e.g., `01-oros.png`, `07-espadas.png`)
- The game logic is dealing cards correctly

## What Gets Verified

The test checks:
- ✅ Lobby page loads
- ✅ Players can create games
- ✅ Games appear in available games list
- ✅ Players can join games
- ✅ Game starts when host initiates
- ✅ Cards are dealt (3 per player)
- ✅ Muestra (trump) card is visible
- ✅ Players can play cards
- ✅ Turn rotation works
- ✅ No console errors

## Console Output

The test logs detailed information:
- Step-by-step progress
- Card counts for each player
- Muestra visibility
- Console errors (if any)
- Turn indicators

Look for these in the terminal output when running the test.
