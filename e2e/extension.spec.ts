import { expect, test } from './fixtures';

const popupUrl = (extensionId: string): string =>
  `chrome-extension://${extensionId}/popup.html`;

test('popup page renders its primary UI', async ({
  extensionId,
  extensionPage,
}) => {
  await extensionPage.goto(popupUrl(extensionId));

  await expect(
    extensionPage.getByRole('heading', { name: 'popup' }),
  ).toBeVisible();
  await expect(
    extensionPage.getByRole('button', { name: 'send message' }),
  ).toBeVisible();
});

test('popup exchanges a typed message with the background', async ({
  extensionId,
  extensionPage,
}) => {
  await extensionPage.goto(popupUrl(extensionId));
  await extensionPage.getByRole('button', { name: 'send message' }).click();

  await expect(extensionPage.getByText('Hello, popup!')).toBeVisible();
});

test('content script is injected into a locally served page', async ({
  extensionPage,
  testPageUrl,
}) => {
  await extensionPage.goto(testPageUrl);

  await expect(
    extensionPage.getByRole('heading', { name: 'content_script sample' }),
  ).toBeVisible();
});
