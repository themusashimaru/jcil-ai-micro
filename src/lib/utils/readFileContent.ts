/**
 * Read file content and parse if needed
 * - CSV: Read as text directly (also suitable for analytics)
 * - XLSX: Keep base64 for analytics, also parse for AI context
 * - TXT: Read as text directly
 * - PDF: Parse to extract readable text
 */
export async function readFileContent(file: File): Promise<{ content: string; rawData?: string }> {
  // For CSV files, read as text - this IS the data we need for analytics
  if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
    const textContent = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
    return { content: textContent, rawData: textContent };
  }

  // For plain text files, read directly
  if (file.type === 'text/plain') {
    const textContent = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
    return { content: textContent };
  }

  // For Excel and PDF, read as base64
  const base64Content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

  // For Excel files, keep raw data for analytics
  const isExcel =
    file.type === 'application/vnd.ms-excel' ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.xls');

  // Send to parsing API to get readable text for AI context
  try {
    const response = await fetch('/api/files/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        content: base64Content,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to parse file');
    }

    const result = await response.json();
    return {
      content: result.parsedText || base64Content,
      rawData: isExcel ? base64Content : undefined,
    };
  } catch (error) {
    console.error('[readFileContent] File parsing failed, using raw content:', error);
    return {
      content: base64Content,
      rawData: isExcel ? base64Content : undefined,
    };
  }
}
