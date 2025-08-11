import { exec, spawn } from "child_process";
import * as path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

export class PlatformUtils {
  static isWindows(): boolean {
    return process.platform === "win32";
  }

  static isLinux(): boolean {
    return process.platform === "linux";
  }

  static isMac(): boolean {
    return process.platform === "darwin";
  }

  static getDockerCommand(): string {
    return "docker"; // Funciona em todos os SOs quando Docker está no PATH
  }

  static async isDockerInstalled(): Promise<boolean> {
    try {
      const command = this.isWindows()
        ? "docker --version"
        : "docker --version";

      await execAsync(command);
      return true;
    } catch {
      return false;
    }
  }

  static async isDockerRunning(): Promise<boolean> {
    try {
      const command = this.isWindows() ? "docker info" : "docker info";

      await execAsync(command);
      return true;
    } catch {
      return false;
    }
  }

  static async installDockerWindows(): Promise<boolean> {
    return new Promise((resolve) => {
      console.log("Tentando instalar Docker Desktop via winget...");

      // Primeiro verificar se winget está disponível
      exec("winget --version", (error) => {
        if (error) {
          console.error(
            "Winget não está disponível. Por favor, instale o Docker Desktop manualmente."
          );
          console.error(
            "Download: https://www.docker.com/products/docker-desktop/"
          );
          resolve(false);
          return;
        }

        // Instalar Docker Desktop via winget
        const installProcess = spawn(
          "cmd",
          [
            "/c",
            "winget",
            "install",
            "-e",
            "--id",
            "Docker.DockerDesktop",
            "--accept-package-agreements",
            "--accept-source-agreements",
          ],
          {
            stdio: "inherit",
            shell: true,
          }
        );

        installProcess.on("close", (code) => {
          if (code === 0) {
            console.log("Docker Desktop instalado com sucesso!");
            console.log(
              "Por favor, reinicie o computador e inicie o Docker Desktop."
            );
            resolve(true);
          } else {
            console.error("Falha ao instalar Docker Desktop.");
            console.error(
              "Por favor, instale manualmente: https://www.docker.com/products/docker-desktop/"
            );
            resolve(false);
          }
        });

        installProcess.on("error", (err) => {
          console.error("Erro ao instalar Docker:", err);
          resolve(false);
        });
      });
    });
  }

  static async startDockerWindows(): Promise<boolean> {
    try {
      console.log("Tentando iniciar Docker Desktop...");

      // Tentar iniciar Docker Desktop
      const dockerPath = path.join(
        process.env.PROGRAMFILES || "C:\\Program Files",
        "Docker",
        "Docker",
        "Docker Desktop.exe"
      );

      exec(`start "" "${dockerPath}"`, (error) => {
        if (error) {
          console.error(
            "Não foi possível iniciar Docker Desktop automaticamente."
          );
          console.error("Por favor, inicie o Docker Desktop manualmente.");
          return false;
        }
      });

      // Aguardar Docker ficar pronto (máximo 2 minutos)
      console.log("Aguardando Docker Desktop inicializar...");
      for (let i = 0; i < 24; i++) {
        // 24 tentativas de 5 segundos = 2 minutos
        await this.sleep(5000);

        if (await this.isDockerRunning()) {
          console.log("Docker Desktop está pronto!");
          return true;
        }

        console.log(`Aguardando Docker... (${i + 1}/24)`);
      }

      console.error("Docker Desktop demorou muito para iniciar.");
      return false;
    } catch (error) {
      console.error("Erro ao iniciar Docker Desktop:", error);
      return false;
    }
  }

  static async ensureDockerReady(): Promise<boolean> {
    console.log("Verificando Docker...");

    // 1. Verificar se Docker está instalado
    if (!(await this.isDockerInstalled())) {
      console.log("Docker não está instalado.");

      if (this.isWindows()) {
        const installed = await this.installDockerWindows();
        if (!installed) {
          throw new Error(
            "Docker não pôde ser instalado. Por favor, instale manualmente."
          );
        }
        // Após instalação, precisa reiniciar
        throw new Error(
          "Docker foi instalado. Por favor, reinicie o computador e tente novamente."
        );
      } else {
        throw new Error(
          "Docker não está instalado. Por favor, instale o Docker Desktop."
        );
      }
    }

    // 2. Verificar se Docker está rodando
    if (!(await this.isDockerRunning())) {
      console.log("Docker não está rodando.");

      if (this.isWindows()) {
        const started = await this.startDockerWindows();
        if (!started) {
          throw new Error(
            "Docker Desktop não pôde ser iniciado. Por favor, inicie manualmente."
          );
        }
      } else {
        throw new Error(
          "Docker não está rodando. Por favor, inicie o Docker Desktop."
        );
      }
    }

    console.log("Docker está pronto!");
    return true;
  }

  static normalizePath(filePath: string): string {
    // Normalizar caminhos para funcionar em Windows e Linux
    if (this.isWindows()) {
      // Converter barras para o formato Windows
      return filePath.replace(/\//g, "\\");
    }
    return filePath;
  }

  static getDockerPath(filePath: string): string {
    // Converter caminho do Windows para formato Docker (Unix)
    if (this.isWindows()) {
      // C:\Users\... -> /c/Users/...
      return filePath
        .replace(/\\/g, "/")
        .replace(/^([A-Z]):/i, (match, drive) => `/${drive.toLowerCase()}`);
    }
    return filePath;
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static getShellCommand(): string {
    return this.isWindows() ? "cmd" : "sh";
  }

  static getShellArgs(command: string): string[] {
    return this.isWindows() ? ["/c", command] : ["-c", command];
  }
}
