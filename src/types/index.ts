export interface TableData {
  name: string;
  rows: Record<string, any>[];
}

export interface ConversionProgress {
  currentTable: string;
  tablesProcessed: number;
  totalTables: number;
  percentage: number;
}

export interface ExportOptions {
  format: 'csv' | 'xlsx';
}

export interface ConversionResult {
  success: boolean;
  message: string;
  outputPath?: string;
  error?: string;
} 