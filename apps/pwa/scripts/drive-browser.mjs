/**
 * Local browser driver (does not use broken MCP).
 * Usage: node scripts/drive-browser.mjs [url]
 */
import { chromium } from "playwright";

const URL = process.argv[2] || "http://localhost:5173/";

function log(...a) {
  console.log("[drive]", ...a);
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage"]
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on("console", (m) => {
    if (m.type() === "error") log("console.error:", m.text());
  });
  page.on("pageerror", (e) => log("pageerror:", e.message));

  log("goto", URL);
  // Vite PWAs often never hit networkidle (HMR / workers) — use load + short settle
  const resp = await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 20000 });
  log("status", resp?.status());
  await page.waitForSelector("svg.preview-svg", { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(1200);

  // --- smoke UI ---
  const title = await page.title();
  log("title", title);

  const hasSelect = await page.getByTitle(/Select/i).first().isVisible().catch(() => false);
  log("hasSelectTool", hasSelect);

  // Click Line tool
  const lineBtn = page.locator('button[title*="Line"]').first();
  await lineBtn.click({ timeout: 10000 });
  log("clicked Line tool");

  const svg = page.locator("svg.preview-svg");
  await svg.waitFor({ state: "visible", timeout: 10000 });
  const box = await svg.boundingBox();
  if (!box) throw new Error("no svg bbox");
  log("svg box", box);

  // Draw line 1: drag inside bed (center-ish)
  const x0 = box.x + box.width * 0.25;
  const y0 = box.y + box.height * 0.4;
  const x1 = box.x + box.width * 0.55;
  const y1 = box.y + box.height * 0.4;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x1, y1, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  log("drew line 1");

  // Draw line 2 above
  const x2 = box.x + box.width * 0.25;
  const y2 = box.y + box.height * 0.25;
  const x3 = box.x + box.width * 0.55;
  const y3 = box.y + box.height * 0.25;
  await page.mouse.move(x2, y2);
  await page.mouse.down();
  await page.mouse.move(x3, y3, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  log("drew line 2");

  // Inspect store / sketch via evaluate
  const sketchInfo = await page.evaluate(() => {
    // try to find React fiber root — fallback: count objects in list
    const rows = document.querySelectorAll(".side__row").length;
    const dimBtn = !!document.querySelector('[data-testid="constraint-toolbar"]');
    const cbar = document.querySelector('[data-testid="constraint-toolbar"]')?.textContent || "";
    return { rows, dimBtn, cbar: cbar.slice(0, 200) };
  });
  log("after draw", sketchInfo);

  // Fusion path: Dim → click line → move → click place → type value
  const dim = page.locator('button:has-text("Dim")').first();
  const dimVisible = await dim.isVisible().catch(() => false);
  log("dim button visible", dimVisible);
  if (dimVisible) {
    await dim.click();
    await page.waitForTimeout(400);
    log("dim tool active");

    // Click first line — should enter place (preview follows)
    await page.mouse.click(x0 + 40, y0);
    await page.waitForTimeout(300);
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.35, { steps: 8 });
    await page.waitForTimeout(200);
    const preview = await page.locator("[data-testid=dim-preview]").count();
    log("dim preview nodes", preview);

    // Place
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.35);
    await page.waitForTimeout(500);

    const inplace = await page.locator("[data-testid=dim-inplace]").isVisible().catch(() => false);
    const hud = inplace || (await page.locator(".dim-hud__input, .dim-inplace__input").isVisible().catch(() => false));
    log("dim in-place editor visible", hud);
    if (hud) {
      const input = page.locator(".dim-hud__input, .dim-inplace__input, [data-testid=dim-inplace-input]").first();
      await input.fill("80");
      await input.press("Enter");
      await page.waitForTimeout(600);
      log("applied dim 80 (in-place Enter)");
    } else {
      const status = await page.evaluate(() =>
        [...document.querySelectorAll("svg.preview-svg text")].map((n) => n.textContent).slice(0, 20)
      );
      log("no in-place editor — svg texts", status);
    }

    const anns = await page.locator("[data-testid=dim-annotations]").count();
    log("dim annotation layers", anns);

    // After dim apply we auto-return to Select; Esc as fallback
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    const selectBtn = page.locator('button.side__tool:has-text("Select")').first();
    if (await selectBtn.isVisible().catch(() => false)) {
      await selectBtn.click();
      await page.waitForTimeout(200);
      log("clicked Select tool");
    } else {
      log("Select tool button not found — relying on post-dim auto-select");
    }

    const dimGroup = page.locator("[data-testid=dim-annotations] [data-dim-id]").first();
    const dimCountBefore = await page.locator("[data-testid=dim-annotations] [data-dim-id]").count();
    log("dim count before delete", dimCountBefore);

    if (dimCountBefore > 0) {
      const db = await dimGroup.boundingBox();
      log("dim bbox before drag", db);

      // Verify dim line is horizontal (parallel to our horizontal line)
      const parallel = await page.evaluate(() => {
        const g = document.querySelector("[data-testid=dim-annotations] [data-dim-id]");
        if (!g) return null;
        const lines = [...g.querySelectorAll("line")].filter(
          (l) => l.getAttribute("stroke") && l.getAttribute("stroke") !== "transparent"
        );
        // Find longest non-extension dim line (horizontal for our test)
        let best = null;
        for (const l of lines) {
          const x1 = +l.getAttribute("x1");
          const y1 = +l.getAttribute("y1");
          const x2 = +l.getAttribute("x2");
          const y2 = +l.getAttribute("y2");
          const len = Math.hypot(x2 - x1, y2 - y1);
          if (!best || len > best.len) best = { x1, y1, x2, y2, len, dy: Math.abs(y2 - y1) };
        }
        return best;
      });
      log("dim line geometry", parallel);
      if (parallel && parallel.dy < 1.5) log("OK: dim line parallel (horizontal)");
      else log("WARN: dim line not clearly horizontal", parallel);

      // Drag dim up to move offset (also selects it — Delete works without re-click)
      if (db) {
        const cx = db.x + db.width / 2;
        const cy = db.y + db.height / 2;
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.move(cx, cy - 40, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(400);
        const db2 = await page.locator("[data-testid=dim-annotations] [data-dim-id]").first().boundingBox();
        log("dim bbox after drag", db2);
        if (db2 && Math.abs(db2.y - db.y) > 5) log("OK: dimension moved");
        else log("WARN: dimension may not have moved");
      }

      // Wait for post-drag synthetic click suppress to expire, then check selection
      await page.waitForTimeout(100);
      const selectedState = await page.evaluate(() => {
        const selected = document.querySelector(
          "[data-testid=dim-annotations] [data-dim-id][data-selected='true']"
        );
        return {
          selectedId: selected?.getAttribute("data-dim-id") || null,
          objectRows: document.querySelectorAll(".side__row").length
        };
      });
      log("dim selected after drag", selectedState);

      const rowsBefore = selectedState.objectRows;
      await page.keyboard.press("Delete");
      await page.waitForTimeout(500);

      const after = await page.evaluate(() => ({
        dimCount: document.querySelectorAll("[data-testid=dim-annotations] [data-dim-id]").length,
        rows: document.querySelectorAll(".side__row").length
      }));
      log("after delete", after);
      if (after.dimCount < dimCountBefore && after.rows === rowsBefore) {
        log("OK: dimension removed, geometry kept");
      } else if (after.dimCount < dimCountBefore && after.rows < rowsBefore) {
        log("FAIL: deleted geometry instead of (or along with) dimension");
      } else {
        log("FAIL: dimension was not removed");
      }
    }
  }

  // Screenshot for evidence
  const shot = "/tmp/laseryx-drive.png";
  await page.screenshot({ path: shot, fullPage: true });
  log("screenshot", shot);

  // Final object count
  const final = await page.evaluate(() => ({
    rows: document.querySelectorAll(".side__row").length,
    dimHud: !!document.querySelector(".dim-hud"),
    dimCount: document.querySelectorAll("[data-testid=dim-annotations] [data-dim-id]").length,
    cbar: document.querySelector('[data-testid="constraint-toolbar"]')?.textContent?.slice(0, 120) || null
  }));
  log("final", final);

  await browser.close();
  log("done");
  process.exit(0);
}

main().catch((e) => {
  console.error("[drive] FAIL", e);
  process.exit(1);
});
