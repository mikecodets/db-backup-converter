import { BrowserWindow, dialog, shell } from 'electron';
import { PlatformUtils } from '../utils/platformUtils';

export class DockerInstaller {
  static async checkAndInstall(parentWindow: BrowserWindow): Promise<boolean> {
    // Verificar se Docker está instalado
    if (await PlatformUtils.isDockerInstalled()) {
      // Verificar se está rodando
      if (await PlatformUtils.isDockerRunning()) {
        return true;
      }

      // Docker instalado mas não rodando
      const result = await dialog.showMessageBox(parentWindow, {
        type: 'warning',
        title: 'Docker Desktop não está rodando',
        message: 'O Docker Desktop está instalado mas não está em execução.',
        detail: 'Para converter arquivos .bak, o Docker Desktop precisa estar rodando.',
        buttons: ['Iniciar Docker', 'Cancelar'],
        defaultId: 0,
        cancelId: 1
      });

      if (result.response === 0) {
        if (PlatformUtils.isWindows()) {
          const started = await PlatformUtils.startDockerWindows();
          if (started) {
            await dialog.showMessageBox(parentWindow, {
              type: 'info',
              title: 'Docker Desktop Iniciado',
              message: 'Docker Desktop foi iniciado com sucesso!',
              buttons: ['OK']
            });
            return true;
          } else {
            await dialog.showMessageBox(parentWindow, {
              type: 'error',
              title: 'Erro ao Iniciar Docker',
              message: 'Não foi possível iniciar o Docker Desktop automaticamente.',
              detail: 'Por favor, inicie o Docker Desktop manualmente e tente novamente.',
              buttons: ['OK']
            });
            return false;
          }
        }
      }
      return false;
    }

    // Docker não instalado
    const result = await dialog.showMessageBox(parentWindow, {
      type: 'question',
      title: 'Docker Desktop não encontrado',
      message: 'O Docker Desktop não está instalado em seu computador.',
      detail: 'O DB Backup Converter precisa do Docker Desktop para funcionar. Deseja instalar agora?',
      buttons: ['Instalar Docker', 'Download Manual', 'Cancelar'],
      defaultId: 0,
      cancelId: 2
    });

    if (result.response === 0) {
      // Tentar instalar automaticamente
      if (PlatformUtils.isWindows()) {
        await dialog.showMessageBox(parentWindow, {
          type: 'info',
          title: 'Instalando Docker Desktop',
          message: 'A instalação do Docker Desktop será iniciada.',
          detail: 'Isso pode levar alguns minutos. Após a instalação, reinicie o computador.',
          buttons: ['OK']
        });

        const installed = await PlatformUtils.installDockerWindows();
        
        if (installed) {
          await dialog.showMessageBox(parentWindow, {
            type: 'info',
            title: 'Instalação Concluída',
            message: 'Docker Desktop foi instalado com sucesso!',
            detail: 'Por favor, reinicie o computador e execute o DB Backup Converter novamente.',
            buttons: ['OK']
          });
          return false; // Precisa reiniciar
        } else {
          await dialog.showMessageBox(parentWindow, {
            type: 'error',
            title: 'Erro na Instalação',
            message: 'Não foi possível instalar o Docker Desktop automaticamente.',
            detail: 'Por favor, faça o download manual no site oficial.',
            buttons: ['Abrir Site', 'Cancelar'],
            defaultId: 0
          });

          if (result.response === 0) {
            await shell.openExternal('https://www.docker.com/products/docker-desktop/');
          }
          return false;
        }
      }
    } else if (result.response === 1) {
      // Download manual
      await shell.openExternal('https://www.docker.com/products/docker-desktop/');
      
      await dialog.showMessageBox(parentWindow, {
        type: 'info',
        title: 'Download Manual',
        message: 'O site do Docker Desktop foi aberto em seu navegador.',
        detail: 'Após instalar o Docker Desktop, reinicie o computador e execute o DB Backup Converter novamente.',
        buttons: ['OK']
      });
      return false;
    }

    return false;
  }

  static async showDockerRequiredDialog(parentWindow: BrowserWindow): Promise<void> {
    const result = await dialog.showMessageBox(parentWindow, {
      type: 'info',
      title: 'Docker Desktop Necessário',
      message: 'O DB Backup Converter requer o Docker Desktop para funcionar.',
      detail: 'O Docker Desktop é uma ferramenta gratuita que permite executar containers. É necessário para processar arquivos .bak de qualquer tamanho.',
      buttons: ['Saber Mais', 'OK'],
      defaultId: 1
    });

    if (result.response === 0) {
      await shell.openExternal('https://www.docker.com/products/docker-desktop/');
    }
  }
} 