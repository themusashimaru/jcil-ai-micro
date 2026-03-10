/**
 * Simple syntax highlighting without external dependencies
 * Provides basic highlighting for common languages
 */
export function highlightCode(code: string, language?: string): string {
  if (!language) return code;

  const lang = language.toLowerCase();

  // Language-specific keywords
  const keywordPatterns: Record<string, RegExp> = {
    typescript:
      /\b(const|let|var|function|return|if|else|for|while|class|extends|implements|import|export|from|async|await|try|catch|throw|new|typeof|instanceof|interface|type|enum|public|private|protected|static|readonly|as|is|keyof|infer|never|unknown|any|void|null|undefined|true|false)\b/g,
    javascript:
      /\b(const|let|var|function|return|if|else|for|while|class|extends|import|export|from|async|await|try|catch|throw|new|typeof|instanceof|true|false|null|undefined)\b/g,
    python:
      /\b(def|class|return|if|elif|else|for|while|import|from|as|try|except|finally|raise|with|yield|lambda|pass|break|continue|and|or|not|in|is|True|False|None|self|async|await)\b/g,
    rust: /\b(fn|let|mut|const|struct|enum|impl|trait|pub|use|mod|match|if|else|for|while|loop|return|break|continue|async|await|self|Self|true|false|None|Some|Ok|Err)\b/g,
    go: /\b(func|var|const|type|struct|interface|package|import|return|if|else|for|range|switch|case|default|break|continue|go|chan|select|defer|map|make|new|true|false|nil)\b/g,
    java: /\b(public|private|protected|class|interface|extends|implements|static|final|void|int|long|double|float|boolean|String|return|if|else|for|while|try|catch|throw|new|import|package|true|false|null|this|super)\b/g,
    css: /\b(color|background|border|margin|padding|display|position|width|height|font|text|flex|grid|align|justify|transform|transition|animation|hover|focus|active)\b/g,
    html: /\b(div|span|p|a|img|ul|ol|li|h[1-6]|header|footer|nav|section|article|main|form|input|button|table|tr|td|th|head|body|html|script|style|link|meta)\b/g,
    sql: /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DROP|ALTER|INDEX|PRIMARY|KEY|FOREIGN|REFERENCES|ORDER|BY|ASC|DESC|LIMIT|OFFSET|GROUP|HAVING|DISTINCT|COUNT|SUM|AVG|MAX|MIN|NULL|AS)\b/gi,
    json: /"[^"]+"\s*:/g,
  };

  // Get patterns for the language or fall back to typescript patterns
  const langPatterns = keywordPatterns[lang] || keywordPatterns.typescript;

  let result = code;

  // Apply highlighting in order of specificity

  // Comments (single line and multi-line)
  result = result.replace(/(\/\/[^\n]*)/g, '<span class="token-comment">$1</span>');
  result = result.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="token-comment">$1</span>');
  result = result.replace(/(#[^\n]*)/g, '<span class="token-comment">$1</span>');

  // Strings (double and single quoted)
  result = result.replace(/(&quot;[^&]*&quot;|"[^"]*")/g, '<span class="token-string">$1</span>');
  result = result.replace(/('(?:[^'\\]|\\.)*')/g, '<span class="token-string">$1</span>');
  result = result.replace(/(`(?:[^`\\]|\\.)*`)/g, '<span class="token-string">$1</span>');

  // Numbers
  result = result.replace(/\b(\d+\.?\d*)\b/g, '<span class="token-number">$1</span>');

  // Keywords (apply last to not affect already highlighted content)
  if (langPatterns) {
    result = result.replace(langPatterns, '<span class="token-keyword">$&</span>');
  }

  // Function calls
  result = result.replace(/\b([a-zA-Z_]\w*)\s*(?=\()/g, '<span class="token-function">$1</span>');

  // Types (capitalized words, common in TS/Java)
  if (['typescript', 'javascript', 'java', 'rust'].includes(lang)) {
    result = result.replace(/\b([A-Z][a-zA-Z0-9]*)\b/g, '<span class="token-type">$1</span>');
  }

  // Operators
  result = result.replace(/([+\-*/%=<>!&|^~?:])/g, '<span class="token-operator">$1</span>');

  return result;
}
