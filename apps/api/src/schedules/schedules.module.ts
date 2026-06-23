import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { AccessModule } from '../access/access.module';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';

@Module({
  imports: [TasksModule, AccessModule],
  providers: [SchedulesService],
  controllers: [SchedulesController],
})
export class SchedulesModule {}
