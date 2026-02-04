import { test, expect, Page, BrowserContext } from '@playwright/test';

test.describe('Truco Multiplayer E2E Test', () => {
  let context: BrowserContext;
  let player1Page: Page;
  let player2Page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('Complete 1v1 multiplayer game flow', async () => {
    // ============================================
    // PLAYER 1: Create Game
    // ============================================
    player1Page = await context.newPage();

    console.log('Step 1: Player 1 navigating to lobby...');
    await player1Page.goto('http://localhost:3000/lobby');
    await player1Page.waitForLoadState('networkidle');

    console.log('Step 2: Taking snapshot of lobby page...');
    await player1Page.screenshot({ path: 'screenshots/01-player1-lobby.png', fullPage: true });

    console.log('Step 3: Player 1 entering name "Jugador1"...');
    const nameInput1 = player1Page.getByPlaceholder('Ingresa tu nombre para jugar');
    await nameInput1.fill('Jugador1');

    console.log('Step 4: Selecting 1v1 room size...');
    // Click the 1v1 button - it contains "1v1" text and "2 jugadores"
    const button1v1 = player1Page.locator('button').filter({ hasText: '1v1' });
    await button1v1.click();

    console.log('Step 5: Clicking "Crear Partida" button...');
    // The button text is "Crear Partida 1v1" after selecting 1v1
    const crearButton = player1Page.locator('button').filter({ hasText: /Crear Partida/i });
    await crearButton.click();

    console.log('Step 6: Waiting for navigation to /game page...');
    await player1Page.waitForURL(/\/game\?mesaId=/, { timeout: 5000 });
    await player1Page.waitForLoadState('networkidle');

    console.log('Step 7: Taking snapshot of Player 1 waiting room...');
    await player1Page.screenshot({ path: 'screenshots/02-player1-waiting-room.png', fullPage: true });

    // Verify Player 1 is in the waiting room
    await expect(player1Page.getByText('Jugador1')).toBeVisible();
    await expect(player1Page.getByRole('button', { name: /Iniciar Partida/i })).toBeVisible();

    // Extract mesaId from URL
    const url1 = player1Page.url();
    const mesaId = new URL(url1).searchParams.get('mesaId');
    console.log(`Game created with mesaId: ${mesaId}`);

    // ============================================
    // PLAYER 2: Join Game
    // ============================================
    player2Page = await context.newPage();

    console.log('Step 8: Player 2 navigating to lobby...');
    await player2Page.goto('http://localhost:3000/lobby');
    await player2Page.waitForLoadState('networkidle');

    console.log('Step 9: Player 2 entering name "Jugador2"...');
    const nameInput2 = player2Page.getByPlaceholder('Ingresa tu nombre para jugar');
    await nameInput2.fill('Jugador2');

    console.log('Step 10: Looking for available game in "Partidas Disponibles"...');
    await player2Page.screenshot({ path: 'screenshots/03-player2-lobby-with-games.png', fullPage: true });

    // Wait for the game to appear in available games list
    await player2Page.waitForSelector('text=Partidas Disponibles', { timeout: 5000 });

    console.log('Step 11: Clicking "Unirse" to join the game...');
    // Find and click the "Unirse" button for the first available game
    // Wait for at least one game to appear
    await player2Page.waitForSelector('button:has-text("Unirse")', { timeout: 5000 });
    const unirseButton = player2Page.locator('button').filter({ hasText: 'Unirse' }).first();
    await unirseButton.click();

    console.log('Step 12: Waiting for Player 2 to navigate to /game page...');
    await player2Page.waitForURL(/\/game\?mesaId=/, { timeout: 5000 });
    await player2Page.waitForLoadState('networkidle');
    await player2Page.screenshot({ path: 'screenshots/04-player2-joined.png', fullPage: true });

    // ============================================
    // PLAYER 1: Start Game
    // ============================================
    console.log('Step 13: Player 1 should see 2 players now. Clicking "Iniciar Partida"...');

    // Wait a moment for Player 2's join to propagate via Socket.IO
    await player1Page.waitForTimeout(1000);
    await player1Page.screenshot({ path: 'screenshots/05-player1-both-players-joined.png', fullPage: true });

    // Verify Player 2 is visible to Player 1
    await expect(player1Page.getByText('Jugador2')).toBeVisible();

    const iniciarButton = player1Page.getByRole('button', { name: /Iniciar Partida/i });
    await iniciarButton.click();

    console.log('Step 14: Waiting for game to start...');
    await player1Page.waitForTimeout(2000); // Wait for game initialization

    await player1Page.screenshot({ path: 'screenshots/06-player1-game-started.png', fullPage: true });

    // ============================================
    // GAMEPLAY: Verify Game State
    // ============================================
    console.log('Step 15: Taking snapshots of both players\' views...');

    await player1Page.waitForTimeout(1000);
    await player2Page.waitForTimeout(1000);

    await player1Page.screenshot({ path: 'screenshots/07-player1-game-view.png', fullPage: true });
    await player2Page.screenshot({ path: 'screenshots/08-player2-game-view.png', fullPage: true });

    // Check for cards in Player 1's hand (cards have alt text like "3 de oro", "7 de espada")
    const player1Cards = await player1Page.locator('img[alt*=" de "]').count();
    console.log(`Player 1 has ${player1Cards} cards visible`);

    // Check for cards in Player 2's hand
    const player2Cards = await player2Page.locator('img[alt*=" de "]').count();
    console.log(`Player 2 has ${player2Cards} cards visible`);

    // Check for muestra (trump card) - should be in top-right corner
    const muestraVisible1 = await player1Page.locator('text=Muestra').count() > 0;
    const muestraVisible2 = await player2Page.locator('text=Muestra').count() > 0;
    console.log(`Muestra visible for Player 1: ${muestraVisible1}`);
    console.log(`Muestra visible for Player 2: ${muestraVisible2}`);

    // Check for console errors
    console.log('Checking for console errors...');
    const player1Errors: string[] = [];
    const player2Errors: string[] = [];

    player1Page.on('console', msg => {
      if (msg.type() === 'error') {
        player1Errors.push(msg.text());
      }
    });

    player2Page.on('console', msg => {
      if (msg.type() === 'error') {
        player2Errors.push(msg.text());
      }
    });

    // ============================================
    // GAMEPLAY: Play a Card
    // ============================================
    console.log('Step 16: Attempting to play a card...');

    // Try to find whose turn it is
    const player1TurnIndicator = await player1Page.locator('text=/tu turno/i, text=/your turn/i').count();
    const player2TurnIndicator = await player2Page.locator('text=/tu turno/i, text=/your turn/i').count();

    console.log(`Player 1 turn indicator count: ${player1TurnIndicator}`);
    console.log(`Player 2 turn indicator count: ${player2TurnIndicator}`);

    let activePlayerPage: Page;
    let activePlayerName: string;

    if (player1TurnIndicator > 0) {
      activePlayerPage = player1Page;
      activePlayerName = 'Player 1';
    } else {
      activePlayerPage = player2Page;
      activePlayerName = 'Player 2';
    }

    console.log(`It appears to be ${activePlayerName}'s turn`);

    // Try to click the first card (cards are wrapped in buttons with class "card-interactive")
    const interactiveCards = activePlayerPage.locator('button.card-interactive');
    const cardCount = await interactiveCards.count();

    if (cardCount > 0) {
      console.log(`${activePlayerName} has ${cardCount} interactive cards, clicking the first one...`);
      await interactiveCards.first().click();

      console.log('Step 17: Waiting for card to be played...');
      await activePlayerPage.waitForTimeout(1500);

      // Take snapshots after playing card
      await player1Page.screenshot({ path: 'screenshots/09-player1-after-card-played.png', fullPage: true });
      await player2Page.screenshot({ path: 'screenshots/10-player2-after-card-played.png', fullPage: true });

      // Check if a card appears on the mesa (table) - look for all card images
      const allCards1 = await player1Page.locator('img[alt*=" de "]').count();
      const allCards2 = await player2Page.locator('img[alt*=" de "]').count();

      console.log(`Total cards visible (Player 1 view): ${allCards1}`);
      console.log(`Total cards visible (Player 2 view): ${allCards2}`);

      // Log final interactive card counts (cards in hand)
      const finalInteractiveCards1 = await player1Page.locator('button.card-interactive').count();
      const finalInteractiveCards2 = await player2Page.locator('button.card-interactive').count();
      console.log(`Player 1 interactive cards remaining: ${finalInteractiveCards1}`);
      console.log(`Player 2 interactive cards remaining: ${finalInteractiveCards2}`);
    } else {
      console.log(`${activePlayerName} has no cards to play - something went wrong!`);
    }

    // Log any console errors
    if (player1Errors.length > 0) {
      console.log('Player 1 Console Errors:');
      player1Errors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log('No console errors for Player 1');
    }

    if (player2Errors.length > 0) {
      console.log('Player 2 Console Errors:');
      player2Errors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log('No console errors for Player 2');
    }

    // Keep pages open for a moment to observe final state
    await player1Page.waitForTimeout(2000);
  });
});
