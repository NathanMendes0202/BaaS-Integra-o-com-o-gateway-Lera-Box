import { IsOptional, IsUrl, Matches } from 'class-validator';

export class RegisterWebhooksDto {
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  baseUrl?: string;
}

export class EventsQueryDto {
  @IsOptional()
  @Matches(/^\d{1,3}$/, { message: 'limit inválido' })
  limit?: string;
}
