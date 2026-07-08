import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { 
  TrendingUp, 
  TrendingDown, 
  Calculator, 
  AlertTriangle, 
  DollarSign, 
  Clock, 
  Shield,
  Target
} from "lucide-react";
import { 
  CreateOrderSchema, 
  type CreateOrder, 
  type OrderType, 
  type OrderSide, 
  type TimeInForce 
} from "@shared/orderSchema";
import { orderManager } from "@/services/OrderManager";
import { useAuth } from "@/contexts/AuthContext";

interface OrderEntryPanelProps {
  symbol?: string;
  currentPrice?: number;
  onOrderSubmitted?: (orderId: string) => void;
}

export default function OrderEntryPanel({ 
  symbol = "AAPL", 
  currentPrice = 178.85,
  onOrderSubmitted 
}: OrderEntryPanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [estimatedCommission, setEstimatedCommission] = useState(0.99);
  const [riskLevel, setRiskLevel] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<CreateOrder>({
    resolver: zodResolver(CreateOrderSchema),
    defaultValues: {
      symbol,
      side: 'BUY',
      orderType: 'MARKET',
      quantity: 100,
      timeInForce: 'DAY',
      price: currentPrice,
      maxSlippage: 0.005, // 0.5%
      positionSizing: 'FIXED',
    },
  });

  const watchedValues = form.watch();

  // Calculate estimated costs whenever form values change
  useEffect(() => {
    const quantity = watchedValues.quantity || 0;
    const price = watchedValues.price || currentPrice;
    const orderType = watchedValues.orderType;

    let estimatedPrice = price;
    if (orderType === 'MARKET') {
      // Add estimated slippage for market orders
      const slippage = (watchedValues.maxSlippage || 0.005) * price;
      estimatedPrice = watchedValues.side === 'BUY' ? price + slippage : price - slippage;
    }

    const cost = quantity * estimatedPrice;
    setEstimatedCost(cost);

    // Calculate commission (simplified)
    const commission = Math.max(0.99, quantity * 0.005);
    setEstimatedCommission(commission);

    // Calculate risk level
    const portfolioValue = 100000; // This would come from risk metrics
    const positionSize = cost / portfolioValue;
    
    if (positionSize < 0.05) setRiskLevel('LOW');
    else if (positionSize < 0.15) setRiskLevel('MEDIUM');
    else setRiskLevel('HIGH');
  }, [watchedValues, currentPrice]);

  const onSubmit = async (data: CreateOrder) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to place orders",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await orderManager.submitOrder(data, user.id);
      
      if (result.success) {
        toast({
          title: "Order Submitted",
          description: `Order ${result.orderId} has been placed successfully`,
        });
        
        onOrderSubmitted?.(result.orderId!);
        form.reset();
      } else {
        toast({
          title: "Order Failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Order Error",
        description: error instanceof Error ? error.message : "Failed to submit order",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRiskBadgeVariant = (level: string) => {
    switch (level) {
      case 'LOW': return 'default';
      case 'MEDIUM': return 'secondary';
      case 'HIGH': return 'destructive';
      default: return 'default';
    }
  };

  const orderTypeRequiresPrice = ['LIMIT', 'STOP_LIMIT', 'LIMIT_ON_CLOSE'].includes(watchedValues.orderType);
  const orderTypeRequiresStopPrice = ['STOP', 'STOP_LIMIT', 'TRAILING_STOP'].includes(watchedValues.orderType);

  return (
    <Card className="bg-card border-card-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-mono text-primary flex items-center gap-2">
          <Target className="w-5 h-5" />
          Order Entry - {symbol}
        </CardTitle>
        <CardDescription className="font-mono">
          Current Price: <span className="font-semibold text-primary">${currentPrice?.toFixed(2)}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Order Side & Type */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="side"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-sm">Side</FormLabel>
                    <FormControl>
                      <div className="grid grid-cols-2 gap-1">
                        <Button
                          type="button"
                          variant={field.value === 'BUY' ? 'default' : 'outline'}
                          className={`font-mono ${field.value === 'BUY' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                          onClick={() => field.onChange('BUY')}
                          data-testid="button-order-buy"
                        >
                          <TrendingUp className="w-4 h-4 mr-1" />
                          BUY
                        </Button>
                        <Button
                          type="button"
                          variant={field.value === 'SELL' ? 'default' : 'outline'}
                          className={`font-mono ${field.value === 'SELL' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                          onClick={() => field.onChange('SELL')}
                          data-testid="button-order-sell"
                        >
                          <TrendingDown className="w-4 h-4 mr-1" />
                          SELL
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="orderType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-sm">Order Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-order-type">
                          <SelectValue placeholder="Select order type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MARKET">Market</SelectItem>
                        <SelectItem value="LIMIT">Limit</SelectItem>
                        <SelectItem value="STOP">Stop</SelectItem>
                        <SelectItem value="STOP_LIMIT">Stop Limit</SelectItem>
                        <SelectItem value="TRAILING_STOP">Trailing Stop</SelectItem>
                        <SelectItem value="MARKET_ON_CLOSE">Market on Close</SelectItem>
                        <SelectItem value="LIMIT_ON_CLOSE">Limit on Close</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Quantity */}
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-sm">Quantity</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      className="font-mono"
                      data-testid="input-order-quantity"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Price (conditional) */}
            {orderTypeRequiresPrice && (
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-sm">Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="font-mono"
                        data-testid="input-order-price"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Stop Price (conditional) */}
            {orderTypeRequiresStopPrice && (
              <FormField
                control={form.control}
                name="stopPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-sm">Stop Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="font-mono"
                        data-testid="input-order-stop-price"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Time in Force */}
            <FormField
              control={form.control}
              name="timeInForce"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-sm">Time in Force</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-time-in-force">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="DAY">Day</SelectItem>
                      <SelectItem value="GTC">Good Till Cancelled</SelectItem>
                      <SelectItem value="IOC">Immediate or Cancel</SelectItem>
                      <SelectItem value="FOK">Fill or Kill</SelectItem>
                      <SelectItem value="GTD">Good Till Date</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Advanced Options Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="advanced-options" className="font-mono text-sm">
                Advanced Options
              </Label>
              <Switch
                id="advanced-options"
                checked={showAdvanced}
                onCheckedChange={setShowAdvanced}
                data-testid="switch-advanced-options"
              />
            </div>

            {/* Advanced Options */}
            {showAdvanced && (
              <div className="space-y-4 p-4 border border-border rounded-md bg-muted/5">
                <FormField
                  control={form.control}
                  name="maxSlippage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-sm">
                        Max Slippage: {((field.value || 0) * 100).toFixed(2)}%
                      </FormLabel>
                      <FormControl>
                        <Slider
                          value={[field.value || 0]}
                          onValueChange={(value) => field.onChange(value[0])}
                          max={0.05}
                          min={0.001}
                          step={0.001}
                          className="w-full"
                          data-testid="slider-max-slippage"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="positionSizing"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-sm">Position Sizing</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-position-sizing">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="FIXED">Fixed Quantity</SelectItem>
                          <SelectItem value="PERCENT_PORTFOLIO">% of Portfolio</SelectItem>
                          <SelectItem value="RISK_BASED">Risk-Based</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <Separator />

            {/* Order Summary */}
            <div className="space-y-3 p-4 bg-muted/10 rounded-md border border-border">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono text-sm font-semibold">Order Summary</span>
                <Badge variant={getRiskBadgeVariant(riskLevel)} className="font-mono text-xs">
                  <Shield className="w-3 h-3 mr-1" />
                  {riskLevel} RISK
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm font-mono">
                <div>
                  <span className="text-muted-foreground">Estimated Cost:</span>
                  <div className="font-semibold text-primary">
                    ${estimatedCost.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Commission:</span>
                  <div className="font-semibold">
                    ${estimatedCommission.toFixed(2)}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Cost:</span>
                  <div className="font-semibold text-primary">
                    ${(estimatedCost + estimatedCommission).toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Portfolio %:</span>
                  <div className="font-semibold">
                    {((estimatedCost / 100000) * 100).toFixed(2)}%
                  </div>
                </div>
              </div>

              {riskLevel === 'HIGH' && (
                <Alert className="border-yellow-500/20 bg-yellow-500/5">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <AlertDescription className="font-mono text-sm">
                    High risk order. This order represents a significant portion of your portfolio.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className={`w-full font-mono font-semibold ${
                watchedValues.side === 'BUY' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-red-600 hover:bg-red-700'
              }`}
              data-testid="button-submit-order"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 animate-spin" />
                  Submitting...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  {watchedValues.side} {watchedValues.quantity} {symbol}
                </div>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}