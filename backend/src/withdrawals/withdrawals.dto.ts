import { IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateWithdrawalDto {
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amountCents: number;

  @IsString()
  @MinLength(3)
  @MaxLength(140)
  pixKey: string;

  @Matches(/^\d{11}$/, { message: 'document deve ser CPF com 11 dígitos' })
  document: string;
}
