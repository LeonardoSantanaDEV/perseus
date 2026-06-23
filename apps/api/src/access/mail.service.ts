import { Injectable, Logger } from '@nestjs/common';

/**
 * Envio de e-mail transacional. Em produção usa SMTP (nodemailer) lendo as
 * variáveis SMTP_*. Em desenvolvimento, quando SMTP_HOST não está definido,
 * apenas registra o link no log e o devolve na resposta (fallback dev), sem
 * exigir um servidor de e-mail.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  get appUrl(): string {
    // Preferência: APP_URL. Sem ele, usa a 1ª origem de WEB_ORIGIN (já apontada
    // para o front, evitando links com host/porta errados no convite/reenvio).
    const fromEnv = process.env.APP_URL?.trim();
    if (fromEnv) return fromEnv.replace(/\/$/, '');
    const webOrigin = (process.env.WEB_ORIGIN || 'http://localhost:5173')
      .split(',')[0]
      .trim();
    return webOrigin.replace(/\/$/, '');
  }

  /** Monta o link público de confirmação a partir do token em texto puro. */
  confirmationLink(rawToken: string): string {
    return `${this.appUrl}/confirmar?token=${encodeURIComponent(rawToken)}`;
  }

  async sendConfirmation(
    to: string,
    link: string,
    name?: string | null,
  ): Promise<{ sent: boolean; link: string }> {
    const host = process.env.SMTP_HOST;
    if (!host) {
      this.logger.warn(
        `[DEV] SMTP não configurado. Link de confirmação para ${to}: ${link}`,
      );
      return { sent: false, link };
    }

    try {
      // require dinâmico: o pacote só é necessário quando há SMTP configurado,
      // e isso evita acoplar o build à presença da dependência em dev.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const nodemailer = require('nodemailer');
      const transport = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });

      const greeting = name ? `Olá, ${name}` : 'Olá';
      await transport.sendMail({
        from: process.env.SMTP_FROM || 'Perseus <no-reply@perseus.local>',
        to,
        subject: 'Confirme seu acesso ao Perseus',
        text: `${greeting}!\n\nVocê recebeu acesso ao Perseus. Confirme seu e-mail e defina sua senha no link abaixo:\n\n${link}\n\nSe você não esperava este convite, ignore esta mensagem.`,
        html: `<p>${greeting}!</p><p>Você recebeu acesso ao <strong>Perseus</strong>. Confirme seu e-mail e defina sua senha:</p><p><a href="${link}">Confirmar acesso e definir senha</a></p><p style="color:#64748b;font-size:12px">Se você não esperava este convite, ignore esta mensagem.</p>`,
      });
      this.logger.log(`E-mail de confirmação enviado para ${to}`);
      return { sent: true, link };
    } catch (err) {
      this.logger.error(
        `Falha ao enviar e-mail para ${to}: ${err}. Link: ${link}`,
      );
      return { sent: false, link };
    }
  }
}
