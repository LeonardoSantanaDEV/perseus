import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAutomationDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  label: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  repositoryId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  manualMinutesPerItem?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyCost?: number;
}

export class UpdateAutomationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  manualMinutesPerItem?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyCost?: number;
}
