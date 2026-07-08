import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Grid3X3, 
  Plus, 
  Settings, 
  Copy, 
  Trash2, 
  Download, 
  Upload, 
  Share, 
  Star,
  Clock,
  LayoutDashboard,
  TrendingUp,
  Search,
  BarChart3,
  Eye,
  Edit,
  RefreshCw
} from "lucide-react";
import { workspaceManager, type Workspace, type WorkspaceTemplate } from "@/services/WorkspaceManager";
import { useAuth } from "@/contexts/AuthContext";

interface WorkspaceManagerProps {
  onWorkspaceChange?: (workspace: Workspace | null) => void;
}

export default function WorkspaceManager({ onWorkspaceChange }: WorkspaceManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [templates, setTemplates] = useState<WorkspaceTemplate[]>([]);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [importData, setImportData] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadWorkspaces();
      loadTemplates();
    }
  }, [user]);

  useEffect(() => {
    // Subscribe to workspace changes
    const handleWorkspaceChange = (allWorkspaces: Workspace[], current: Workspace | null) => {
      if (user) {
        const userWorkspaces = allWorkspaces.filter(w => w.userId === user.id);
        setWorkspaces(userWorkspaces);
        setCurrentWorkspace(current);
        onWorkspaceChange?.(current);
      }
    };

    workspaceManager.subscribeToChanges(handleWorkspaceChange);

    return () => {
      workspaceManager.unsubscribeFromChanges(handleWorkspaceChange);
    };
  }, [user, onWorkspaceChange]);

  const loadWorkspaces = () => {
    if (!user) return;
    
    const userWorkspaces = workspaceManager.getWorkspaces(user.id);
    setWorkspaces(userWorkspaces);
    setCurrentWorkspace(workspaceManager.getCurrentWorkspace());
  };

  const loadTemplates = () => {
    const allTemplates = workspaceManager.getTemplates();
    setTemplates(allTemplates);
  };

  const handleCreateWorkspace = async () => {
    if (!user || !newWorkspaceName.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please enter a workspace name",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    
    try {
      const workspace = workspaceManager.createWorkspace(
        newWorkspaceName.trim(), 
        user.id, 
        selectedTemplate || undefined
      );

      // Switch to the new workspace
      workspaceManager.switchWorkspace(workspace.id);

      toast({
        title: "Workspace Created",
        description: `Workspace "${workspace.name}" has been created successfully`,
      });

      setNewWorkspaceName("");
      setSelectedTemplate("");
      setIsOpen(false);
    } catch (error) {
      toast({
        title: "Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create workspace",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSwitchWorkspace = (workspaceId: string) => {
    const success = workspaceManager.switchWorkspace(workspaceId);
    if (success) {
      toast({
        title: "Workspace Switched",
        description: "Successfully switched workspace",
      });
      setIsOpen(false);
    } else {
      toast({
        title: "Switch Failed", 
        description: "Failed to switch workspace",
        variant: "destructive",
      });
    }
  };

  const handleDuplicateWorkspace = (workspace: Workspace) => {
    const duplicated = workspaceManager.duplicateWorkspace(workspace.id, `${workspace.name} (Copy)`);
    if (duplicated) {
      toast({
        title: "Workspace Duplicated",
        description: `Created copy: "${duplicated.name}"`,
      });
    } else {
      toast({
        title: "Duplication Failed",
        description: "Failed to duplicate workspace",
        variant: "destructive",
      });
    }
  };

  const handleDeleteWorkspace = (workspace: Workspace) => {
    if (workspace.isDefault) {
      toast({
        title: "Cannot Delete",
        description: "Default workspace cannot be deleted",
        variant: "destructive",
      });
      return;
    }

    const success = workspaceManager.deleteWorkspace(workspace.id);
    if (success) {
      toast({
        title: "Workspace Deleted",
        description: `Workspace "${workspace.name}" has been deleted`,
      });
    } else {
      toast({
        title: "Deletion Failed",
        description: "Failed to delete workspace",
        variant: "destructive",
      });
    }
  };

  const handleExportWorkspace = (workspace: Workspace) => {
    const exportData = workspaceManager.exportWorkspace(workspace.id);
    if (exportData) {
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workspace.name.replace(/[^a-zA-Z0-9]/g, '_')}_workspace.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Workspace Exported",
        description: "Workspace exported successfully",
      });
    } else {
      toast({
        title: "Export Failed",
        description: "Failed to export workspace",
        variant: "destructive",
      });
    }
  };

  const handleImportWorkspace = () => {
    if (!user || !importData.trim()) {
      toast({
        title: "Invalid Data",
        description: "Please provide valid workspace data",
        variant: "destructive",
      });
      return;
    }

    const imported = workspaceManager.importWorkspace(importData.trim(), user.id);
    if (imported) {
      toast({
        title: "Workspace Imported",
        description: `Workspace "${imported.name}" imported successfully`,
      });
      setImportData("");
    } else {
      toast({
        title: "Import Failed",
        description: "Failed to import workspace - invalid format",
        variant: "destructive",
      });
    }
  };

  const handleShareWorkspace = (workspace: Workspace) => {
    const shareId = workspaceManager.shareWorkspace(workspace.id);
    if (shareId) {
      navigator.clipboard.writeText(shareId);
      toast({
        title: "Workspace Shared",
        description: "Share ID copied to clipboard",
      });
    } else {
      toast({
        title: "Share Failed",
        description: "Failed to create share link",
        variant: "destructive",
      });
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'trading': return <TrendingUp className="w-4 h-4" />;
      case 'research': return <Search className="w-4 h-4" />;
      case 'monitoring': return <Eye className="w-4 h-4" />;
      case 'analysis': return <BarChart3 className="w-4 h-4" />;
      default: return <LayoutDashboard className="w-4 h-4" />;
    }
  };

  const formatLastAccessed = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="font-mono hover-elevate"
          data-testid="button-workspace-manager"
        >
          <Grid3X3 className="w-4 h-4 mr-2" />
          {currentWorkspace ? currentWorkspace.name : 'Workspaces'}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-6xl h-[85vh] bg-card border-card-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-mono text-primary flex items-center gap-2">
            <Grid3X3 className="w-5 h-5" />
            Workspace Manager
          </DialogTitle>
          <DialogDescription className="font-mono">
            Manage your Bloom Terminal workspaces and layouts
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="workspaces" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="workspaces" className="font-mono">My Workspaces</TabsTrigger>
            <TabsTrigger value="templates" className="font-mono">Templates</TabsTrigger>
            <TabsTrigger value="import-export" className="font-mono">Import/Export</TabsTrigger>
          </TabsList>

          <TabsContent value="workspaces" className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">
                  {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
                </span>
                {currentWorkspace && (
                  <Badge variant="default" className="font-mono text-xs">
                    <Star className="w-3 h-3 mr-1" />
                    Current: {currentWorkspace.name}
                  </Badge>
                )}
              </div>
              
              <Button
                onClick={loadWorkspaces}
                size="sm"
                variant="outline"
                className="font-mono"
                data-testid="button-refresh-workspaces"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>

            <ScrollArea className="flex-1 h-[450px]">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workspaces.map((workspace) => (
                  <Card 
                    key={workspace.id} 
                    className={`bg-card border-card-border hover-elevate cursor-pointer transition-all ${
                      currentWorkspace?.id === workspace.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleSwitchWorkspace(workspace.id)}
                    data-testid={`workspace-card-${workspace.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-mono font-semibold text-primary flex items-center gap-2">
                          <LayoutDashboard className="w-4 h-4" />
                          {workspace.name}
                          {workspace.isDefault && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                        </CardTitle>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateWorkspace(workspace);
                            }}
                            data-testid={`button-duplicate-${workspace.id}`}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShareWorkspace(workspace);
                            }}
                            data-testid={`button-share-${workspace.id}`}
                          >
                            <Share className="w-3 h-3" />
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportWorkspace(workspace);
                            }}
                            data-testid={`button-export-${workspace.id}`}
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                          
                          {!workspace.isDefault && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteWorkspace(workspace);
                              }}
                              data-testid={`button-delete-${workspace.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <CardDescription className="text-xs font-mono">
                        {workspace.description || 'No description'}
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="pt-0 space-y-3">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-muted-foreground">Panels:</span>
                        <span className="font-semibold">{workspace.panels.length}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-muted-foreground">Last accessed:</span>
                        <span className="font-semibold">
                          {formatLastAccessed(workspace.metadata.lastAccessedAt)}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-muted-foreground">Access count:</span>
                        <span className="font-semibold">{workspace.metadata.accessCount}</span>
                      </div>
                      
                      {workspace.metadata.tags && workspace.metadata.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {workspace.metadata.tags.map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="templates" className="flex-1 space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="workspace-name" className="font-mono text-sm">
                    Workspace Name
                  </Label>
                  <Input
                    id="workspace-name"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="Enter workspace name"
                    className="font-mono"
                    data-testid="input-workspace-name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="font-mono text-sm">Template</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger data-testid="select-workspace-template">
                      <SelectValue placeholder="Choose a template (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Blank Workspace</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Button
                onClick={handleCreateWorkspace}
                disabled={isCreating || !newWorkspaceName.trim()}
                className="w-full font-mono"
                data-testid="button-create-workspace"
              >
                {isCreating ? (
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 animate-spin" />
                    Creating...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Create Workspace
                  </div>
                )}
              </Button>
            </div>

            <Separator />

            <ScrollArea className="h-[350px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <Card key={template.id} className="bg-card border-card-border hover-elevate">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-mono font-semibold text-primary flex items-center gap-2">
                        {getCategoryIcon(template.category)}
                        {template.name}
                        <Badge variant="outline" className="text-xs font-mono">
                          {template.category}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-xs font-mono">
                        {template.description}
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <div className="space-y-2 text-xs font-mono">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Panels:</span>
                          <span className="font-semibold">{template.workspace.panels.length}</span>
                        </div>
                        
                        <div className="flex flex-wrap gap-1">
                          {template.workspace.panels.slice(0, 4).map((panel) => (
                            <Badge key={panel.id} variant="secondary" className="text-xs">
                              {panel.title}
                            </Badge>
                          ))}
                          {template.workspace.panels.length > 4 && (
                            <Badge variant="secondary" className="text-xs">
                              +{template.workspace.panels.length - 4} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="import-export" className="flex-1 space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="import-data" className="font-mono text-sm">
                  Import Workspace Data
                </Label>
                <textarea
                  id="import-data"
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  placeholder="Paste workspace JSON data here..."
                  className="w-full h-32 p-3 text-sm font-mono border border-border rounded-md bg-background resize-none"
                  data-testid="textarea-import-data"
                />
              </div>
              
              <Button
                onClick={handleImportWorkspace}
                disabled={!importData.trim()}
                className="w-full font-mono"
                data-testid="button-import-workspace"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import Workspace
              </Button>
            </div>

            <Separator />

            <Alert>
              <Clock className="w-4 h-4" />
              <AlertDescription className="font-mono text-sm">
                <strong>Auto-save:</strong> Your workspaces are automatically saved every 30 seconds.
                Manual export creates a downloadable backup of your workspace configuration.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}