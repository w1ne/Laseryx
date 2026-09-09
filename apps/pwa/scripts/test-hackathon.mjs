import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const url = process.argv[2] || 'https://laseryx.com/';
const output = process.argv[3] || '/tmp/laseryx-hackathon';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const errors = [];
const report = { url, checks: [], errors };
const check = (name, details) => { report.checks.push({ name, details }); console.log(name, JSON.stringify(details)); };
const job = async (page) => {
  const result = await page.evaluate(() => window.laseryx.protocol.request({ protocolVersion: 1, requestId: 'export', command: 'project.exportJson' }));
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.data.job;
};
try {
  const creator = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await creator.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.getByRole('button', { name: 'Create panel', exact: true }).click();
  await page.getByRole('button', { name: 'Save panel', exact: true }).click();
  await page.getByRole('button', { name: 'Add component', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Hackathon button');
  await page.getByRole('button', { name: 'Save component', exact: true }).click();
  await page.getByRole('button', { name: 'Make box', exact: true }).click();
  await page.getByRole('button', { name: 'Generate box', exact: true }).click();
  await page.getByRole('button', { name: 'Arrange sheets', exact: true }).click();
  const addOperation = page.getByRole('button', { name: 'Add cut operation', exact: true });
  if (await addOperation.isVisible()) await addOperation.click();
  const original = await job(page);
  assert.equal(original.document.enclosureWorkspace.enclosure.result.panels.length, 6);
  check('box-generated', { components: original.document.enclosureWorkspace.sourcePanel.components.length, sheets: original.document.enclosureWorkspace.sheetLayout.sheets.length, objects: original.document.objects.length });
  await page.screenshot({ path: `${output}/creator.png`, fullPage: true });
  await page.getByRole('button', { name: 'Share link', exact: true }).click();
  const shared = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(shared.includes('#share='));
  await writeFile(`${output}/shared-link.txt`, shared);
  const operator = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const recipient = await operator.newPage();
  recipient.on('pageerror', error => errors.push(error.message));
  const target = new URL(shared); target.searchParams.set('virtual', 'true');
  await recipient.goto(target.toString());
  await recipient.getByRole('button', { name: 'Open shared design', exact: true }).click();
  const received = await job(recipient);
  assert.deepEqual(received.document, JSON.parse(JSON.stringify(original.document)));
  assert.deepEqual(received.camSettings, original.camSettings);
  check('share-roundtrip', { bytes: shared.length, exactDocument: true, exactOperations: true });
  const operationsTab = recipient.getByRole('tab', { name: 'Operations', exact: true });
  if (await operationsTab.isVisible()) await operationsTab.click();
  await recipient.getByRole('button', { name: 'Generate', exact: true }).click();
  await recipient.waitForTimeout(1500);
  await recipient.screenshot({ path: `${output}/operator.png`, fullPage: true });
  await writeFile(`${output}/operator-text.txt`, await recipient.locator('body').innerText());
  await writeFile(`${output}/job.json`, JSON.stringify(received, null, 2));
  check('automation-preflight', (await recipient.evaluate(() => window.laseryx.preflight())).data);
  const downloadButton = recipient.getByRole('button', { name: 'Download', exact: true });
  const downloadPromise = recipient.waitForEvent('download');
  await downloadButton.click();
  const download = await downloadPromise;
  await download.saveAs(`${output}/${download.suggestedFilename()}`);
  const gcode = await readFile(`${output}/${download.suggestedFilename()}`, 'utf8');
  assert.ok(gcode.includes('G1 X'), 'Generated job has no cutting moves');
  check('cutting-moves', { lines: gcode.split('\n').length });
  const sheetSelect = recipient.getByLabel('Cut sheet', { exact: true });
  assert.equal(await sheetSelect.isVisible(), true, 'Per-sheet cutting selector is missing');
  if (await sheetSelect.isVisible()) {
    for (const sheet of received.document.enclosureWorkspace.sheetLayout.sheets) {
      await sheetSelect.selectOption(sheet.id);
      if (sheet.id !== received.document.enclosureWorkspace.sheetLayout.sheets[0].id) assert.equal(await downloadButton.isDisabled(), true);
      await recipient.getByRole('button', { name: 'Generate', exact: true }).click();
      await downloadButton.waitFor({ state: 'visible' });
      const pending = recipient.waitForEvent('download');
      await downloadButton.click();
      const file = await pending;
      await file.saveAs(`${output}/${file.suggestedFilename()}`);
      const code = await readFile(`${output}/${file.suggestedFilename()}`, 'utf8');
      for (const match of code.matchAll(/X(-?[\d.]+) Y(-?[\d.]+)/g)) {
        assert.ok(+match[1] >= 0 && +match[1] <= sheet.width && +match[2] >= 0 && +match[2] <= sheet.height, `Out of sheet: ${match[0]}`);
      }
      check('sheet-export', { sheet: sheet.id, lines: code.split('\n').length, bounds: 'within physical stock' });
    }
  }
  for (const sheet of received.document.enclosureWorkspace.sheetLayout.sheets) {
    await sheetSelect.selectOption(sheet.id);
    await recipient.getByRole('button', { name: 'Generate', exact: true }).click();
    await recipient.getByRole('button', { name: 'Machine', exact: true }).click();
    const connect = recipient.getByRole('button', { name: 'Connect', exact: true });
    if (await connect.isVisible()) await connect.click();
    await recipient.getByLabel('Arm Laser', { exact: true }).check();
    await recipient.getByRole('button', { name: 'Start Job', exact: true }).click();
    await recipient.getByRole('button', { name: /Pause/ }).click();
    await recipient.getByRole('button', { name: /Resume/ }).click();
    await recipient.getByText(/Job Complete/).waitFor({ timeout: 60000 });
    check('virtual-stream', { sheet: sheet.id, completed: true, pauseResume: true });
    if (sheet !== received.document.enclosureWorkspace.sheetLayout.sheets.at(-1)) {
      await recipient.getByRole('button', { name: 'Design', exact: true }).first().click();
    }
  }
  await recipient.screenshot({ path: `${output}/completed.png`, fullPage: true });
  await recipient.getByRole('button', { name: 'Start Job', exact: true }).click();
  await recipient.getByRole('button', { name: /Abort/ }).click();
  await recipient.getByText(/Status: ERROR/).waitFor();
  check('virtual-abort', true);
  await recipient.getByRole('button', { name: 'Design', exact: true }).first().click();
  await recipient.getByRole('button', { name: 'Edit panel', exact: true }).click();
  await recipient.getByLabel('Panel width', { exact: true }).fill('155');
  await recipient.getByRole('button', { name: 'Save panel', exact: true }).click();
  assert.equal(await downloadButton.isDisabled(), true);
  await recipient.getByRole('button', { name: 'Machine', exact: true }).click();
  assert.equal(await recipient.getByRole('button', { name: 'Start Job', exact: true }).isDisabled(), true);
  check('edited-design-invalidates-job', true);
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
  const phone = await mobile.newPage();
  phone.on('pageerror', error => errors.push(error.message));
  await phone.goto(target.toString());
  await phone.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal((await job(phone)).document.objects.length, 0);
  await phone.goto(target.toString());
  await phone.getByRole('button', { name: 'Open shared design', exact: true }).click();
  await phone.getByRole('tab', { name: 'Operations', exact: true }).click();
  await phone.getByRole('button', { name: 'Generate', exact: true }).click();
  await phone.waitForTimeout(500);
  assert.equal(await phone.getByRole('button', { name: 'Download', exact: true }).isEnabled(), true);
  await phone.screenshot({ path: `${output}/mobile.png`, fullPage: true });
  check('mobile-shared-design', { cancel: true, open: true, generate: true, horizontalOverflow: await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
  assert.deepEqual(errors, []);
} catch (error) {
  report.failure = String(error);
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
