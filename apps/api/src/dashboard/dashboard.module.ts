import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [AccessModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
