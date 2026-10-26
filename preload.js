const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Every call resolves to the value or throws an Error with the main-process message.
const call = async (ch, ...args) => {
  const r = await ipcRenderer.invoke(ch, ...args);
  if (r && r.error) throw new Error(r.error);
  return r ? r.ok : undefined;
};

const on = (ch) => (cb) => {
  const fn = (_e, ...a) => cb(...a);
  ipcRenderer.on(ch, fn);
  return () => ipcRenderer.removeListener(ch, fn);
};

contextBridge.exposeInMainWorld('lumen', {
  win: (action) => ipcRenderer.send('win', action),
  pathOf: (file) => webUtils.getPathForFile(file), // real path of a dropped file
  call,
  onProgress: on('game:progress'),
  onLog: on('game:log'),
  onState: on('game:state'),
  onTask: on('task:status'),
  onProblem: on('game:problem'),
  onError: on('app:error'),
  onCrash: on('game:crash'),
});
