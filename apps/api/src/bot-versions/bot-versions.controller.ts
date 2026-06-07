import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BotVersionsService } from './bot-versions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('automations/:automationId/versions')
export class BotVersionsController {
  constructor(private service: BotVersionsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('automationId') automationId: string,
  ) {
    return this.service.listForAutomation(user.workspaceId, automationId);
  }

  @Post()
  @Roles('ADMIN', 'OPERATOR')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 200 * 1024 * 1024 } }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @Param('automationId') automationId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { version?: string; releaseVersion?: string },
  ) {
    return this.service.upload(user.workspaceId, automationId, file, body);
  }

  @Delete(':versionId')
  @Roles('ADMIN', 'OPERATOR')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('automationId') automationId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.service.remove(user.workspaceId, automationId, versionId);
  }
}
