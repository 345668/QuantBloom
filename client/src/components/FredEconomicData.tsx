import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, DollarSign, BarChart3, Activity, Landmark } from "lucide-react";

type FredItem = {
  name: string;
  value: number | null;
  date?: string;
  prior?: number | null;
  change?: number | null;
  changePercent?: number | null;
  category?: string;
  frequency?: string;
};

function ChangeIndicator({ change }: { change?: number | null }) {
  if (change == null) return <span className="text-muted-foreground text-xs">—</span>;
  const cls = change > 0 ? "text-green-500" : change < 0 ? "text-red-500" : "text-muted-foreground";
  return <span className={`text-xs font-mono tabular-nums ${cls}`}>{change > 0 ? "+" : ""}{change.toFixed(2)}</span>;
}

function DataRow({ label, value, unit = "", change, changePercent, icon: Icon }: {
  label: string; value: number | null; unit?: string; change?: number | null;
  changePercent?: number | null; icon?: React.ElementType;
}) {
  if (value == null) return null;
  const fmt = (v: number) => {
    if (label.includes("Claims")) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (label.includes("CPI")) return v.toFixed(1);
    return v.toFixed(2);
  };
  return (
    <div className="flex items-center justify-between py-1.5 px-2 hover:bg-muted/50 rounded-sm transition-colors">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <span className="text-sm text-foreground truncate">{label}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-semibold font-mono tabular-nums text-amber-500">{unit}{fmt(value)}</span>
        <div className="w-16 text-right"><ChangeIndicator change={change} /></div>
        {changePercent != null && (
          <span className={`text-xs font-mono tabular-nums w-20 text-right ${changePercent >= 0 ? "text-green-500" : "text-red-500"}`}>
            ({changePercent >= 0 ? "+" : ""}{changePercent.toFixed(2)}%)
          </span>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title, icon: Icon }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/30 rounded-sm">
      <Icon className="h-3.5 w-3.5 text-amber-500" />
      <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">{title}</span>
    </div>
  );
}

export function FredEconomicData() {
  const { data: rates } = useQuery<Record<string, FredItem>>({ queryKey: ["/api/fred/rates"], refetchInterval: 300000 });
  const { data: market } = useQuery<Record<string, FredItem>>({ queryKey: ["/api/fred/market"], refetchInterval: 300000 });
  const { data: macro } = useQuery<Record<string, FredItem>>({ queryKey: ["/api/fred/macro"], refetchInterval: 600000 });

  const hasRates = rates && Object.keys(rates).length > 0;
  const hasMarket = market && Object.keys(market).length > 0;
  const hasMacro = macro && Object.keys(macro).length > 0;

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-sm font-bold tracking-wider flex items-center justify-between">
          <div className="flex items-center gap-2"><Landmark className="h-4 w-4 text-amber-500" /><span>ECONOMIC DATA</span></div>
          <Badge variant="outline" className="text-[10px] font-bold text-blue-400 border-blue-400/30">FRED</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        {!hasRates && !hasMarket && !hasMacro ? (
          <div className="text-center text-muted-foreground text-sm py-8">Loading FRED data...</div>
        ) : (
          <ScrollArea className="h-[340px]">
            <div className="space-y-3">
              {hasRates && (
                <div className="space-y-0.5">
                  <SectionHeader title="Rates & Yield Curve" icon={Landmark} />
                  {["DFF","DGS2","DGS10","DGS30","T10Y2Y","T10YFF"].map(id => rates[id] && <DataRow key={id} label={rates[id].name} value={rates[id].value} change={rates[id].change} />)}
                </div>
              )}
              {hasMarket && (
                <div className="space-y-0.5">
                  <SectionHeader title="Market Indicators" icon={Activity} />
                  {["VIXCLS","DTWEXBGS"].map(id => market[id] && <DataRow key={id} label={market[id].name} value={market[id].value} change={market[id].change} changePercent={market[id].changePercent} icon={BarChart3} />)}
                  {["DCOILWTICO","DCOILBRENTEU","GOLDAMGBD228NLBM"].map(id => market[id] && <DataRow key={id} label={market[id].name} value={market[id].value} unit="$" change={market[id].change} changePercent={market[id].changePercent} icon={DollarSign} />)}
                </div>
              )}
              {hasMacro && (
                <div className="space-y-0.5">
                  <SectionHeader title="Macro Indicators" icon={TrendingUp} />
                  {["FEDFUNDS","UNRATE","UMCSENT","IC4WSA","BAMLH0A0HYM2"].map(id => macro[id] && <DataRow key={id} label={macro[id].name} value={macro[id].value} change={macro[id].change} />)}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
