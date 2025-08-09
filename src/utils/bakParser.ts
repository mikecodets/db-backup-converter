import * as fs from 'fs';
import { ConversionProgress, TableData } from '../types';
import { DockerSqlService } from './dockerSqlService';

export class BakParser {
  private dockerSqlService = new DockerSqlService();

  async parse(
    filePath: string,
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<TableData[]> {
    console.log('Iniciando conversão do arquivo .bak...');
    
    // Verificar se arquivo existe
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }

    // Verificar tamanho do arquivo
    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    console.log(`Tamanho do arquivo: ${fileSizeMB.toFixed(2)} MB`);

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
      console.log('Tentativa 1: Docker + SQL Server...');
      const outputDir = require('path').dirname(filePath);
      const tables = await this.dockerSqlService.convertBakFile(filePath, outputDir, onProgress);

      if (tables.length === 0) {
        throw new Error('Nenhuma tabela foi encontrada no backup ou todas as tabelas estão vazias');
      }

      console.log(`Conversão concluída com Docker: ${tables.length} tabelas extraídas`);
      return tables;

    } catch (dockerError) {
      console.log('Docker falhou, tentando solução alternativa...');
      
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
        
        throw new Error(`Todas as opções falharam:\n\n1. Docker + SQL Server:\n${dockerMsg}\n\n2. RebaseData (fallback):\n${fallbackMsg}\n\nSolução: Instale e inicie o Docker Desktop.`);
      }
    }
  }

  private async fallbackToCurl(filePath: string, onProgress?: (progress: ConversionProgress) => void): Promise<TableData[]> {
    const { spawn } = require('child_process');
    const path = require('path');
    
    console.log('Usando RebaseData como fallback...');
    
    // Verificar tamanho (RebaseData tem limite)
    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    if (fileSizeMB > 10) {
      throw new Error(`Arquivo muito grande para fallback (${fileSizeMB.toFixed(2)}MB). RebaseData suporta apenas até 10MB. Use Docker + SQL Server.`);
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
          reject(new Error(`RebaseData falhou: ${errorOutput}`));
        }
      });

      curlProcess.on('error', (error: Error) => {
        reject(new Error(`Erro ao executar curl: ${error.message}`));
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
      console.error(`Erro ao ler XLSX ${filePath}:`, error);
      return null;
    }
  }
} 