import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsEmail()
  @MaxLength(160)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MaxLength(72)
  password: string;
}
