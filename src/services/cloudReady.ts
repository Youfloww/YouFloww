/**
 * Has this device heard from the server for the signed-in account yet? Until then only the cached copy is on
 * screen and nothing may be saved over the account (see sync.ts). Kept apart from sync.ts so features can ask
 * without importing the whole sync service.
 */
let ready = false;
export const setCloudReady = (v: boolean) => void (ready = v);
export const isCloudReady = () => ready;
