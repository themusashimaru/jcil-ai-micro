# JCIL.AI Chat Tools Inventory

## Complete Tool Catalog

**Last Updated:** January 31, 2026
**Total Tools:** 46
**Prepared by:** Chief Engineering Officer

---

## Executive Summary

The JCIL.AI platform provides Claude Sonnet 4.5 with unrestricted access to 46 powerful tools. All tools are fully wired, tested, and production-ready. This document serves as the authoritative reference for all available chat capabilities.

---

## Tool Categories

### Category Overview

| Category               | Tool Count | Description                                    |
| ---------------------- | ---------- | ---------------------------------------------- |
| **Web & Research**     | 5          | Web scraping, search, browser automation       |
| **Code & Development** | 6          | Code execution, formatting, diagrams           |
| **Media & Images**     | 7          | OCR, image processing, charts, screenshots     |
| **Documents & Data**   | 10         | PDF, Excel, spreadsheets, SQL, data processing |
| **Text Processing**    | 4          | NLP, entity extraction, diff comparison        |
| **Utilities**          | 14         | Crypto, ZIP, validators, converters, etc.      |

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
   - CHAT_TOOLS array with all 46 tools
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
| Web tools        | $0.001-$0.01 | API calls to external services  |
| Code execution   | $0.001-$0.05 | E2B sandbox time                |
| Image processing | $0.001-$0.01 | Compute-intensive               |

---

## Recent Updates

### January 31, 2026 - Tier S/A/B Tool Expansion

Added 18 new local-only tools:

**Tier S (Game Changers):**

- `ocr_extract_text` - Tesseract.js OCR
- `pdf_manipulate` - pdf-lib PDF operations
- `media_process` - FFmpeg.wasm audio/video
- `query_data_sql` - sql.js SQLite database
- `excel_advanced` - SheetJS Excel processing

**Tier A (High Value):**

- `format_code` - Prettier code formatting
- `crypto_toolkit` - jose JWT/encryption
- `zip_files` - JSZip archives
- `capture_webpage` - Puppeteer captures
- `math_compute` - math.js computations
- `image_metadata` - exifr metadata
- `search_index` - Lunr.js search

**Tier B (Utilities):**

- `ascii_art` - FIGlet ASCII art
- `color_tools` - chroma-js colors
- `validate_data` - validator.js
- `cron_explain` - cron-parser
- `convert_units` - convert-units
- `audio_synth` - Tone.js specs

---

## Verification Status

| Check                                                 | Status      |
| ----------------------------------------------------- | ----------- |
| All 46 tools exported from index.ts                   | ✅ Verified |
| All 46 tools have switch cases in route.ts            | ✅ Verified |
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
