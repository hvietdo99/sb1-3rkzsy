import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { SmartContractService } from './smart-contract.service';
import { BankTransactionService } from './bank-transaction.service';
import { OrderStatus, OrderType, TransactionStatus } from '@prisma/client';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private prisma: PrismaService,
    private smartContractService: SmartContractService,
    private bankTransactionService: BankTransactionService,
  ) {}

  async createOrder(userId: string, createOrderDto: CreateOrderDto) {
    const order = await this.prisma.order.create({
      data: {
        ...createOrderDto,
        userId,
      },
    });

    if (order.type === OrderType.SELL) {
      await this.handleSellOrder(order);
    } else {
      await this.handleBuyOrder(order);
    }

    return order;
  }

  private async handleSellOrder(order: any) {
    try {
      // Create smart contract for USDT escrow
      const contract = await this.smartContractService.createContract(
        order.userId,
        order.id,
        order.amount
      );

      // Create transaction record
      await this.prisma.transaction.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          amount: order.amount,
          status: TransactionStatus.PENDING,
        },
      });

      // Start monitoring contract funding
      this.monitorContractFunding(contract.address, order.id);
    } catch (error) {
      this.logger.error(`Failed to handle sell order: ${error.message}`);
      throw error;
    }
  }

  private async handleBuyOrder(order: any) {
    try {
      // Create transaction record for fiat payment tracking
      const transaction = await this.prisma.transaction.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          amount: order.amount,
          status: TransactionStatus.PENDING,
        },
      });

      // Start monitoring bank payment
      this.monitorBankPayment(transaction.id, order.id);
    } catch (error) {
      this.logger.error(`Failed to handle buy order: ${error.message}`);
      throw error;
    }
  }

  private async monitorContractFunding(contractAddress: string, orderId: string) {
    const checkInterval = setInterval(async () => {
      try {
        const isFunded = await this.smartContractService.checkContractFunding(contractAddress);
        
        if (isFunded) {
          await this.updateOrderStatus(orderId, OrderStatus.MATCHED);
          await this.processFiatTransfer(orderId);
          clearInterval(checkInterval);
        }
      } catch (error) {
        this.logger.error(`Contract funding check failed: ${error.message}`);
      }
    }, 30000); // Check every 30 seconds
  }

  private async monitorBankPayment(transactionId: string, orderId: string) {
    const checkInterval = setInterval(async () => {
      try {
        const isPaymentReceived = await this.bankTransactionService.checkBankTransaction(transactionId);
        
        if (isPaymentReceived) {
          await this.updateOrderStatus(orderId, OrderStatus.MATCHED);
          await this.processUsdtTransfer(orderId);
          clearInterval(checkInterval);
        }
      } catch (error) {
        this.logger.error(`Bank payment check failed: ${error.message}`);
      }
    }, 30000); // Check every 30 seconds
  }

  private async updateOrderStatus(orderId: string, status: OrderStatus) {
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status },
    });
  }

  private async processFiatTransfer(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    await this.bankTransactionService.processFiatPayment(
      order.userId,
      order.amount * order.price,
      order.user // Assuming user has bank details
    );

    await this.updateOrderStatus(orderId, OrderStatus.COMPLETED);
  }

  private async processUsdtTransfer(orderId: string) {
    // Implement USDT transfer logic using Fireblocks or your preferred crypto service
    // This would involve transferring USDT from your system's wallet to the buyer's wallet
    // Update order status upon successful transfer
    await this.updateOrderStatus(orderId, OrderStatus.COMPLETED);
  }
}