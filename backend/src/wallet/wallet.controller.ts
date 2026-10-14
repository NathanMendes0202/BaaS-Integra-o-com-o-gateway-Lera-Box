import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { StatementQueryDto } from './wallet.dto';
import { WalletService } from './wallet.service';

@ApiTags('Carteira')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly service: WalletService) {}

  @Get()
  balance(@CurrentUser() user: AuthUser) {
    return this.service.balance(user.id);
  }

  @Get('transactions')
  statement(@CurrentUser() user: AuthUser, @Query() query: StatementQueryDto) {
    return this.service.statement(user.id, {
      status: query.status,
      type: query.type,
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }
}
