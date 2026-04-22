import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CustomersModule } from './customers/customers.module';
import { DocumentsModule } from './documents/documents.module';
import { IspsModule } from './isps/isps.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    CustomersModule,
    DocumentsModule,
    MonitoringModule,
    IspsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
