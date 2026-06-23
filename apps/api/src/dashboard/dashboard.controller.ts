import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AccessService } from '../access/access.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private service: DashboardService,
    private access: AccessService,
  ) {}

  @Get('summary')
  async summary(@CurrentUser() user: AuthUser) {
    const accessibleIds = await this.access.accessibleAutomationIds(user);
    return this.service.summary(user.workspaceId, accessibleIds);
  }

  @Get('live')
  async live(@CurrentUser() user: AuthUser) {
    const accessibleIds = await this.access.accessibleAutomationIds(user);
    return this.service.live(user.workspaceId, accessibleIds);
  }
}
