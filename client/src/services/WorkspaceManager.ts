import { queryClient } from '@/lib/queryClient';

export interface WorkspaceLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  isDraggable?: boolean;
  isResizable?: boolean;
  static?: boolean;
}

export interface WorkspacePanel {
  id: string;
  type: string;
  title: string;
  symbol?: string;
  config?: Record<string, any>;
  data?: any;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  userId: string;
  layouts: {
    lg: WorkspaceLayout[];
    md: WorkspaceLayout[];
    sm: WorkspaceLayout[];
    xs: WorkspaceLayout[];
  };
  panels: WorkspacePanel[];
  settings: {
    theme?: string;
    refreshInterval?: number;
    autoSave?: boolean;
    gridCompact?: boolean;
    gridMargin?: [number, number];
    gridPadding?: [number, number];
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    lastAccessedAt: Date;
    accessCount: number;
    tags?: string[];
    isPublic?: boolean;
    shareId?: string;
  };
}

export interface WorkspaceTemplate {
  id: string;
  name: string;
  description: string;
  category: 'trading' | 'research' | 'monitoring' | 'analysis' | 'custom';
  thumbnail?: string;
  workspace: Omit<Workspace, 'id' | 'userId' | 'metadata'>;
}

class WorkspaceManager {
  private workspaces: Map<string, Workspace> = new Map();
  private currentWorkspaceId: string | null = null;
  private templates: Map<string, WorkspaceTemplate> = new Map();
  private changeListeners: Array<(workspaces: Workspace[], current: Workspace | null) => void> = [];
  private autoSaveInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeDefaultTemplates();
    this.loadWorkspacesFromStorage();
    this.startAutoSave();
  }

  private initializeDefaultTemplates() {
    const tradingTemplate: WorkspaceTemplate = {
      id: 'trading-basic',
      name: 'Basic Trading',
      description: 'Essential panels for active trading',
      category: 'trading',
      workspace: {
        name: 'Basic Trading',
        description: 'Essential panels for active trading',
        isDefault: false,
        layouts: {
          lg: [
            { i: 'quote', x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
            { i: 'chart', x: 6, y: 0, w: 12, h: 8, minW: 8, minH: 6 },
            { i: 'order-entry', x: 18, y: 0, w: 6, h: 8, minW: 4, minH: 6 },
            { i: 'watchlist', x: 0, y: 4, w: 6, h: 8, minW: 4, minH: 6 },
            { i: 'portfolio', x: 6, y: 8, w: 6, h: 6, minW: 4, minH: 4 },
            { i: 'orders', x: 12, y: 8, w: 6, h: 6, minW: 4, minH: 4 },
          ],
          md: [
            { i: 'quote', x: 0, y: 0, w: 5, h: 4, minW: 4, minH: 3 },
            { i: 'chart', x: 5, y: 0, w: 10, h: 6, minW: 6, minH: 4 },
            { i: 'order-entry', x: 15, y: 0, w: 5, h: 6, minW: 4, minH: 4 },
            { i: 'watchlist', x: 0, y: 4, w: 5, h: 6, minW: 4, minH: 4 },
            { i: 'portfolio', x: 5, y: 6, w: 5, h: 4, minW: 4, minH: 3 },
            { i: 'orders', x: 10, y: 6, w: 5, h: 4, minW: 4, minH: 3 },
          ],
          sm: [
            { i: 'quote', x: 0, y: 0, w: 12, h: 4, minW: 6, minH: 3 },
            { i: 'chart', x: 0, y: 4, w: 12, h: 6, minW: 6, minH: 4 },
            { i: 'order-entry', x: 0, y: 10, w: 6, h: 6, minW: 4, minH: 4 },
            { i: 'watchlist', x: 6, y: 10, w: 6, h: 6, minW: 4, minH: 4 },
            { i: 'portfolio', x: 0, y: 16, w: 6, h: 4, minW: 4, minH: 3 },
            { i: 'orders', x: 6, y: 16, w: 6, h: 4, minW: 4, minH: 3 },
          ],
          xs: [
            { i: 'quote', x: 0, y: 0, w: 4, h: 4, minW: 4, minH: 3 },
            { i: 'chart', x: 0, y: 4, w: 4, h: 6, minW: 4, minH: 4 },
            { i: 'order-entry', x: 0, y: 10, w: 4, h: 6, minW: 4, minH: 4 },
            { i: 'watchlist', x: 0, y: 16, w: 4, h: 6, minW: 4, minH: 4 },
            { i: 'portfolio', x: 0, y: 22, w: 4, h: 4, minW: 4, minH: 3 },
            { i: 'orders', x: 0, y: 26, w: 4, h: 4, minW: 4, minH: 3 },
          ],
        },
        panels: [
          { id: 'quote', type: 'quote', title: 'Stock Quote', symbol: 'AAPL' },
          { id: 'chart', type: 'chart', title: 'Price Chart', symbol: 'AAPL' },
          { id: 'order-entry', type: 'order-entry', title: 'Order Entry' },
          { id: 'watchlist', type: 'watchlist', title: 'Watchlist' },
          { id: 'portfolio', type: 'portfolio', title: 'Portfolio' },
          { id: 'orders', type: 'orders', title: 'Orders' },
        ],
        settings: {
          refreshInterval: 15000,
          autoSave: true,
          gridCompact: true,
          gridMargin: [8, 8],
          gridPadding: [8, 8],
        },
      },
    };

    const researchTemplate: WorkspaceTemplate = {
      id: 'research-comprehensive',
      name: 'Comprehensive Research',
      description: 'Complete research workspace with analysis tools',
      category: 'research',
      workspace: {
        name: 'Comprehensive Research',
        description: 'Complete research workspace with analysis tools',
        isDefault: false,
        layouts: {
          lg: [
            { i: 'quote', x: 0, y: 0, w: 4, h: 4, minW: 4, minH: 3 },
            { i: 'chart', x: 4, y: 0, w: 8, h: 8, minW: 6, minH: 6 },
            { i: 'fundamentals', x: 12, y: 0, w: 6, h: 8, minW: 4, minH: 6 },
            { i: 'news', x: 18, y: 0, w: 6, h: 8, minW: 4, minH: 6 },
            { i: 'technical', x: 0, y: 4, w: 4, h: 8, minW: 4, minH: 6 },
            { i: 'screener', x: 4, y: 8, w: 8, h: 8, minW: 6, minH: 6 },
            { i: 'sector', x: 12, y: 8, w: 6, h: 8, minW: 4, minH: 6 },
            { i: 'calendar', x: 18, y: 8, w: 6, h: 8, minW: 4, minH: 6 },
          ],
          md: [
            { i: 'quote', x: 0, y: 0, w: 5, h: 4, minW: 4, minH: 3 },
            { i: 'chart', x: 5, y: 0, w: 10, h: 6, minW: 6, minH: 4 },
            { i: 'fundamentals', x: 15, y: 0, w: 5, h: 6, minW: 4, minH: 4 },
            { i: 'news', x: 0, y: 4, w: 5, h: 6, minW: 4, minH: 4 },
            { i: 'technical', x: 5, y: 6, w: 5, h: 6, minW: 4, minH: 4 },
            { i: 'screener', x: 10, y: 6, w: 5, h: 6, minW: 4, minH: 4 },
            { i: 'sector', x: 15, y: 6, w: 5, h: 6, minW: 4, minH: 4 },
            { i: 'calendar', x: 0, y: 10, w: 10, h: 6, minW: 6, minH: 4 },
          ],
          sm: [
            { i: 'quote', x: 0, y: 0, w: 12, h: 4, minW: 6, minH: 3 },
            { i: 'chart', x: 0, y: 4, w: 12, h: 6, minW: 6, minH: 4 },
            { i: 'fundamentals', x: 0, y: 10, w: 6, h: 6, minW: 4, minH: 4 },
            { i: 'news', x: 6, y: 10, w: 6, h: 6, minW: 4, minH: 4 },
            { i: 'technical', x: 0, y: 16, w: 6, h: 6, minW: 4, minH: 4 },
            { i: 'screener', x: 6, y: 16, w: 6, h: 6, minW: 4, minH: 4 },
            { i: 'sector', x: 0, y: 22, w: 6, h: 6, minW: 4, minH: 4 },
            { i: 'calendar', x: 6, y: 22, w: 6, h: 6, minW: 4, minH: 4 },
          ],
          xs: [
            { i: 'quote', x: 0, y: 0, w: 4, h: 4, minW: 4, minH: 3 },
            { i: 'chart', x: 0, y: 4, w: 4, h: 6, minW: 4, minH: 4 },
            { i: 'fundamentals', x: 0, y: 10, w: 4, h: 6, minW: 4, minH: 4 },
            { i: 'news', x: 0, y: 16, w: 4, h: 6, minW: 4, minH: 4 },
            { i: 'technical', x: 0, y: 22, w: 4, h: 6, minW: 4, minH: 4 },
            { i: 'screener', x: 0, y: 28, w: 4, h: 6, minW: 4, minH: 4 },
            { i: 'sector', x: 0, y: 34, w: 4, h: 6, minW: 4, minH: 4 },
            { i: 'calendar', x: 0, y: 40, w: 4, h: 6, minW: 4, minH: 4 },
          ],
        },
        panels: [
          { id: 'quote', type: 'quote', title: 'Stock Quote', symbol: 'AAPL' },
          { id: 'chart', type: 'chart', title: 'Price Chart', symbol: 'AAPL' },
          { id: 'fundamentals', type: 'fundamentals', title: 'Fundamentals', symbol: 'AAPL' },
          { id: 'news', type: 'news', title: 'News & Analysis', symbol: 'AAPL' },
          { id: 'technical', type: 'technical', title: 'Technical Analysis', symbol: 'AAPL' },
          { id: 'screener', type: 'screener', title: 'Stock Screener' },
          { id: 'sector', type: 'sector', title: 'Sector Analysis' },
          { id: 'calendar', type: 'calendar', title: 'Economic Calendar' },
        ],
        settings: {
          refreshInterval: 30000,
          autoSave: true,
          gridCompact: false,
          gridMargin: [10, 10],
          gridPadding: [10, 10],
        },
      },
    };

    const monitoringTemplate: WorkspaceTemplate = {
      id: 'monitoring-dashboard',
      name: 'Market Monitoring',
      description: 'Real-time market monitoring dashboard',
      category: 'monitoring',
      workspace: {
        name: 'Market Monitoring',
        description: 'Real-time market monitoring dashboard',
        isDefault: false,
        layouts: {
          lg: [
            { i: 'market-overview', x: 0, y: 0, w: 12, h: 6, minW: 8, minH: 4 },
            { i: 'heatmap', x: 12, y: 0, w: 12, h: 6, minW: 8, minH: 4 },
            { i: 'crypto', x: 0, y: 6, w: 8, h: 6, minW: 6, minH: 4 },
            { i: 'alerts', x: 8, y: 6, w: 8, h: 6, minW: 6, minH: 4 },
            { i: 'risk', x: 16, y: 6, w: 8, h: 6, minW: 6, minH: 4 },
            { i: 'watchlist', x: 0, y: 12, w: 12, h: 6, minW: 8, minH: 4 },
            { i: 'news', x: 12, y: 12, w: 12, h: 6, minW: 8, minH: 4 },
          ],
          md: [
            { i: 'market-overview', x: 0, y: 0, w: 10, h: 6, minW: 6, minH: 4 },
            { i: 'heatmap', x: 10, y: 0, w: 10, h: 6, minW: 6, minH: 4 },
            { i: 'crypto', x: 0, y: 6, w: 7, h: 6, minW: 5, minH: 4 },
            { i: 'alerts', x: 7, y: 6, w: 6, h: 6, minW: 4, minH: 4 },
            { i: 'risk', x: 13, y: 6, w: 7, h: 6, minW: 5, minH: 4 },
            { i: 'watchlist', x: 0, y: 12, w: 10, h: 6, minW: 6, minH: 4 },
            { i: 'news', x: 10, y: 12, w: 10, h: 6, minW: 6, minH: 4 },
          ],
          sm: [
            { i: 'market-overview', x: 0, y: 0, w: 12, h: 6, minW: 6, minH: 4 },
            { i: 'heatmap', x: 0, y: 6, w: 12, h: 6, minW: 6, minH: 4 },
            { i: 'crypto', x: 0, y: 12, w: 6, h: 6, minW: 4, minH: 4 },
            { i: 'alerts', x: 6, y: 12, w: 6, h: 6, minW: 4, minH: 4 },
            { i: 'risk', x: 0, y: 18, w: 12, h: 6, minW: 6, minH: 4 },
            { i: 'watchlist', x: 0, y: 24, w: 6, h: 6, minW: 4, minH: 4 },
            { i: 'news', x: 6, y: 24, w: 6, h: 6, minW: 4, minH: 4 },
          ],
          xs: [
            { i: 'market-overview', x: 0, y: 0, w: 4, h: 6, minW: 4, minH: 4 },
            { i: 'heatmap', x: 0, y: 6, w: 4, h: 6, minW: 4, minH: 4 },
            { i: 'crypto', x: 0, y: 12, w: 4, h: 6, minW: 4, minH: 4 },
            { i: 'alerts', x: 0, y: 18, w: 4, h: 6, minW: 4, minH: 4 },
            { i: 'risk', x: 0, y: 24, w: 4, h: 6, minW: 4, minH: 4 },
            { i: 'watchlist', x: 0, y: 30, w: 4, h: 6, minW: 4, minH: 4 },
            { i: 'news', x: 0, y: 36, w: 4, h: 6, minW: 4, minH: 4 },
          ],
        },
        panels: [
          { id: 'market-overview', type: 'market', title: 'Market Overview' },
          { id: 'heatmap', type: 'heatmap', title: 'Market Heatmap' },
          { id: 'crypto', type: 'crypto', title: 'Crypto Markets' },
          { id: 'alerts', type: 'alerts', title: 'Price Alerts' },
          { id: 'risk', type: 'risk', title: 'Risk Analytics' },
          { id: 'watchlist', type: 'watchlist', title: 'Watchlist' },
          { id: 'news', type: 'news', title: 'Market News' },
        ],
        settings: {
          refreshInterval: 10000,
          autoSave: true,
          gridCompact: true,
          gridMargin: [6, 6],
          gridPadding: [6, 6],
        },
      },
    };

    this.templates.set(tradingTemplate.id, tradingTemplate);
    this.templates.set(researchTemplate.id, researchTemplate);
    this.templates.set(monitoringTemplate.id, monitoringTemplate);
  }

  private loadWorkspacesFromStorage() {
    try {
      const stored = localStorage.getItem('bloom-workspaces');
      if (stored) {
        const data = JSON.parse(stored);
        if (data.workspaces) {
          data.workspaces.forEach((workspace: any) => {
            // Convert date strings back to Date objects
            workspace.metadata.createdAt = new Date(workspace.metadata.createdAt);
            workspace.metadata.updatedAt = new Date(workspace.metadata.updatedAt);
            workspace.metadata.lastAccessedAt = new Date(workspace.metadata.lastAccessedAt);
            
            this.workspaces.set(workspace.id, workspace);
          });
        }
        if (data.currentWorkspaceId) {
          this.currentWorkspaceId = data.currentWorkspaceId;
        }
      }
    } catch (error) {
      console.error('Failed to load workspaces from storage:', error);
    }
  }

  private saveToStorage() {
    try {
      const data = {
        workspaces: Array.from(this.workspaces.values()),
        currentWorkspaceId: this.currentWorkspaceId,
      };
      localStorage.setItem('bloom-workspaces', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save workspaces to storage:', error);
    }
  }

  private startAutoSave() {
    this.autoSaveInterval = setInterval(() => {
      this.saveToStorage();
    }, 30000); // Auto-save every 30 seconds
  }

  generateWorkspaceId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  createWorkspace(name: string, userId: string, templateId?: string): Workspace {
    const id = this.generateWorkspaceId();
    
    let baseWorkspace: Omit<Workspace, 'id' | 'userId'>;
    
    if (templateId && this.templates.has(templateId)) {
      const template = this.templates.get(templateId)!;
      baseWorkspace = {
        ...template.workspace,
        name,
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessedAt: new Date(),
          accessCount: 0,
        },
      };
    } else {
      // Create minimal default workspace
      baseWorkspace = {
        name,
        description: 'Custom workspace',
        isDefault: false,
        layouts: {
          lg: [
            { i: 'quote', x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
            { i: 'chart', x: 6, y: 0, w: 12, h: 8, minW: 8, minH: 6 },
            { i: 'watchlist', x: 18, y: 0, w: 6, h: 8, minW: 4, minH: 6 },
          ],
          md: [
            { i: 'quote', x: 0, y: 0, w: 5, h: 4, minW: 4, minH: 3 },
            { i: 'chart', x: 5, y: 0, w: 10, h: 6, minW: 6, minH: 4 },
            { i: 'watchlist', x: 15, y: 0, w: 5, h: 6, minW: 4, minH: 4 },
          ],
          sm: [
            { i: 'quote', x: 0, y: 0, w: 12, h: 4, minW: 6, minH: 3 },
            { i: 'chart', x: 0, y: 4, w: 12, h: 6, minW: 6, minH: 4 },
            { i: 'watchlist', x: 0, y: 10, w: 12, h: 6, minW: 6, minH: 4 },
          ],
          xs: [
            { i: 'quote', x: 0, y: 0, w: 4, h: 4, minW: 4, minH: 3 },
            { i: 'chart', x: 0, y: 4, w: 4, h: 6, minW: 4, minH: 4 },
            { i: 'watchlist', x: 0, y: 10, w: 4, h: 6, minW: 4, minH: 4 },
          ],
        },
        panels: [
          { id: 'quote', type: 'quote', title: 'Stock Quote', symbol: 'AAPL' },
          { id: 'chart', type: 'chart', title: 'Price Chart', symbol: 'AAPL' },
          { id: 'watchlist', type: 'watchlist', title: 'Watchlist' },
        ],
        settings: {
          refreshInterval: 15000,
          autoSave: true,
          gridCompact: true,
          gridMargin: [8, 8],
          gridPadding: [8, 8],
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessedAt: new Date(),
          accessCount: 0,
        },
      };
    }

    const workspace: Workspace = {
      id,
      userId,
      ...baseWorkspace,
    };

    this.workspaces.set(id, workspace);
    this.notifyListeners();
    this.saveToStorage();

    return workspace;
  }

  getWorkspaces(userId: string): Workspace[] {
    return Array.from(this.workspaces.values())
      .filter(workspace => workspace.userId === userId)
      .sort((a, b) => {
        // Default workspaces first, then by last accessed
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return b.metadata.lastAccessedAt.getTime() - a.metadata.lastAccessedAt.getTime();
      });
  }

  getCurrentWorkspace(): Workspace | null {
    if (!this.currentWorkspaceId) return null;
    return this.workspaces.get(this.currentWorkspaceId) || null;
  }

  switchWorkspace(workspaceId: string): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;

    this.currentWorkspaceId = workspaceId;
    
    // Update last accessed
    workspace.metadata.lastAccessedAt = new Date();
    workspace.metadata.accessCount++;
    workspace.metadata.updatedAt = new Date();

    this.notifyListeners();
    this.saveToStorage();
    
    // Invalidate React Query cache to refresh data for new workspace
    queryClient.clear();

    return true;
  }

  updateWorkspaceLayout(workspaceId: string, breakpoint: string, layouts: WorkspaceLayout[]): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;

    workspace.layouts[breakpoint as keyof typeof workspace.layouts] = layouts;
    workspace.metadata.updatedAt = new Date();

    this.notifyListeners();
    
    if (workspace.settings.autoSave) {
      this.saveToStorage();
    }

    return true;
  }

  addPanelToWorkspace(workspaceId: string, panel: WorkspacePanel, layout?: WorkspaceLayout): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;

    // Check if panel already exists
    if (workspace.panels.find(p => p.id === panel.id)) {
      return false;
    }

    workspace.panels.push(panel);

    // Add layout for all breakpoints if provided
    if (layout) {
      Object.keys(workspace.layouts).forEach(breakpoint => {
        workspace.layouts[breakpoint as keyof typeof workspace.layouts].push({
          ...layout,
          i: panel.id,
        });
      });
    }

    workspace.metadata.updatedAt = new Date();
    this.notifyListeners();
    this.saveToStorage();

    return true;
  }

  removePanelFromWorkspace(workspaceId: string, panelId: string): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;

    // Remove panel
    workspace.panels = workspace.panels.filter(p => p.id !== panelId);

    // Remove from all layouts
    Object.keys(workspace.layouts).forEach(breakpoint => {
      workspace.layouts[breakpoint as keyof typeof workspace.layouts] = 
        workspace.layouts[breakpoint as keyof typeof workspace.layouts].filter(l => l.i !== panelId);
    });

    workspace.metadata.updatedAt = new Date();
    this.notifyListeners();
    this.saveToStorage();

    return true;
  }

  updateWorkspaceSettings(workspaceId: string, settings: Partial<Workspace['settings']>): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;

    workspace.settings = { ...workspace.settings, ...settings };
    workspace.metadata.updatedAt = new Date();

    this.notifyListeners();
    this.saveToStorage();

    return true;
  }

  duplicateWorkspace(workspaceId: string, newName: string): Workspace | null {
    const original = this.workspaces.get(workspaceId);
    if (!original) return null;

    const duplicate: Workspace = {
      ...original,
      id: this.generateWorkspaceId(),
      name: newName,
      isDefault: false,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
        accessCount: 0,
        tags: original.metadata.tags ? [...original.metadata.tags] : undefined,
        isPublic: false,
        shareId: undefined,
      },
    };

    this.workspaces.set(duplicate.id, duplicate);
    this.notifyListeners();
    this.saveToStorage();

    return duplicate;
  }

  deleteWorkspace(workspaceId: string): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace || workspace.isDefault) return false;

    this.workspaces.delete(workspaceId);

    if (this.currentWorkspaceId === workspaceId) {
      // Switch to another workspace
      const userWorkspaces = this.getWorkspaces(workspace.userId);
      if (userWorkspaces.length > 0) {
        this.currentWorkspaceId = userWorkspaces[0].id;
      } else {
        this.currentWorkspaceId = null;
      }
    }

    this.notifyListeners();
    this.saveToStorage();

    return true;
  }

  getTemplates(): WorkspaceTemplate[] {
    return Array.from(this.templates.values());
  }

  shareWorkspace(workspaceId: string): string | null {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return null;

    const shareId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    workspace.metadata.shareId = shareId;
    workspace.metadata.isPublic = true;
    workspace.metadata.updatedAt = new Date();

    this.saveToStorage();
    return shareId;
  }

  exportWorkspace(workspaceId: string): string | null {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return null;

    const exportData = {
      ...workspace,
      metadata: {
        ...workspace.metadata,
        exportedAt: new Date(),
      },
    };

    return JSON.stringify(exportData, null, 2);
  }

  importWorkspace(workspaceData: string, userId: string): Workspace | null {
    try {
      const parsed = JSON.parse(workspaceData);
      
      const workspace: Workspace = {
        ...parsed,
        id: this.generateWorkspaceId(),
        userId,
        isDefault: false,
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessedAt: new Date(),
          accessCount: 0,
          tags: parsed.metadata?.tags || [],
          isPublic: false,
          shareId: undefined,
        },
      };

      this.workspaces.set(workspace.id, workspace);
      this.notifyListeners();
      this.saveToStorage();

      return workspace;
    } catch (error) {
      console.error('Failed to import workspace:', error);
      return null;
    }
  }

  subscribeToChanges(callback: (workspaces: Workspace[], current: Workspace | null) => void): void {
    this.changeListeners.push(callback);
  }

  unsubscribeFromChanges(callback: (workspaces: Workspace[], current: Workspace | null) => void): void {
    const index = this.changeListeners.indexOf(callback);
    if (index > -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  private notifyListeners(): void {
    const current = this.getCurrentWorkspace();
    const allWorkspaces = Array.from(this.workspaces.values());
    
    this.changeListeners.forEach(callback => {
      try {
        callback(allWorkspaces, current);
      } catch (error) {
        console.error('Error in workspace change listener:', error);
      }
    });
  }

  cleanup(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
  }
}

// Singleton instance
export const workspaceManager = new WorkspaceManager();