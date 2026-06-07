import { Module } from '@nestjs/common';
import { RunnersService } from './runners.service';
import { RunnersController } from './runners.controller';

@Module({
  providers: [RunnersService],
  controllers: [RunnersController],
  exports: [RunnersService],
})
export class RunnersModule {}
