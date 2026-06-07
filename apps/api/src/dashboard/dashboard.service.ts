import { Injectable } from '@nestjs/common';
import { TaskState } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async summary(workspaceId: string) {
    const [
      totalTasks,
      byStateRaw,
      runners,
      alerts,
      errors,
      perRunnerRaw,
      failedByAutoRaw,
    ] = await Promise.all([
      this.prisma.task.count({ where: { workspaceId } }),
      this.prisma.task.groupBy({
        by: ['state'],
        where: { workspaceId },
        _count: { _all: true },
      }),
      this.prisma.runner.findMany({
        where: { workspaceId },
        select: { id: true, label: true, status: true },
      }),
      this.prisma.eventLog.count({
        where: { type: 'ALERT', task: { workspaceId } },
      }),
      this.prisma.eventLog.count({
        where: { type: 'ERROR', task: { workspaceId } },
      }),
      this.prisma.task.groupBy({
        by: ['runnerId'],
        where: { workspaceId, runnerId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ['automationId'],
        where: { workspaceId, state: 'FAILED' },
        _count: { _all: true },
      }),
    ]);

    const byState: Record<string, number> = {};
    for (const row of byStateRaw) byState[row.state] = row._count._all;

    const runnerLabels = new Map(runners.map((r) => [r.id, r.label]));
    const tasksPerRunner = perRunnerRaw.map((row) => ({
      runnerId: row.runnerId,
      label: runnerLabels.get(row.runnerId!) ?? row.runnerId,
      count: row._count._all,
    }));

    const automations = await this.prisma.automation.findMany({
      where: { workspaceId },
      select: { id: true, name: true, label: true },
    });
    const autoNames = new Map(automations.map((a) => [a.id, a.name]));
    const failedByAutomation = failedByAutoRaw
      .map((row) => ({
        automationId: row.automationId,
        name: autoNames.get(row.automationId) ?? row.automationId,
        count: row._count._all,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalTasks,
      schedules: await this.prisma.schedule.count({ where: { workspaceId } }),
      alerts,
      errors,
      byState: {
        FINISHED: byState['FINISHED'] ?? 0,
        FAILED: byState['FAILED'] ?? 0,
        QUEUED: byState['QUEUED'] ?? 0,
        DISPATCHED: byState['DISPATCHED'] ?? 0,
        RUNNING: byState['RUNNING'] ?? 0,
        CANCELLED: byState['CANCELLED'] ?? 0,
        TIMEOUT: byState['TIMEOUT'] ?? 0,
      },
      runners: {
        total: runners.length,
        online: runners.filter((r) => r.status !== 'OFFLINE').length,
        offline: runners.filter((r) => r.status === 'OFFLINE').length,
        list: runners,
      },
      tasksPerRunner,
      failedByAutomation,
      roi: await this.computeRoi(workspaceId),
    };
  }

  async live(workspaceId: string) {
    const activeStates: TaskState[] = ['QUEUED', 'DISPATCHED', 'RUNNING'];
    const queue = await this.prisma.task.findMany({
      where: { workspaceId, state: { in: activeStates } },
      include: {
        automation: { select: { name: true } },
        runner: { select: { label: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 50,
    });
    return { queue };
  }

  private async computeRoi(workspaceId: string) {
    const automations = await this.prisma.automation.findMany({
      where: {
        workspaceId,
        manualMinutesPerItem: { not: null },
      },
      select: {
        id: true,
        name: true,
        manualMinutesPerItem: true,
        hourlyCost: true,
      },
    });

    let totalHoursSaved = 0;
    let totalMoneySaved = 0;
    const perAutomation: {
      automationId: string;
      name: string;
      itemsProcessed: number;
      hoursSaved: number;
      moneySaved: number;
    }[] = [];

    for (const auto of automations) {
      const agg = await this.prisma.task.aggregate({
        where: { automationId: auto.id, state: 'FINISHED' },
        _sum: { processed: true },
      });
      const items = agg._sum.processed ?? 0;
      const hours = (items * (auto.manualMinutesPerItem ?? 0)) / 60;
      const money = hours * (auto.hourlyCost ?? 0);
      totalHoursSaved += hours;
      totalMoneySaved += money;
      perAutomation.push({
        automationId: auto.id,
        name: auto.name,
        itemsProcessed: items,
        hoursSaved: Math.round(hours * 10) / 10,
        moneySaved: Math.round(money * 100) / 100,
      });
    }

    return {
      totalHoursSaved: Math.round(totalHoursSaved * 10) / 10,
      totalMoneySaved: Math.round(totalMoneySaved * 100) / 100,
      perAutomation: perAutomation.sort((a, b) => b.moneySaved - a.moneySaved),
    };
  }
}
