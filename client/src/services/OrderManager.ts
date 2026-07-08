import { 
  type Order, 
  type CreateOrder, 
  type Position, 
  type Trade, 
  type RiskMetrics,
  type OrderBook,
  OrderSchema,
  CreateOrderSchema,
  OrderValidationSchema 
} from '@shared/orderSchema';
import { z } from 'zod';

interface OrderExecutionResult {
  success: boolean;
  orderId?: string;
  error?: string;
  estimatedCommission?: number;
  estimatedSlippage?: number;
}

interface RiskCheckResult {
  approved: boolean;
  reason?: string;
  recommendations?: string[];
}

class OrderManager {
  private orders: Map<string, Order> = new Map();
  private positions: Map<string, Position> = new Map();
  private trades: Map<string, Trade> = new Map();
  private riskMetrics: RiskMetrics | null = null;
  private orderBooks: Map<string, OrderBook> = new Map();
  private executionListeners: Array<(order: Order) => void> = [];
  private riskListeners: Array<(metrics: RiskMetrics) => void> = [];

  constructor() {
    this.initializeMockData();
    this.startMarketDataSubscription();
  }

  private initializeMockData() {
    // Initialize with some mock data for demo purposes
    this.riskMetrics = {
      portfolioValue: 100000,
      availableCash: 25000,
      buyingPower: 50000,
      dayTradeCount: 2,
      marginUsed: 0,
      riskLevel: 'MEDIUM',
      maxPositionSize: 10000,
      portfolioBeta: 1.2,
    };

    // Mock positions
    const mockPositions: Position[] = [
      {
        id: '1',
        userId: 'user1',
        symbol: 'AAPL',
        quantity: 100,
        avgPrice: 150.25,
        currentPrice: 178.85,
        marketValue: 17885,
        unrealizedPnL: 2860,
        unrealizedPnLPercent: 19.03,
        realizedPnL: 0,
        totalReturn: 2860,
        totalReturnPercent: 19.03,
        costBasis: 15025,
        dayChange: 245,
        dayChangePercent: 1.39,
        updatedAt: new Date(),
      }
    ];

    mockPositions.forEach(position => {
      this.positions.set(position.symbol, position);
    });
  }

