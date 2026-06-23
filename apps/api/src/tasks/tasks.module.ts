import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccessModule } from '../access/access.module';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { SdkController } from './sdk.controller';
import { TaskTokenGuard } from './task-token.guard';

@Module({
  imports: [AuthModule, AccessModule],
  providers: [TasksService, TaskTokenGuard],
  controllers: [TasksController, SdkController],
  exports: [TasksService],
})
export class TasksModule {}
