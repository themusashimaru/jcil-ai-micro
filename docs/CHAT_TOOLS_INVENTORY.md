# JCIL.AI Chat Tools Inventory

## Complete Tool Catalog

**Last Updated:** January 31, 2026
**Total Tools:** 58
**Prepared by:** Chief Engineering Officer

---

## Executive Summary

The JCIL.AI platform provides Claude Sonnet 4.5 with unrestricted access to 58 powerful tools. All tools are fully wired, tested, and production-ready. This document serves as the authoritative reference for all available chat capabilities.

---

## Tool Categories

### Category Overview

| Category                  | Tool Count | Description                                     |
| ------------------------- | ---------- | ----------------------------------------------- |
| **Web & Research**        | 5          | Web scraping, search, browser automation        |
| **Code & Development**    | 6          | Code execution, formatting, diagrams            |
| **Media & Images**        | 7          | OCR, image processing, charts, screenshots      |
| **Documents & Data**      | 10         | PDF, Excel, spreadsheets, SQL, data processing  |
| **Text Processing**       | 4          | NLP, entity extraction, diff comparison         |
| **Utilities**             | 14         | Crypto, ZIP, validators, converters, etc.       |
| **Scientific & Research** | 12         | Statistics, chemistry, biology, physics, graphs |

---

## Complete Tool Reference

### 1. Web & Research Tools (5)

| #   | Tool Name            | Function                 | Description                                           |
| --- | -------------------- | ------------------------ | ----------------------------------------------------- |
| 1   | `web_search`         | executeWebSearch         | Search the web for information using Brave Search API |
| 2   | `fetch_url`          | executeFetchUrl          | Fetch and extract content from any URL                |
| 3   | `browser_visit`      | executeBrowserVisitTool  | Full browser automation with Puppeteer                |
| 4   | `parallel_research`  | executeMiniAgent         | Multi-agent research orchestration                    |
| 5   | `youtube_transcript` | executeYouTubeTranscript | Extract transcripts from YouTube videos               |

### 2. Code & Development Tools (6)

| #   | Tool Name             | Function              | Description                                               |
| --- | --------------------- | --------------------- | --------------------------------------------------------- |
| 6   | `run_code`            | executeRunCode        | Execute Python/JavaScript in E2B sandbox                  |
| 7   | `format_code`         | executePrettier       | Format code with Prettier (JS, TS, CSS, HTML, JSON, etc.) |
| 8   | `generate_diagram`    | executeMermaidDiagram | Generate diagrams from Mermaid syntax                     |
| 9   | `create_and_run_tool` | executeDynamicTool    | Create and execute custom tools dynamically               |
| 10  | `github`              | executeGitHub         | GitHub API operations (repos, issues, PRs)                |
| 11  | `diff_compare`        | executeDiff           | Compare text/code and show differences                    |

### 3. Media & Image Tools (7)

| #   | Tool Name          | Function              | Description                                    |
| --- | ------------------ | --------------------- | ---------------------------------------------- |
| 12  | `analyze_image`    | executeVisionAnalyze  | Claude Vision analysis of images               |
| 13  | `screenshot`       | executeScreenshot     | Capture screenshots of web pages               |
| 14  | `capture_webpage`  | executeWebCapture     | Advanced webpage capture (screenshot, PDF)     |
| 15  | `ocr_extract_text` | executeOCR            | Extract text from images using Tesseract.js    |
| 16  | `transform_image`  | executeImageTransform | Resize, crop, rotate, filter images with Sharp |
| 17  | `image_metadata`   | executeExif           | Extract EXIF metadata from images              |
| 18  | `create_chart`     | executeChart          | Generate charts and graphs from data           |

### 4. Document & Data Tools (10)

