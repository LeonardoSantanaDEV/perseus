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
import { AutomationsService } from './automations.service';
import { CreateAutomationDto, UpdateAutomationDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class AutomationsController {
  constructor(private service: AutomationsService) {}

  @Get('repositories')
  repositories(@CurrentUser() user: AuthUser) {
    return this.service.listRepositories(user.workspaceId);
  }

  @Get('automations')
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.workspaceId);
  }

  @Get('automations/:id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user.workspaceId, id);
  }

  @Post('automations')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAutomationDto) {
    return this.service.create(user.workspaceId, dto);
  }

  @Patch('automations/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationDto,
  ) {
    return this.service.update(user.workspaceId, id, dto);
  }

  @Delete('automations/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user.workspaceId, id);
  }
}
