/**
 * ZIP FILE TOOL
 *
 * Create and extract ZIP archives using archiver and jszip.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Create ZIP files from multiple inputs
 * - Extract ZIP contents
 * - List ZIP contents
 * - Add files to existing ZIPs
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded libraries
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let JSZip: any = null;

async function initJSZip(): Promise<boolean> {
  if (JSZip) return true;
  try {
    const mod = await import('jszip');
    JSZip = mod.default || mod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const zipTool: UnifiedTool = {
  name: 'zip_files',
  description: `Create and extract ZIP archives.

Operations:
- create: Create a new ZIP file from multiple files
- extract: Extract all files from a ZIP
- extract_file: Extract a specific file from ZIP
- list: List contents of a ZIP file
- add: Add files to an existing ZIP

Input files should be provided as base64 encoded data.
Output ZIP is returned as base64 encoded data.

Use cases:
- Bundle multiple files for download
- Extract uploaded archives
- Compress files for storage
- Organize and package outputs`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'extract', 'extract_file', 'list', 'add'],
        description: 'ZIP operation to perform',
      },
      files: {
        type: 'array',
        items: { type: 'object' },
        description:
          'For create/add: Array of file objects with {name: string, content: string, is_base64?: boolean}',
      },
      zip_data: {
        type: 'string',
        description: 'Base64 encoded ZIP file data (for extract/list/add operations)',
      },
      file_name: {
        type: 'string',
        description: 'For extract_file: specific file to extract from ZIP',
      },
      compression_level: {
        type: 'number',
        description: 'Compression level 0-9 (0=none, 9=max). Default: 6',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isZipAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeZip(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    operation: string;
    files?: { name: string; content: string; is_base64?: boolean }[];
    zip_data?: string;
    file_name?: string;
    compression_level?: number;
  };

  if (!args.operation) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: 'Operation is required' }),
      isError: true,
    };
  }

  try {
    const initialized = await initJSZip();
    if (!initialized) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: 'Failed to initialize JSZip' }),
        isError: true,
      };
    }

    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'create': {
        if (!args.files || args.files.length === 0) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Files array required for create' }),
            isError: true,
          };
        }

        const zip = new JSZip();
        const compressionLevel = args.compression_level ?? 6;

        for (const file of args.files) {
          const content = file.is_base64 ? Buffer.from(file.content, 'base64') : file.content;
          zip.file(file.name, content);
        }

        const zipBuffer = await zip.generateAsync({
          type: 'nodebuffer',
          compression: compressionLevel > 0 ? 'DEFLATE' : 'STORE',
          compressionOptions: { level: compressionLevel },
        });

        const base64 = zipBuffer.toString('base64');

        result = {
          operation: 'create',
          files_count: args.files.length,
          file_names: args.files.map((f) => f.name),
          zip_base64: base64,
          size_bytes: zipBuffer.length,
        };
        break;
      }

      case 'extract': {
        if (!args.zip_data) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'ZIP data required for extract' }),
            isError: true,
          };
        }

        const zipBuffer = Buffer.from(args.zip_data, 'base64');
        const zip = await JSZip.loadAsync(zipBuffer);

        const extractedFiles: { name: string; size: number; content: string }[] = [];

        for (const [name, zipEntry] of Object.entries(zip.files)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const entry = zipEntry as any;
          if (!entry.dir) {
            const content = await entry.async('base64');
            extractedFiles.push({
              name,
              size: content.length,
              content,
            });
          }
        }

        result = {
          operation: 'extract',
          files_count: extractedFiles.length,
          files: extractedFiles.map((f) => ({
            name: f.name,
            size_bytes: Math.ceil(f.size * 0.75), // Base64 overhead
            content_base64: f.content,
          })),
        };
        break;
      }

      case 'extract_file': {
        if (!args.zip_data || !args.file_name) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'ZIP data and file name required' }),
            isError: true,
          };
        }

        const zipBuffer = Buffer.from(args.zip_data, 'base64');
        const zip = await JSZip.loadAsync(zipBuffer);
        const file = zip.file(args.file_name);

        if (!file) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: `File "${args.file_name}" not found in ZIP` }),
            isError: true,
          };
        }

        const content = await file.async('base64');

        result = {
          operation: 'extract_file',
          file_name: args.file_name,
          content_base64: content,
          size_bytes: Math.ceil(content.length * 0.75),
        };
        break;
      }

      case 'list': {
        if (!args.zip_data) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'ZIP data required for list' }),
            isError: true,
          };
        }

        const zipBuffer = Buffer.from(args.zip_data, 'base64');
        const zip = await JSZip.loadAsync(zipBuffer);

        const files: { name: string; is_directory: boolean; size: number; date: string }[] = [];

        for (const [name, zipEntry] of Object.entries(zip.files)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const entry = zipEntry as any;
          files.push({
            name,
            is_directory: entry.dir,
            size: entry._data?.uncompressedSize || 0,
            date: entry.date?.toISOString() || '',
          });
        }

        result = {
          operation: 'list',
          total_files: files.filter((f) => !f.is_directory).length,
          total_directories: files.filter((f) => f.is_directory).length,
          contents: files,
        };
        break;
      }

      case 'add': {
        if (!args.zip_data || !args.files || args.files.length === 0) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'ZIP data and files required for add' }),
            isError: true,
          };
        }

        const zipBuffer = Buffer.from(args.zip_data, 'base64');
        const zip = await JSZip.loadAsync(zipBuffer);

        for (const file of args.files) {
          const content = file.is_base64 ? Buffer.from(file.content, 'base64') : file.content;
          zip.file(file.name, content);
        }

        const newZipBuffer = await zip.generateAsync({
          type: 'nodebuffer',
          compression: 'DEFLATE',
        });

        const base64 = newZipBuffer.toString('base64');

        result = {
          operation: 'add',
          files_added: args.files.length,
          added_names: args.files.map((f) => f.name),
          zip_base64: base64,
          size_bytes: newZipBuffer.length,
        };
        break;
      }

      default:
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({ error: `Unknown operation: ${args.operation}` }),
          isError: true,
        };
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(result),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'ZIP operation failed',
        details: error instanceof Error ? error.message : String(error),
      }),
      isError: true,
    };
  }
}
