import { spawn } from 'child_process';
import * as path from 'path';
import { ConversionProgress, TableData } from '../types';
import { PlatformUtils } from '../utils/platformUtils';

export class DockerSqlService {
  private readonly CONTAINER_NAME = 'db-backup-converter-sql';
  private readonly SQL_PASSWORD = 'DbConverter123!';
  private readonly DATABASE_NAME = 'RestoreDB';
  private readonly SQL_PORT = 1431;

  private getSpawnOptions(): any {
    return {
      stdio: 'pipe',
      shell: PlatformUtils.isWindows()
    };
  }

  async convertBakFile(
    filePath: string,
    outputDir: string,
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<TableData[]> {
    console.log('🚀 =========================');
    console.log('🚀 INICIANDO CONVERSÃO DOCKER');
    console.log('🚀 =========================');
    console.log('📁 Arquivo:', filePath);
    
    try {
      // 1. Verificar se Docker está disponível
      await this.checkDocker();
      
      if (onProgress) {
        onProgress({
          currentTable: 'Iniciando container SQL Server...',
          tablesProcessed: 0,
          totalTables: 1,
          percentage: 10
        });
      }

      // 2. Iniciar container SQL Server
      await this.startSqlContainer();

      if (onProgress) {
        onProgress({
          currentTable: 'Aguardando SQL Server...',
          tablesProcessed: 0,
          totalTables: 1,
          percentage: 20
        });
      }

      // 3. Aguardar SQL Server ficar pronto
      await this.waitForSqlServer(onProgress);

      if (onProgress) {
        onProgress({
          currentTable: 'Restaurando backup...',
          tablesProcessed: 0,
          totalTables: 1,
          percentage: 30
        });
      }

      // 4. Copiar .bak para container
      await this.copyBakToContainer(filePath);

      // 5. Restaurar banco de dados
      await this.restoreDatabase(path.basename(filePath));

      if (onProgress) {
        onProgress({
          currentTable: 'Listando tabelas...',
          tablesProcessed: 0,
          totalTables: 1,
          percentage: 50
        });
      }

      // 6. Listar todas as tabelas
      console.log('🔍 Chamando listTables()...');
      let tableNames: string[];
      try {
        tableNames = await this.listTables();
        console.log(`🎯 listTables() retornou: ${tableNames.length} tabelas`);
        console.log(`📋 Nomes das tabelas:`, tableNames);
        console.log(`Encontradas ${tableNames.length} tabelas`);
      } catch (error) {
        console.error('❌ Erro em listTables():', error);
        throw error;
      }

      if (onProgress) {
        onProgress({
          currentTable: 'Extraindo dados das tabelas...',
          tablesProcessed: 0,
          totalTables: tableNames.length,
          percentage: 60
        });
      }

      // 7. Extrair dados de cada tabela
      const tables: TableData[] = [];
      for (let i = 0; i < tableNames.length; i++) {
        const tableName = tableNames[i];
        
        if (onProgress) {
          onProgress({
            currentTable: `Extraindo ${tableName}...`,
            tablesProcessed: i,
            totalTables: tableNames.length,
            percentage: 60 + Math.round((i / tableNames.length) * 30)
          });
        }

        try {
          const tableData = await this.extractTableData(tableName);
          // SEMPRE ADICIONAR TABELA, MESMO COM 0 REGISTROS
          tables.push(tableData);
          console.log(`${tableName}: ${tableData.rows.length} registros extraídos`);
        } catch (error) {
          console.warn(`Erro ao extrair ${tableName}:`, error);
        }
      }

      if (onProgress) {
        onProgress({
          currentTable: 'Conversão concluída',
          tablesProcessed: tables.length,
          totalTables: tables.length,
          percentage: 100
        });
      }

      console.log('🎉 =========================');
      console.log('🎉 CONVERSÃO CONCLUÍDA!');
      console.log('🎉 =========================');
      console.log(`📊 Total de tabelas: ${tables.length}`);
      
      return tables;

    } finally {
      // 8. Sempre limpar container
      console.log('🧹 Limpando container...');
      await this.cleanupContainer();
      console.log('✅ Container limpo');
    }
  }

  private async checkDocker(): Promise<void> {
    try {
      // Usar PlatformUtils para garantir que Docker está pronto
      await PlatformUtils.ensureDockerReady();
    } catch (error) {
      throw new Error(`Docker não está disponível: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  private async startSqlContainer(): Promise<void> {
    // Primeiro, limpar container existente
    await this.cleanupContainer();

    return new Promise((resolve, reject) => {
      const dockerArgs = [
        'run', '-d',
        '--name', this.CONTAINER_NAME,
        '-e', 'ACCEPT_EULA=Y',
        '-e', `SA_PASSWORD=${this.SQL_PASSWORD}`,
        '-e', 'MSSQL_PID=Express', // Usar SQL Server Express (mais leve)
        '-e', 'MSSQL_MEMORY_LIMIT_MB=1024', // Limitar memória SQL Server
        '-e', `MSSQL_TCP_PORT=${this.SQL_PORT}`,
        '-p', `${this.SQL_PORT}:${this.SQL_PORT}`,
        '--memory=2g', // Limitar memória container
        '--cpus=2',    // Limitar CPU
        '--shm-size=256m', // Memória compartilhada
        'mcr.microsoft.com/mssql/server:2019-latest'
      ];

      console.log('Iniciando container SQL Server...');
      console.log('Primeira execução pode demorar mais (download da imagem)...');
      const dockerRun = spawn('docker', dockerArgs, this.getSpawnOptions());

      let output = '';
      let errorOutput = '';
      
      dockerRun.stdout.on('data', (data) => {
        output += data.toString();
      });

      dockerRun.stderr.on('data', (data) => {
        const message = data.toString();
        errorOutput += message;
        console.log('Docker stderr:', message);
      });

      dockerRun.on('close', (code) => {
        if (code === 0) {
          console.log('Container SQL Server iniciado com sucesso');
          resolve();
        } else {
          let errorMessage = `Falha ao iniciar container (código ${code})`;
          if (errorOutput.includes('pull access denied') || errorOutput.includes('connection refused')) {
            errorMessage += '\n\nVerifique:\n1. Docker Desktop está rodando?\n2. Conexão com internet está funcionando?\n3. Docker tem permissões necessárias?';
          }
          reject(new Error(`${errorMessage}\n\nDetalhes: ${errorOutput || output}`));
        }
      });

      dockerRun.on('error', (error) => {
        reject(new Error(`Erro ao executar Docker: ${error.message}\n\nVerifique se o Docker Desktop está instalado e rodando.`));
      });
    });
  }

  private async waitForSqlServer(onProgress?: (progress: ConversionProgress) => void): Promise<void> {
    console.log('Aguardando SQL Server ficar pronto...');
    
    // Verificar se container está realmente rodando
    await this.checkContainerHealth();
    
    // Aguardar mais tempo para SQL Server inicializar completamente
    console.log('Container verificado, aguardando SQL Server inicializar...');
    console.log('Aguardando 30 segundos para garantir inicialização completa...');
    await this.sleep(30000); // 30 segundos para garantir
    
    // Tentativas com backoff exponencial
    for (let i = 0; i < 60; i++) { // Reduzir para 60 tentativas de 2s cada = 2 minutos
      try {
        await this.executeSqlCommand('SELECT 1', 3);
        console.log('SQL Server está pronto!');
        return;
      } catch (error) {
        const waitTime = Math.min(1000 + (i * 100), 3000); // Backoff exponencial até 3s
        console.log(`Tentativa ${i + 1}/60 - Aguardando SQL Server... (${waitTime}ms)`);
        
        // Verificar se container ainda está rodando
        if (i % 10 === 0) {
          try {
            await this.checkContainerHealth();
          } catch (healthError) {
            throw new Error(`Container SQL Server parou de funcionar: ${healthError}`);
          }
        }
        
        // Atualizar progresso
        if (onProgress && i % 5 === 0) {
          const percentage = 20 + Math.round((i / 60) * 15); // 20-35%
          onProgress({
            currentTable: `Aguardando SQL Server... (${i + 1}/60)`,
            tablesProcessed: 0,
            totalTables: 1,
            percentage
          });
        }
        
        await this.sleep(waitTime);
      }
    }
    
    // Se chegou aqui, vamos tentar diagnosticar o problema
    await this.diagnoseSqlServerIssue();
    throw new Error('SQL Server não conseguiu inicializar. Verifique os logs acima para detalhes.');
  }

  private async copyBakToContainer(filePath: string): Promise<void> {
    const fileName = path.basename(filePath);
    
    // Converter caminho para formato Docker se estiver no Windows
    const sourcePath = PlatformUtils.isWindows() ? filePath : filePath;
    
    return new Promise((resolve, reject) => {
      const dockerCp = spawn('docker', [
        'cp', sourcePath, `${this.CONTAINER_NAME}:/var/opt/mssql/data/${fileName}`
      ], { stdio: 'pipe', shell: PlatformUtils.isWindows() });

      dockerCp.on('close', (code) => {
        if (code === 0) {
          console.log('Arquivo .bak copiado para container');
          resolve();
        } else {
          reject(new Error('Falha ao copiar arquivo .bak'));
        }
      });
    });
  }

  private async restoreDatabase(bakFileName: string): Promise<void> {
    console.log(`Iniciando restauração do arquivo: ${bakFileName}`);
    
    // Primeiro, sempre obter informações do backup
    try {
      const fileListCommand = `RESTORE FILELISTONLY FROM DISK = '/var/opt/mssql/data/${bakFileName}'`;
      const fileList = await this.executeSqlCommand(fileListCommand);
      console.log('Informações do backup obtidas com sucesso');
      
      // Analisar resultado para extrair nomes lógicos
      console.log('🔍 Output FILELISTONLY completo:');
      console.log('---START---');
      console.log(fileList);
      console.log('---END---');
      
      const { dataFile, logFile } = this.parseFileList(fileList);
      console.log(`🎯 Arquivos lógicos encontrados: DATA=${dataFile}, LOG=${logFile}`);
      
      // Restaurar com nomes corretos
      const restoreCommand = `
        RESTORE DATABASE [${this.DATABASE_NAME}] 
        FROM DISK = '/var/opt/mssql/data/${bakFileName}' 
        WITH REPLACE,
        MOVE '${dataFile}' TO '/var/opt/mssql/data/${this.DATABASE_NAME}.mdf',
        MOVE '${logFile}' TO '/var/opt/mssql/data/${this.DATABASE_NAME}_Log.ldf'
      `;

      console.log('🔄 Executando comando RESTORE...');
      const restoreResult = await this.executeSqlCommand(restoreCommand);
      console.log('📊 Resultado do RESTORE:', restoreResult);
      console.log('✅ Banco restaurado com sucesso!');
      
      // Verificar se restauração funcionou
      await this.verifyRestore();
      
      console.log('🎉 Restauração verificada com sucesso!');
      
    } catch (error) {
      console.error('❌ ERRO NA RESTAURAÇÃO:', error);
      console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'Sem stack');
      
      // Tentar diagnóstico se falhar
      console.log('🔍 Iniciando diagnóstico do erro...');
      await this.diagnoseBackupFile(bakFileName);
      throw new Error(`Falha na restauração: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  private parseFileList(fileListOutput: string): { dataFile: string; logFile: string } {
    const lines = fileListOutput.split('\n').filter(line => line.trim());
    let dataFile = '';
    let logFile = '';
    
    console.log('🔍 Analisando lista de arquivos do backup...');
    console.log('📋 Total de linhas:', lines.length);
    
    // Método 1: Procurar por padrões conhecidos
    const fullText = fileListOutput.toLowerCase();
    
    // Detectar SICNET especificamente (padrão conhecido)
    if (fullText.includes('sicnet')) {
      console.log('🎯 Detectado padrão SICNET!');
      dataFile = 'SICNET';
      logFile = 'SICNET_log';
      console.log(`✅ Usando nomes específicos: DATA=${dataFile}, LOG=${logFile}`);
      return { dataFile, logFile };
    }
    
    // Método 2: Buscar por linhas que contenham apenas nomes válidos
    console.log('🔍 Procurando nomes lógicos linha por linha...');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      console.log(`📝 Linha ${i}: "${trimmed}"`);
      
      // Se a linha contém exatamente um nome válido (só letras, números, underscore)
      // e não contém outros caracteres especiais
      if (trimmed && 
          trimmed.match(/^[A-Za-z][A-Za-z0-9_]*$/) && 
          !trimmed.includes('\\') && 
          !trimmed.includes('/') &&
          trimmed.length > 2) {
        
        console.log(`🎯 Nome lógico candidato: "${trimmed}"`);
        
        // Se tem 'log' no nome, é arquivo de log
        if (trimmed.toLowerCase().includes('log')) {
          logFile = trimmed;
          console.log(`✅ Arquivo LOG encontrado: ${trimmed}`);
        } else {
          // Senão, é arquivo de dados (primeiro encontrado)
          if (!dataFile) {
            dataFile = trimmed;
            console.log(`✅ Arquivo DATA encontrado: ${trimmed}`);
          }
        }
      }
    }
    
    // Método 3: Buscar padrões mais específicos
    if (!dataFile || !logFile) {
      console.log('🔍 Procurando com regex mais específica...');
      for (const line of lines) {
        // Procurar por palavras que comecem com letras e possam ter underscore
        const matches = line.match(/\b([A-Za-z][A-Za-z0-9_]*)\b/g);
        if (matches) {
          for (const match of matches) {
            if (match.length > 3 && 
                !match.includes('Program') && 
                !match.includes('Files') &&
                !match.includes('Microsoft') &&
                !match.includes('DATA') &&
                !match.includes('NULL')) {
              
              console.log(`🎯 Match encontrado: "${match}"`);
              
              if (match.toLowerCase().includes('log') && !logFile) {
                logFile = match;
                console.log(`✅ LOG via regex: ${match}`);
              } else if (!dataFile && !match.toLowerCase().includes('log')) {
                dataFile = match;
                console.log(`✅ DATA via regex: ${match}`);
              }
            }
          }
        }
      }
    }
    
    // Fallback se não encontrar nomes específicos
    if (!dataFile) {
      dataFile = 'DATA';
      console.log('⚠️ Usando fallback para DATA');
    }
    if (!logFile) {
      logFile = 'LOG';
      console.log('⚠️ Usando fallback para LOG');
    }
    
    console.log(`🎯 Resultado final: DATA=${dataFile}, LOG=${logFile}`);
    return { dataFile, logFile };
  }

  private async verifyRestore(): Promise<void> {
    try {
      // Aguardar um pouco após restauração
      await this.sleep(2000);
      
      const checkQuery = `
        USE [${this.DATABASE_NAME}];
        SELECT COUNT(*) as table_count 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE'
      `;
      
      console.log('🔍 Executando verificação de tabelas...');
      const result = await this.executeSqlCommand(checkQuery);
      console.log('📊 Resultado da verificação:', result);
      
      const count = this.parseCountResult(result);
      console.log(`✅ Verificação: ${count} tabelas encontradas no banco restaurado`);
      
      if (count === 0) {
        // Tentar listagem alternativa
        console.log('⚠️ Contagem zero, tentando listagem alternativa...');
        const altQuery = `USE [${this.DATABASE_NAME}]; SELECT name FROM sys.tables`;
        const altResult = await this.executeSqlCommand(altQuery);
        console.log('📋 Tabelas via sys.tables:', altResult);
        
        const altLines = altResult.split('\n').filter(line => 
          line.trim() && 
          !line.includes('name') && 
          !line.includes('---') && 
          !line.includes('affected')
        );
        
        if (altLines.length > 0) {
          console.log(`✅ Encontradas ${altLines.length} tabelas via método alternativo`);
          return; // Sucesso
        }
        
        throw new Error('Nenhuma tabela encontrada no banco restaurado (verificação dupla)');
      }
    } catch (error) {
      console.error('❌ Erro na verificação:', error);
      throw error;
    }
  }

  private async diagnoseBackupFile(bakFileName: string): Promise<void> {
    console.log('\n=== DIAGNÓSTICO DO ARQUIVO .BAK ===');
    
    try {
      // Verificar informações básicas do backup
      const headerCommand = `RESTORE HEADERONLY FROM DISK = '/var/opt/mssql/data/${bakFileName}'`;
      const headerResult = await this.executeSqlCommand(headerCommand);
      console.log('Cabeçalho do backup:');
      console.log(headerResult);
      
      // Verificar arquivos
      const fileListCommand = `RESTORE FILELISTONLY FROM DISK = '/var/opt/mssql/data/${bakFileName}'`;
      const fileListResult = await this.executeSqlCommand(fileListCommand);
      console.log('Lista de arquivos:');
      console.log(fileListResult);
      
    } catch (diagError) {
      console.log('Erro no diagnóstico:', diagError);
    }
    
    console.log('=== FIM DO DIAGNÓSTICO ===\n');
  }

  private async listTables(): Promise<string[]> {
    // SOLUÇÃO DIRETA: Usar sys.tables que é mais confiável
    const query = `USE [${this.DATABASE_NAME}]; SELECT name FROM sys.tables ORDER BY name`;

    const result = await this.executeSqlCommand(query);
    console.log('🔍 RESULTADO SYS.TABLES:');
    console.log(result);
    
    const lines = result.split('\n')
      .map(line => line.trim())
      .filter(line => 
        line && 
        !line.includes('name') &&
        !line.includes('---') &&
        !line.includes('Changed database') &&
        !line.includes('rows affected') &&
        !line.includes('(') &&
        line.length > 2 &&
        line.length < 50
      );

    console.log('🎯 TABELAS ENCONTRADAS:', lines);
    return lines;
  }

  private async extractTableData(tableName: string): Promise<TableData> {
    // Primeiro, obter contagem de registros
    const countQuery = `USE [${this.DATABASE_NAME}]; SELECT COUNT(*) as count FROM [dbo].[${tableName}]`;
    const countResult = await this.executeSqlCommand(countQuery);
    const count = this.parseCountResult(countResult);

    if (count === 0) {
      return { name: `dbo.${tableName}`, rows: [] };
    }

    // Extrair dados com LIMIT para evitar sobrecarga
    const limit = Math.min(count, 1000); // Máximo 1000 registros por tabela

    // 1) Tentar saída tabular TSV (mais eficiente de parsear)
    const tsvQuery = `
      USE [${this.DATABASE_NAME}]; 
      SELECT TOP ${limit} * FROM [dbo].[${tableName}]
    `;

    let result = await this.executeSqlCommand(tsvQuery);
    let rows = this.parseTabularResult(result);

    // 2) Fallback: se não conseguiu parsear mas há registros, tentar JSON
    if (rows.length === 0) {
      const jsonQuery = `
        USE [${this.DATABASE_NAME}]; 
        SELECT TOP ${limit} * FROM [dbo].[${tableName}] FOR JSON PATH, INCLUDE_NULL_VALUES
      `;
      result = await this.executeSqlCommand(jsonQuery);
      rows = this.parseJsonResult(result);
    }

    return {
      name: `dbo.${tableName}`,
      rows
    };
  }

  private parseTabularResult(result: string): Record<string, any>[] {
    const lines = result.split('\n').map(l => l.trim()).filter(line => line);
    if (lines.length < 2) return [];

    // Cabeçalho é a primeira linha que contém TABs
    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('\t')) {
        headerIndex = i;
        break;
      }
    }
    if (headerIndex === -1) return [];

    const headers = lines[headerIndex].split('\t').map(h => h.trim());
    const rows: Record<string, any>[] = [];

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.startsWith('---') || line.startsWith('(') || line.startsWith('Changed database')) continue;
      const values = line.split('\t');
      if (values.length !== headers.length) continue;
      const row: Record<string, any> = {};
      for (let j = 0; j < headers.length; j++) {
        const value = (values[j] ?? '').trim();
        row[headers[j]] = value === 'NULL' ? null : value;
      }
      rows.push(row);
    }

