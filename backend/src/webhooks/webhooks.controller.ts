import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EventsQueryDto, RegisterWebhooksDto } from './webhooks.dto';
import { WebhooksService } from './webhooks.service';

@ApiTags('Webhooks (receptor)')
@Controller('webhooks/gateway')
export class WebhookReceiverController {
  constructor(private readonly service: WebhooksService) {}

  @Post(':token')
  @HttpCode(200)
  receive(
    @Param('token') token: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-lera-box-signature') signature: string | undefined,
    @Body() body: any,
  ) {
    return this.service.receive(token, req.rawBody, signature, body);
  }
}

@ApiTags('Webhooks (configuração)')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}

  @Get('config')
  config(@CurrentUser() user: AuthUser) {
    return this.service.config_(user.id);
  }

  @Post('config')
  @HttpCode(200)
  register(@CurrentUser() user: AuthUser, @Body() dto: RegisterWebhooksDto) {
    return this.service.register(user.id, dto.baseUrl);
  }

  @Delete('config/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user.id, id);
  }

  @Get('events')
  events(@CurrentUser() user: AuthUser, @Query() query: EventsQueryDto) {
    return this.service.listEvents(user.id, query.limit ? Number(query.limit) : 30);
  }
}
