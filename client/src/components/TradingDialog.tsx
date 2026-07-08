import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TrendingUp, TrendingDown, DollarSign, AlertCircle } from "lucide-react";

const buySchema = z.object({
  quantity: z.coerce.number().positive("Quantity must be positive").min(0.00000001, "Quantity too small"),
});

const createSellSchema = (maxQuantity: number) =>
  z.object({
    quantity: z.coerce
      .number()
      .positive("Quantity must be positive")
      .min(0.00000001, "Quantity too small")
      .max(maxQuantity, `Cannot sell more than ${maxQuantity.toFixed(8)} available`),
  });

type TradeForm = z.infer<typeof buySchema>;

interface TradingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
  currentPrice?: number;
  availableQuantity?: number;
}

export default function TradingDialog({
  open,
  onOpenChange,
  symbol,
  currentPrice = 0,
  availableQuantity = 0,
}: TradingDialogProps) {
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const buyForm = useForm<TradeForm>({
    resolver: zodResolver(buySchema),
    defaultValues: {
      quantity: 1,
    },
  });

  const sellForm = useForm<TradeForm>({
    resolver: zodResolver(createSellSchema(availableQuantity || Number.MAX_SAFE_INTEGER)),
    defaultValues: {
      quantity: 1,
    },
  });

  const buyMutation = useMutation({
    mutationFn: async (data: TradeForm) => {
      return apiRequest("POST", "/api/trade/buy", {
        symbol,
        quantity: data.quantity,
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Trade Executed",
        description: data.message || `Successfully bought ${symbol}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      buyForm.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Trade Failed",
        description: error.message || "Failed to execute buy order",
        variant: "destructive",
      });
    },
  });

  const sellMutation = useMutation({
    mutationFn: async (data: TradeForm) => {
      return apiRequest("POST", "/api/trade/sell", {
        symbol,
        quantity: data.quantity,
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Trade Executed",
        description: data.message || `Successfully sold ${symbol}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      sellForm.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Trade Failed",
        description: error.message || "Failed to execute sell order",
        variant: "destructive",
      });
    },
  });

  const handleBuy = (data: TradeForm) => {
    buyMutation.mutate(data);
  };

  const handleSell = (data: TradeForm) => {
    sellMutation.mutate(data);
  };

  const buyQuantity = buyForm.watch("quantity");
  const sellQuantity = sellForm.watch("quantity");
  const estimatedBuyCost = buyQuantity * currentPrice;
  const estimatedSellProceeds = sellQuantity * currentPrice;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-trading">
        <DialogHeader>
          <DialogTitle>Trade {symbol}</DialogTitle>
          <DialogDescription>
            Execute a market order for {symbol}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-card rounded-md border">
            <div>
              <div className="text-xs text-muted-foreground">Current Price</div>
              <div className="text-lg font-semibold" data-testid="text-current-price">
                ${currentPrice.toFixed(2)}
              </div>
            </div>
            {availableQuantity > 0 && (
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Available</div>
                <div className="text-sm font-medium" data-testid="text-available-quantity">
                  {availableQuantity}
                </div>
              </div>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "buy" | "sell")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="buy" data-testid="tab-buy">
                <TrendingUp className="w-4 h-4 mr-2" />
                Buy
              </TabsTrigger>
              <TabsTrigger value="sell" data-testid="tab-sell">
                <TrendingDown className="w-4 h-4 mr-2" />
                Sell
              </TabsTrigger>
            </TabsList>

            <TabsContent value="buy" className="space-y-4">
              <form onSubmit={buyForm.handleSubmit(handleBuy)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="buy-quantity">Quantity</Label>
                  <Input
                    id="buy-quantity"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Enter quantity"
                    data-testid="input-buy-quantity"
                    {...buyForm.register("quantity")}
                  />
                  {buyForm.formState.errors.quantity && (
                    <p className="text-sm text-destructive">
                      {buyForm.formState.errors.quantity.message}
                    </p>
                  )}
                </div>

                <div className="p-3 bg-muted rounded-md space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Estimated Cost</span>
                    <span className="font-medium" data-testid="text-estimated-cost">
                      ${estimatedBuyCost.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Order Type</span>
                    <Badge variant="outline">Market</Badge>
                  </div>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Market orders execute immediately at the current price. Actual execution
                    price may vary slightly.
                  </AlertDescription>
                </Alert>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={buyMutation.isPending}
                  data-testid="button-execute-buy"
                >
                  {buyMutation.isPending ? (
                    "Processing..."
                  ) : (
                    <>
                      <DollarSign className="w-4 h-4 mr-2" />
                      Buy {symbol}
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="sell" className="space-y-4">
              <form onSubmit={sellForm.handleSubmit(handleSell)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sell-quantity">Quantity</Label>
                  <Input
                    id="sell-quantity"
                    type="number"
                    step="any"
                    min="0"
                    max={availableQuantity}
                    placeholder="Enter quantity"
                    data-testid="input-sell-quantity"
                    {...sellForm.register("quantity")}
                  />
                  {sellForm.formState.errors.quantity && (
                    <p className="text-sm text-destructive">
                      {sellForm.formState.errors.quantity.message}
                    </p>
                  )}
                </div>

                <div className="p-3 bg-muted rounded-md space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Estimated Proceeds</span>
                    <span className="font-medium" data-testid="text-estimated-proceeds">
                      ${estimatedSellProceeds.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Order Type</span>
                    <Badge variant="outline">Market</Badge>
                  </div>
                </div>

                {availableQuantity === 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      You don't own any {symbol} to sell. Buy some first!
                    </AlertDescription>
                  </Alert>
                )}

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Market orders execute immediately at the current price. Actual execution
                    price may vary slightly.
                  </AlertDescription>
                </Alert>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={sellMutation.isPending || availableQuantity === 0}
                  data-testid="button-execute-sell"
                >
                  {sellMutation.isPending ? (
                    "Processing..."
                  ) : (
                    <>
                      <DollarSign className="w-4 h-4 mr-2" />
                      Sell {symbol}
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
