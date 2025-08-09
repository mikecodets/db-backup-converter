import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { ConversionProgress, ConversionResult, ExportOptions } from '../types';

contextBridge.exposeInMainWorld('electronAPI', {
  selectBakFile: (): Promise<string | null> => ipcRenderer.invoke('select-bak-file'),
  
  convertFile: (filePath: string, options: ExportOptions): Promise<ConversionResult> =>
    ipcRenderer.invoke('convert-file', filePath, options),
    
  openOutputFolder: (outputPath: string): Promise<void> =>
    ipcRenderer.invoke('open-output-folder', outputPath),
    
  onConversionProgress: (callback: (progress: ConversionProgress) => void) => {
    const handleProgress = (event: IpcRendererEvent, progress: ConversionProgress) => {
      callback(progress);
    };
    ipcRenderer.on('conversion-progress', handleProgress);
    
    return () => {
      ipcRenderer.removeListener('conversion-progress', handleProgress);
    };
  },
}); 