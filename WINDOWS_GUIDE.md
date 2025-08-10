# Guia do DB Backup Converter para Windows

## 🚀 Instalação Rápida

### Passo 1: Baixar o Instalador
1. Baixe o arquivo `DB Backup Converter Setup.exe` 
2. Execute o instalador como Administrador
3. Siga as instruções na tela

### Passo 2: Docker Desktop (Instalação Automática)
Na primeira execução, o programa verificará se você tem o Docker Desktop instalado:

- **Se não tiver Docker**: O programa oferecerá instalar automaticamente
- **Se tiver Docker parado**: O programa tentará iniciar automaticamente
- **Se tudo estiver OK**: Você pode começar a usar imediatamente

## 📋 Requisitos do Sistema

### Mínimos:
- Windows 10 64-bit: Pro, Enterprise ou Education (Build 19041 ou superior)
- Windows 11 64-bit
- 4 GB de RAM
- 10 GB de espaço em disco
- Virtualização habilitada na BIOS

### Recomendados:
- 8 GB de RAM ou mais
- SSD com 20 GB livres
- Processador com 4 núcleos ou mais

## 🐳 Sobre o Docker Desktop

O DB Backup Converter usa o Docker Desktop para processar arquivos .bak de forma segura e eficiente.

### Por que preciso do Docker?
- Permite processar arquivos .bak de qualquer tamanho
- Garante compatibilidade com diferentes versões do SQL Server
- Isola o processamento do seu sistema principal
- Não requer instalação do SQL Server

### Instalação Manual do Docker (se necessário)
1. Acesse: https://www.docker.com/products/docker-desktop/
2. Baixe "Docker Desktop for Windows"
3. Execute o instalador
4. Reinicie o computador
5. Inicie o Docker Desktop

## 🔧 Verificar Virtualização

### Como verificar se a virtualização está habilitada:
1. Abra o **Gerenciador de Tarefas** (Ctrl+Shift+Esc)
2. Vá para a aba **Desempenho**
3. Selecione **CPU**
4. Procure por **Virtualização: Habilitada**

### Se a virtualização estiver desabilitada:
1. Reinicie o computador
2. Entre na BIOS (geralmente F2, F10, DEL ou ESC durante o boot)
3. Procure por opções como:
   - Intel VT-x / Intel Virtualization Technology
   - AMD-V / SVM Mode
4. Habilite a virtualização
5. Salve e saia da BIOS

## 🎯 Como Usar

### 1. Iniciar o Programa
- Clique duas vezes no ícone do DB Backup Converter
- Aguarde a janela principal abrir

### 2. Verificação Automática do Docker
Na primeira execução:
- O programa verificará o Docker automaticamente
- Se necessário, oferecerá para instalar
- Após instalação, reinicie o computador

### 3. Converter Arquivo .bak
1. Clique em **"Escolher Arquivo"**
2. Selecione seu arquivo `.bak`
3. Clique em **"Converter para XLSX"**
4. Aguarde o processamento
5. Os arquivos Excel serão salvos em uma pasta com data/hora

### 4. Localizar Arquivos Convertidos
- Os arquivos são salvos em: `exports\NomeDoBackup_YYYYMMDD_HHMMSS\`
- Cada tabela do banco é exportada como um arquivo Excel separado
- Clique em **"Abrir Pasta"** para acessar os arquivos

## ❗ Solução de Problemas

### "Docker Desktop não está rodando"
1. Procure por "Docker Desktop" no menu Iniciar
2. Clique para abrir
3. Aguarde o ícone da baleia ficar estável na bandeja do sistema
4. Tente converter novamente

### "Virtualização não está habilitada"
- Siga as instruções na seção "Verificar Virtualização" acima
- Após habilitar, reinicie o computador

### "Erro ao conectar ao Docker"
1. Abra o PowerShell como Administrador
2. Execute: `docker --version`
3. Se der erro, reinstale o Docker Desktop
4. Se funcionar, execute: `docker run hello-world`

### "Arquivo .bak muito grande"
- O programa funciona com arquivos de qualquer tamanho
- Arquivos grandes (>1GB) podem demorar mais
- Certifique-se de ter espaço em disco suficiente (3x o tamanho do arquivo)

### "Conversão está demorando muito"
- Na primeira execução, o Docker baixa a imagem do SQL Server (~1GB)
- Execuções posteriores são mais rápidas
- Arquivos grandes podem levar vários minutos

## 🔐 Segurança

- Seus dados nunca saem do seu computador
- O processamento é feito localmente
- Nenhuma informação é enviada para a internet
- Os containers Docker são removidos após cada conversão

## 💡 Dicas de Performance

1. **Feche outros programas** durante a conversão
2. **Use SSD** ao invés de HD para melhor performance
3. **Aumente a memória do Docker**:
   - Abra Docker Desktop
   - Vá em Settings → Resources
   - Aumente Memory para 4GB ou mais
   - Clique em "Apply & Restart"

## 📞 Suporte

### Logs de Erro
Se encontrar problemas:
1. Os logs aparecem no console do programa
2. Tire uma captura de tela da mensagem de erro
3. Verifique o status do Docker Desktop

### Requisitos Especiais para Windows
- **Windows 10 Home**: Precisa do WSL 2 (instalado automaticamente)
- **Windows Server**: Requer configuração adicional
- **Máquinas Virtuais**: Precisam de virtualização aninhada

## 🔄 Atualizações

O programa verifica atualizações automaticamente. Quando disponível:
1. Você será notificado
2. Clique em "Baixar Atualização"
3. O instalador será baixado
4. Execute para atualizar

## ✅ Checklist de Instalação

- [ ] Windows 10/11 64-bit
- [ ] Virtualização habilitada na BIOS
- [ ] 4GB+ de RAM disponível
- [ ] 10GB+ de espaço em disco
- [ ] Docker Desktop instalado
- [ ] Docker Desktop rodando
- [ ] DB Backup Converter instalado

## 🎉 Pronto para Usar!

Após completar a instalação:
1. O DB Backup Converter está pronto
2. Docker será gerenciado automaticamente
3. Você pode converter arquivos .bak ilimitados
4. Cada conversão cria uma nova pasta com timestamp

---

**Versão**: 1.0.0  
**Compatibilidade**: Windows 10/11 64-bit  
**Licença**: MIT 