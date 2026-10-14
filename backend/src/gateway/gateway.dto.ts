import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ConnectGatewayDto {
  @IsString()
  @Matches(/^\d{11}$|^\d{14}$/, { message: 'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos' })
  document: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  password: string;
}

export class RegisterGatewayDto {
  @IsIn(['PF', 'PJ'])
  personType: 'PF' | 'PJ';

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsString()
  @Matches(/^\d{11}$|^\d{14}$/, { message: 'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos' })
  document: string;

  @IsEmail()
  email: string;

  @IsString()
  @Matches(/^\d{10,13}$/, { message: 'Telefone deve ter de 10 a 13 dígitos, apenas números' })
  phone: string;

  @IsString()
  @Matches(/^\d{8}$/, { message: 'zipCode deve ter 8 dígitos' })
  zipCode: string;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  address: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  number: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  neighborhood: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city: string;

  @IsString()
  @Matches(/^[A-Za-z]{2}$/, { message: 'state deve ser UF com 2 letras' })
  state: string;
}

export class FeesQueryDto {
  @IsOptional()
  @IsIn(['VISA', 'MASTERCARD', 'ELO'])
  brand?: 'VISA' | 'MASTERCARD' | 'ELO';
}
