# DB Backup Converter

Aplicação desktop moderna e minimalista para conversão de arquivos `.bak` para CSV ou XLSX.

## Características

- **Interface Minimalista**: Design limpo e intuitivo com Tailwind CSS
- **Performance Otimizada**: Algoritmos com complexidade O(n) para processamento eficiente
- **Múltiplos Formatos**: Exportação em CSV ou XLSX
- **Barra de Progresso**: Acompanhamento em tempo real do processo de conversão
- **Tolerante a Erros**: Tratamento robusto de exceções
- **Cross-Platform**: Funciona em Windows, macOS e Linux

## Tecnologias

- **Electron** - Framework para aplicações desktop
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Framework CSS utilitário
- **Yarn** - Gerenciador de pacotes
- **Webpack** - Bundler para o frontend

## Como Usar

1. **Instalar dependências:**
   ```bash
   yarn install
   ```

2. **Executar em modo desenvolvimento:**
   ```bash
   yarn dev
   ```

3. **Compilar aplicação:**
   ```bash
   yarn build
   ```

4. **Executar aplicação compilada:**
   ```bash
   yarn start
   ```

## Funcionalidades

### Seleção de Arquivo
- Clique em "Escolher Arquivo" para selecionar um arquivo `.bak`
- O arquivo deve estar localizado na raiz do projeto

### Opções de Exportação
- **Formato**: CSV ou XLSX
- **Tipo**: Arquivos individuais ou pacote único

### Conversão
- Barra de progresso em tempo real
- Informações detalhadas sobre tabelas processadas
- Tratamento de erros com mensagens claras

### Resultados
- Abertura automática da pasta de destino
- Opção para converter outro arquivo
- Tentativa de nova conversão em caso de erro

## Estrutura do Projeto

```
src/
├── main/           # Processo principal do Electron
├── renderer/       # Interface do usuário
├── types/          # Definições TypeScript
└── utils/          # Utilitários (parser e exportador)
```

## Algoritmos

### Parser de .bak
- Complexidade: O(n) onde n é o tamanho do arquivo
- Suporte a múltiplos formatos de backup
- Processamento eficiente de memória

### Exportador
- Complexidade: O(n*m) onde n é o número de registros e m é o número de colunas
- Otimizado para grandes volumes de dados
- Sanitização automática de nomes de arquivos # db-backup-converter
