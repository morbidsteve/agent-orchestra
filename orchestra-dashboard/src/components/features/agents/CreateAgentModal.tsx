import { useState } from 'react';
import { Terminal, Code, FlaskConical, Shield, Briefcase, Wrench, FileText, Database, Bot, Palette, Globe, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface CreateAgentModalProps {
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    capabilities: string[];
    tools: string[];
    color: string;
    icon: string;
  }) => void;
}

const AVAILABLE_TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebSearch', 'WebFetch'];

const ICON_OPTIONS: { name: string; Icon: LucideIcon }[] = [
  { name: 'Bot', Icon: Bot },
  { name: 'Terminal', Icon: Terminal },
  { name: 'Code', Icon: Code },
  { name: 'FileText', Icon: FileText },
  { name: 'Database', Icon: Database },
  { name: 'Globe', Icon: Globe },
  { name: 'Wrench', Icon: Wrench },
  { name: 'Shield', Icon: Shield },
  { name: 'FlaskConical', Icon: FlaskConical },
  { name: 'Briefcase', Icon: Briefcase },
  { name: 'Palette', Icon: Palette },
];

const COLOR_OPTIONS = [
  '#3b82f6', '#06b6d4', '#22c55e', '#f97316',
  '#a855f7', '#ec4899', '#ef4444', '#eab308',
];

export function CreateAgentModal({ onClose, onSubmit }: CreateAgentModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [capabilitiesInput, setCapabilitiesInput] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedIcon, setSelectedIcon] = useState('Bot');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');

  const handleToolToggle = (tool: string) => {
    setSelectedTools(prev =>
      prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const capabilities = capabilitiesInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      capabilities,
      tools: selectedTools,
      color: selectedColor,
      icon: selectedIcon,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border border-surface-600 bg-surface-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-600 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-100">Create Agent</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-700 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Documentation Writer"
              required
              maxLength={100}
              className="w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-accent-blue focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this agent do?"
              maxLength={500}
              rows={3}
              className="w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-accent-blue focus:outline-none resize-none"
            />
          </div>

          {/* Capabilities */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Capabilities</label>
            <input
              type="text"
              value={capabilitiesInput}
              onChange={e => setCapabilitiesInput(e.target.value)}
              placeholder="e.g. Documentation, API Design, Testing"
              className="w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-accent-blue focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">Comma-separated list</p>
          </div>

          {/* Tools */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Tools</label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TOOLS.map(tool => (
                <label key={tool} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTools.includes(tool)}
                    onChange={() => handleToolToggle(tool)}
                    className="rounded border-surface-600 bg-surface-700 text-accent-blue focus:ring-accent-blue"
                  />
                  <span className="text-xs font-mono text-gray-300">{tool}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Icon */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Icon</label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map(({ name: iconName, Icon }) => (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setSelectedIcon(iconName)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                    selectedIcon === iconName
                      ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                      : 'border-surface-600 bg-surface-700 text-gray-400 hover:text-gray-200'
                  }`}
                  title={iconName}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Color</label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`h-8 w-8 rounded-full border-2 transition-transform ${
                    selectedColor === color ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-surface-600 px-4 py-2 text-sm text-gray-300 hover:bg-surface-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-accent-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Agent
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