| #   | Tool Name            | Function            | Description                                  |
| --- | -------------------- | ------------------- | -------------------------------------------- |
| 19  | `extract_pdf`        | executeExtractPdf   | Extract text from PDF URLs                   |
| 20  | `pdf_manipulate`     | executePDF          | Create, merge, split PDFs with pdf-lib       |
| 21  | `extract_table`      | executeExtractTable | Extract tables from documents                |
| 22  | `create_document`    | executeDocument     | Create Word/PDF documents                    |
| 23  | `create_spreadsheet` | executeSpreadsheet  | Create Excel/CSV spreadsheets                |
| 24  | `excel_advanced`     | executeExcel        | Advanced Excel operations with SheetJS       |
| 25  | `query_data_sql`     | executeSQL          | Run SQL queries on in-memory SQLite database |
| 26  | `convert_file`       | executeFileConvert  | Convert between file formats                 |
| 27  | `search_index`       | executeSearchIndex  | Full-text search with Lunr.js                |
| 28  | `http_request`       | executeHttpRequest  | Make HTTP requests (GET, POST, etc.)         |

### 5. Text Processing Tools (4)

| #   | Tool Name            | Function                | Description                                   |
| --- | -------------------- | ----------------------- | --------------------------------------------- |
| 29  | `analyze_text_nlp`   | executeNLP              | NLP analysis (sentiment, tokens, stems, etc.) |
| 30  | `extract_entities`   | executeEntityExtraction | Extract named entities from text              |
| 31  | `transcribe_audio`   | executeAudioTranscribe  | Transcribe audio files to text                |
| 32  | `generate_fake_data` | executeFaker            | Generate realistic test data                  |

### 6. Utility Tools (14)

| #   | Tool Name          | Function           | Description                                 |
| --- | ------------------ | ------------------ | ------------------------------------------- |
| 33  | `calculator`       | executeCalculator  | Advanced calculator with math.js            |
| 34  | `math_compute`     | executeMath        | Complex mathematical computations           |
| 35  | `crypto_toolkit`   | executeCryptoTool  | JWT, encryption, hashing with jose          |
| 36  | `zip_files`        | executeZip         | Create/extract ZIP archives                 |
| 37  | `generate_qr_code` | executeQRCode      | Generate QR codes                           |
| 38  | `generate_barcode` | executeBarcode     | Generate various barcode formats            |
| 39  | `shorten_link`     | executeLinkShorten | Create shortened URLs                       |
| 40  | `validate_data`    | executeValidator   | Validate emails, URLs, credit cards, etc.   |
| 41  | `convert_units`    | executeUnitConvert | Convert between measurement units           |
| 42  | `cron_explain`     | executeCron        | Parse and explain cron expressions          |
| 43  | `ascii_art`        | executeAsciiArt    | Generate ASCII art text with FIGlet         |
| 44  | `color_tools`      | executeColor       | Color manipulation with chroma-js           |
| 45  | `audio_synth`      | executeAudioSynth  | Audio synthesis specifications with Tone.js |
| 46  | `media_process`    | executeMedia       | Audio/video processing with FFmpeg.wasm     |

### 7. Scientific & Research Tools (12)

| #   | Tool Name             | Function                | Description                                                       |
| --- | --------------------- | ----------------------- | ----------------------------------------------------------------- |
| 47  | `analyze_statistics`  | executeStatistics       | Statistical analysis: t-test, ANOVA, regression, correlation      |
| 48  | `geo_calculate`       | executeGeospatial       | Geospatial calculations with turf.js (distance, area, bearing)    |
| 49  | `phone_validate`      | executePhone            | Phone number validation and formatting (libphonenumber-js)        |
| 50  | `analyze_password`    | executePasswordStrength | Password strength analysis with pattern detection (zxcvbn)        |
| 51  | `analyze_molecule`    | executeChemistry        | Chemistry/molecular analysis: SMILES, properties (openchemlib-js) |
| 52  | `analyze_sequence`    | executeDnaBio           | DNA/RNA/protein sequences: complement, translate, GC content      |
| 53  | `matrix_compute`      | executeMatrix           | Linear algebra: eigenvalues, SVD, matrix operations (ml-matrix)   |
| 54  | `analyze_graph`       | executeGraph            | Network/graph analysis: shortest path, centrality (graphology)    |
| 55  | `periodic_table`      | executePeriodicTable    | Element properties lookup and molecular mass calculation          |
| 56  | `physics_constants`   | executePhysicsConstants | Physical constants lookup and unit calculations                   |
| 57  | `signal_process`      | executeSignal           | FFT/signal processing: spectrum analysis, waveforms (fft-js)      |
| 58  | `check_accessibility` | executeAccessibility    | WCAG accessibility checking for HTML content                      |

