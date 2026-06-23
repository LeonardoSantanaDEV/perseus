import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AutomationsService } from './automations.service';
import { AutomationsController } from './automations.controller';

@Module({
  imports: [AccessModule],
  providers: [AutomationsService],
  controllers: [AutomationsController],
  exports: [AutomationsService],
})
export class AutomationsModule {}
