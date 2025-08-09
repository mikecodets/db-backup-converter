import { ConversionProgress, ConversionResult, ExportOptions } from '../types';
import './styles.css';

declare global {
  interface Window {
    electronAPI: {
      selectBakFile(): Promise<string | null>;
      convertFile(filePath: string, options: ExportOptions): Promise<ConversionResult>;
      openOutputFolder(outputPath: string): Promise<void>;
      onConversionProgress(callback: (progress: ConversionProgress) => void): () => void;
    };
  }
}

class AppController {
  private selectedFilePath: string | null = null;
  private progressUnsubscribe: (() => void) | null = null;

  constructor() {
    this.initializeEventListeners();
  }

  private initializeEventListeners(): void {
    // File selection
    const selectFileBtn = document.getElementById('select-file') as HTMLButtonElement;
    selectFileBtn?.addEventListener('click', () => this.handleFileSelection());

    // Conversion start
    const startConversionBtn = document.getElementById('start-conversion') as HTMLButtonElement;
    startConversionBtn?.addEventListener('click', () => this.handleConversionStart());

    // Results actions
    const openFolderBtn = document.getElementById('open-folder') as HTMLButtonElement;
    openFolderBtn?.addEventListener('click', () => this.handleOpenFolder());

    const convertAnotherBtn = document.getElementById('convert-another') as HTMLButtonElement;
    convertAnotherBtn?.addEventListener('click', () => this.resetInterface());

    const retryBtn = document.getElementById('retry-conversion') as HTMLButtonElement;
    retryBtn?.addEventListener('click', () => this.handleConversionStart());
  }

  private async handleFileSelection(): Promise<void> {
    try {
      const filePath = await window.electronAPI.selectBakFile();
      
      if (filePath) {
        this.selectedFilePath = filePath;
        this.showFileInfo(filePath);
        this.showConversionSection();
      }
    } catch (error) {
      this.showError('Erro ao selecionar arquivo', error);
    }
  }

  private showFileInfo(filePath: string): void {
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    
    if (fileInfo && fileName) {
      fileName.textContent = filePath.split('/').pop() || filePath;
      fileInfo.classList.remove('hidden');
    }
  }

  private showConversionSection(): void {
    const conversionSection = document.getElementById('conversion-section');
    conversionSection?.classList.remove('hidden');
  }

  private async handleConversionStart(): Promise<void> {
    if (!this.selectedFilePath) {
      this.showError('Nenhum arquivo selecionado', 'Selecione um arquivo .bak antes de iniciar a conversão');
      return;
    }

    try {
      const options = this.getExportOptions();
      this.showProgressSection();
      this.hideResults();
      
      // Subscribe to progress updates
      this.progressUnsubscribe = window.electronAPI.onConversionProgress(
        (progress) => this.updateProgress(progress)
      );

      const result = await window.electronAPI.convertFile(this.selectedFilePath, options);
      
      // Unsubscribe from progress updates
      if (this.progressUnsubscribe) {
        this.progressUnsubscribe();
        this.progressUnsubscribe = null;
      }

      this.handleConversionResult(result);
      
    } catch (error) {
      this.showError('Erro durante a conversão', error);
      this.hideProgress();
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
document.addEventListener('DOMContentLoaded', () => {
  new AppController();
}); 