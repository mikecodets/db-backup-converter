import { ConversionProgress, ConversionResult, ExportOptions } from '../types';
import './styles.css';

// Variável global para evitar múltiplas execuções do script
declare global {
  interface Window {
    electronAPI: {
      selectBakFile(): Promise<string | null>;
      convertFile(filePath: string, options: ExportOptions): Promise<ConversionResult>;
      onConversionProgress(callback: (progress: ConversionProgress) => void): () => void;
      openOutputFolder(outputPath: string): Promise<void>;
      openExportsFolder(): Promise<void>;
      checkPreviousExports(): Promise<boolean>;
      openWindowsGuide(): Promise<void>;
    };
    appControllerInstance: AppController | undefined; // Nova proteção global
  }
}

class AppController {
  private selectedFilePath: string | null = null;
  private progressUnsubscribe: (() => void) | null = null;
  private isSelectingFile: boolean = false;
  private isConverting: boolean = false;

  constructor() {
    // Verificar se já existe uma instância global
    if (window.appControllerInstance) {
      return window.appControllerInstance;
    }
    
    
    // Armazenar na variável global
    window.appControllerInstance = this;
    this.initializeEventListeners();
  }

  public static getInstance(): AppController {
    if (window.appControllerInstance) {
      return window.appControllerInstance;
    }
    
    return new AppController();
  }