  async validateOrder(orderData: CreateOrder): Promise<RiskCheckResult> {
    try {
      // Schema validation
      CreateOrderSchema.parse(orderData);
      OrderValidationSchema.parse(orderData);

      // Risk checks
      const riskChecks = await this.performRiskChecks(orderData);
      if (!riskChecks.approved) {
        return riskChecks;
      }

      // Position size validation
      const positionSizeCheck = this.validatePositionSize(orderData);
      if (!positionSizeCheck.approved) {
        return positionSizeCheck;
      }

      // Buying power check
      const buyingPowerCheck = this.validateBuyingPower(orderData);
      if (!buyingPowerCheck.approved) {
        return buyingPowerCheck;
      }

      return { approved: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          approved: false,
          reason: 'Order validation failed',
          recommendations: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return {
        approved: false,
        reason: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }

  private async performRiskChecks(orderData: CreateOrder): Promise<RiskCheckResult> {
    if (!this.riskMetrics) {
      return { approved: false, reason: 'Risk metrics not available' };
    }

    const orderValue = this.calculateOrderValue(orderData);
    const maxOrderValue = this.riskMetrics.portfolioValue * 0.1; // Max 10% of portfolio

    if (orderValue > maxOrderValue) {
      return {
        approved: false,
        reason: 'Order exceeds maximum position size',
        recommendations: [
          `Consider reducing quantity to ${Math.floor((maxOrderValue / (orderData.price || 100)) * 0.9)}`,
          'Use position sizing to limit risk exposure'
        ]
      };
    }

    // Day trade limit check (PDT rule)
    if (this.riskMetrics.dayTradeCount >= 3 && this.riskMetrics.portfolioValue < 25000) {
      return {
        approved: false,
        reason: 'Pattern Day Trader rule violation',
        recommendations: [
          'You have reached your day trading limit',
          'Consider placing a GTC order instead of a day trade'
        ]
      };
    }

    return { approved: true };
  }

  private validatePositionSize(orderData: CreateOrder): RiskCheckResult {
    const orderValue = this.calculateOrderValue(orderData);
    
    if (!this.riskMetrics) {
      return { approved: false, reason: 'Risk metrics not available' };
    }

    if (orderValue > this.riskMetrics.maxPositionSize) {
      return {
        approved: false,
        reason: 'Order exceeds maximum allowed position size',
        recommendations: [
          `Maximum position size: $${this.riskMetrics.maxPositionSize.toLocaleString()}`,
          `Your order value: $${orderValue.toLocaleString()}`
        ]
      };
    }

    return { approved: true };
  }

  private validateBuyingPower(orderData: CreateOrder): RiskCheckResult {
    if (!this.riskMetrics) {
      return { approved: false, reason: 'Risk metrics not available' };
    }

    if (orderData.side === 'BUY') {
      const orderValue = this.calculateOrderValue(orderData);
      const estimatedCommission = this.calculateCommission(orderData);
      const totalCost = orderValue + estimatedCommission;

      if (totalCost > this.riskMetrics.buyingPower) {
        return {
          approved: false,
          reason: 'Insufficient buying power',
          recommendations: [
            `Available buying power: $${this.riskMetrics.buyingPower.toLocaleString()}`,
            `Required funds: $${totalCost.toLocaleString()}`,
            'Consider reducing order size or depositing additional funds'
          ]
        };
      }
    }

    return { approved: true };
  }

  private calculateOrderValue(orderData: CreateOrder): number {
    const price = orderData.price || 100; // Use current market price if not specified
    return orderData.quantity * price;
  }

  private calculateCommission(orderData: CreateOrder): number {
    // Simple commission structure - in practice this would be more complex
    const baseCommission = 0.99;
    const perShareFee = orderData.quantity * 0.005;
    return Math.max(baseCommission, perShareFee);
  }

  async submitOrder(orderData: CreateOrder, userId: string): Promise<OrderExecutionResult> {
    try {
      // Validate the order
      const validation = await this.validateOrder(orderData);
      if (!validation.approved) {
        return {
          success: false,
          error: validation.reason,
        };
      }

      // Create order object
      const order: Order = {
        id: this.generateOrderId(),
        userId,
        ...orderData,
        status: 'SUBMITTED',
        filledQuantity: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store order
      this.orders.set(order.id, order);

      // Simulate order execution for market orders
      if (orderData.orderType === 'MARKET') {
        setTimeout(() => this.executeMarketOrder(order.id), 1000);
      }

      // Calculate estimates
      const estimatedCommission = this.calculateCommission(orderData);
      const estimatedSlippage = this.calculateSlippage(orderData);

      // Update risk metrics
      this.updateRiskMetrics(order);

      // Notify listeners
      this.notifyExecutionListeners(order);

      return {
        success: true,
        orderId: order.id,
        estimatedCommission,
        estimatedSlippage,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Order submission failed'
      };
    }
  }

  private calculateSlippage(orderData: CreateOrder): number {
    // Simplified slippage calculation based on order size and market conditions
    const baseSlippage = 0.01; // 1 cent base slippage
    const volumeMultiplier = Math.min(orderData.quantity / 1000, 2); // More slippage for larger orders
    return baseSlippage * (1 + volumeMultiplier);
  }

  private async executeMarketOrder(orderId: string): Promise<void> {
    const order = this.orders.get(orderId);
    if (!order || order.status !== 'SUBMITTED') return;

    try {
      // Simulate market execution
      const currentPrice = await this.getCurrentPrice(order.symbol);
      const slippage = this.calculateSlippage(order);
      const executionPrice = order.side === 'BUY' 
        ? currentPrice + slippage 
        : currentPrice - slippage;

      // Update order
      const updatedOrder: Order = {
        ...order,
        status: 'FILLED',
        filledQuantity: order.quantity,
        avgFillPrice: executionPrice,
        updatedAt: new Date(),
      };

      this.orders.set(orderId, updatedOrder);

      // Create trade record
      const trade: Trade = {
        id: this.generateTradeId(),
        orderId: order.id,
        userId: order.userId,
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        price: executionPrice,
        commission: this.calculateCommission(order),
        executedAt: new Date(),
        venue: 'NASDAQ',
        executionId: `EXEC_${Date.now()}`,
      };

      this.trades.set(trade.id, trade);

      // Update positions
      this.updatePosition(trade);

      // Update risk metrics
      this.updateRiskMetrics(updatedOrder);

      // Notify listeners
      this.notifyExecutionListeners(updatedOrder);

    } catch (error) {
      // Mark order as rejected
      const rejectedOrder: Order = {
        ...order,
        status: 'REJECTED',
        updatedAt: new Date(),
      };
      this.orders.set(orderId, rejectedOrder);
      this.notifyExecutionListeners(rejectedOrder);
    }
  }

  private async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const response = await fetch(`/api/quote/${symbol}`);
      const data = await response.json();
      return data.price || 100; // Fallback price
    } catch {
      return 100; // Fallback price
    }
  }

  private updatePosition(trade: Trade): void {
    const existingPosition = this.positions.get(trade.symbol);
    
    if (existingPosition) {
      // Update existing position
      const newQuantity = trade.side === 'BUY' 
        ? existingPosition.quantity + trade.quantity
        : existingPosition.quantity - trade.quantity;

      if (newQuantity === 0) {
        // Position closed
        this.positions.delete(trade.symbol);
      } else {
        // Calculate new average price
        const totalCost = (existingPosition.avgPrice * existingPosition.quantity) + 
                         (trade.price * trade.quantity * (trade.side === 'BUY' ? 1 : -1));
        const newAvgPrice = totalCost / newQuantity;

        const updatedPosition: Position = {
          ...existingPosition,
          quantity: newQuantity,
          avgPrice: newAvgPrice,
          updatedAt: new Date(),
        };

        this.positions.set(trade.symbol, updatedPosition);
      }
    } else if (trade.side === 'BUY') {
      // Create new position
      const newPosition: Position = {
        id: this.generatePositionId(),
        userId: trade.userId,
        symbol: trade.symbol,
        quantity: trade.quantity,
        avgPrice: trade.price,
        currentPrice: trade.price,
        marketValue: trade.quantity * trade.price,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        realizedPnL: 0,
        totalReturn: 0,
        totalReturnPercent: 0,
        costBasis: trade.quantity * trade.price,
        updatedAt: new Date(),
      };

      this.positions.set(trade.symbol, newPosition);
    }
  }

  private updateRiskMetrics(order: Order): void {
    if (!this.riskMetrics) return;

    // Update day trade count
    if (order.timeInForce === 'DAY') {
      this.riskMetrics.dayTradeCount++;
    }

    // Update available cash (simplified)
    if (order.status === 'FILLED' && order.side === 'BUY') {
      const orderValue = (order.avgFillPrice || order.price || 0) * order.filledQuantity;
      this.riskMetrics.availableCash -= orderValue;
      this.riskMetrics.buyingPower -= orderValue;
    }

    this.notifyRiskListeners(this.riskMetrics);
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order || order.status === 'FILLED' || order.status === 'CANCELLED') {
      return false;
    }

    const cancelledOrder: Order = {
      ...order,
      status: 'CANCELLED',
      updatedAt: new Date(),
    };

    this.orders.set(orderId, cancelledOrder);
    this.notifyExecutionListeners(cancelledOrder);
    return true;
  }

  getOrders(userId: string): Order[] {
    return Array.from(this.orders.values())
      .filter(order => order.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getPositions(userId: string): Position[] {
    return Array.from(this.positions.values())
      .filter(position => position.userId === userId);
  }

  getTrades(userId: string, symbol?: string): Trade[] {
    return Array.from(this.trades.values())
      .filter(trade => trade.userId === userId && (!symbol || trade.symbol === symbol))
      .sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime());
  }

  getRiskMetrics(): RiskMetrics | null {
    return this.riskMetrics;
  }

  private generateOrderId(): string {
    return `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTradeId(): string {
    return `TRD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePositionId(): string {
    return `POS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startMarketDataSubscription(): void {
    // Update positions with current market prices
    setInterval(async () => {
      for (const position of Array.from(this.positions.values())) {
        try {
          const currentPrice = await this.getCurrentPrice(position.symbol);
          const marketValue = position.quantity * currentPrice;
          const unrealizedPnL = marketValue - position.costBasis;
          const unrealizedPnLPercent = (unrealizedPnL / position.costBasis) * 100;

          const updatedPosition: Position = {
            ...position,
            currentPrice,
            marketValue,
            unrealizedPnL,
            unrealizedPnLPercent,
            totalReturn: unrealizedPnL + position.realizedPnL,
            totalReturnPercent: ((unrealizedPnL + position.realizedPnL) / position.costBasis) * 100,
            updatedAt: new Date(),
          };

          this.positions.set(position.symbol, updatedPosition);
        } catch (error) {
          console.error(`Failed to update position for ${position.symbol}:`, error);
        }
      }
    }, 15000); // Update every 15 seconds
  }

  subscribeToExecutions(callback: (order: Order) => void): void {
    this.executionListeners.push(callback);
  }

  subscribeToRiskUpdates(callback: (metrics: RiskMetrics) => void): void {
    this.riskListeners.push(callback);
  }

  private notifyExecutionListeners(order: Order): void {
    this.executionListeners.forEach(callback => {
      try {
        callback(order);
      } catch (error) {
        console.error('Error in execution listener:', error);
      }
    });
  }

  private notifyRiskListeners(metrics: RiskMetrics): void {
    this.riskListeners.forEach(callback => {
      try {
        callback(metrics);
      } catch (error) {
        console.error('Error in risk listener:', error);
      }
    });
  }
}

// Singleton instance
export const orderManager = new OrderManager();