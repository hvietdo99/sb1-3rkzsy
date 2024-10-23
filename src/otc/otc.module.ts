import { Module } from '@nestjs/common';
import { OrderController } from './controllers/order.controller';
import { OrderService } from './services/order.service';
import { SmartContractService } from './services/smart-contract.service';
import { BankTransactionService } from './services/bank-transaction.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OrderController],
  providers: [
    OrderService,
    SmartContractService,
    BankTransactionService,
  ],
})
export class OtcModule {}