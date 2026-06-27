import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QueueService } from './queue.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('queue')
export class QueueController {
  constructor(private service: QueueService) {}

  @Get('schemas')
  schemas(@CurrentUser() user: AuthUser) {
    return this.service.listSchemas(user);
  }

  @Get('items')
  items(
    @CurrentUser() user: AuthUser,
    @Query('schema') schema: string,
    @Query('page') page?: string,
    @Query('search') search?: string,
  ) {
    return this.service.getItems(
      user,
      schema,
      parseInt(page || '1', 10) || 1,
      search,
    );
  }
}
