import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AuthModule } from './auth/auth.module';
import { AccessModule } from './access/access.module';
import { UsersModule } from './users/users.module';
import { AutomationsModule } from './automations/automations.module';
import { BotVersionsModule } from './bot-versions/bot-versions.module';
import { RunnersModule } from './runners/runners.module';
import { TasksModule } from './tasks/tasks.module';
import { SchedulesModule } from './schedules/schedules.module';
import { QueueModule } from './queue/queue.module';
import { EventsModule } from './events/events.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    StorageModule,
    RealtimeModule,
    AuthModule,
    AccessModule,
    UsersModule,
    AutomationsModule,
    BotVersionsModule,
    RunnersModule,
    TasksModule,
    SchedulesModule,
    QueueModule,
    EventsModule,
    DashboardModule,
  ],
})
export class AppModule {}
