import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { SdkController } from './sdk.controller';
import { TaskTokenGuard } from './task-token.guard';

@Module({
  imports: [AuthModule],
  providers: [TasksService, TaskTokenGuard],
  controllers: [TasksController, SdkController],
  exports: [TasksService],
})
export class TasksModule {}
