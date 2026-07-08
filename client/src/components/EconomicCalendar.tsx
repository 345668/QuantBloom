import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Clock, AlertTriangle, TrendingUp, Globe, ChevronDown, ChevronUp, Filter, RefreshCw } from "lucide-react";
import type { EconomicEvent } from "@shared/schema";
import { format, isToday, isTomorrow, isThisWeek, startOfDay, addDays } from "date-fns";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function EconomicCalendar() {
  const [selectedImportance, setSelectedImportance] = useState<string[]>(['high', 'medium', 'low']);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const { toast } = useToast();
  
  const { data: events = [], isLoading, error, isRefetching } = useQuery<EconomicEvent[]>({
    queryKey: ['/api/economic-calendar'],
    refetchInterval: 300000,
  });

  const countries = useMemo(() => {
    const uniqueCountries = new Set(events.map(e => e.country));
    return Array.from(uniqueCountries).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events
      .filter(event => selectedImportance.includes(event.importance))
      .filter(event => selectedCountries.length === 0 || selectedCountries.includes(event.country))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [events, selectedImportance, selectedCountries]);

  const groupedEvents = useMemo(() => {
    const today: EconomicEvent[] = [];
    const tomorrow: EconomicEvent[] = [];
    const thisWeek: EconomicEvent[] = [];
    const later: EconomicEvent[] = [];

    filteredEvents.forEach(event => {
      const eventDate = new Date(event.timestamp);
      if (isToday(eventDate)) {
        today.push(event);
      } else if (isTomorrow(eventDate)) {
        tomorrow.push(event);
      } else if (isThisWeek(eventDate, { weekStartsOn: 0 })) {
        thisWeek.push(event);
      } else {
        later.push(event);
      }
    });

    return { today, tomorrow, thisWeek, later };
  }, [filteredEvents]);

  const getImportanceIcon = (importance: string) => {
    switch (importance) {
      case 'high': return <AlertTriangle className="w-3 h-3" />;
      case 'medium': return <TrendingUp className="w-3 h-3" />;
      default: return <Globe className="w-3 h-3" />;
    }
  };

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  const formatEventTime = (timestamp: Date) => {
    const date = new Date(timestamp);
    return format(date, 'HH:mm');
  };

  const formatEventDate = (timestamp: Date) => {
    const date = new Date(timestamp);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM dd');
  };

  const toggleImportance = (importance: string) => {
    setSelectedImportance(prev => 
      prev.includes(importance) 
        ? prev.filter(i => i !== importance)
        : [...prev, importance]
    );
  };

  const toggleCountry = (country: string) => {
    setSelectedCountries(prev => 
      prev.includes(country) 
        ? prev.filter(c => c !== country)
        : [...prev, country]
    );
  };

  const toggleExpandEvent = (eventId: string) => {
    setExpandedEvent(prev => prev === eventId ? null : eventId);
  };

  const handleRefresh = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ['/api/economic-calendar'] });
      toast({
        title: "Calendar refreshed",
        description: "Economic events have been updated",
      });
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Unable to refresh economic calendar",
        variant: "destructive",
      });
    }
  };

  const renderEvent = (event: EconomicEvent) => {
    const isExpanded = expandedEvent === event.id;
    
    return (
      <div
        key={event.id}
        data-testid={`event-${event.id}`}
        className="border border-border rounded-md overflow-hidden hover-elevate transition-all bg-card"
      >
        <button
          onClick={() => toggleExpandEvent(event.id)}
          className="w-full text-left p-3"
          data-testid={`button-toggle-event-${event.id}`}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge 
                variant="outline" 
                className={`text-xs px-2 py-0.5 h-5 flex items-center gap-1 ${getImportanceColor(event.importance)}`}
                data-testid={`badge-importance-${event.id}`}
              >
                {getImportanceIcon(event.importance)}
                <span className="capitalize">{event.importance}</span>
              </Badge>
              
              <Badge variant="outline" className="text-xs" data-testid={`badge-country-${event.id}`}>
                {event.country}
              </Badge>
              
              <Badge variant="outline" className="text-xs" data-testid={`badge-currency-${event.id}`}>
                {event.currency}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span className="font-mono" data-testid={`text-time-${event.id}`}>
                  {formatEventDate(event.timestamp)} {formatEventTime(event.timestamp)}
                </span>
              </div>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
          
          <h4 className="font-medium text-sm leading-tight" data-testid={`text-title-${event.id}`}>
            {event.title}
          </h4>
        </button>
        
        {isExpanded && (
          <div className="px-3 pb-3 pt-0 border-t border-border mt-2" data-testid={`details-${event.id}`}>
            <div className="grid grid-cols-3 gap-3 text-xs mt-3">
              {event.previous && (
                <div>
                  <span className="text-muted-foreground">Previous:</span>
                  <div className="font-mono font-medium mt-1" data-testid={`text-previous-${event.id}`}>
                    {event.previous}
                  </div>
                </div>
              )}
              
              {event.forecast && (
                <div>
                  <span className="text-muted-foreground">Forecast:</span>
                  <div className="font-mono font-medium mt-1" data-testid={`text-forecast-${event.id}`}>
                    {event.forecast}
                  </div>
                </div>
              )}
              
              {event.actual && (
                <div>
                  <span className="text-muted-foreground">Actual:</span>
                  <div className="font-mono font-medium text-orange-400 mt-1" data-testid={`text-actual-${event.id}`}>
                    {event.actual}
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-3">
              <Badge variant="secondary" className="text-xs" data-testid={`badge-category-${event.id}`}>
                {event.category}
              </Badge>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderEventGroup = (title: string, events: EconomicEvent[], testId: string) => {
    if (events.length === 0) return null;
    
    return (
      <div className="mb-4" data-testid={`group-${testId}`}>
        <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
          {title} ({events.length})
        </h3>
        <div className="space-y-2">
          {events.map(renderEvent)}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className="h-96 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-mono flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Economic Calendar
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            <div className="text-sm text-muted-foreground">Loading events...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-96 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-mono flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Economic Calendar
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefetching}
              className="h-7 px-2 text-xs"
              data-testid="button-refresh-calendar"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isRefetching ? 'animate-spin' : ''}`} />
              Retry
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-2">Failed to load economic events</div>
            <div className="text-xs text-muted-foreground">Please check your connection and try again</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-96 flex flex-col">
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg font-mono flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Economic Calendar
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs" data-testid="badge-event-count">
              {filteredEvents.length} events
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRefresh}
              disabled={isRefetching}
              className="h-7 w-7 p-0"
              data-testid="button-refresh-calendar"
            >
              <RefreshCw className={`w-3 h-3 ${isRefetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Importance:</span>
            <Button
              size="sm"
              variant={selectedImportance.includes('high') ? 'default' : 'outline'}
              onClick={() => toggleImportance('high')}
              className="h-6 px-2 text-xs"
              data-testid="button-filter-high"
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              High
            </Button>
            <Button
              size="sm"
              variant={selectedImportance.includes('medium') ? 'default' : 'outline'}
              onClick={() => toggleImportance('medium')}
              className="h-6 px-2 text-xs"
              data-testid="button-filter-medium"
            >
              <TrendingUp className="w-3 h-3 mr-1" />
              Medium
            </Button>
            <Button
              size="sm"
              variant={selectedImportance.includes('low') ? 'default' : 'outline'}
              onClick={() => toggleImportance('low')}
              className="h-6 px-2 text-xs"
              data-testid="button-filter-low"
            >
              <Globe className="w-3 h-3 mr-1" />
              Low
            </Button>
          </div>
          
          {countries.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Countries:</span>
              <Button
                size="sm"
                variant={selectedCountries.length === 0 ? 'default' : 'outline'}
                onClick={() => setSelectedCountries([])}
                className="h-6 px-2 text-xs"
                data-testid="button-filter-all-countries"
              >
                All
              </Button>
              {countries.slice(0, 6).map(country => (
                <Button
                  key={country}
                  size="sm"
                  variant={selectedCountries.includes(country) ? 'default' : 'outline'}
                  onClick={() => toggleCountry(country)}
                  className="h-6 px-2 text-xs"
                  data-testid={`button-filter-country-${country}`}
                >
                  {country}
                </Button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          <div className="p-3 pt-0">
            {filteredEvents.length > 0 ? (
              <>
                {renderEventGroup('Today', groupedEvents.today, 'today')}
                {renderEventGroup('Tomorrow', groupedEvents.tomorrow, 'tomorrow')}
                {renderEventGroup('This Week', groupedEvents.thisWeek, 'this-week')}
                {renderEventGroup('Later', groupedEvents.later, 'later')}
              </>
            ) : (
              <div className="text-center text-sm text-muted-foreground py-8">
                No events match the selected filters
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
