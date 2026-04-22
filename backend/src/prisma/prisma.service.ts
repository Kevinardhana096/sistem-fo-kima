import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  isEnabled(): boolean {
    return Boolean(process.env.DATABASE_URL);
  }

  async onModuleInit() {
    if (!this.isEnabled()) {
      return;
    }

    await this.$connect();
  }

  async onModuleDestroy() {
    if (!this.isEnabled()) {
      return;
    }

    await this.$disconnect();
  }
}
