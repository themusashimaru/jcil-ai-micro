import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileUpload } from './useFileUpload';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/utils/imageCompression', () => ({
  compressImage: vi.fn().mockResolvedValue({
    compressedSize: 5000,
    dataUrl: 'data:image/jpeg;base64,mockdata',
    originalSize: 10000,
    width: 800,
    height: 600,
  }),
  isImageFile: vi
    .fn()
    .mockImplementation((file: { type: string }) => file.type.startsWith('image/')),
}));

vi.mock('@/lib/utils/readFileContent', () => ({
  readFileContent: vi.fn().mockResolvedValue({
    content: 'file content here',
    rawData: 'raw-data-string',
  }),
}));

// The hook imports the Attachment type; the module only needs to exist.
vi.mock('@/app/chat/types', async () => {
  const actual = await vi.importActual('@/app/chat/types');
  return actual;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockFile(name: string, size: number, type: string): File {
  // Create a blob of exact size by filling with 'a' characters
  const content = new Array(size).fill('a').join('');
  return new File([content], name, { type });
}

function createMockFileList(files: File[]): FileList {
  const fileList: Record<string | number | symbol, unknown> = {
    length: files.length,
    item: (i: number) => files[i] || null,
    [Symbol.iterator]: function* () {
      for (const f of files) yield f;
    },
  };
  files.forEach((f, i) => {
    fileList[i] = f;
  });
  return fileList as unknown as FileList;
}

function createDragEvent(files: File[] = []): React.DragEvent {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: {
      files: createMockFileList(files),
    },
  } as unknown as React.DragEvent;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useFileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 1. Initial state
  it('returns correct initial state', () => {
    const { result } = renderHook(() => useFileUpload());

    expect(result.current.attachments).toEqual([]);
    expect(result.current.isDragging).toBe(false);
    expect(result.current.fileError).toBeNull();
  });

  // 2. handleFileSelect with null does nothing
  it('handleFileSelect with null does nothing', async () => {
    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.handleFileSelect(null);
    });

    expect(result.current.attachments).toEqual([]);
    expect(result.current.fileError).toBeNull();
  });

  // 3. handleFileSelect adds an image file (compressed)
  it('handleFileSelect adds an image file via compression', async () => {
    const { result } = renderHook(() => useFileUpload());
    const imageFile = createMockFile('photo.jpg', 1024, 'image/jpeg');
    const fileList = createMockFileList([imageFile]);

    await act(async () => {
      await result.current.handleFileSelect(fileList);
    });

    expect(result.current.attachments).toHaveLength(1);
    const attachment = result.current.attachments[0];
    expect(attachment.name).toBe('photo.jpg');
    expect(attachment.type).toBe('image/jpeg');
    expect(attachment.size).toBe(5000); // compressedSize from mock
    expect(attachment.thumbnail).toBe('data:image/jpeg;base64,mockdata');
    expect(attachment.url).toBe('data:image/jpeg;base64,mockdata');
    expect(result.current.fileError).toBeNull();
  });

  // 4. handleFileSelect adds a text file (readFileContent)
  it('handleFileSelect adds a text file via readFileContent', async () => {
    const { result } = renderHook(() => useFileUpload());
    const textFile = createMockFile('notes.txt', 512, 'text/plain');
    const fileList = createMockFileList([textFile]);

    await act(async () => {
      await result.current.handleFileSelect(fileList);
    });

    expect(result.current.attachments).toHaveLength(1);
    const attachment = result.current.attachments[0];
    expect(attachment.name).toBe('notes.txt');
    expect(attachment.type).toBe('text/plain');
    expect(attachment.size).toBe(512);
    expect(attachment.url).toBe('file content here');
    expect(attachment.rawData).toBe('raw-data-string');
    expect(result.current.fileError).toBeNull();
  });

  // 5. Rejects file over 10MB
  it('rejects a file exceeding MAX_FILE_SIZE (10MB)', async () => {
    const { result } = renderHook(() => useFileUpload());
    const bigFile = createMockFile('huge.png', 10 * 1024 * 1024 + 1, 'image/png');
    const fileList = createMockFileList([bigFile]);

    await act(async () => {
      await result.current.handleFileSelect(fileList);
    });

    expect(result.current.attachments).toEqual([]);
    expect(result.current.fileError).toMatch(/too large/i);
  });

  // 6. Rejects unsupported file type
  it('rejects an unsupported file type', async () => {
    const { result } = renderHook(() => useFileUpload());
    const exeFile = createMockFile('malware.exe', 256, 'application/x-msdownload');
    const fileList = createMockFileList([exeFile]);

    await act(async () => {
      await result.current.handleFileSelect(fileList);
    });

    expect(result.current.attachments).toEqual([]);
    expect(result.current.fileError).toMatch(/not supported/i);
  });

  // 7. Rejects when exceeding MAX_FILE_COUNT
  it('rejects files when exceeding MAX_FILE_COUNT (10)', async () => {
    const { result } = renderHook(() => useFileUpload());

    // First, add 9 files
    const nineFiles = Array.from({ length: 9 }, (_, i) =>
      createMockFile(`file-${i}.txt`, 100, 'text/plain')
    );
    const nineFileList = createMockFileList(nineFiles);

    await act(async () => {
      await result.current.handleFileSelect(nineFileList);
    });
    expect(result.current.attachments).toHaveLength(9);

    // Now try to add 2 more (9 + 2 = 11 > 10)
    const twoMore = [
      createMockFile('extra1.txt', 100, 'text/plain'),
      createMockFile('extra2.txt', 100, 'text/plain'),
    ];
    const twoMoreList = createMockFileList(twoMore);

    await act(async () => {
      await result.current.handleFileSelect(twoMoreList);
    });

    expect(result.current.attachments).toHaveLength(9); // unchanged
    expect(result.current.fileError).toMatch(/maximum 10 files/i);
  });

  // 8. removeAttachment removes by id
  it('removeAttachment removes the correct attachment by id', async () => {
    const { result } = renderHook(() => useFileUpload());

    // Add two files
    const file1 = createMockFile('a.txt', 100, 'text/plain');
    const file2 = createMockFile('b.txt', 100, 'text/plain');

    await act(async () => {
      await result.current.handleFileSelect(createMockFileList([file1]));
    });
    await act(async () => {
      await result.current.handleFileSelect(createMockFileList([file2]));
    });

    expect(result.current.attachments).toHaveLength(2);

    const idToRemove = result.current.attachments[0].id;

    act(() => {
      result.current.removeAttachment(idToRemove);
    });

    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.attachments[0].name).toBe('b.txt');
  });

  // 9. clearAttachments empties the array
  it('clearAttachments removes all attachments', async () => {
    const { result } = renderHook(() => useFileUpload());

    const files = [
      createMockFile('a.txt', 100, 'text/plain'),
      createMockFile('b.txt', 100, 'text/plain'),
    ];

    await act(async () => {
      await result.current.handleFileSelect(createMockFileList(files));
    });

    expect(result.current.attachments).toHaveLength(2);

    act(() => {
      result.current.clearAttachments();
    });

    expect(result.current.attachments).toEqual([]);
  });

  // 10. handleDragOver sets isDragging to true
  it('handleDragOver sets isDragging to true', () => {
    const { result } = renderHook(() => useFileUpload());

    const event = createDragEvent();

    act(() => {
      result.current.handleDragOver(event);
    });

    expect(result.current.isDragging).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  // 11. handleDragLeave sets isDragging to false
  it('handleDragLeave sets isDragging to false', () => {
    const { result } = renderHook(() => useFileUpload());

    // First set isDragging to true
    act(() => {
      result.current.handleDragOver(createDragEvent());
    });
    expect(result.current.isDragging).toBe(true);

    const leaveEvent = createDragEvent();
    act(() => {
      result.current.handleDragLeave(leaveEvent);
    });

    expect(result.current.isDragging).toBe(false);
    expect(leaveEvent.preventDefault).toHaveBeenCalled();
  });

  // 12. handleDrop calls handleFileSelect and resets isDragging
  it('handleDrop processes dropped files and sets isDragging to false', async () => {
    const { result } = renderHook(() => useFileUpload());

    // Set dragging to true first
    act(() => {
      result.current.handleDragOver(createDragEvent());
    });
    expect(result.current.isDragging).toBe(true);

    const droppedFile = createMockFile('dropped.txt', 200, 'text/plain');
    const dropEvent = createDragEvent([droppedFile]);

    await act(async () => {
      result.current.handleDrop(dropEvent);
    });

    expect(dropEvent.preventDefault).toHaveBeenCalled();
    expect(result.current.isDragging).toBe(false);
    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.attachments[0].name).toBe('dropped.txt');
  });

  // 13. fileError clears automatically after 5 seconds
  it('fileError clears automatically after timeout', async () => {
    const { result } = renderHook(() => useFileUpload());
    const badFile = createMockFile('bad.exe', 256, 'application/x-msdownload');

    await act(async () => {
      await result.current.handleFileSelect(createMockFileList([badFile]));
    });

    expect(result.current.fileError).not.toBeNull();

    // Advance timers by 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.fileError).toBeNull();
  });

  // 14. Multiple valid file types are accepted
  it('accepts all allowed file types', async () => {
    const { result } = renderHook(() => useFileUpload());

    const allowedFiles = [
      createMockFile('photo.jpg', 100, 'image/jpeg'),
      createMockFile('icon.png', 100, 'image/png'),
      createMockFile('anim.gif', 100, 'image/gif'),
      createMockFile('modern.webp', 100, 'image/webp'),
      createMockFile('doc.pdf', 100, 'application/pdf'),
      createMockFile('readme.txt', 100, 'text/plain'),
      createMockFile('data.csv', 100, 'text/csv'),
      createMockFile('legacy.xls', 100, 'application/vnd.ms-excel'),
      createMockFile(
        'sheet.xlsx',
        100,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ),
    ];

    await act(async () => {
      await result.current.handleFileSelect(createMockFileList(allowedFiles));
    });

    expect(result.current.attachments).toHaveLength(9);
    expect(result.current.fileError).toBeNull();
  });

  // 15. Adding exactly MAX_FILE_COUNT files works
  it('allows exactly MAX_FILE_COUNT (10) files', async () => {
    const { result } = renderHook(() => useFileUpload());

    const tenFiles = Array.from({ length: 10 }, (_, i) =>
      createMockFile(`file-${i}.txt`, 100, 'text/plain')
    );

    await act(async () => {
      await result.current.handleFileSelect(createMockFileList(tenFiles));
    });

    expect(result.current.attachments).toHaveLength(10);
    expect(result.current.fileError).toBeNull();
  });

  // 16. handleFileSelect clears previous fileError on valid input
  it('clears previous fileError when new valid files are selected', async () => {
    const { result } = renderHook(() => useFileUpload());

    // Trigger an error first
    const badFile = createMockFile('bad.exe', 256, 'application/x-msdownload');
    await act(async () => {
      await result.current.handleFileSelect(createMockFileList([badFile]));
    });
    expect(result.current.fileError).not.toBeNull();

    // Now select a valid file — error should clear
    const goodFile = createMockFile('good.txt', 100, 'text/plain');
    await act(async () => {
      await result.current.handleFileSelect(createMockFileList([goodFile]));
    });
    expect(result.current.fileError).toBeNull();
    expect(result.current.attachments).toHaveLength(1);
  });
});