---

## Tool Execution Architecture

### Request Flow

```
User Message → Claude Sonnet 4.5 → Tool Selection → Availability Check
                                                          ↓
                                                   Execute Tool
                                                          ↓
                                                   Quality Control
                                                          ↓
                                                   Return Result
```

### Tool Registration

All tools are registered in two locations:

1. **Tool Index** (`/src/lib/ai/tools/index.ts`)
   - Static tool definitions exported
   - CHAT_TOOLS array with all 58 tools
   - Lazy loading for optimal performance

2. **Chat Route** (`/app/api/chat/route.ts`)
   - Tool imports and availability checks
   - Switch statement for tool execution
   - Cost tracking and quality control

---

## Tool Availability

All tools include availability checks:

| Tool Type     | Check Function         | Typical Availability |
| ------------- | ---------------------- | -------------------- |
| Local-only    | `isTOOLAvailable()`    | Always available     |
| API-dependent | `isTOOLAvailable()`    | Depends on API keys  |
| E2B-dependent | `isRunCodeAvailable()` | Requires E2B_API_KEY |

---

## Cost Structure

| Tool Category    | Cost Range   | Notes                           |
| ---------------- | ------------ | ------------------------------- |
| Local tools      | $0.0001      | Runs entirely in-browser/server |
| Scientific tools | $0.0001      | Local computation only          |
| Web tools        | $0.001-$0.01 | API calls to external services  |
| Code execution   | $0.001-$0.05 | E2B sandbox time                |
| Image processing | $0.001-$0.01 | Compute-intensive               |

---

## Recent Updates

### January 31, 2026 - Scientific & Research Tools (58 Total)

Added 12 new scientific/research tools for pharmaceutical, physics, chemistry, and biology research:

**Statistical & Data Science:**

- `analyze_statistics` - T-test, ANOVA, regression, correlation (simple-statistics + jstat)
- `matrix_compute` - Linear algebra, eigenvalues, SVD (ml-matrix)
- `analyze_graph` - Network analysis, shortest path, centrality (graphology)
- `signal_process` - FFT, signal analysis, waveforms (fft-js)

**Chemistry & Biology:**

- `analyze_molecule` - SMILES parsing, molecular properties (openchemlib-js)
- `analyze_sequence` - DNA/RNA/protein analysis, translation, GC content
- `periodic_table` - Element lookup, molecular mass calculations

**Physics & Engineering:**

- `physics_constants` - Physical constants (c, h, G, etc.) with calculations
- `geo_calculate` - Geospatial calculations (turf.js)

**Security & Validation:**

- `phone_validate` - International phone validation (libphonenumber-js)
- `analyze_password` - Password strength scoring (zxcvbn)
- `check_accessibility` - WCAG accessibility checking

### January 31, 2026 - Tier S/A/B Tool Expansion (46 Total)

Added 18 local-only tools covering OCR, PDF, media processing, SQL, Excel, code formatting, and utilities.

---

## Verification Status

| Check                                                 | Status      |
| ----------------------------------------------------- | ----------- |
| All 58 tools exported from index.ts                   | ✅ Verified |
| All 58 tools have switch cases in route.ts            | ✅ Verified |
| All tool names match between definitions and handlers | ✅ Verified |
| Build passes with no TypeScript errors                | ✅ Verified |
| All tools have proper documentation headers           | ✅ Verified |

---

## File Locations

| File                            | Purpose                         |
| ------------------------------- | ------------------------------- |
| `/src/lib/ai/tools/index.ts`    | Tool registry and exports       |
| `/app/api/chat/route.ts`        | Tool execution handlers         |
| `/src/lib/ai/tools/*-tool.ts`   | Individual tool implementations |
| `/docs/CHAT_TOOLS_INVENTORY.md` | This documentation              |

---

_Document generated: January 31, 2026_
_Chief Engineering Officer - JCIL.AI Platform_
