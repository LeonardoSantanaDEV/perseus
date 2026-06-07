import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TaskState } from '@prisma/client';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class TasksController {
  constructor(private service: TasksService) {}

  @Get('tasks')
  findAll(@CurrentUser() user: AuthUser, @Query('state') state?: TaskState) {
    return this.service.findAll(user.workspaceId, { state });
  }

  @Get('tasks/:id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user.workspaceId, id);
  }

  @Post('tasks')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto) {
    return this.service.create(user.workspaceId, user.id, dto);
  }

  @Post('tasks/:id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.cancel(user.workspaceId, id);
  }

  @Get('artifacts/:id/download')
  artifactDownload(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.artifactDownloadUrl(user.workspaceId, id);
  }
}
