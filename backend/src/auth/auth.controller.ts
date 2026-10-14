import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthGuard, AuthUser } from './auth.guard';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.service.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.service.login(dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.service.me(user.id);
  }
}
