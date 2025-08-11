import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ConversionProgress, ConversionResult, ExportOptions } from '../types';
import { BakParser } from '../utils/bakParser';
import { FileExporter } from '../utils/fileExporter';
import { Logger } from '../utils/logger';
import { DockerInstaller } from './dockerInstaller';

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

// Initialize logger as soon as possible
Logger.initialize();
Logger.startSection('App Lifecycle');

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

// Global error handlers
process.on('uncaughtException', (err) => {
  Logger.error(err, 'uncaughtException');
});
process.on('unhandledRejection', (reason: any) => {
  Logger.error(reason instanceof Error ? reason : new Error(String(reason)), 'unhandledRejection');
});

// IPC Handlers
let isDialogOpen = false;

ipcMain.handle('select-bak-file', async (): Promise<string | null> => {
  // Prevenir múltiplos diálogos
  if (isDialogOpen) {
    return null;
  }
  
  isDialogOpen = true;
  
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Backup Files', extensions: ['bak'] }],
    });
    
    return result.canceled ? null : result.filePaths[0];
  } finally {
    // Aguardar um pouco antes de permitir novo diálogo
    setTimeout(() => {
      isDialogOpen = false;
    }, 500);
  }
});

ipcMain.handle('convert-file', async (
  event,
  filePath: string,
  options: ExportOptions
): Promise<ConversionResult> => {
  const log = Logger.withContext('convert-file');
  try {
    log.info('Iniciando conversão', { filePath, options });
    // Verificar Docker antes de iniciar conversão
    const dockerReady = await DockerInstaller.checkAndInstall(mainWindow);
    if (!dockerReady) {
      return {
        success: false,
        message: 'Docker Desktop não está disponível',
        error: 'O Docker Desktop é necessário para converter arquivos .bak. Por favor, instale ou inicie o Docker Desktop e tente novamente.',
      };
    }

    const parser = new BakParser();
    const exporter = new FileExporter();
    
    // Progress callback
    const onProgress = (progress: ConversionProgress) => {
      event.sender.send('conversion-progress', progress);
      Logger.info('progress', progress, 'conversion-progress');
    };
    
    const tables = await parser.parse(filePath, onProgress);
    const outputPath = await exporter.export(tables, options, filePath);
    
    log.info('Conversão concluída', { outputPath, tables: tables.length });
    return {
      success: true,
      message: 'Conversão concluída com sucesso!',
      outputPath,
    };
  } catch (error) {
    log.error(error);
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

ipcMain.handle('open-exports-folder', async () => {
  try {
    const exportsPath = path.join(process.cwd(), 'exports');
    await shell.openPath(exportsPath);
  } catch (error) {
    console.error('Erro ao abrir pasta de exports:', error);
  }
});

ipcMain.handle('check-previous-exports', async (): Promise<boolean> => {
  try {
    const exportsPath = path.join(process.cwd(), 'exports');
    
    if (!fs.existsSync(exportsPath)) {
      return false;
    }
    
    const files = fs.readdirSync(exportsPath);
    // Verificar se há pelo menos uma pasta de backup
    const hasBackupFolders = files.some(file => {
      const fullPath = path.join(exportsPath, file);
      return fs.statSync(fullPath).isDirectory();
    });
    
    return hasBackupFolders;
  } catch (error) {
    console.error('Erro ao verificar exports anteriores:', error);
    return false;
  }
});

ipcMain.handle('open-windows-guide', async () => {
  try {
    const guidePath = path.join(process.cwd(), 'WINDOWS_GUIDE.md');
    await shell.openPath(guidePath);
  } catch (error) {
    console.error('Erro ao abrir guia do Windows:', error);
    throw error;
  }
});

// Logging related IPC
ipcMain.handle('get-current-log-path', async () => {
  return Logger.getCurrentLogPath();
});

ipcMain.handle('save-log-as', async () => {
  const currentLog = Logger.getCurrentLogPath();
  if (!currentLog || !fs.existsSync(currentLog)) {
    return null;
  }
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Salvar log',
    defaultPath: path.basename(currentLog),
    filters: [{ name: 'Log Files', extensions: ['log', 'txt'] }],
  });
  if (result.canceled || !result.filePath) return null;

  await fs.promises.copyFile(currentLog, result.filePath);
  return result.filePath;
}); 