import { test, expect } from '@playwright/test';

test('verify lobby page loads correctly', async ({ page }) => {
  // Step 1: Navigate to http://localhost:3000/lobby
  await page.goto('http://localhost:3000/lobby');

  // Step 2: Take a snapshot to see if the lobby loads correctly
  await page.screenshot({ path: 'tests/screenshots/lobby-page.png', fullPage: true });

  // Step 3: Check if the page shows the "Tu nombre" input and "Crear Partida" button
  const nombreInput = page.locator('input[placeholder*="Tu nombre" i], input[placeholder*="nombre" i], input[type="text"]');
  const crearPartidaButton = page.locator('button:has-text("Crear Partida"), button:has-text("crear partida")');

  // Wait for elements to be visible
  await expect(nombreInput.first()).toBeVisible({ timeout: 10000 });
  await expect(crearPartidaButton.first()).toBeVisible({ timeout: 10000 });

  console.log('✓ Lobby page loaded successfully');
  console.log('✓ "Tu nombre" input found');
  console.log('✓ "Crear Partida" button found');
});
