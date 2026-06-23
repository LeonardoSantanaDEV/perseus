import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RunnersService } from './runners.service';
import { CreateRunnerDto, UpdateRunnerDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('runners')
export class RunnersController {
  constructor(private service: RunnersService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.workspaceId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user.workspaceId, id);
  }

  @Post()
  @Roles('ADMINISTRADOR', 'OPERADOR')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRunnerDto) {
    return this.service.create(user.workspaceId, dto);
  }

  @Patch(':id')
  @Roles('ADMINISTRADOR', 'OPERADOR')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateRunnerDto,
  ) {
    return this.service.update(user.workspaceId, id, dto);
  }

  @Post(':id/regenerate-token')
  @Roles('ADMINISTRADOR', 'OPERADOR')
  regenerate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.regenerateToken(user.workspaceId, id);
  }

  @Delete(':id')
  @Roles('ADMINISTRADOR')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user.workspaceId, id);
  }
}
