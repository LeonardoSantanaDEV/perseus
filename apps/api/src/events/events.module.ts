import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { AuthModule } from '../auth/auth.module';
import { RunnerGateway } from './runner.gateway';
import { DashboardGateway } from './dashboard.gateway';

@Module({
  imports: [TasksModule, AuthModule],
  providers: [RunnerGateway, DashboardGateway],
})
export class EventsModule {}
