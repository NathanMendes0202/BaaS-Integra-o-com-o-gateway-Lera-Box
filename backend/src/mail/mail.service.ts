import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const user = config.get<string>('SMTP_USER');
    this.from = config.get<string>('MAIL_FROM', 'BaaS <no-reply@localhost>');
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: Number(config.get<string>('SMTP_PORT', '587')),
          secure: config.get<string>('SMTP_SECURE', 'false') === 'true',
          auth: user ? { user, pass: config.get<string>('SMTP_PASS', '') } : undefined,
        })
      : null;
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transporter) {
      throw new ServiceUnavailableException('Envio de e-mail não configurado. Defina SMTP_HOST (e demais SMTP_*) no .env.');
    }
    try {
      await this.transporter.sendMail({ from: this.from, ...message });
    } catch (err) {
      this.logger.error(`Falha ao enviar e-mail: ${(err as Error).message}`);
      throw new BadGatewayException('Não foi possível enviar o e-mail. Confira a configuração SMTP.');
    }
  }
}
