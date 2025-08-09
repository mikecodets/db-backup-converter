# Configuração do Docker para DB Backup Converter

## 📋 Pré-requisitos

Este aplicativo utiliza **Docker + SQL Server** para restaurar arquivos `.bak` e extrair os dados. Isso permite trabalhar com arquivos de qualquer tamanho.

## 🐳 Instalação do Docker

### Windows
1. Baixe o **Docker Desktop** em: https://www.docker.com/products/docker-desktop/
2. Execute o instalador
3. Reinicie o computador se solicitado
4. Abra o Docker Desktop e aguarde ele inicializar completamente

### Linux (Ubuntu/Debian)
```bash
# Instalar Docker
sudo apt update
sudo apt install docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker

# Adicionar usuário ao grupo docker (logout/login necessário)
sudo usermod -aG docker $USER
```

### macOS
1. Baixe o **Docker Desktop** para Mac
2. Instale o arquivo `.dmg`
3. Abra o Docker Desktop

## ✅ Verificar Instalação

Abra um terminal/prompt e execute:
```bash
docker --version
```

Deve retornar algo como: `Docker version 20.x.x`

## 🚀 Primeiro Uso

1. **Inicie o Docker Desktop** (Windows/Mac) ou verifique se o serviço está rodando (Linux)
2. Abra o **DB Backup Converter**
3. Selecione seu arquivo `.bak`
4. O aplicativo automaticamente:
   - Baixa a imagem SQL Server (primeira vez apenas)
   - Cria um container temporário
   - Restaura o backup
   - Extrai os dados
   - Remove o container

## 🔧 Resolução de Problemas

### "Docker não encontrado"
- Certifique-se que o Docker Desktop está **rodando**
- Windows: Ícone do Docker na bandeja do sistema
- Reinicie o Docker Desktop se necessário

### "Permission denied" (Linux)
```bash
# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER
# Fazer logout e login novamente
```

### "Cannot connect to Docker daemon"
- Windows/Mac: Abra o Docker Desktop
- Linux: `sudo systemctl start docker`

### Primeira execução lenta
- É normal! O Docker está baixando a imagem SQL Server (~1GB)
- Execuções seguintes serão muito mais rápidas

## 💡 Dicas

- **Mantenha o Docker rodando** durante o uso do aplicativo
- A primeira conversão demora mais (download da imagem)
- O aplicativo limpa automaticamente os containers temporários
- Funciona com arquivos `.bak` de qualquer tamanho

## 🆘 Suporte

### Diagnóstico Rápido
Abra um terminal/prompt e execute estes comandos para diagnosticar:

```bash
# 1. Verificar se Docker está instalado
docker --version

# 2. Verificar se Docker daemon está rodando  
docker info

# 3. Testar funcionamento básico
docker run hello-world
```

### Problemas Comuns

**"SQL Server não ficou pronto a tempo"**
- **Causa**: Docker demorou para inicializar (normal na primeira vez)
- **Solução**: Aguarde mais tempo ou reinicie o Docker Desktop
- **Primeira vez**: Download da imagem SQL Server (~1GB) demora mais

**"Docker não encontrado"**
- **Causa**: Docker não está instalado ou não está no PATH
- **Solução**: Instale Docker Desktop e reinicie o sistema

**"Cannot connect to Docker daemon"**
- **Causa**: Docker Desktop não está rodando
- **Solução**: Abra Docker Desktop e aguarde ele inicializar

**"Permission denied" (Linux)**
- **Causa**: Usuário não está no grupo docker
- **Solução**: 
  ```bash
  sudo usermod -aG docker $USER
  # Fazer logout e login novamente
  ```

### Se Nada Funcionar
1. Reinicie o Docker Desktop
2. Reinicie o computador
3. Verifique recursos: mínimo 4GB RAM livres
4. Verifique espaço em disco: mínimo 2GB livres 