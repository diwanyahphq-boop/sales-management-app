import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getData: () => ipcRenderer.invoke('get-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  getAuth: () => ipcRenderer.invoke('get-auth'),
  setAuth: (user, pass) => ipcRenderer.invoke('set-auth', user, pass)
});
