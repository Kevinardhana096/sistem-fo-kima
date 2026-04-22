import { Module } from '@nestjs/common';
import { StoreModule } from '../store/store.module';
import { CustomersController } from './customers.controller';
import { PrismaCustomersReadService } from './prisma-customers-read.service';
import { PrismaCustomersWriteService } from './prisma-customers-write.service';
import { CustomersService } from './customers.service';

@Module({
  imports: [StoreModule],
  controllers: [CustomersController],
  providers: [
    CustomersService,
    PrismaCustomersReadService,
    PrismaCustomersWriteService,
  ],
  exports: [CustomersService],
})
export class CustomersModule {}
