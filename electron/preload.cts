import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopAPI } from '../src/shared.js';
const api: DesktopAPI = {
  listQuestions: () => ipcRenderer.invoke('questions:list'),
  createQuestion: (input) => ipcRenderer.invoke('questions:create', input),
  replyToQuestion: (id, content, source) =>
    ipcRenderer.invoke('questions:reply', id, content, source),
  copyQuestion: (id) => ipcRenderer.invoke('questions:copy', id),
  deleteQuestion: (id) => ipcRenderer.invoke('questions:delete', id),
  list: () => ipcRenderer.invoke('library:list'),
  save: (input, id) => ipcRenderer.invoke('library:save', input, id),
  remove: (id) => ipcRenderer.invoke('library:remove', id),
  importText: () => ipcRenderer.invoke('library:import'),
  backup: () => ipcRenderer.invoke('library:backup'),
  storageInfo: () => ipcRenderer.invoke('library:storage'),
};
contextBridge.exposeInMainWorld('trademe', api);
