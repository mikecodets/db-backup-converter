import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ConversionProgress, ConversionResult, ExportOptions } from '../types';
import { BakParser } from '../utils/bakParser';
import { FileExporter } from '../utils/fileExporter';
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
  try {
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
    };
    
    const tables = await parser.parse(filePath, onProgress);
    const outputPath = await exporter.export(tables, options, filePath);
    
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