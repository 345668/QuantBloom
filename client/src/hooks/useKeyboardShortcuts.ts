import { useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  description: string;
  category: string;
  action: () => void;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

export function useKeyboardShortcuts({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) {
  const { toast } = useToast();
  const activeShortcutsRef = useRef<Map<string, KeyboardShortcut>>(new Map());

  // Create a key string for comparison
  const createKeyString = useCallback((event: KeyboardEvent) => {
    const parts: string[] = [];
    if (event.ctrlKey || event.metaKey) parts.push('ctrl');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');
    parts.push(event.key.toLowerCase());
    return parts.join('+');
  }, []);

  const createShortcutKeyString = useCallback((shortcut: KeyboardShortcut) => {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('ctrl');
    if (shortcut.alt) parts.push('alt');
    if (shortcut.shift) parts.push('shift');
    parts.push(shortcut.key.toLowerCase());
    return parts.join('+');
  }, []);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      return;
    }

    const keyString = createKeyString(event);
    const shortcut = activeShortcutsRef.current.get(keyString);

    if (shortcut) {
      event.preventDefault();
      event.stopPropagation();
      
      try {
        shortcut.action();
        
        // Show brief feedback for executed shortcut
        toast({
          title: "Shortcut Executed",
          description: shortcut.description,
          duration: 1500,
        });
      } catch (error) {
        console.error('Error executing keyboard shortcut:', error);
        toast({
          title: "Shortcut Error",
          description: "Failed to execute keyboard shortcut",
          variant: "destructive",
          duration: 2000,
        });
      }
    }
  }, [enabled, createKeyString, toast]);

  // Update shortcuts map when shortcuts change
  useEffect(() => {
    const shortcutsMap = new Map<string, KeyboardShortcut>();
    
    shortcuts.forEach(shortcut => {
      const keyString = createShortcutKeyString(shortcut);
      shortcutsMap.set(keyString, shortcut);
    });
    
    activeShortcutsRef.current = shortcutsMap;
  }, [shortcuts, createShortcutKeyString]);

  // Add/remove event listener
  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [enabled, handleKeyDown]);

  // Helper function to get formatted shortcut display
  const getShortcutDisplay = useCallback((shortcut: KeyboardShortcut) => {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.alt) parts.push('Alt');
    if (shortcut.shift) parts.push('Shift');
    parts.push(shortcut.key.toUpperCase());
    return parts.join(' + ');
  }, []);

  // Group shortcuts by category
  const groupedShortcuts = useCallback(() => {
    const groups: Record<string, KeyboardShortcut[]> = {};
    
    shortcuts.forEach(shortcut => {
      if (!groups[shortcut.category]) {
        groups[shortcut.category] = [];
      }
      groups[shortcut.category].push(shortcut);
    });
    
    return groups;
  }, [shortcuts]);

  return {
    shortcuts,
    groupedShortcuts: groupedShortcuts(),
    getShortcutDisplay,
    enabled
  };
}