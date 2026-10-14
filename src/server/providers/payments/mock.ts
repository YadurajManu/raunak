import type { PaymentProvider, ProviderPayment } from "./cashfree";

export class MockPaymentProvider implements PaymentProvider {
  readonly payments = new Map<string, ProviderPayment[]>();
  readonly refunds: string[] = [];
  async createOrder(input: { orderId: string }) {
    return { paymentSessionId: `mock_${input.orderId}` };
  }
  async getPayments(orderId: string) {
    return this.payments.get(orderId) || [];
  }
  async getRefund(_orderId: string, refundId: string) {
    return { providerRefundId: refundId, status: "SUCCESS" };
  }
  async refund(input: { orderId: string; refundId: string }) {
    this.refunds.push(input.orderId);
    return { providerRefundId: input.refundId, status: "PENDING" };
  }
}
