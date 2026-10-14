import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateWithdrawalDto } from './withdrawals.dto';
import { WithdrawalsService } from './withdrawals.service';

@ApiTags('Saques')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private readonly service: WithdrawalsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWithdrawalDto) {
    return this.service.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(user.id, id);
  }
}