  private initializeEventListeners(): void {
    // File selection com debounce
    const selectFileBtn = document.getElementById('select-file') as HTMLButtonElement;
    if (selectFileBtn) {
      let lastClickTime = 0;
      selectFileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const now = Date.now();
        if (now - lastClickTime < 1000) {
          return;
        }
        lastClickTime = now;
        
        this.handleFileSelection();
      });
    }

    // Conversion start
    const startConversionBtn = document.getElementById('start-conversion') as HTMLButtonElement;
    if (startConversionBtn) {
      startConversionBtn.addEventListener('click', () => this.handleConversionStart());
    }

    // Results actions
    const openFolderBtn = document.getElementById('open-folder') as HTMLButtonElement;
    if (openFolderBtn) {
      openFolderBtn.addEventListener('click', () => this.handleOpenFolder());
    }

    const convertAnotherBtn = document.getElementById('convert-another') as HTMLButtonElement;
    if (convertAnotherBtn) {
      convertAnotherBtn.addEventListener('click', () => this.resetInterface());
    }

    const retryBtn = document.getElementById('retry-conversion') as HTMLButtonElement;
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.handleConversionStart());
    }

    // Open exports folder button
    const openExportsFolderBtn = document.getElementById('open-exports-folder') as HTMLButtonElement;
    if (openExportsFolderBtn) {
      openExportsFolderBtn.addEventListener('click', () => this.handleOpenExportsFolder());
    }

    // Windows guide button
    const windowsGuideBtn = document.getElementById('windows-guide') as HTMLButtonElement;
    if (windowsGuideBtn) {
      windowsGuideBtn.addEventListener('click', () => this.handleOpenWindowsGuide());
    }

    // Check for previous exports on load
    this.checkForPreviousExports();
  }

  private async handleFileSelection(): Promise<void> {
    // Prevenir múltiplas chamadas simultâneas
    if (this.isSelectingFile) {
      return;
    }
    
    this.isSelectingFile = true;
    
    try {
      const filePath = await window.electronAPI.selectBakFile();
      
      if (filePath && typeof filePath === 'string' && filePath.trim() !== '') {
        this.selectedFilePath = filePath;
        
        // Verificação imediata
        setTimeout(() => {
        }, 100);
        
        this.showFileInfo(filePath);
        this.showConversionSection();
      } else {
      }
    } catch (error) {
      this.showError('Erro ao selecionar arquivo', error);
    } finally {
      // Aguardar um pouco antes de permitir nova seleção
      setTimeout(() => {
        this.isSelectingFile = false;
      }, 500);
    }
  }

  private showFileInfo(filePath: string): void {
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    
    if (fileInfo && fileName) {
      // Usar separador compatível com Windows e Linux
      const pathSeparator = filePath.includes('\\') ? '\\' : '/';
      const fileNameOnly = filePath.split(pathSeparator).pop() || filePath;
      fileName.textContent = fileNameOnly;
      fileInfo.classList.remove('hidden');
      
      // Debug log
    }
  }

  private showConversionSection(): void {
    const conversionSection = document.getElementById('conversion-section');
    conversionSection?.classList.remove('hidden');
  }

  private async handleConversionStart(): Promise<void> {
    
    // Verificar se já está convertendo
    if (this.isConverting) {
      return;
    }
    
    // Validação mais robusta
    const isValidFilePath = this.selectedFilePath && 
                           typeof this.selectedFilePath === 'string' && 
                           this.selectedFilePath.trim().length > 0 &&
                           this.selectedFilePath.endsWith('.bak');
    
    
    if (!isValidFilePath) {
      console.error('ERRO: selectedFilePath inválido:', {
        value: this.selectedFilePath,
        type: typeof this.selectedFilePath,
        isNull: this.selectedFilePath == null,
        isEmpty: this.selectedFilePath === '',
        isBakFile: this.selectedFilePath?.endsWith?.('.bak')
      });
      this.showError('Nenhum arquivo selecionado', 'Selecione um arquivo .bak antes de iniciar a conversão');
      return;
    }


    // Marcar como em conversão
    this.isConverting = true;
    
    try {
      const options = this.getExportOptions();
      
      this.showProgressSection();
      this.hideResults();
      
      // Subscribe to progress updates
      this.progressUnsubscribe = window.electronAPI.onConversionProgress(
        (progress) => this.updateProgress(progress)
      );

      const result = await window.electronAPI.convertFile(this.selectedFilePath!, options);
      
      // Unsubscribe from progress updates
      if (this.progressUnsubscribe) {
        this.progressUnsubscribe();
        this.progressUnsubscribe = null;
      }

      this.handleConversionResult(result);
      
    } catch (error) {
      console.error('Erro durante conversão:', error);
      this.showError('Erro durante a conversão', error);
      this.hideProgress();
    } finally {
      // Sempre limpar a flag no final
      this.isConverting = false;
    }
  }

  private getExportOptions(): ExportOptions {
    // Sempre XLSX
    return { format: 'xlsx' };
  }

  private showProgressSection(): void {
    const progressSection = document.getElementById('progress-section');
    progressSection?.classList.remove('hidden');
    
    // Hide conversion section
    const conversionSection = document.getElementById('conversion-section');
    conversionSection?.classList.add('hidden');
  }

  private hideProgress(): void {
    const progressSection = document.getElementById('progress-section');
    progressSection?.classList.add('hidden');
    
    // Show conversion section again
    const conversionSection = document.getElementById('conversion-section');
    conversionSection?.classList.remove('hidden');
  }

  private updateProgress(progress: ConversionProgress): void {
    const progressBar = document.getElementById('progress-bar') as HTMLElement;
    const progressText = document.getElementById('progress-text') as HTMLElement;
    const progressPercentage = document.getElementById('progress-percentage') as HTMLElement;
    const currentTable = document.getElementById('current-table') as HTMLElement;
    const tablesProcessed = document.getElementById('tables-processed') as HTMLElement;
    const totalTables = document.getElementById('total-tables') as HTMLElement;

    if (progressBar) {
      progressBar.style.width = `${progress.percentage}%`;
    }

    if (progressText) {
      progressText.textContent = `Processando: ${progress.currentTable}`;
    }

    if (progressPercentage) {
      progressPercentage.textContent = `${Math.round(progress.percentage)}%`;
    }

    if (currentTable) {
      currentTable.textContent = progress.currentTable;
    }

    if (tablesProcessed) {
      tablesProcessed.textContent = progress.tablesProcessed.toString();
    }

    if (totalTables) {
      totalTables.textContent = progress.totalTables.toString();
    }
  }

  private handleConversionResult(result: ConversionResult): void {
    this.hideProgress();
    
    if (result.success) {
      this.showSuccess(result.outputPath!);
    } else {
      this.showError('Conversão falhou', result.error || result.message);
    }
  }

  private showSuccess(outputPath: string): void {
    const resultsSection = document.getElementById('results-section');
    const successResult = document.getElementById('success-result');
    
    if (resultsSection && successResult) {
      resultsSection.classList.remove('hidden');
      successResult.classList.remove('hidden');
      
      // Store output path for later use
      (successResult as any).outputPath = outputPath;
    }
  }

  private showError(title: string, error: any): void {
    const resultsSection = document.getElementById('results-section');
    const errorResult = document.getElementById('error-result');
    const errorMessage = document.getElementById('error-message');
    
    if (resultsSection && errorResult) {
      resultsSection.classList.remove('hidden');
      errorResult.classList.remove('hidden');
      
      if (errorMessage) {
        const message = error instanceof Error ? error.message : 
                       typeof error === 'string' ? error : 
                       'Erro desconhecido';
        errorMessage.textContent = message;
      }
    }
  }

  private hideResults(): void {
    const resultsSection = document.getElementById('results-section');
    const successResult = document.getElementById('success-result');
    const errorResult = document.getElementById('error-result');
    
    resultsSection?.classList.add('hidden');
    successResult?.classList.add('hidden');
    errorResult?.classList.add('hidden');
  }

  private async handleOpenFolder(): Promise<void> {
    try {
      const successResult = document.getElementById('success-result') as any;
      const outputPath = successResult?.outputPath;
      
      if (outputPath) {
        await window.electronAPI.openOutputFolder(outputPath);
      }
    } catch (error) {
      this.showError('Erro ao abrir pasta', error);
    }
  }


  private async handleOpenExportsFolder(): Promise<void> {
    try {
      await window.electronAPI.openExportsFolder();
    } catch (error) {
      this.showError('Erro ao abrir pasta de exports', error);
    }
  }

  private async handleOpenWindowsGuide(): Promise<void> {
    try {
      await window.electronAPI.openWindowsGuide();
    } catch (error) {
      this.showError('Erro ao abrir guia do Windows', error);
    }
  }

  private async checkForPreviousExports(): Promise<void> {
    try {
      const hasPreviousExports = await window.electronAPI.checkPreviousExports();
      const previousExportsSection = document.getElementById('previous-exports-section');
      
      if (hasPreviousExports && previousExportsSection) {
        previousExportsSection.classList.remove('hidden');
      }
    } catch (error) {
      console.error('Erro ao verificar exports anteriores:', error);
    }
  }

  private resetInterface(): void {
    // Reset file selection
    this.selectedFilePath = null;
    
    const fileInfo = document.getElementById('file-info');
    fileInfo?.classList.add('hidden');
    
    // Hide all sections except file selection
    const conversionSection = document.getElementById('conversion-section');
    const progressSection = document.getElementById('progress-section');
    const resultsSection = document.getElementById('results-section');
    
    conversionSection?.classList.add('hidden');
    progressSection?.classList.add('hidden');
    resultsSection?.classList.add('hidden');
    
    // Reset progress bar
    const progressBar = document.getElementById('progress-bar') as HTMLElement;
    if (progressBar) {
      progressBar.style.width = '0%';
    }
    
    // No form values to reset - always XLSX
  }
}

// Initialize app when DOM is loaded
let appInitialized = false;

function initializeApp() {
  if (appInitialized) {
    return;
  }
  
  appInitialized = true;
  AppController.getInstance();
}

// Remover múltiplas inicializações - usar apenas uma abordagem
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp, { once: true });
} else {
  initializeApp();
} 