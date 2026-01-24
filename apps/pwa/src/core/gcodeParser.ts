export type GcodeMove = {
    type: "travel" | "cut";
    from: { x: number; y: number };
    to: { x: number; y: number };
    power: number; // 0-1000 usually, or whatever the S value is
    speed: number;
};

export type ParseResult = {
    moves: GcodeMove[];
    warnings: string[];
};

export function parseGcode(gcode: string): ParseResult {
    const moves: GcodeMove[] = [];
    const warnings: string[] = [];

    let currentX = 0;
    let currentY = 0;
    let currentSpeed = 0;
    let currentPower = 0;
    let isLaserOn = false;
    let isRapid = false; // G0

    // We need to track modal state
    // simple parser state machine

    const lines = gcode.split(/\r?\n/);

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("(")) {
            continue;
        }

        // Remove comments inline if any? For now assume simple generated Gcode from our system
        // But better to be robust: split by ; or (
        const content = trimmed.split(/[;(]/)[0].trim();
        if (!content) continue;

        const parts = content.split(/\s+/);

        let moveFound = false;
        let newX = currentX;
        let newY = currentY;

        for (const part of parts) {
            const char = part.charAt(0).toUpperCase();
            const val = parseFloat(part.substring(1));

            switch (char) {
                case "G":
                    if (val === 0) {
                        isRapid = true;
                    } else if (val === 1) {
                        isRapid = false;
                    }
                    // Ignore others for now
                    break;
                case "X":
                    newX = val;
                    moveFound = true;
                    break;
                case "Y":
                    newY = val;
                    moveFound = true;
                    break;
                case "F":
                    currentSpeed = val;
                    break;
                case "S":
                    currentPower = val;
                    break;
                case "M":
                    if (val === 3 || val === 4) {
                        isLaserOn = true;
                    } else if (val === 5) {
                        isLaserOn = false;
                    }
                    break;
            }
        }

        if (moveFound) {
            // If the laser is OFF or it is G0, it is a travel move (visually)
            // Even if laser is ON, if power is 0, it's travel? Usually yes.
            // But typically G0 implies travel.

            const type = (isRapid || !isLaserOn || currentPower === 0) ? "travel" : "cut";

            moves.push({
                type,
                from: { x: currentX, y: currentY },
                to: { x: newX, y: newY },
                power: isLaserOn ? currentPower : 0,
                speed: currentSpeed
            });

            currentX = newX;
            currentY = newY;
        }
    }

    return { moves, warnings };
}
