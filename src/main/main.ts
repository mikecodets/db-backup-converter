import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import * as path from 'path';
import { ConversionProgress, ConversionResult, ExportOptions } from '../types';
import { BakParser } from '../utils/bakParser';
import { FileExporter } from '../utils/fileExporter';

let mainWindow: BrowserWindow;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers
ipcMain.handle('select-bak-file', async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Backup Files', extensions: ['bak'] }],
  });
  
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('convert-file', async (
  event,
  filePath: string,
  options: ExportOptions
): Promise<ConversionResult> => {
  try {
    const parser = new BakParser();
    const exporter = new FileExporter();
    
    // Progress callback
    const onProgress = (progress: ConversionProgress) => {
      event.sender.send('conversion-progress', progress);
    };
    
    const tables = await parser.parse(filePath, onProgress);
    const outputPath = await exporter.export(tables, options);
    
    return {
      success: true,
      message: 'Conversão concluída com sucesso!',
      outputPath,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Erro durante a conversão',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
});

ipcMain.handle('open-output-folder', async (event, outputPath: string) => {
  try {
    await shell.showItemInFolder(outputPath);
  } catch (error) {
    // Fallback para abrir a pasta diretamente
    await shell.openPath(path.dirname(outputPath));
  }
}); 