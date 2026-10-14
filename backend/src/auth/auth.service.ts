import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException('E-mail já cadastrado');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.create({
      name: dto.name.trim(),
      email: dto.email.toLowerCase(),
      passwordHash,
    });
    return this.session(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }
    return this.session(user);
  }

  async me(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Usuário não encontrado');
    return { id: user.id, name: user.name, email: user.email };
  }

  private async session(user: User) {
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id, email: user.email }),
      user: { id: user.id, name: user.name, email: user.email },
    };
  }
}
