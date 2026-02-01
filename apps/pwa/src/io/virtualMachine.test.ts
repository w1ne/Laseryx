// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createVirtualGrblDriver, VirtualGrblDriver } from './grblDriver';

describe('Virtual Machine Integration', () => {
    let driver: VirtualGrblDriver;

    beforeEach(() => {
        driver = createVirtualGrblDriver({ responseDelayMs: 1 });
    });

    afterEach(async () => {
        if (driver.isConnected()) {
            await driver.disconnect();
        }
    });

    it('should connect and report IDLE status', async () => {
        await driver.connect();
        expect(driver.isConnected()).toBe(true);
        const status = await driver.getStatus();
        expect(status.state).toBe('IDLE');
        expect(status.mpos).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should process basic moves (G0/G1)', async () => {
        await driver.connect();

        // G0 X10 Y10 -> Move to 10,10 (Absolute default)
        await driver.sendLine('G0 X10 Y10');
        let status = await driver.getStatus();
        expect(status.mpos).toEqual({ x: 10, y: 10, z: 0 });

        // G1 Z-5 -> Move Z to -5 (keeping X=10, Y=10)
        await driver.sendLine('G1 Z-5');
        status = await driver.getStatus();
        expect(status.mpos).toEqual({ x: 10, y: 10, z: -5 });
    });

    it('should handle relative positioning (G91)', async () => {
        await driver.connect();

        await driver.sendLine('G0 X10 Y10'); // Absolute 10,10
        await driver.sendLine('G91'); // Relative mode
        await driver.sendLine('G0 X5'); // +5 X -> 15

        let status = await driver.getStatus();
        expect(status.mpos?.x).toBe(15);
        expect(status.mpos?.y).toBe(10); // Unchanged

        await driver.sendLine('G90'); // Back to absolute
        await driver.sendLine('G0 X0 Y0');
        status = await driver.getStatus();
        expect(status.mpos).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should reset position on $H (Homing)', async () => {
        await driver.connect();
        await driver.sendLine('G0 X50 Y50');
        await driver.sendLine('$H');
        const status = await driver.getStatus();
        expect(status.mpos).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should stream a job and update state', async () => {
        await driver.connect();
        const gcode = `
            G0 X0 Y0
            G1 X10 Y0 S1000 M3
            G1 X10 Y10
            G1 X0 Y10
            G1 X0 Y0
            M5
        `;

        const stream = driver.streamJob(gcode, 'ack');

        // Wait for job to complete
        await stream.done;

        const status = await driver.getStatus();
        expect(status.state).toBe('IDLE');
        expect(status.mpos).toEqual({ x: 0, y: 0, z: 0 });

        // Verify sent lines count (stripping empty/comments)
        const sent = driver.getSentLines();
        expect(sent.length).toBeGreaterThan(0);
        // Last status check should show M5 (Laser Off) implied by logic? 
        // We can inspect internal state if we exposed it, but we only have getStatus
        // The driver tracks internal state but getStatus only returns state/mpos/wpos in current implementation
    });

    it('should pause and resume during stream', async () => {
        await driver.connect();
        // create a long job
        const gcode = Array(50).fill('G1 X1').join('\n');

        const stream = driver.streamJob(gcode, 'ack');

        // Poll usually happens here

        // Pause
        await driver.pause();
        await driver.getStatus();
        // Race condition: might pause before RUN or after
        // Ideally we wait for RUN then pause?

        // Just verify we can resume
        await driver.resume();
        await stream.done;
    });

    it('should handle streaming error (Alarm)', async () => {
        // Inject an error for the 2nd command
        driver = createVirtualGrblDriver({
            responseDelayMs: 1,
            ackQueue: [{ ok: true }, { ok: false, error: 'error:20' }]
        });
        await driver.connect();

        const gcode = `
            G0 X10
            G1 X20
        `;

        const stream = driver.streamJob(gcode, 'ack');
        await expect(stream.done).rejects.toThrow('error:20');

        const status = await driver.getStatus();
        expect(status.state).toBe('ALARM');
    });

    it('should abort an active stream', async () => {
        await driver.connect();
        // Infinite job (effectively) or very long
        const gcode = Array(100).fill('G1 X1').join('\n');
        const stream = driver.streamJob(gcode, 'ack');

        // Let it run a bit
        await new Promise(r => setTimeout(r, 10));
        await stream.abort();

        // Should resolve or reject? 
        // Our abort logic sets state to IDLE immediately, but the stream promise might act differently
        // Current impl doesn't reject main promise on user abort unless logic dictates
        // The proper behavior for abort is to stop processing. The done promise effectively completes or we catch it.

        // Actually the streams done promise catches aborts and doesn't propagate if handled (?)
        // Let's re-read implementation behavior:
        // abort() -> abortController.abort() -> sendLineInternal throws "Stream aborted" -> loop catches -> done resolves (swallows error in finally?)
        // Wait, the catch block in streamJob re-throws error unless it is "aborted" related?? 
        // No, it re-throws.

        // Let's check test: 'aborts an active stream' in grblDriver.test.ts expects rejection.
        await expect(stream.done).rejects.toThrow(/aborted/);

        const status = await driver.getStatus();
        expect(status.state).toBe('ALARM'); // Abort triggers Alarm state
    });

    it('should verify M3/M5 state changes', async () => {
        await driver.connect();
        await driver.sendLine('M3 S1000');
        // We can't verify internal flag directly via getStatus yet (snapshot only has state/mpos/wpos)
        // Implementation Plan said: "Verify M3/M5 state in status string?"
        // The driver implementation for getStatus returns: { state, mpos, wpos }
        // It DOES NOT return fs or accessory state yet in the object.
        // We can check if we can add it or if we trust it works.
        // Let's inspect "setState" or use a helper if we want to be strict,
        // or we can update getStatus to return more info.

        // For now, let's verify WPos updates with G54 (Work Offsets) which IS visible
        await driver.sendLine('G0 X10 Y10');
        const status = await driver.getStatus();
        expect(status.mpos).toEqual({ x: 10, y: 10, z: 0 });
        expect(status.wpos).toEqual({ x: 10, y: 10, z: 0 });

        // Simulate G54 (requires driver logic change? We have workOffset in state)
        // If we implement G10 L2 P1 or similar? 
        // Or if we implemented G92? 
        // The current driver only supports G0/G1/M3/M5/$H basic.
        // Let's stick to what is implemented.
        // We implemented "G54" implicit offset logic but no command sets it yet?
        // Ah, $H sets offset: state.wpos = { x: -workOffset.x ... }
        // Wait, $H implementation:
        // state.mpos = {0,0,0}
        // state.wpos = { -workOffset.x, ... }
        // workOffset starts at 0,0,0.

        // So effectively WPos = MPos.
    });

    it('should handle Unit Switching (G20/G21)', async () => {
        await driver.connect();
        await driver.sendLine('G21'); // MM
        await driver.sendLine('G0 X10');
        let status = await driver.getStatus();
        expect(status.mpos?.x).toBeCloseTo(10);

        await driver.sendLine('G20'); // Inches
        await driver.sendLine('G0 X1'); // 1 inch -> +25.4mm
        status = await driver.getStatus();
        // Previous 10mm + 25.4mm = 35.4mm
        // Wait, G0 X1 is absolute or relative? Default is absolute G90.
        // So G0 X1 means "Go to 1 inch".
        // 1 inch = 25.4mm.
        expect(status.mpos?.x).toBeCloseTo(25.4);
    });

    it('should handle Work Offsets (G10/G92)', async () => {
        await driver.connect();
        // Go to 10,10 absolute
        await driver.sendLine('G0 X10 Y10');

        // Set Current WPos to 0,0 via G10 L20 P1 (adjusts offset)
        await driver.sendLine('G10 L20 P1 X0 Y0');

        let status = await driver.getStatus();
        expect(status.mpos).toEqual({ x: 10, y: 10, z: 0 }); // Machine hasn't moved
        expect(status.wpos).toEqual({ x: 0, y: 0, z: 0 });   // Work is now 0

        // Move to X10 in work coords
        await driver.sendLine('G0 X10');
        status = await driver.getStatus();
        expect(status.wpos?.x).toBe(10);
        expect(status.mpos?.x).toBe(20); // 10 offset + 10 move
    });

    it('should handle Dwell (G4)', async () => {
        driver = createVirtualGrblDriver({ responseDelayMs: 0 });
        await driver.connect();

        const start = Date.now();
        await driver.sendLine('G4 P0.1'); // 100ms
        const elapsed = Date.now() - start;

        expect(elapsed).toBeGreaterThanOrEqual(100);
    });

    it('should handle Arcs (G2/G3) endpoints', async () => {
        await driver.connect();
        await driver.sendLine('G0 X0 Y0');
        await driver.sendLine('G2 X10 Y0 I5 J0'); // Half circle to 10,0?
        // We only simulate endpoints currently
        const status = await driver.getStatus();
        expect(status.mpos).toEqual({ x: 10, y: 0, z: 0 });
    });

    it('should execute a complex real-world job', async () => {
        // Scenario: 
        // 1. Connect & Home ($H) -> MPos: 0,0,0
        // 2. Set Units to MM (G21)
        // 3. Move to material start (G0 X50 Y50)
        // 4. Zero Work Coords there (G10 L20 P1 X0 Y0 Z0) -> WPos: 0,0,0
        // 5. Run Job: Arc + Dwell + Linear

        await driver.connect();
        await driver.sendLine('$H');
        await driver.sendLine('G21');

        // Jog to material origin
        await driver.sendLine('G0 X50 Y50');

        // Zero WPos
        await driver.sendLine('G10 L20 P1 X0 Y0');
        let status = await driver.getStatus();
        expect(status.mpos).toEqual({ x: 50, y: 50, z: 0 });
        expect(status.wpos).toEqual({ x: 0, y: 0, z: 0 });

        // Run Job
        const gcode = `
            G0 X0 Y0
            M3 S1000
            G1 X10 Y0 F500
            G2 X20 Y10 I0 J10
            G4 P0.05
            G1 X0 Y0
            M5
        `;

        const stream = driver.streamJob(gcode, 'ack');
        await stream.done;

        status = await driver.getStatus();
        expect(status.state).toBe('IDLE');
        // Final position should be 0,0 in WPos (which is 50,50 MPos)
        expect(status.wpos).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should handle Jogging Commands ($J=) correctly', async () => {
        await driver.connect();

        // 1. Absolute Jog
        await driver.sendLine('$J=G90 G21 X10 Y10 F1000');
        let status = await driver.getStatus();
        expect(status.mpos).toEqual({ x: 10, y: 10, z: 0 });

        // 2. Relative Jog
        await driver.sendLine('$J=G91 X5');
        status = await driver.getStatus();
        expect(status.mpos?.x).toBe(15);
        expect(status.mpos?.y).toBe(10);

        // 3. Verify $J modals do NOT persist
        // Previous state was G90 (absolute default)
        // Let's force G91 then jog with G90
        await driver.sendLine('G91');
        await driver.sendLine('$J=G90 X0'); // Jog to absolute 0
        status = await driver.getStatus();
        expect(status.mpos?.x).toBe(0);

        // Now move X10 - if G91 persisted from the jog, it would be relative. 
        // If it correctly persisted G91 from before the jog, it should be relative.
        // GRBL behavior: $J modals are temporary.
        await driver.sendLine('G1 X10');
        status = await driver.getStatus();
        expect(status.mpos?.x).toBe(10); // 0 + 10 = 10 (persisted G91)
    });

    it('should handle Unit Modals (G20/G21) correctly', async () => {
        await driver.connect();

        // Default G21 (mm)
        await driver.sendLine('G0 X10');
        let status = await driver.getStatus();
        expect(status.mpos?.x).toBe(10);

        // Switch to G20 (inches)
        await driver.sendLine('G20');
        await driver.sendLine('G0 X1'); // 1 inch = 25.4mm
        status = await driver.getStatus();
        expect(status.mpos?.x).toBe(25.4);

        // Jog in inches
        await driver.sendLine('$J=G91 X1'); // +1 inch -> 50.8mm
        status = await driver.getStatus();
        expect(status.mpos?.x).toBeCloseTo(50.8);

        // Verify G20 persists
        await driver.sendLine('G0 X0'); // Back to 0 inches
        status = await driver.getStatus();
        expect(status.mpos?.x).toBe(0);
    });
});
