import { Module } from '@nestjs/common';
import { AccessService } from './access.service';
import { MailService } from './mail.service';
import { AccessController } from './access.controller';
import { ConfirmController } from './confirm.controller';

@Module({
  providers: [AccessService, MailService],
  controllers: [AccessController, ConfirmController],
  exports: [AccessService],
})
export class AccessModule {}
