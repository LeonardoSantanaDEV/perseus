import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AccessService } from './access.service';
import { ConfirmDto } from './dto';

/**
 * Endpoints públicos (sem JWT) para o fluxo de confirmação de e-mail e
 * definição de senha pelo usuário convidado.
 */
@Controller('access/confirm')
export class ConfirmController {
  constructor(private service: AccessService) {}

  @Get(':token')
  check(@Param('token') token: string) {
    return this.service.checkConfirmationToken(token);
  }

  @Post()
  confirm(@Body() dto: ConfirmDto) {
    return this.service.confirm(dto);
  }
}
