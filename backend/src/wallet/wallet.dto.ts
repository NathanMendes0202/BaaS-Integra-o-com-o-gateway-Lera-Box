import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class StatementQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'DENIED', 'EXPIRED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  type?: string;

  @IsOptional()
  @Matches(/^\d{1,3}$/, { message: 'limit inválido' })
  limit?: string;
}
