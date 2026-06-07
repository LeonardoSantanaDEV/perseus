import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import AdmZip from 'adm-zip';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

interface BotManifest {
  name?: string;
  version?: string;
  tech?: string;
  pythonVersion?: string;
  entrypoint?: string;
  params?: unknown;
}

@Injectable()
export class BotVersionsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  private parseManifest(buffer: Buffer): BotManifest {
    try {
      const zip = new AdmZip(buffer);
      const entry =
        zip.getEntry('bot.json') ||
        zip.getEntries().find((e) => e.entryName.endsWith('bot.json'));
      if (!entry) return {};
      return JSON.parse(entry.getData().toString('utf-8')) as BotManifest;
    } catch {
      throw new BadRequestException('Pacote .zip inválido ou corrompido');
    }
  }

  private hasEntrypoint(buffer: Buffer, entrypoint: string): boolean {
    try {
      const zip = new AdmZip(buffer);
      return zip
        .getEntries()
        .some((e) => e.entryName === entrypoint || e.entryName.endsWith('/' + entrypoint));
    } catch {
      return false;
    }
  }

  async listForAutomation(workspaceId: string, automationId: string) {
    await this.assertAutomation(workspaceId, automationId);
    return this.prisma.botVersion.findMany({
      where: { automationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upload(
    workspaceId: string,
    automationId: string,
    file: Express.Multer.File,
    body: { version?: string; releaseVersion?: string },
  ) {
    await this.assertAutomation(workspaceId, automationId);
    if (!file) throw new BadRequestException('Arquivo .zip é obrigatório');
    if (!file.originalname.toLowerCase().endsWith('.zip')) {
      throw new BadRequestException('O pacote deve ser um arquivo .zip');
    }

    const manifest = this.parseManifest(file.buffer);
    const version = body.version || manifest.version;
    if (!version) {
      throw new BadRequestException(
        'Versão obrigatória (informe no formulário ou no bot.json)',
      );
    }
    const entrypoint = manifest.entrypoint || 'main.py';
    if (!this.hasEntrypoint(file.buffer, entrypoint)) {
      throw new BadRequestException(
        `Entrypoint "${entrypoint}" não encontrado no pacote`,
      );
    }

    const existing = await this.prisma.botVersion.findUnique({
      where: { automationId_version: { automationId, version } },
    });
    if (existing) {
      throw new BadRequestException(`Versão ${version} já existe`);
    }

    const storageKey = `packages/${automationId}/${version}/${Date.now()}-${file.originalname}`;
    await this.storage.upload(
      this.storage.packagesBucket,
      storageKey,
      file.buffer,
      'application/zip',
    );

    return this.prisma.botVersion.create({
      data: {
        automationId,
        version,
        releaseVersion: body.releaseVersion,
        tech: manifest.tech || 'python',
        pythonVersion: manifest.pythonVersion,
        entrypoint,
        storageKey,
        manifest: manifest as object,
      },
    });
  }

  async remove(workspaceId: string, automationId: string, versionId: string) {
    await this.assertAutomation(workspaceId, automationId);
    const version = await this.prisma.botVersion.findFirst({
      where: { id: versionId, automationId },
    });
    if (!version) throw new NotFoundException('Versão não encontrada');
    await this.storage
      .delete(this.storage.packagesBucket, version.storageKey)
      .catch(() => undefined);
    await this.prisma.botVersion.delete({ where: { id: versionId } });
    return { ok: true };
  }

  private async assertAutomation(workspaceId: string, automationId: string) {
    const automation = await this.prisma.automation.findFirst({
      where: { id: automationId, workspaceId },
    });
    if (!automation) throw new NotFoundException('Automação não encontrada');
    return automation;
  }
}
