import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { CryptoService } from '../common/crypto.service';
import { GatewayAccount } from './gateway-account.entity';
import { GatewayClient } from './gateway.client';
import { GatewayError } from './gateway.error';

@Injectable()
export class GatewaySessionService {
  constructor(
    @InjectRepository(GatewayAccount) private readonly repo: Repository<GatewayAccount>,
    private readonly client: GatewayClient,
    private readonly crypto: CryptoService,
  ) {}

  findAccount(userId: string) {
    return this.repo.findOneBy({ userId });
  }

  async getAccount(userId: string): Promise<GatewayAccount> {
    const account = await this.findAccount(userId);
    if (!account) {
      throw new ConflictException('Conecte sua conta do gateway antes de continuar');
    }
    return account;
  }

  async connect(userId: string, document: string, password: string) {
    const login = await this.client.login(document, password);
    let account = await this.findAccount(userId);
    if (!account) {
      account = this.repo.create({
        userId,
        webhookToken: randomBytes(24).toString('hex'),
        encryptedWebhookSecret: this.crypto.encrypt(randomBytes(32).toString('hex')),
      });
    }
    account.document = document;
    account.clientCode = login.clientCode;
    account.storeKey = login.storeKey;
    account.encryptedPassword = this.crypto.encrypt(password);
    account.encryptedToken = this.crypto.encrypt(login.token);
    return this.repo.save(account);
  }

  async disconnect(userId: string) {
    await this.repo.delete({ userId });
  }

  /** Executa uma chamada autenticada no gateway, renovando o token se preciso. */
  async call<T>(userId: string, fn: (token: string) => Promise<T>): Promise<T> {
    const account = await this.getAccount(userId);
    let token = account.encryptedToken
      ? this.crypto.decrypt(account.encryptedToken)
      : await this.refresh(account);
    try {
      return await fn(token);
    } catch (err) {
      if (err instanceof GatewayError && err.gatewayStatus === 401) {
        token = await this.refresh(account);
        return fn(token);
      }
      throw err;
    }
  }

  private async refresh(account: GatewayAccount): Promise<string> {
    const password = this.crypto.decrypt(account.encryptedPassword);
    const login = await this.client.login(account.document, password);
    account.encryptedToken = this.crypto.encrypt(login.token);
    await this.repo.save(account);
    return login.token;
  }
}
