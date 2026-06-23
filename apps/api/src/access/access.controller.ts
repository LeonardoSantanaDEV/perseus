import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AccessService } from './access.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import {
  AssignAutomationRepositoryDto,
  CreateGroupDto,
  CreateRepositoryDto,
  InviteUserDto,
  SetGroupRepositoriesDto,
  SetUserGroupsDto,
  UpdateGroupDto,
  UpdateRepositoryDto,
} from './dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
@Controller('access')
export class AccessController {
  constructor(private service: AccessService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.service.overview(user.workspaceId);
  }

  // Usuários
  @Post('users/invite')
  invite(@CurrentUser() user: AuthUser, @Body() dto: InviteUserDto) {
    return this.service.inviteUser(user.workspaceId, dto);
  }

  @Post('users/:id/resend-confirmation')
  resend(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.resendConfirmation(user.workspaceId, id);
  }

  @Put('users/:id/groups')
  setUserGroups(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SetUserGroupsDto,
  ) {
    return this.service.setUserGroups(user.workspaceId, id, dto);
  }

  @Delete('users/:id')
  deleteUser(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteUser(user.workspaceId, id, user.id);
  }

  // Grupos
  @Post('groups')
  createGroup(@CurrentUser() user: AuthUser, @Body() dto: CreateGroupDto) {
    return this.service.createGroup(user.workspaceId, dto);
  }

  @Patch('groups/:id')
  updateGroup(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.service.updateGroup(user.workspaceId, id, dto);
  }

  @Delete('groups/:id')
  deleteGroup(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteGroup(user.workspaceId, id);
  }

  @Put('groups/:id/repositories')
  setGroupRepositories(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SetGroupRepositoriesDto,
  ) {
    return this.service.setGroupRepositories(user.workspaceId, id, dto);
  }

  // Repositórios
  @Post('repositories')
  createRepository(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateRepositoryDto,
  ) {
    return this.service.createRepository(user.workspaceId, dto);
  }

  @Patch('repositories/:id')
  updateRepository(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateRepositoryDto,
  ) {
    return this.service.updateRepository(user.workspaceId, id, dto);
  }

  @Delete('repositories/:id')
  deleteRepository(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteRepository(user.workspaceId, id);
  }

  @Put('repositories/assign-automation')
  assignAutomation(
    @CurrentUser() user: AuthUser,
    @Body() dto: AssignAutomationRepositoryDto,
  ) {
    return this.service.assignAutomationRepository(user.workspaceId, dto);
  }
}
