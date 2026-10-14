import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  findByEmail(email: string) {
    return this.repo.findOneBy({ email: email.toLowerCase() });
  }

  findById(id: string) {
    return this.repo.findOneBy({ id });
  }

  create(data: Pick<User, 'name' | 'email' | 'passwordHash'>) {
    return this.repo.save(this.repo.create(data));
  }
}
