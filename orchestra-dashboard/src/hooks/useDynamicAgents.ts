import { useState, useEffect, useRef } from 'react';
import type { DynamicAgent, FileActivityEvent, FileTreeNode, WsConsoleMessage } from '../lib/types.ts';

interface UseDynamicAgentsReturn {
  agents: DynamicAgent[];
  fileActivities: FileActivityEvent[];
  fileTree: FileTreeNode[];
  activeFiles: string[];
}

/**
 * Build a file tree from flat file activity events.
 */
function buildFileTree(activities: FileActivityEvent[]): FileTreeNode[] {
  const tree: Map<string, FileTreeNode> = new Map();
  const activeFiles = new Set<string>();

  // Find currently active files (written in last 10 seconds)
  const now = Date.now();
  for (const activity of activities) {
    if (activity.action !== 'read') {
      const activityTime = new Date(activity.timestamp).getTime();
      if (now - activityTime < 10000) {
        activeFiles.add(activity.file);
      }
    }
  }

  for (const activity of activities) {
    const parts = activity.file.split('/').filter(Boolean);
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;

      if (!tree.has(currentPath)) {
        tree.set(currentPath, {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'directory',
          children: isFile ? undefined : [],
          isActive: isFile && activeFiles.has(activity.file),
          lastActivity: isFile ? activity : undefined,
        });
      } else if (isFile) {
        const node = tree.get(currentPath)!;
        node.lastActivity = activity;
        node.isActive = activeFiles.has(activity.file);
      }
    }
  }

  // Build parent-child relationships
  const roots: FileTreeNode[] = [];
  for (const [path, node] of tree) {
    const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
    const parent = tree.get(parentPath);
    if (parent && parent.children) {
      if (!parent.children.find(c => c.path === path)) {
        parent.children.push(node);
      }
    } else if (!path.includes('/', 1) || !tree.has(parentPath)) {
      if (!roots.find(r => r.path === path)) {
        roots.push(node);
      }
    }
  }

  return roots;
}

export function useDynamicAgents(wsMessages: WsConsoleMessage[]): UseDynamicAgentsReturn {
  const [agents, setAgents] = useState<DynamicAgent[]>([]);
  const [fileActivities, setFileActivities] = useState<FileActivityEvent[]>([]);
  const [activeFiles, setActiveFiles] = useState<string[]>([]);
  const processedRef = useRef(0);

  useEffect(() => {
    // Process only new messages since last check
    const newMessages = wsMessages.slice(processedRef.current);
    processedRef.current = wsMessages.length;

    for (const msg of newMessages) {
      if (msg.type === 'agent-spawn') {
        const spawnMsg = msg as unknown as { type: 'agent-spawn'; agent: DynamicAgent };
        setAgents(prev => {
          if (prev.find(a => a.id === spawnMsg.agent.id)) return prev;
          return [...prev, spawnMsg.agent];
        });
      } else if (msg.type === 'agent-output') {
        const outputMsg = msg as unknown as { type: 'agent-output'; agentId: string; line: string };
        setAgents(prev =>
          prev.map(a =>
            a.id === outputMsg.agentId
              ? { ...a, status: 'running' as const, output: [...a.output, outputMsg.line] }
              : a
          )
        );
      } else if (msg.type === 'agent-complete') {
        const completeMsg = msg as unknown as { type: 'agent-complete'; agentId: string; status: 'completed' | 'failed'; filesModified: string[] };
        setAgents(prev =>
          prev.map(a =>
            a.id === completeMsg.agentId
              ? { ...a, status: completeMsg.status, filesModified: completeMsg.filesModified, completedAt: new Date().toISOString() }
              : a
          )
        );
      } else if (msg.type === 'file-activity') {
        const fileMsg = msg as unknown as { type: 'file-activity'; file: string; action: FileActivityEvent['action']; agentId: string; agentName: string };
        const timestamp = new Date().toISOString();
        setFileActivities(prev => [...prev, {
          file: fileMsg.file,
          action: fileMsg.action,
          agentId: fileMsg.agentId,
          agentName: fileMsg.agentName,
          timestamp,
        }]);
        // Update active files within the effect (safe to call Date.now here)
        if (fileMsg.action !== 'read') {
          setActiveFiles(prev =>
            prev.includes(fileMsg.file) ? prev : [...prev, fileMsg.file],
          );
        }
      }
    }
  }, [wsMessages]);

  // Expire active files after 10 seconds
  useEffect(() => {
    if (activeFiles.length === 0) return;
    const timer = setTimeout(() => {
      const now = Date.now();
      const stillActive = fileActivities
        .filter(a => a.action !== 'read' && now - new Date(a.timestamp).getTime() < 10000)
        .map(a => a.file);
      setActiveFiles([...new Set(stillActive)]);
    }, 10000);
    return () => clearTimeout(timer);
  }, [activeFiles, fileActivities]);

  const fileTree = buildFileTree(fileActivities);

  return { agents, fileActivities, fileTree, activeFiles };
}
