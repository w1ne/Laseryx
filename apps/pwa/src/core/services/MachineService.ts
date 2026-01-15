import { AppState } from "../state/types";
import { getDriver } from "../../io/driverSingleton";

export const MachineService = {
    jog: async (x: number, y: number, z: number, speed: number, relative: boolean = true) => {
        const driver = getDriver();
        if (!driver.isConnected()) return;
        const cmd = `$J=G91 G21 X${x} Y${y} F${speed}`;
        await driver.sendLine(cmd);
    },

    home: async () => {
        const driver = getDriver();
        if (driver.isConnected()) {
            await driver.sendLine("$H");
        }
    },

    unlock: async () => {
        const driver = getDriver();
        if (driver.isConnected()) {
            await driver.sendLine("$X");
        }
    },

    zeroXY: async () => {
        const driver = getDriver();
        if (driver.isConnected()) {
            await driver.sendLine("G10 L20 P1 X0 Y0");
        }
    },

    zeroZ: async () => {
        const driver = getDriver();
        if (driver.isConnected()) {
            await driver.sendLine("G10 L20 P1 Z0");
        }
    },

    goToZero: async () => {
        const driver = getDriver();
        if (driver.isConnected()) {
            await driver.sendLine("G0 X0 Y0");
        }
    },

    softReset: async () => {
        const driver = getDriver();
        if (driver.isConnected()) {
            await driver.sendLine("\x18");
        }
    }
};
