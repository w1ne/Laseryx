import { createWebSerialGrblDriver, GrblDriver } from "./grblDriver";

let driverInstance: GrblDriver | null = null;

export function getDriver(): GrblDriver {
    if (!driverInstance) {
        driverInstance = createWebSerialGrblDriver();
    }
    return driverInstance;
}
