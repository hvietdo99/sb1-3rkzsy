import { Injectable, Logger } from '@nestjs/common';
import { ISmartContract } from '../interfaces/smart-contract.interface';
import { FireblocksSDK } from 'fireblocks-sdk';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmartContractService {
  private readonly logger = new Logger(SmartContractService.name);
  private readonly fireblocks: FireblocksSDK;

  constructor(private configService: ConfigService) {
    this.fireblocks = new FireblocksSDK(
      this.configService.get('FIREBLOCKS_API_KEY'),
      this.configService.get('FIREBLOCKS_API_SECRET')
    );
  }

  async createContract(sellerId: string, orderId: string, amount: number): Promise<ISmartContract> {
    try {
      // Create a new vault account for the escrow
      const vaultAccount = await this.fireblocks.createVaultAccount({
        name: `escrow-${orderId}`,
        hiddenOnUI: false,
      });

      return {
        address: vaultAccount.id,
        amount,
        sellerId,
        orderId,
        status: 'PENDING',
      };
    } catch (error) {
      this.logger.error(`Failed to create smart contract: ${error.message}`);
      throw error;
    }
  }

  async checkContractFunding(contractAddress: string): Promise<boolean> {
    try {
      const account = await this.fireblocks.getVaultAccountById(contractAddress);
      const balance = account.assets.find(asset => asset.id === 'USDT')?.total;
      return balance > 0;
    } catch (error) {
      this.logger.error(`Failed to check contract funding: ${error.message}`);
      throw error;
    }
  }
}