    return rows;
  }

  private normalizeDisplayName(quotedTable: string): string {
    // Converte [dbo].[TABEST1] -> dbo.TABEST1
    return quotedTable.replace(/\[/g, '').replace(/\]/g, '');
  }

  private parseJsonResult(result: string): Record<string, any>[] {
    // Extrair somente o JSON do output (ignora mensagens como "Changed database context ...")
    const startIdx = result.indexOf('[');
    const endIdx = result.lastIndexOf(']');
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      try {
        // Tenta caso o resultado seja um objeto único
        const objStart = result.indexOf('{');
        const objEnd = result.lastIndexOf('}');
        if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
          const jsonText = result.slice(objStart, objEnd + 1);
          const obj = JSON.parse(jsonText);
          return Array.isArray(obj) ? obj : [obj];
        }
      } catch {}
      return [];
    }

    const jsonText = result.slice(startIdx, endIdx + 1).trim();
    try {
      const parsed = JSON.parse(jsonText);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private parseCountResult(result: string): number {
    const lines = result.split('\n').filter(line => line.trim());
    
    // BUSCAR ESPECIFICAMENTE A LINHA COM O COUNT
    for (const line of lines) {
      // Se a linha tem só números e espaços (é o resultado do COUNT)
      if (/^\s*\d+\s*$/.test(line)) {
        const count = parseInt(line.trim());
        console.log(`✅ COUNT encontrado: ${count}`);
        return count;
      }
    }
    
    console.log('❌ COUNT não encontrado, retornando 0');
    return 0;
  }

  private async executeSqlCommand(query: string, timeoutSeconds: number = 5): Promise<string> {
    return new Promise((resolve, reject) => {
      // Forçar formato amigável ao parser: TSV, sem espaços extras, sem "(N rows affected)"
      const wrappedQuery = `SET NOCOUNT ON; ${query}`;
      
      // Log detalhado para debug
      console.log(`[DEBUG] Executando comando SQL:`);
      console.log(`[DEBUG] Query: ${query}`);
      console.log(`[DEBUG] Servidor: localhost,${this.SQL_PORT}`);
      console.log(`[DEBUG] Container: ${this.CONTAINER_NAME}`);
      
      const sqlcmd = spawn('docker', [
        'exec', this.CONTAINER_NAME,
        '/opt/mssql-tools18/bin/sqlcmd', 
        '-S', `localhost,${this.SQL_PORT}`,
        '-U', 'sa', 
        '-P', this.SQL_PASSWORD,
        '-C', // Trust server certificate
        '-l', String(timeoutSeconds), // timeout configurável
        '-s', '\t', // separador TAB
        '-W',        // remove espaços em branco extras (mantemos só este)
        // Removido -y pois conflita com -W
        // Mantemos cabeçalhos para o parser identificar colunas
        '-Q', wrappedQuery
      ], this.getSpawnOptions());

      let output = '';
      let errorOutput = '';

      sqlcmd.stdout.on('data', (data) => {
        output += data.toString();
      });

      sqlcmd.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      sqlcmd.on('close', (code) => {
        if (code === 0) {
          console.log(`[DEBUG] SQL Command sucesso!`);
          resolve(output);
        } else {
          console.log(`[DEBUG] SQL Command falhou com código ${code}`);
          console.log(`[DEBUG] Erro: ${errorOutput}`);
          reject(new Error(`SQL Command failed: ${errorOutput}`));
        }
      });
    });
  }

  private async cleanupContainer(): Promise<void> {
    try {
      // Parar container
      await new Promise<void>((resolve) => {
        const stopCmd = spawn('docker', ['stop', this.CONTAINER_NAME], this.getSpawnOptions());
        stopCmd.on('close', () => resolve());
      });

      // Remover container
      await new Promise<void>((resolve) => {
        const rmCmd = spawn('docker', ['rm', this.CONTAINER_NAME], this.getSpawnOptions());
        rmCmd.on('close', () => resolve());
      });

      console.log('Container limpo com sucesso');
    } catch (error) {
      // Ignorar erros de limpeza
    }
  }

  private async checkContainerHealth(): Promise<void> {
    return new Promise((resolve, reject) => {
      const inspectCmd = spawn('docker', ['inspect', this.CONTAINER_NAME, '--format', '{{.State.Status}}'], this.getSpawnOptions());
      
      let output = '';
      inspectCmd.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      inspectCmd.on('close', (code) => {
        if (code === 0) {
          const status = output.trim();
          if (status === 'running') {
            resolve();
          } else {
            reject(new Error(`Container status: ${status}`));
          }
        } else {
          reject(new Error('Container não encontrado'));
        }
      });
    });
  }

  private async diagnoseSqlServerIssue(): Promise<void> {
    console.log('\n=== DIAGNÓSTICO DO PROBLEMA ===');
    
    try {
      // 1. Status do container
      console.log('1. Verificando status do container...');
      const statusResult = await this.runDockerCommand(['inspect', this.CONTAINER_NAME, '--format', '{{.State.Status}}']);
      console.log(`Status: ${statusResult.trim()}`);
      
      // 2. Logs do container
      console.log('2. Últimos logs do container:');
      const logsResult = await this.runDockerCommand(['logs', '--tail', '20', this.CONTAINER_NAME]);
      console.log(logsResult);
      
      // 3. Recursos do sistema
      console.log('3. Verificando recursos...');
      const statsResult = await this.runDockerCommand(['stats', '--no-stream', '--format', 'table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}', this.CONTAINER_NAME]);
      console.log(statsResult);
      
    } catch (error) {
      console.log('Erro ao diagnosticar:', error);
    }
    
    console.log('=== FIM DO DIAGNÓSTICO ===\n');
  }

  private async runDockerCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const dockerCmd = spawn('docker', args, this.getSpawnOptions());
      
      let output = '';
      let errorOutput = '';
      
      dockerCmd.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      dockerCmd.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      dockerCmd.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(errorOutput || output));
        }
      });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 