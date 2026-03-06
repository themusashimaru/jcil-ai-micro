interface GeneratedFile {
  path: string;
  content: string;
  language?: string;
}

/**
 * Build HTML document from generated files
 */
export function buildPreviewHtml(files: GeneratedFile[]): string {
  // Find main files
  const htmlFile = files.find((f) => f.path.endsWith('.html') || f.path === 'index.html');
  const cssFiles = files.filter((f) => f.path.endsWith('.css'));
  const jsFiles = files.filter(
    (f) => f.path.endsWith('.js') && !f.path.endsWith('.config.js') && !f.path.endsWith('.test.js')
  );
  const tsxFiles = files.filter((f) => f.path.endsWith('.tsx') || f.path.endsWith('.jsx'));

  // If we have an HTML file, use it as base
  if (htmlFile) {
    let html = htmlFile.content;

    // Inject CSS if not already linked
    const cssContent = cssFiles.map((f) => f.content).join('\n');
    if (cssContent && !html.includes('<style>')) {
      html = html.replace('</head>', `<style>\n${cssContent}\n</style>\n</head>`);
    }

    // Inject JS if not already linked
    const jsContent = jsFiles.map((f) => f.content).join('\n');
    if (jsContent && !html.includes('<script')) {
      html = html.replace('</body>', `<script>\n${jsContent}\n</script>\n</body>`);
    }

    return wrapWithConsoleCapture(html);
  }

  // If we have React/JSX files, build a React preview
  if (tsxFiles.length > 0) {
    return buildReactPreview(tsxFiles, cssFiles);
  }

  // If we only have CSS/JS, create a basic HTML shell
  const cssContent = cssFiles.map((f) => f.content).join('\n');
  const jsContent = jsFiles.map((f) => f.content).join('\n');

  return wrapWithConsoleCapture(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 1rem; font-family: system-ui, sans-serif; }
    ${cssContent}
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    ${jsContent}
  </script>
</body>
</html>
  `);
}

/**
 * Build a React preview with Babel for JSX transformation
 */
function buildReactPreview(tsxFiles: GeneratedFile[], cssFiles: GeneratedFile[]): string {
  const mainComponent =
    tsxFiles.find(
      (f) => f.path.includes('App') || f.path.includes('page') || f.path.includes('index')
    ) || tsxFiles[0];

  const cssContent = cssFiles.map((f) => f.content).join('\n');

  // Extract component code (simplified - assumes functional component)
  let componentCode = mainComponent?.content || '';

  // Remove imports and exports for inline execution
  componentCode = componentCode
    .replace(/import .+?;?\n/g, '')
    .replace(/export default .+?;?\n?$/, '')
    .replace(/export /g, '');

  return wrapWithConsoleCapture(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; }
    /* Theme-aware text colors */
    @media (prefers-color-scheme: dark) {
      body { background: #0f1419; color: #e6edf3; }
      .preview-message { color: #7d8590; }
      .preview-error { color: #f87171; }
    }
    @media (prefers-color-scheme: light) {
      body { background: #ffffff; color: #1a1f36; }
      .preview-message { color: #6b7280; }
      .preview-error { color: #ef4444; }
    }
    ${cssContent}
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useRef, useMemo, useCallback } = React;

    ${componentCode}

    // Try to render the component
    try {
      const rootElement = document.getElementById('root');
      const root = ReactDOM.createRoot(rootElement);

      // Look for the main component
      const MainComponent = typeof App !== 'undefined' ? App :
                            typeof Component !== 'undefined' ? Component :
                            typeof Page !== 'undefined' ? Page :
                            null;

      if (MainComponent) {
        root.render(<MainComponent />);
      } else {
        rootElement.innerHTML = '<p class="preview-message" style="padding: 1rem;">No component found to render.</p>';
      }
    } catch (err) {
      window.parent.postMessage({ type: 'error', message: err.message }, '*');
      // Safe DOM manipulation to prevent XSS
      const rootEl = document.getElementById('root');
      const pre = document.createElement('pre');
      pre.className = 'preview-error';
      pre.style.cssText = 'padding: 1rem;';
      pre.textContent = err.message; // textContent is XSS-safe
      rootEl.innerHTML = '';
      rootEl.appendChild(pre);
    }
  </script>
</body>
</html>
  `);
}

/**
 * Wrap HTML with console capture script
 */
function wrapWithConsoleCapture(html: string): string {
  const captureScript = `
    <script>
      (function() {
        const originalConsole = {
          log: console.log,
          warn: console.warn,
          error: console.error,
        };

        ['log', 'warn', 'error'].forEach(type => {
          console[type] = function(...args) {
            originalConsole[type].apply(console, args);
            const message = args.map(arg =>
              typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            window.parent.postMessage({ type: 'console', logType: type, message }, '*');
          };
        });

        window.onerror = function(message, source, lineno, colno, error) {
          window.parent.postMessage({ type: 'error', message: message + ' at line ' + lineno }, '*');
        };
      })();
    </script>
  `;

  // Insert capture script right after <head>
  if (html.includes('<head>')) {
    return html.replace('<head>', '<head>' + captureScript);
  }

  // Or at the start of the document
  return captureScript + html;
}
