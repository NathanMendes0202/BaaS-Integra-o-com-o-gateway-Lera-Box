import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateLinkDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  description: string;

  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amountCents: number;

  @IsIn(['PIX', 'CARD'])
  method: 'PIX' | 'CARD';

  @IsOptional()
  @IsIn(['VISA', 'MASTERCARD', 'ELO'])
  brand?: 'VISA' | 'MASTERCARD' | 'ELO';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(21)
  installments?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60 * 24 * 30)
  expiresInMinutes?: number;
}

export class PayPixDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  payerName: string;

  @Matches(/^\d{11}$|^\d{14}$/, { message: 'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos' })
  payerDocument: string;
}

export class PayCardDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  holderName: string;

  @Matches(/^\d{13,19}$/, { message: 'Número do cartão inválido' })
  number: string;

  @IsInt()
  @Min(1)
  @Max(12)
  expMonth: number;

  @IsInt()
  @Min(2024)
  @Max(2100)
  expYear: number;

  @Matches(/^\d{3,4}$/, { message: 'CVV inválido' })
  cvv: string;
}

export class TransactionsQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'DENIED', 'EXPIRED', 'CANCELLED'])
  status?: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED' | 'CANCELLED';

  @IsOptional()
  @Matches(/^\d{1,3}$/, { message: 'limit inválido' })
  limit?: string;
}

export class SendLinkEmailDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
