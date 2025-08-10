import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { ExportOptions, TableData } from '../types';

export class FileExporter {
  async export(tables: TableData[], options: ExportOptions, bakFilePath?: string): Promise<string> {
    // Criar pasta base exports se não existir
    const exportsBaseDir = path.join(process.cwd(), 'exports');
    await this.ensureDirectoryExists(exportsBaseDir);
    
    // Criar subpasta com timestamp e nome do arquivo bak (se fornecido)
    const timestamp = this.getTimestamp();
    let folderName = `backup_${timestamp}`;
    
    if (bakFilePath) {
      const bakFileName = path.basename(bakFilePath, '.bak');
      // Sanitizar nome do arquivo para uso como nome de pasta
      const sanitizedName = bakFileName.replace(/[^a-zA-Z0-9_-]/g, '_');
      folderName = `${sanitizedName}_${timestamp}`;
    }
    
    const outputDir = path.join(exportsBaseDir, folderName);
    await this.ensureDirectoryExists(outputDir);
    
    console.log(`Exportando ${tables.length} tabelas para: ${outputDir}`);
    console.log(`Formato: XLSX (arquivos individuais)`);
    
    // Sempre exportar individualmente na pasta específica da conversão
    return this.exportIndividuallyToRoot(tables, options, outputDir);
  }

  private async exportIndividuallyToRoot(
    tables: TableData[],
    options: ExportOptions,
    outputDir: string
  ): Promise<string> {
    console.log(`Criando arquivos individuais em: ${outputDir}`);
    
    let filesCreated = 0;
    
    // Processar cada tabela individualmente
    for (const table of tables) {
      if (table.rows.length === 0) {
        console.log(`Tabela ${table.name} está vazia, pulando...`);
        continue;
      }
      
      console.log(`Exportando tabela ${table.name} com ${table.rows.length} registros`);
      
      const sanitizedName = this.sanitizeFilename(table.name);
      
      if (options.format === 'xlsx') {
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(table.rows);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
        
        const filename = `${sanitizedName}.xlsx`;
        const filepath = path.join(outputDir, filename);
        XLSX.writeFile(workbook, filepath);
        console.log(`Arquivo XLSX criado: ${filepath}`);
        filesCreated++;
      } else {
        const csvContent = this.convertToCSV(table.rows);
        const filename = `${sanitizedName}.csv`;
        const filepath = path.join(outputDir, filename);
        
        await fs.promises.writeFile(filepath, csvContent, 'utf8');
        console.log(`Arquivo CSV criado: ${filepath}`);
        filesCreated++;
      }
    }
    
    console.log(`Total de ${filesCreated} arquivos criados em: ${outputDir}`);
    return outputDir;
  }

  private convertToCSV(rows: Record<string, any>[]): string {
    if (rows.length === 0) return '';
    
    // Get all unique column names - O(n*m) where m is average columns per row
    const columns = new Set<string>();
    for (const row of rows) {
      Object.keys(row).forEach(key => columns.add(key));
    }
    
    const columnArray = Array.from(columns);
    const lines: string[] = [];
    
    // Add header
    lines.push(columnArray.map(col => this.escapeCSVValue(col)).join(','));
    
    // Add data rows - O(n*m)
    for (const row of rows) {
      const values = columnArray.map(col => {
        const value = row[col];
        return this.escapeCSVValue(value);
      });
      lines.push(values.join(','));
    }
    
    return lines.join('\n');
  }

  private escapeCSVValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    const stringValue = String(value);
    
    // If value contains comma, newline, or quote, wrap in quotes and escape internal quotes
    if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  }

  private sanitizeFilename(name: string): string {
    // Replace invalid characters for filenames
    return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
  }

  private sanitizeSheetName(name: string): string {
    // Excel sheet name restrictions
    let sanitized = name.replace(/[\\\/\?\*\[\]]/g, '_');
    
    // Limit to 31 characters
    if (sanitized.length > 31) {
      sanitized = sanitized.substring(0, 31);
    }
    
    return sanitized;
  }

  private getTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
  }

  private async ensureDirectoryExists(dir: string): Promise<void> {
    try {
      await fs.promises.access(dir);
    } catch {
      await fs.promises.mkdir(dir, { recursive: true });
    }
  }
} 