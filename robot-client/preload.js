const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 选择文件夹
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
  // 选择文件
  openFileDialog: (filters) => ipcRenderer.invoke('dialog:openFile', filters),
  // 在 Finder/资源管理器 显示
  showInFolder: (filePath) => ipcRenderer.invoke('shell:showInFolder', filePath),
  // 输入框
  showPrompt: (message, defaultText) => ipcRenderer.invoke('dialog:prompt', { message, defaultText }),
  // 确认框
  showConfirm: (message) => ipcRenderer.invoke('dialog:confirm', { message }),
  // 是否是桌面应用
  isDesktop: true,
});

// 重写 window.prompt，让页面里的 prompt() 正常工作
window.prompt = function(message, defaultText) {
  // 同步模拟：用 ipcRenderer.sendSync（但 sendSync 阻塞主线程，不太好）
  // 更好的方式是页面代码直接用 electronAPI.showPrompt
  // 这里提供一个简单的 fallback
  return null;
};

// 重写 window.confirm
window.confirm = function(message) {
  // 同上，页面代码应该用 electronAPI.showConfirm
  return true;
};
