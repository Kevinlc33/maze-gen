import { expect, test } from '@playwright/test'

test('Generate publishes only a verified browser-worker candidate', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Design width').fill('60')
  await page.getByRole('button', { name: 'Generate', exact: true }).click()

  await expect(page.getByRole('status')).toContainText('Generation complete', { timeout: 30_000 })
  const renderedMaze = page.getByText(/^Rendered maze: candidate-/)
  await expect(renderedMaze).toBeVisible()
  const completedDesign = await renderedMaze.textContent()

  await page.getByLabel('Geometry mode').selectOption('mixed')
  await page.getByRole('button', { name: 'Generate', exact: true }).click()

  await expect(page.getByRole('status')).toContainText('mixed geometry generator is not implemented')
  await expect(renderedMaze).toHaveText(completedDesign ?? '')
})
