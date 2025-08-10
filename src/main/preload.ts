import { contextBridge, ipcRenderer } from 'electron';
import { ConversionProgress, ConversionResult, ExportOptions } from '../types';

contextBridge.exposeInMainWorld('electronAPI', {
  selectBakFile: (): Promise<string | null> => ipcRenderer.invoke('select-bak-file'),
  convertFile: (filePath: string, options: ExportOptions): Promise<ConversionResult> => 
    ipcRenderer.invoke('convert-file', filePath, options),
  onConversionProgress: (callback: (progress: ConversionProgress) => void): (() => void) => {
    const handler = (_event: any, progress: ConversionProgress) => callback(progress);
    ipcRenderer.on('conversion-progress', handler);
    return () => ipcRenderer.removeListener('conversion-progress', handler);
  },
  openOutputFolder: (outputPath: string): Promise<void> => 
    ipcRenderer.invoke('open-output-folder', outputPath),
  openExportsFolder: (): Promise<void> => ipcRenderer.invoke('open-exports-folder'),
  checkPreviousExports: (): Promise<boolean> => ipcRenderer.invoke('check-previous-exports'),
  openWindowsGuide: (): Promise<void> => ipcRenderer.invoke('open-windows-guide'),
}); 