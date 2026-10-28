import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopAPI } from '../src/shared.js';
const api: DesktopAPI = {
  editSource: (id, input) => ipcRenderer.invoke('sources:edit', id, input),
  listSources: () => ipcRenderer.invoke('sources:list'),
  prepareSource: (kind) => ipcRenderer.invoke('sources:prepare', kind),
  cancelSource: (token) => ipcRenderer.invoke('sources:cancel', token),
  saveSourceFile: (token, input) =>
    ipcRenderer.invoke('sources:save-file', token, input),
  saveSourceLink: (kind, input) =>
    ipcRenderer.invoke('sources:save-link', kind, input),
  openSource: (id) => ipcRenderer.invoke('sources:open', id),
  deleteSource: (id) => ipcRenderer.invoke('sources:delete', id),
  updateStatus: () => ipcRenderer.invoke('updates:status'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
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
