import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateRunnerDto {
  @IsString()
  @MinLength(2)
  label: string;
}

export class UpdateRunnerDto {
  @IsOptional()
  @IsString()
  label?: string;
}
