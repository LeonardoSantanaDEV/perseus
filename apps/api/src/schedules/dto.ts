import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateScheduleDto {
  @IsString()
  automationId: string;

  @IsOptional()
  @IsString()
  runnerId?: string;

  @IsString()
  cron: string;

  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateScheduleDto {
  @IsOptional()
  @IsString()
  cron?: string;

  // null => volta para "Automático" (limpa o runner fixo); undefined => não altera
  @IsOptional()
  @IsString()
  runnerId?: string | null;

  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
