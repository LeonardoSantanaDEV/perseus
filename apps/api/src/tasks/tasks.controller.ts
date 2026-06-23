import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TaskState } from '@prisma/client';
import { TasksService } from './tasks.service';
import { AccessService } from '../access/access.service';
import { CreateTaskDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class TasksController {
  constructor(
    private service: TasksService,
    private access: AccessService,
  ) {}

  @Get('tasks')
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('state') state?: TaskState,
  ) {
    const accessibleIds = await this.access.accessibleAutomationIds(user);
    return this.service.findAll(user.workspaceId, { state }, accessibleIds);
  }

  @Get('tasks/:id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const accessibleIds = await this.access.accessibleAutomationIds(user);
    return this.service.findOne(user.workspaceId, id, accessibleIds);
  }

  @Post('tasks')
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto) {
    const accessibleIds = await this.access.accessibleAutomationIds(user);
    if (accessibleIds && !accessibleIds.includes(dto.automationId)) {
      throw new ForbiddenException('Sem acesso a esta automação');
    }
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
