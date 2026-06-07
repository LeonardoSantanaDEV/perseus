import { Module } from '@nestjs/common';
import { BotVersionsService } from './bot-versions.service';
import { BotVersionsController } from './bot-versions.controller';

@Module({
  providers: [BotVersionsService],
  controllers: [BotVersionsController],
  exports: [BotVersionsService],
})
export class BotVersionsModule {}
