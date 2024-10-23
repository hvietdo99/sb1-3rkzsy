export interface ISmartContract {
  address: string;
  amount: number;
  sellerId: string;
  orderId: string;
  status: 'PENDING' | 'FUNDED' | 'COMPLETED' | 'CANCELLED';
}