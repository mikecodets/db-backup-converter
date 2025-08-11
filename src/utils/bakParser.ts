import * as fs from 'fs';
import { ConversionProgress, TableData } from '../types';
import { DockerSqlService } from './dockerSqlService';
import { Logger } from './logger';

export class BakParser {
  private dockerSqlService = new DockerSqlService();

  async parse(
    filePath: string,
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<TableData[]> {
    Logger.info('Iniciando conversão do arquivo .bak...', { filePath }, 'BakParser');
    
    // Verificar se arquivo existe
    if (!fs.existsSync(filePath)) {
      const err = new Error(`Arquivo não encontrado: ${filePath}`);
      Logger.error(err, 'BakParser');
      throw err;
    }

    // Verificar tamanho do arquivo
    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    Logger.info(`Tamanho do arquivo: ${fileSizeMB.toFixed(2)} MB`, undefined, 'BakParser');

    if (onProgress) {
      onProgress({
        currentTable: 'Verificando arquivo .bak...',
        tablesProcessed: 0,
        totalTables: 1,
        percentage: 5,
      });
    }

    // Tentar Docker + SQL Server primeiro
    try {
      Logger.info('Tentativa 1: Docker + SQL Server...', undefined, 'BakParser');
      const outputDir = require('path').dirname(filePath);
      const tables = await this.dockerSqlService.convertBakFile(filePath, outputDir, onProgress);

      if (tables.length === 0) {
        throw new Error('Nenhuma tabela foi encontrada no backup ou todas as tabelas estão vazias');
      }

      Logger.info(`Conversão concluída com Docker: ${tables.length} tabelas extraídas`, undefined, 'BakParser');
      return tables;

    } catch (dockerError) {
      Logger.warn('Docker falhou, tentando solução alternativa...', dockerError, 'BakParser');
      
      // Se Docker falhar, tentar solução alternativa
      if (onProgress) {
        onProgress({
          currentTable: 'Docker falhou, tentando RebaseData...',
          tablesProcessed: 0,
          totalTables: 1,
          percentage: 10,
        });
      }

      try {
        return await this.fallbackToCurl(filePath, onProgress);
      } catch (fallbackError) {
        // Se tudo falhar, mostrar ambos os erros
        const dockerMsg = dockerError instanceof Error ? dockerError.message : 'Erro Docker desconhecido';
        const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : 'Erro fallback desconhecido';
        
        const combined = new Error(`Todas as opções falharam:\n\n1. Docker + SQL Server:\n${dockerMsg}\n\n2. RebaseData (fallback):\n${fallbackMsg}\n\nSolução: Instale e inicie o Docker Desktop.`);
        Logger.error(combined, 'BakParser');
        throw combined;
      }
    }
  }

  private async fallbackToCurl(filePath: string, onProgress?: (progress: ConversionProgress) => void): Promise<TableData[]> {
    const { spawn } = require('child_process');
    const path = require('path');
    
    Logger.info('Usando RebaseData como fallback...', undefined, 'BakParser');
    
    // Verificar tamanho (RebaseData tem limite)
    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    if (fileSizeMB > 10) {
      const err = new Error(`Arquivo muito grande para fallback (${fileSizeMB.toFixed(2)}MB). RebaseData suporta apenas até 10MB. Use Docker + SQL Server.`);
      Logger.error(err, 'BakParser');
      throw err;
    }

    const outputDir = path.dirname(filePath);
    const outputZipPath = path.join(outputDir, 'output.zip');
    
    // Remover ZIP anterior se existir
    if (fs.existsSync(outputZipPath)) {
      fs.unlinkSync(outputZipPath);
    }

    // Executar curl
    await this.executeCurl(filePath, outputZipPath, onProgress);
    
    // Extrair e ler XLSX
    const tables = await this.extractAndReadXlsx(outputZipPath, outputDir, onProgress);
    
    // Limpar
    if (fs.existsSync(outputZipPath)) {
      fs.unlinkSync(outputZipPath);
    }
    
    return tables;
  }

  private async executeCurl(filePath: string, outputPath: string, onProgress?: (progress: ConversionProgress) => void): Promise<void> {
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const curlArgs = [
        '-F', `files[]=@${filePath}`,
        'https://www.rebasedata.com/api/v1/convert?outputFormat=xlsx&errorResponse=zip',
        '-o', outputPath
      ];

      const curlProcess = spawn('curl', curlArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

      let errorOutput = '';

      curlProcess.stderr.on('data', (data: Buffer) => {
        const output = data.toString();
        errorOutput += output;
        
        const progressMatch = output.match(/(\d+)%/);
        if (progressMatch && onProgress) {
          const percentage = Math.min(parseInt(progressMatch[1]), 40) + 20; // 20-60%
          onProgress({
            currentTable: `Enviando para RebaseData... ${progressMatch[1]}%`,
            tablesProcessed: 0,
            totalTables: 1,
            percentage,
          });
        }
      });

      curlProcess.on('close', (code: number | null) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve();
        } else {
          const err = new Error(`RebaseData falhou: ${errorOutput}`);
          Logger.error(err, 'BakParser');
          reject(err);
        }
      });

      curlProcess.on('error', (error: Error) => {
        const err = new Error(`Erro ao executar curl: ${error.message}`);
        Logger.error(err, 'BakParser');
        reject(err);
      });
    });
  }

  private async extractAndReadXlsx(zipPath: string, outputDir: string, onProgress?: (progress: ConversionProgress) => void): Promise<TableData[]> {
    const AdmZip = require('adm-zip');
    const path = require('path');
    
    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();
    const tables: TableData[] = [];

    for (let i = 0; i < zipEntries.length; i++) {
      const entry = zipEntries[i];
      if (entry.entryName.endsWith('.xlsx')) {
        if (onProgress) {
          onProgress({
            currentTable: `Processando ${entry.entryName}...`,
            tablesProcessed: i,
            totalTables: zipEntries.length,
            percentage: 60 + Math.round((i / zipEntries.length) * 35)
          });
        }

        const xlsxPath = path.join(outputDir, entry.entryName);
        zip.extractEntryTo(entry, outputDir, false, true);

        const tableData = await this.readXlsxFile(xlsxPath);
        if (tableData) {
          tables.push(tableData);
        }
      }
    }

    return tables;
  }

  private async readXlsxFile(filePath: string): Promise<TableData | null> {
    try {
      const XLSX = require('xlsx');
      const path = require('path');
      
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      
      if (!sheetName) return null;
      
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      const tableName = path.basename(filePath, '.xlsx');
      
      return {
        name: tableName,
        rows: jsonData
      };
    } catch (error) {
      Logger.error(`Erro ao ler XLSX ${filePath}: ${error}`, 'BakParser');
      return null;
    }
  }
} 