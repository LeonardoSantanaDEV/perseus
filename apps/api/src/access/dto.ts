import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

const ROLES = ['OPERADOR', 'DESENVOLVEDOR', 'GERENTE', 'ADMINISTRADOR'] as const;
type RoleLiteral = (typeof ROLES)[number];

export class InviteUserDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(ROLES)
  role?: RoleLiteral;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  groupIds?: string[];
}

export class SetUserGroupsDto {
  @IsArray()
  @IsString({ each: true })
  groupIds: string[];
}

export class SetGroupRepositoriesDto {
  @IsArray()
  @IsString({ each: true })
  repositoryIds: string[];
}

export class AssignAutomationRepositoryDto {
  @IsString()
  automationId: string;

  @IsString()
  repositoryId: string;
}

export class CreateGroupDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateRepositoryDto {
  @IsString()
  @MinLength(1)
  name: string;
}

export class UpdateRepositoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}

export class ConfirmDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(6)
  password: string;
}
