import { z } from 'zod';
import { readTextFile, writeTextFile, readDir, mkdir } from '@tauri-apps/plugin-fs';
import { Tool } from '../types';

// File system tools
export const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read the contents of a file',
  parameters: z.object({
    path: z.string().describe('The path to the file to read'),
  }),
  execute: async (args) => {
    try {
      const content = await readTextFile(args.path);
      return content;
    } catch (error) {
      return `Error reading file: ${error}`;
    }
  },
};

export const writeFileTool: Tool = {
  name: 'write_file',
  description: 'Write content to a file',
  parameters: z.object({
    path: z.string().describe('The path to the file to write'),
    content: z.string().describe('The content to write to the file'),
  }),
  execute: async (args) => {
    try {
      await writeTextFile(args.path, args.content);
      return `Successfully wrote to file: ${args.path}`;
    } catch (error) {
      return `Error writing file: ${error}`;
    }
  },
};

export const listDirectoryTool: Tool = {
  name: 'list_directory',
  description: 'List the contents of a directory',
  parameters: z.object({
    path: z.string().describe('The path to the directory to list'),
  }),
  execute: async (args) => {
    try {
      const entries = await readDir(args.path);
      return JSON.stringify(entries.map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory,
      })), null, 2);
    } catch (error) {
      return `Error listing directory: ${error}`;
    }
  },
};

export const createDirectoryTool: Tool = {
  name: 'create_directory',
  description: 'Create a new directory',
  parameters: z.object({
    path: z.string().describe('The path of the directory to create'),
    recursive: z.boolean().optional().describe('Create parent directories if they don\'t exist'),
  }),
  execute: async (args) => {
    try {
      await mkdir(args.path, { recursive: args.recursive || false });
      return `Successfully created directory: ${args.path}`;
    } catch (error) {
      return `Error creating directory: ${error}`;
    }
  },
};

// Code analysis tools
export const analyzeCodTool: Tool = {
  name: 'analyze_code',
  description: 'Analyze code structure and provide insights',
  parameters: z.object({
    code: z.string().describe('The code to analyze'),
    language: z.string().optional().describe('Programming language of the code'),
  }),
  execute: async (args) => {
    // This is a placeholder - in a real implementation, you'd use a code analysis library
    const lines = args.code.split('\n');
    const analysis = {
      lines: lines.length,
      language: args.language || 'unknown',
      hasComments: lines.some(line => line.includes('//') || line.includes('/*')),
      functions: lines.filter(line => line.includes('function') || line.includes('=>')).length,
    };
    return JSON.stringify(analysis, null, 2);
  },
};

// Search tool
export const searchTool: Tool = {
  name: 'search',
  description: 'Search for text patterns in files',
  parameters: z.object({
    pattern: z.string().describe('The pattern to search for'),
    directory: z.string().describe('The directory to search in'),
    fileExtensions: z.array(z.string()).optional().describe('File extensions to include'),
  }),
  execute: async (args) => {
    // This is a simplified implementation
    // In a real implementation, you'd use a more sophisticated search
    try {
      const results: string[] = [];
      // Placeholder for search logic
      return `Search results for "${args.pattern}" in ${args.directory}: ${results.length} matches found`;
    } catch (error) {
      return `Error searching: ${error}`;
    }
  },
};

// Get all available tools
export const getAllTools = (): Tool[] => [
  readFileTool,
  writeFileTool,
  listDirectoryTool,
  createDirectoryTool,
  analyzeCodTool,
  searchTool,
];

// Get tools by names
export const getToolsByNames = (names: string[]): Tool[] => {
  const allTools = getAllTools();
  return allTools.filter(tool => names.includes(tool.name));
};