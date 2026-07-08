import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Keyboard, Command, Search, BarChart3, Grid3X3, Settings, Bell, User, RefreshCw } from "lucide-react";
import { type KeyboardShortcut } from "@/hooks/useKeyboardShortcuts";

interface KeyboardShortcutsPanelProps {
  shortcuts: KeyboardShortcut[];
  getShortcutDisplay: (shortcut: KeyboardShortcut) => string;
  children: React.ReactNode;
}

export default function KeyboardShortcutsPanel({ 
  shortcuts, 
  getShortcutDisplay, 
  children 
}: KeyboardShortcutsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((groups, shortcut) => {
    if (!groups[shortcut.category]) {
      groups[shortcut.category] = [];
    }
    groups[shortcut.category].push(shortcut);
    return groups;
  }, {} as Record<string, KeyboardShortcut[]>);

  // Category icons
  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'navigation':
        return <Grid3X3 className="w-4 h-4" />;
      case 'search':
        return <Search className="w-4 h-4" />;
      case 'charts':
        return <BarChart3 className="w-4 h-4" />;
      case 'data':
        return <RefreshCw className="w-4 h-4" />;
      case 'system':
        return <Settings className="w-4 h-4" />;
      case 'notifications':
        return <Bell className="w-4 h-4" />;
      case 'profile':
        return <User className="w-4 h-4" />;
      default:
        return <Command className="w-4 h-4" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      
      <DialogContent 
        className="max-w-4xl h-[80vh] bg-card border-card-border"
        data-testid="keyboard-shortcuts-panel"
      >
        <DialogHeader className="border-b border-card-border pb-4">
          <DialogTitle className="text-primary font-mono text-xl uppercase tracking-wide flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <p className="text-sm text-muted-foreground font-mono mt-1">
            Bloom Terminal-style hotkeys for efficient navigation
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
              <div key={category} className="space-y-3">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(category)}
                  <h3 className="text-lg font-mono font-semibold text-primary uppercase tracking-wide">
                    {category}
                  </h3>
                  <Badge variant="outline" className="font-mono text-xs">
                    {categoryShortcuts.length} shortcuts
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {categoryShortcuts.map((shortcut, index) => (
                    <div
                      key={`${category}-${index}`}
                      className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/5 hover-elevate"
                      data-testid={`shortcut-${category}-${index}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono text-foreground font-medium">
                          {shortcut.description}
                        </p>
                      </div>
                      
                      <div className="flex-shrink-0 ml-3">
                        <Badge 
                          variant="secondary" 
                          className="font-mono text-xs bg-card border border-border px-2 py-1"
                        >
                          {getShortcutDisplay(shortcut)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                
                {Object.keys(groupedShortcuts).indexOf(category) < Object.keys(groupedShortcuts).length - 1 && (
                  <Separator className="border-card-border my-4" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="border-t border-card-border pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-mono">
              Total: {shortcuts.length} keyboard shortcuts available
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                <Keyboard className="w-3 h-3 mr-1" />
                Press ? for help
              </Badge>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setIsOpen(false)}
                className="font-mono text-xs"
                data-testid="button-close-shortcuts"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}