/**
 * Preload script for Electron renderer process.
 * Exposes safe IPC communication bridges via contextBridge.
 * This runs in a privileged context before the renderer page loads.
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * Allowed IPC channels for sending messages from renderer to main.
 */
const validSendChannels = [
  'window:minimize',
  'window:maximize',
  'window:close',
  'app:get-version',
  'cc:connect',
  'cc:disconnect',
  'cc:send-command',
] as const;

/**
 * Allowed IPC channels for receiving messages in renderer from main.
 */
const validReceiveChannels = [
  'app:version',
  'cc:connected',
  'cc:disconnected',
  'cc:message',
  'cc:error',
  'window:maximized',
  'window:unmaximized',
] as const;

type SendChannel = typeof validSendChannels[number];
type ReceiveChannel = typeof validReceiveChannels[number];

/**
 * Expose a safe, typed API to the renderer process under `window.electronAPI`.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Send a message to the main process on a validated channel.
   */
  send: (channel: SendChannel, ...args: unknown[]): void => {
    if ((validSendChannels as readonly string[]).includes(channel)) {
      ipcRenderer.send(channel, ...args);
    } else {
      console.warn(`[preload] Blocked send on unauthorized channel: ${channel}`);
    }
  },

  /**
   * Invoke a main-process handler and await the response.
   */
  invoke: async (channel: SendChannel, ...args: unknown[]): Promise<unknown> => {
    if ((validSendChannels as readonly string[]).includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    console.warn(`[preload] Blocked invoke on unauthorized channel: ${channel}`);
    return undefined;
  },

  /**
   * Register a listener for messages from the main process.
   * Returns an unsubscribe function.
   */
  on: (
    channel: ReceiveChannel,
    listener: (...args: unknown[]) => void
  ): (() => void) => {
    if ((validReceiveChannels as readonly string[]).includes(channel)) {
      const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
        listener(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
    console.warn(`[preload] Blocked listener on unauthorized channel: ${channel}`);
    return () => {};
  },

  /**
   * Register a one-time listener for a message from the main process.
   */
  once: (channel: ReceiveChannel, listener: (...args: unknown[]) => void): void => {
    if ((validReceiveChannels as readonly string[]).includes(channel)) {
      ipcRenderer.once(channel, (_event, ...args) => listener(...args));
    } else {
      console.warn(`[preload] Blocked once-listener on unauthorized channel: ${channel}`);
    }
  },
});
