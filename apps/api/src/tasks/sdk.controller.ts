import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { TasksService } from './tasks.service';
import { TaskTokenGuard } from './task-token.guard';
import { FinishTaskDto, LogDto, EventDto } from './dto';

@UseGuards(TaskTokenGuard)
@Controller('sdk/tasks')
export class SdkController {
  constructor(private service: TasksService) {}

  private taskId(req: Request): string {
    return (req as any).taskId;
  }

  @Get('current')
  current(@Req() req: Request) {
    return this.service.getForToken(this.taskId(req));
  }

  @Post('start')
  start(@Req() req: Request) {
    return this.service.startByToken(this.taskId(req));
  }

  @Post('log')
  log(@Req() req: Request, @Body() dto: LogDto) {
    return this.service.logByToken(this.taskId(req), dto);
  }

  @Post('alert')
  alert(@Req() req: Request, @Body() dto: EventDto) {
    return this.service.eventByToken(this.taskId(req), 'ALERT', dto);
  }

  @Post('error')
  error(@Req() req: Request, @Body() dto: EventDto) {
    return this.service.eventByToken(this.taskId(req), 'ERROR', dto);
  }

  @Post('finish')
  finish(@Req() req: Request, @Body() dto: FinishTaskDto) {
    return this.service.finishByToken(this.taskId(req), dto);
  }

  @Post('artifacts')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }),
  )
  artifact(@Req() req: Request, @UploadedFile() file: Express.Multer.File) {
    return this.service.addArtifact(this.taskId(req), file);
  }
}
