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
import { SchedulesService } from './schedules.service';
import { AccessService } from '../access/access.service';
import { CreateScheduleDto, UpdateScheduleDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schedules')
export class SchedulesController {
  constructor(
    private service: SchedulesService,
    private access: AccessService,
  ) {}

  @Get()
  async findAll(@CurrentUser() user: AuthUser) {
    const accessibleIds = await this.access.accessibleAutomationIds(user);
    return this.service.findAll(user.workspaceId, accessibleIds);
  }

  @Post()
  @Roles('ADMINISTRADOR', 'OPERADOR')
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateScheduleDto) {
    const accessibleIds = await this.access.accessibleAutomationIds(user);
    return this.service.create(user.workspaceId, dto, accessibleIds);
  }

  @Patch(':id')
  @Roles('ADMINISTRADOR', 'OPERADOR')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    const accessibleIds = await this.access.accessibleAutomationIds(user);
    return this.service.update(user.workspaceId, id, dto, accessibleIds);
  }

  @Delete(':id')
  @Roles('ADMINISTRADOR', 'OPERADOR')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const accessibleIds = await this.access.accessibleAutomationIds(user);
    return this.service.remove(user.workspaceId, id, accessibleIds);
  }
}
