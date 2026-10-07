const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// 启动机器人后端服务
const robotPath = path.join(__dirname, 'index.js');
require(robotPath);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: '轻聊机器人控制台',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // 等面板服务起来再加载
  const panelPort = require('./config').panelPort || 7777;
  const url = `http://localhost:${panelPort}`;

  let tries = 0;
  const tryLoad = () => {
    tries++;
    if (tries > 20) {
      mainWindow.loadURL(url); // 最后还是加载，让用户看到错误
      return;
    }
    const http = require('http');
    http.get(url, () => {
      mainWindow.loadURL(url);
    }).on('error', () => {
      setTimeout(tryLoad, 300);
    });
  };
  tryLoad();

  // 外部链接用浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 支持 prompt/alert/confirm 弹窗
  mainWindow.webContents.on('before-input-event', () => {});
}

// 处理页面里的 prompt（Electron 默认禁用）
ipcMain.handle('dialog:prompt', async (event, { message, defaultText }) => {
  const result = await dialog.showInputBox(mainWindow, {
    title: '输入',
    message: message || '请输入',
    value: defaultText || '',
    buttons: ['确定', '取消'],
    defaultId: 0,
    cancelId: 1,
  });
  if (result.response === 1) return null;
  return result.value || '';
});

// 处理 confirm
ipcMain.handle('dialog:confirm', async (event, { message }) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['确定', '取消'],
    defaultId: 0,
    cancelId: 1,
    message: message || '确定吗？',
  });
  return result.response === 0;
});

// 选择文件夹
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择监控文件夹',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// 选择文件（图片等）
ipcMain.handle('dialog:openFile', async (event, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: '选择文件',
    filters: filters || [],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// 在 Finder/资源管理器中显示
ipcMain.handle('shell:showInFolder', async (event, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});

// 应用菜单
function createMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about', label: '关于' },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Mac 上关闭窗口不退出（后台跑机器人）
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
