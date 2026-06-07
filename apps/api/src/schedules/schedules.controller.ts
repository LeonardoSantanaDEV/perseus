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
import { CreateScheduleDto, UpdateScheduleDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schedules')
export class SchedulesController {
  constructor(private service: SchedulesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.workspaceId);
  }

  @Post()
  @Roles('ADMIN', 'OPERATOR')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateScheduleDto) {
    return this.service.create(user.workspaceId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'OPERATOR')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.service.update(user.workspaceId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'OPERATOR')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user.workspaceId, id);
  }
}
