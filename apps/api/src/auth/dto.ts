import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({ require_tld: false })
  email: string;

  @IsString()
  @MinLength(4)
  password: string;
}

export class RegisterDto {
  @IsEmail({ require_tld: false })
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  name?: string;
}
