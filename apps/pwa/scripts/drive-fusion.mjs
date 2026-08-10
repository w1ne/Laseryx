/**
 * Drive real Autodesk Fusion on macOS via osascript + cliclick.
 * This is coarse UI automation (not the Fusion API).
 *
 * Usage: node scripts/drive-fusion.mjs
 */
import { execSync, execFileSync } from "node:child_process";

function sh(cmd) {
  console.log("[fusion]", cmd);
  return execSync(cmd, { encoding: "utf8" });
}

function osascript(script) {
  return execFileSync("osascript", ["-e", script], { encoding: "utf8" }).trim();
}

function main() {
  // Activate Fusion
  try {
    osascript('tell application "Autodesk Fusion" to activate');
  } catch {
    try {
      sh('open -a "Autodesk Fusion"');
      // wait for launch
      execSync("sleep 4");
      osascript('tell application "Autodesk Fusion" to activate');
    } catch (e) {
      console.error("[fusion] cannot open Autodesk Fusion:", e.message);
      process.exit(1);
    }
  }

  execSync("sleep 1.2");

  const wins = osascript(`
    tell application "System Events"
      tell process "Autodesk Fusion"
        set names to name of every window
        return names as string
      end tell
    end tell
  `);
  console.log("[fusion] windows:", wins);

  // Hotkey D = Sketch Dimension (when in sketch). We only probe focus + type D for now.
  // Full sketch create needs a live document; we verify we can send keys.
  osascript(`
    tell application "System Events"
      tell process "Autodesk Fusion"
        set frontmost to true
      end tell
    end tell
  `);
  execSync("sleep 0.3");

  // Click roughly center of main screen to focus canvas (best-effort)
  try {
    execFileSync("cliclick", ["c:900,500"]);
    console.log("[fusion] cliclick canvas center");
  } catch (e) {
    console.log("[fusion] cliclick failed (permissions?):", e.message);
  }

  // Send D (dimension) — may no-op if not in sketch; proves key delivery
  try {
    execFileSync("cliclick", ["kd:cmd", "ku:cmd"]); // noop focus
    osascript(`
      tell application "System Events"
        keystroke "d"
      end tell
    `);
    console.log("[fusion] sent keystroke d (Sketch Dimension when in sketch)");
  } catch (e) {
    console.log("[fusion] keystroke failed:", e.message);
  }

  console.log(`
[fusion] READY PATH:
  1. Accessibility: System Settings → Privacy → Accessibility → allow Terminal/node
  2. Open a design → Create Sketch → draw two lines
  3. Re-run: node scripts/drive-fusion.mjs
  4. Or use Fusion API add-in for deterministic control (preferred long-term)
`);
  console.log("[fusion] done");
}

main();
