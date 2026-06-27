import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';

@Module({
  imports: [AccessModule],
  providers: [QueueService],
  controllers: [QueueController],
})
export class QueueModule {}
