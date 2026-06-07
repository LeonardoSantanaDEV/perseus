import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTaskDto {
  @IsString()
  automationId: string;

  @IsOptional()
  @IsString()
  botVersionId?: string;

  @IsOptional()
  @IsString()
  runnerId?: string;

  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  priority?: number;
}

export class FinishTaskDto {
  @IsOptional()
  @IsString()
  status?: 'SUCCESS' | 'FAILED';

  @IsOptional()
  @IsInt()
  totalItems?: number;

  @IsOptional()
  @IsInt()
  processed?: number;

  @IsOptional()
  @IsInt()
  failed?: number;

  @IsOptional()
  @IsString()
  message?: string;
}

export class LogDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  level?: string;
}

export class EventDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
