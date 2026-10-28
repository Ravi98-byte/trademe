import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopAPI } from '../src/shared.js';
const api: DesktopAPI = {
  list: () => ipcRenderer.invoke('library:list'),
  save: (input, id) => ipcRenderer.invoke('library:save', input, id),
  remove: (id) => ipcRenderer.invoke('library:remove', id),
  importText: () => ipcRenderer.invoke('library:import'),
  backup: () => ipcRenderer.invoke('library:backup'),
  storageInfo: () => ipcRenderer.invoke('library:storage'),
};
contextBridge.exposeInMainWorld('trademe', api);
