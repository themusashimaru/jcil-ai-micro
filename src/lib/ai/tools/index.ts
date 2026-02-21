/**
 * CHAT TOOLS INDEX
 *
 * Unified exports for all chat-level tools.
 * These tools extend the main chat with capabilities from Deep Strategy agent.
 *
 * Tools available (371 total):
 * - web_search: Search the web (Brave Search)
 * - fetch_url: Fetch and extract content from URLs
 * - run_code: Execute Python/JavaScript in E2B sandbox
 * - analyze_image: Vision analysis with Claude
 * - browser_visit: Full browser via Puppeteer
 * - extract_pdf: Extract text from PDF URLs
 * - extract_table: Vision-based table extraction
 * - parallel_research: Mini-agent orchestrator (5-10 agents max)
 * - create_and_run_tool: Dynamic tool creation (cost-limited)
 * - youtube_transcript: Extract transcripts from YouTube videos
 * - github: Search and browse GitHub repos, code, issues
 * - screenshot: Capture screenshots of any webpage
 * - calculator: Advanced math with Wolfram Alpha
 * - create_chart: Generate charts and data visualizations
 * - create_document: Generate PDF, DOCX, TXT documents
 * - transcribe_audio: Transcribe audio files with Whisper
 * - create_spreadsheet: Generate Excel files with formulas (ExcelJS)
 * - http_request: Make HTTP requests to APIs and webhooks
 * - generate_qr_code: Create QR codes from text/URLs
 * - transform_image: Resize, compress, convert, watermark images
 * - convert_file: Convert between file formats
 * - shorten_link: Create shortened URLs
 * - generate_diagram: Create diagrams with Mermaid.js (flowcharts, sequence, etc.)
 * - generate_fake_data: Generate realistic fake data with Faker.js
 * - diff_compare: Compare texts and show differences
 * - analyze_text_nlp: NLP analysis (sentiment, tokenize, stem, etc.)
 * - extract_entities: Extract named entities from text
 * - generate_barcode: Create barcodes (CODE128, EAN, UPC, etc.)
 * - ocr_extract_text: Extract text from images (Tesseract.js OCR)
 * - pdf_manipulate: Create, merge, split, watermark PDFs (pdf-lib)
 * - media_process: Audio/video processing (FFmpeg.js)
 * - query_data_sql: SQL queries on data (SQL.js)
 * - excel_advanced: Advanced Excel manipulation (SheetJS)
 * - format_code: Code formatting (Prettier)
 * - crypto_toolkit: JWT, encryption, hashing (jose)
 * - zip_files: Create/extract ZIP archives (JSZip)
 * - capture_webpage: Web screenshots and PDFs (Puppeteer)
 * - math_compute: Advanced math and unit conversion (math.js)
 * - image_metadata: EXIF/metadata extraction (exifr)
 * - search_index: Full-text search indexing (Lunr.js)
 * - ascii_art: ASCII art text generation (FIGlet)
 * - color_tools: Color manipulation and palettes (chroma-js)
 * - validate_data: Data validation (validator.js)
 * - cron_explain: Cron expression parsing
 * - convert_units: Unit conversions (convert-units)
 * - audio_synth: Audio tone generation specs (Tone.js)
 * - analyze_statistics: Statistical analysis (simple-statistics + jstat)
 * - geo_calculate: Geospatial calculations (turf.js)
 * - phone_validate: Phone number validation (libphonenumber-js)
 * - analyze_password: Password strength analysis (zxcvbn)
 * - analyze_molecule: Chemistry/molecule analysis (openchemlib-js)
 * - analyze_sequence: DNA/RNA/protein sequences (custom)
 * - matrix_compute: Matrix/linear algebra (ml-matrix)
 * - analyze_graph: Graph/network analysis (graphology)
 * - periodic_table: Element properties lookup (custom)
 * - physics_constants: Physical constants (custom)
 * - signal_process: Signal processing/FFT (fft-js)
 * - check_accessibility: WCAG accessibility checking (axe-core)
 * - numerical_integrate: Numerical integration (Simpson's, Gauss-Legendre, Romberg)
 * - find_roots: Root finding (Newton, bisection, secant, Brent)
 * - interpolate: Interpolation (linear, Lagrange, spline, polynomial fit)
 * - special_functions: Math special functions (Gamma, Bessel, erf, Legendre)
 * - complex_math: Complex number operations (complex.js)
 * - combinatorics: Combinatorial math (permutations, combinations, Stirling)
 * - number_theory: Number theory (primes, factorization, modular arithmetic)
 * - probability_dist: Probability distributions (normal, binomial, chi-squared)
 * - polynomial_ops: Polynomial operations (arithmetic, roots, GCD)
 * - astronomy_calc: Celestial mechanics (planet positions, moon phases)
 * - coordinate_transform: Geographic projections (proj4)
 * - sequence_analyze: Sequence analysis and pattern detection
 *
 * TIER OMEGA - Advanced Scientific Computing (12 new tools):
 * - ml_toolkit: Machine Learning (K-means, PCA, regression, neural networks)
 * - quantum_circuit: Quantum Computing (gates, Bell states, Grover's algorithm)
 * - control_theory: Control Systems (transfer functions, PID, Bode plots)
 * - monte_carlo_sim: Monte Carlo (integration, option pricing, VaR, bootstrap)
 * - game_solver: Game Theory (Nash equilibrium, minimax, replicator dynamics)
 * - orbital_calc: Orbital Mechanics (Hohmann transfers, delta-v, orbital elements)
 * - thermo_calc: Thermodynamics (gas laws, Carnot, heat transfer)
 * - em_fields: Electromagnetics (E/B fields, transmission lines, antennas)
 * - image_compute: Image Processing (convolution, edge detection, morphology)
 * - wavelet_transform: Wavelets (DWT, CWT, denoising, multi-resolution)
 * - latex_render: LaTeX Rendering (MathML/SVG output, equation templates)
 *
 * TIER INFINITY - Rocket Science & Engineering (12 new tools):
 * - rocket_propulsion: Rocket Science (Tsiolkovsky, staging, thrust curves)
 * - fluid_dynamics: Fluid Mechanics (Reynolds, Bernoulli, pipe flow, drag)
 * - aerodynamics: Aircraft Aerodynamics (lift/drag, airfoils, atmosphere)
 * - drone_flight: UAV Flight (hover, endurance, waypoints, battery)
 * - pathfinder: Routing Algorithms (A*, Dijkstra, TSP, BFS)
 * - circuit_sim: Circuit Analysis (RC/RLC, impedance, filters)
 * - ballistics: Projectile Motion (drag, wind, Coriolis, terminal velocity)
 * - genetic_algorithm: Evolutionary Optimization (crossover, mutation)
 * - chaos_dynamics: Chaos Theory (Lorenz, Lyapunov, bifurcation, fractals)
 * - robotics_kinematics: Robot Kinematics (forward/inverse, Jacobian)
 * - optics_sim: Optics (Snell's law, lenses, diffraction, interference)
 * - epidemiology: Disease Modeling (SIR/SEIR, R0, herd immunity)
 *
 * TIER BEYOND - Advanced Engineering (6 bonus tools):
 * - finite_element: Structural Mechanics (stress/strain, beams, buckling)
 * - antenna_rf: RF Engineering (link budgets, path loss, impedance)
 * - materials_science: Materials (crystals, phase diagrams, Hall-Petch)
 * - seismology: Earthquake Modeling (magnitude, waves, ground motion)
 * - bioinformatics_pro: Sequence Alignment (Needleman-Wunsch, phylogenetics)
 * - acoustics: Sound/Acoustics (room modes, RT60, speaker design)
 *
 * Workflow utilities:
 * - Workflow tasks: Claude Code style todo lists with borders
 *
 * Last updated: 2026-02-01 12:00 AM UTC
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPE RE-EXPORTS
// ============================================================================

export type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TOOL IMPORTS
// ============================================================================

// Web Search (native Anthropic server tool)
import { isNativeServerTool as _isNativeServerTool } from './web-search';
export {
  webSearchTool,
  executeWebSearch,
  isWebSearchAvailable,
  isNativeServerTool,
  NATIVE_WEB_SEARCH_SENTINEL,
} from './web-search';

// URL Fetcher
export { fetchUrlTool, executeFetchUrl, isFetchUrlAvailable } from './fetch-url';

// Code Execution
export { runCodeTool, executeRunCode, isRunCodeAvailable, cleanupCodeSandbox } from './run-code';

// Vision Analysis
export {
  visionAnalyzeTool,
  executeVisionAnalyze,
  isVisionAnalyzeAvailable,
  analyzeConversationImage,
} from './vision-analyze';

// Browser Visit
export {
  browserVisitTool,
  executeBrowserVisitTool,
  isBrowserVisitAvailable,
  cleanupBrowserSandbox,
} from './browser-visit';

// PDF Extraction
export { extractPdfTool, executeExtractPdf, isExtractPdfAvailable } from './extract-pdf';

// Table Extraction
export { extractTableTool, executeExtractTable, isExtractTableAvailable } from './extract-table';

// Mini-Agent Orchestrator
export { miniAgentTool, executeMiniAgent, isMiniAgentAvailable } from './mini-agent';

// Dynamic Tool Creation
export {
  dynamicToolTool,
  executeDynamicTool,
  isDynamicToolAvailable,
  getDynamicToolSessionInfo,
  DYNAMIC_TOOL_LIMITS,
} from './dynamic-tool';

// YouTube Transcript
export {
  youtubeTranscriptTool,
  executeYouTubeTranscript,
  isYouTubeTranscriptAvailable,
} from './youtube-transcript';

// GitHub Tool - REMOVED: Now handled by Composio GitHub connector
// Keeping getRepoSummaryForPrompt for backward compatibility
export { getRepoSummaryForPrompt } from './github-tool';

// Screenshot Tool
export { screenshotTool, executeScreenshot, isScreenshotAvailable } from './screenshot-tool';

// Chart/Data Visualization Tool
export { chartTool, executeChart, isChartAvailable } from './chart-tool';

// Document Generation Tool
export { documentTool, executeDocument, isDocumentAvailable } from './document-tool';

// Audio Transcription (Whisper)
export {
  audioTranscribeTool,
  executeAudioTranscribe,
  isAudioTranscribeAvailable,
} from './audio-transcribe';

// Spreadsheet Generation (Excel)
export { spreadsheetTool, executeSpreadsheet, isSpreadsheetAvailable } from './spreadsheet-tool';

// HTTP Request (API calls, webhooks)
export { httpRequestTool, executeHttpRequest, isHttpRequestAvailable } from './http-request-tool';

// QR Code Generation
export { qrCodeTool, executeQRCode, isQRCodeAvailable } from './qr-code-tool';

// Image Transform (resize, compress, convert, watermark)
export {
  imageTransformTool,
  executeImageTransform,
  isImageTransformAvailable,
} from './image-transform-tool';

// File Conversion (format conversion)
export { fileConvertTool, executeFileConvert, isFileConvertAvailable } from './file-convert-tool';

// Link Shortening
export { linkShortenTool, executeLinkShorten, isLinkShortenAvailable } from './link-shorten-tool';

// Mermaid Diagram Generation
export {
  mermaidDiagramTool,
  executeMermaidDiagram,
  isMermaidDiagramAvailable,
} from './mermaid-diagram-tool';

// Fake Data Generation (Faker.js)
export { fakerTool, executeFaker, isFakerAvailable } from './faker-tool';

// Text Diff Comparison
export { diffTool, executeDiff, isDiffAvailable } from './diff-tool';

// NLP Analysis (Natural)
export { nlpTool, executeNLP, isNLPAvailable } from './nlp-tool';

// Entity Extraction (Compromise)
export {
  entityExtractionTool,
  executeEntityExtraction,
  isEntityExtractionAvailable,
} from './entity-extraction-tool';

// Barcode Generation (JsBarcode)
export { barcodeTool, executeBarcode, isBarcodeAvailable } from './barcode-tool';

// ============================================================================
// NEW TIER S/A/B TOOLS (19 new tools)
// ============================================================================

// OCR - Text extraction from images (Tesseract.js)
export { ocrTool, executeOCR, isOCRAvailable } from './ocr-tool';

// PDF Manipulation (pdf-lib)
export { pdfTool, executePDF, isPDFAvailable } from './pdf-tool';

// Media Processing (FFmpeg.js)
export { mediaTool, executeMedia, isMediaAvailable } from './media-tool';

// SQL Queries (SQL.js)
export { sqlTool, executeSQL, isSQLAvailable } from './sql-tool';

// Advanced Excel (SheetJS xlsx)
export { excelTool, executeExcel, isExcelAvailable } from './excel-tool';

// Code Formatting (Prettier)
export { prettierTool, executePrettier, isPrettierAvailable } from './prettier-tool';

// Cryptography (jose)
export { cryptoTool, executeCryptoTool, isCryptoToolAvailable } from './crypto-tool';

// ZIP Files (JSZip)
export { zipTool, executeZip, isZipAvailable } from './zip-tool';

// Web Capture (Puppeteer)
export { webCaptureTool, executeWebCapture, isWebCaptureAvailable } from './web-capture-tool';

// EXIF/Image Metadata (exifr)
export { exifTool, executeExif, isExifAvailable } from './exif-tool';

// Search Index (Lunr.js)
export { searchIndexTool, executeSearchIndex, isSearchIndexAvailable } from './search-index-tool';

// Data Validation (validator.js)
export { validatorTool, executeValidator, isValidatorAvailable } from './validator-tool';

// Audio Synthesis (Tone.js)
export { audioSynthTool, executeAudioSynth, isAudioSynthAvailable } from './audio-synth-tool';

// ============================================================================
// SCIENTIFIC & RESEARCH TOOLS (12 new tools)
// ============================================================================

// Geospatial Calculations (turf.js)
export { geospatialTool, executeGeospatial, isGeospatialAvailable } from './geospatial-tool';

// Phone Validation (libphonenumber-js)
export { phoneTool, executePhone, isPhoneAvailable } from './phone-tool';

// DNA/Bio Sequences (custom)
export { dnaBioTool, executeDnaBio, isDnaBioAvailable } from './dna-bio-tool';

// Signal Processing (fft-js)
export { signalTool, executeSignal, isSignalAvailable } from './signal-tool';

// Accessibility Checking (axe-core)
export {
  accessibilityTool,
  executeAccessibility,
  isAccessibilityAvailable,
} from './accessibility-tool';

// ============================================================================
// COMPUTATIONAL & ALGORITHMIC TOOLS (12 new tools)
// ============================================================================

// Parser / Grammar (nearley)
export { parserTool, executeParser, isParserAvailable } from './parser-tool';

// Constraint Solver (logic-solver)
export { constraintTool, executeConstraint, isConstraintAvailable } from './constraint-tool';

// ============================================================================
// ADVANCED SCIENTIFIC COMPUTING TOOLS (12 new tools)
// ============================================================================

// Sequence Analysis
export {
  sequenceAnalyzeTool,
  executeSequenceAnalyze,
  isSequenceAnalyzeAvailable,
} from './sequence-analyze-tool';

// ============================================================================
// TIER OMEGA - ADVANCED SCIENTIFIC COMPUTING TOOLS (12 new tools)
// ============================================================================

// ============================================================================
// TIER INFINITY - ROCKET SCIENCE & ENGINEERING TOOLS (12 new tools)
// ============================================================================

// ============================================================================
// TIER BEYOND - ADVANCED ENGINEERING TOOLS (6 bonus tools)
// ============================================================================

// ============================================================================
// TIER GODMODE - ULTIMATE INTELLIGENCE TOOLS (9 new tools)
// ============================================================================

// Medical Calculator - Clinical scores, drug dosing, body calculations
export { medicalCalcTool, executeMedicalCalc, isMedicalCalcAvailable } from './medical-calc-tool';

// Graphics 3D - 3D mesh generation, OBJ/STL export, scene composition
export { graphics3dTool, executeGraphics3D, isGraphics3DAvailable } from './graphics-3d-tool';

// Error Correction - Hamming codes, CRC, checksums, SECDED
export {
  errorCorrectionTool,
  executeErrorCorrection,
  isErrorCorrectionAvailable,
} from './error-correction-tool';

// Hough Vision - Computer vision: edge detection, Hough transform, corners
export { houghVisionTool, executeHoughVision, isHoughVisionAvailable } from './hough-vision-tool';

// Solar Environmental - Solar energy, carbon footprint, sustainability
export {
  executeSolarEnvironmental,
  isSolarEnvironmentalAvailable,
} from './solar-environmental-tool';

// ============================================================================
// TIER VISUAL MADNESS - Graphics & Animation Tools
// ============================================================================

// SVG Generator - Create SVG graphics, charts, icons
export {
  svgGeneratorTool,
  executeSVGGenerator,
  isSVGGeneratorAvailable,
} from './svg-generator-tool';

// Fractal Generator - Mandelbrot, Julia, Sierpinski, Koch
export {
  fractalGeneratorTool,
  executeFractalGenerator,
  isFractalGeneratorAvailable,
} from './fractal-generator-tool';

// Particle System - Physics-based particle simulation
export {
  particleSystemTool,
  executeParticleSystem,
  isParticleSystemAvailable,
} from './particle-system-tool';

// ============================================================================
// TIER SOUND & MUSIC - Audio Tools
// ============================================================================

// Music Theory is already exported in COMPUTATIONAL & ALGORITHMIC TOOLS section (line 391)

// ============================================================================
// TIER EDUCATION - Interactive Learning Tools
// ============================================================================

// Sorting Visualizer - Step-by-step sorting algorithm visualization
export {
  sortingVisualizerTool,
  executeSortingVisualizer,
  isSortingVisualizerAvailable,
} from './sorting-visualizer-tool';

// Data Structures - Interactive data structure demonstrations
export {
  dataStructuresTool,
  executeDataStructures,
  isDataStructuresAvailable,
} from './data-structures-tool';

// ============================================================================
// TIER ADVANCED SCIENCE - Cutting-Edge Scientific Tools
// ============================================================================

// Quantum Computing - Quantum circuits, gates, algorithms
export {
  quantumComputingTool,
  executeQuantumComputing,
  isQuantumComputingAvailable,
} from './quantum-computing-tool';

// Shader Generator - GLSL shader generation for visual effects
export {
  shaderGeneratorTool,
  executeShaderGenerator,
  isShaderGeneratorAvailable,
} from './shader-generator-tool';

// Neural Network - Educational neural network demonstrations
export {
  neuralNetworkTool,
  executeNeuralNetwork,
  isNeuralNetworkAvailable,
} from './neural-network-tool';

// Procedural Generation - Terrain, noise, dungeons, mazes
export {
  proceduralGenerationTool,
  executeProceduralGeneration,
  isProceduralGenerationAvailable,
} from './procedural-generation-tool';

// Ray Tracing - 3D graphics ray tracing fundamentals
export { rayTracingTool, executeRayTracing, isRayTracingAvailable } from './ray-tracing-tool';

// Automata Theory - DFA, NFA, regex, formal languages
export {
  automataTheoryTool,
  executeAutomataTheory,
  isAutomataTheoryAvailable,
} from './automata-theory-tool';

// ============================================================================
// TIER PHYSICS & CHEMISTRY - Deep Science Tools (6 new tools)
// ============================================================================

// Reaction Kinetics - Rate laws, Arrhenius, mechanisms
export {
  reactionKineticsTool,
  executeReactionKinetics,
  isReactionKineticsAvailable,
} from './reaction-kinetics-tool';

// Electrochemistry - Nernst, electrolysis, batteries
export {
  electrochemistryTool,
  executeElectrochemistry,
  isElectrochemistryAvailable,
} from './electrochemistry-tool';

// Spectroscopy - Beer-Lambert, IR/NMR peaks
export {
  spectroscopyTool,
  executeSpectroscopy,
  isSpectroscopyAvailable,
} from './spectroscopy-tool';

// Quantum Mechanics - Wavefunctions, hydrogen atom
export {
  quantumMechanicsTool,
  executeQuantumMechanics,
  isQuantumMechanicsAvailable,
} from './quantum-mechanics-tool';

// Statistical Mechanics - Boltzmann, partition functions
export {
  statisticalMechanicsTool,
  executeStatisticalMechanics,
  isStatisticalMechanicsAvailable,
} from './statistical-mechanics-tool';

// Workflow Tasks (Claude Code style todo lists)
export {
  // Types
  type TaskStatus,
  type WorkflowTask,
  type Workflow,
  // Workflow management
  createWorkflow,
  getWorkflow,
  updateTaskStatus,
  startNextTask,
  completeCurrentTask,
  deleteWorkflow,
  clearAllWorkflows,
  // Formatting (Claude Code style with borders)
  formatWorkflow,
  formatTaskList,
  formatTaskUpdate,
  formatWorkflowProgress,
  formatProgressLine,
  formatStatusUpdate,
  // Streaming helpers
  createWorkflowChunk,
  containsWorkflowChunk,
  extractWorkflowFromChunk,
} from './workflow-tasks';

// Quality Control
export {
  verifyCodeOutput,
  verifyResearchSynthesis,
  verifyTableExtraction,
  verifyOutput,
  shouldRunQC,
  QC_COST,
  QC_TRIGGERS,
  type QCResult,
} from './quality-control';

// Safety (re-exported from strategy)
export {
  // Blocked lists
  BLOCKED_TLDS,
  BLOCKED_DOMAINS,
  BLOCKED_URL_PATTERNS,
  ADULT_KEYWORDS,
  BLOCKED_FORM_ACTIONS,
  ALLOWED_FORM_TYPES,
  BLOCKED_INPUT_TYPES,
  BLOCKED_INPUT_PATTERNS,
  TRUSTED_DOMAINS,
  CONTENT_WARNING_KEYWORDS,
  // Rate limits
  RATE_LIMITS,
  // Types
  type SafetyCheckResult,
  // Safety check functions
  isUrlSafe,
  isFormActionSafe,
  isInputSafe,
  isDomainTrusted,
  sanitizeOutput,
  checkContentForWarnings,
  // Session tracking
  getSessionTracker,
  canVisitPage,
  recordPageVisit,
  canSubmitForm,
  recordFormSubmission,
  getBlockedAttempts,
  cleanupSessionTracker,
  stopSessionCleanupInterval,
  // Logging
  logRiskyAction,
  logBlockedAction,
  // AI prompts
  AI_SAFETY_PROMPT,
  getCondensedSafetyPrompt,
  // Chat-specific
  CHAT_COST_LIMITS,
  getChatSessionCosts,
  canExecuteTool,
  recordToolCost,
  getSessionCostSummary,
  clearSessionCosts,
} from './safety';

// ============================================================================
// CODE AGENT BRAIN TOOLS - Full Coding Capabilities
// ============================================================================

// Workspace Tool - Bash, File Operations, Git (with Enhancement #2: Persistent Sessions)
export {
  workspaceTool,
  executeWorkspace,
  isWorkspaceAvailable,
  getWorkspaceForConversation,
  getWorkspaceContext,
  cleanupConversationWorkspace,
  executeWorkspaceWithConversation,
} from './workspace-tool';

// Code Generation Tool - Generate production code
export {
  codeGenerationTool,
  executeCodeGeneration,
  isCodeGenerationAvailable,
} from './code-generation-tool';

// Code Analysis Tool - Security/performance/quality analysis
export {
  codeAnalysisTool,
  executeCodeAnalysis,
  isCodeAnalysisAvailable,
} from './code-analysis-tool';

// Project Builder Tool - Create complete project structures
export {
  projectBuilderTool,
  executeProjectBuilder,
  isProjectBuilderAvailable,
} from './project-builder-tool';

// Test Generator Tool - Generate comprehensive tests
export {
  testGeneratorTool,
  executeTestGenerator,
  isTestGeneratorAvailable,
} from './test-generator-tool';

// Error Fixer Tool - Debug and fix code errors
export { errorFixerTool, executeErrorFixer, isErrorFixerAvailable } from './error-fixer-tool';

// Refactor Tool - Improve code quality
export { refactorTool, executeRefactor, isRefactorAvailable } from './refactor-tool';

// Doc Generator Tool - Generate documentation
export {
  docGeneratorTool,
  executeDocGenerator,
  isDocGeneratorAvailable,
} from './doc-generator-tool';

// Tool Chain Executor - Smart multi-tool workflows (Enhancement #3)
export {
  toolChainTool,
  createToolChainExecutor,
  ToolChainExecutor,
  WORKFLOW_TEMPLATES,
  type ToolChainPlan,
  type ToolChainProgress,
  type ToolChainResult,
  type ToolChainStep,
} from './tool-chain-executor';

// GitHub Context Tool - REMOVED: Now handled by Composio GitHub connector

// ============================================================================
// CYBERSECURITY TOOLS (32 tools) - Full Security Operations Suite
// ============================================================================

export {
  networkDefenseTool,
  executeNetworkDefense,
  isNetworkDefenseAvailable,
} from './network-defense-tool';

// ============================================================================
// MEGA BATCH - 158 Additional Engineering/Science/Manufacturing Tools
// ============================================================================
export {
  accessControlTool,
  executeAccessControl,
  isAccessControlAvailable,
} from './access-control-tool';
export { agricultureTool, executeAgriculture, isAgricultureAvailable } from './agriculture-tool';
export {
  assetManagementTool,
  executeAssetManagement,
  isAssetManagementAvailable,
} from './asset-management-tool';
export {
  authProtocolTool,
  executeAuthProtocol,
  isAuthProtocolAvailable,
} from './auth-protocol-tool';
export {
  authenticationTool,
  executeAuthentication,
  isAuthenticationAvailable,
} from './authentication-tool';
export {
  backupRecoveryTool,
  executeBackupRecovery,
  isBackupRecoveryAvailable,
} from './backup-recovery-tool';
export {
  businessContinuityTool,
  executeBusinessContinuity,
  isBusinessContinuityAvailable,
} from './business-continuity-tool';
export { certificateTool, executeCertificate, isCertificateAvailable } from './certificate-tool';
export {
  crystallographyTool,
  executeCrystallography,
  isCrystallographyAvailable,
} from './crystallography-tool';
export {
  dataClassificationTool,
  executeDataClassification,
  isDataClassificationAvailable,
} from './data-classification-tool';
export {
  dataLossPreventionTool,
  executeDataLossPrevention,
  isDataLossPreventionAvailable,
} from './data-loss-prevention-tool';
export { devsecOpsTool, executeDevsecOps, isDevsecOpsAvailable } from './devsecops-tool';
export { ecologyTool, executeEcology, isEcologyAvailable } from './ecology-tool';
export { encryptionTool, executeEncryption, isEncryptionAvailable } from './encryption-tool';
export {
  entropyAnalysisTool,
  executeEntropyAnalysis,
  isEntropyAnalysisAvailable,
} from './entropy-analysis-tool';
export { geologyTool, executeGeology, isGeologyAvailable } from './geology-tool';
export {
  identityGovernanceTool,
  executeIdentityGovernance,
  isIdentityGovernanceAvailable,
} from './identity-governance-tool';
export {
  identityManagementTool,
  executeIdentityManagement,
  isIdentityManagementAvailable,
} from './identity-management-tool';
export {
  industrialControlTool,
  executeIndustrialControl,
  isIndustrialControlAvailable,
} from './industrial-control-tool';
export { jwtTool, executeJwt, isJwtAvailable } from './jwt-tool';
export {
  keyManagementTool,
  executeKeyManagement,
  isKeyManagementAvailable,
} from './key-management-tool';
export { logAnalysisTool, executeLogAnalysis, isLogAnalysisAvailable } from './log-analysis-tool';
export {
  logManagementTool,
  executeLogManagement,
  isLogManagementAvailable,
} from './log-management-tool';
export { meteorologyTool, executeMeteorology, isMeteorologyAvailable } from './meteorology-tool';
export { mineralogyTool, executeMineralogy, isMineralogyAvailable } from './mineralogy-tool';
export {
  networkAnalysisTool,
  executeNetworkAnalysis,
  isNetworkAnalysisAvailable,
} from './network-analysis-tool';
export {
  nuclearPhysicsTool,
  executeNuclearPhysics,
  isNuclearPhysicsAvailable,
} from './nuclear-physics-tool';
export { nutritionTool, executeNutrition, isNutritionAvailable } from './nutrition-tool';
export {
  oceanographyTool,
  executeOceanography,
  isOceanographyAvailable,
} from './oceanography-tool';
export { owaspTool, executeOwasp, isOwaspAvailable } from './owasp-tool';
export {
  patchManagementTool,
  executePatchManagement,
  isPatchManagementAvailable,
} from './patch-management-tool';
export {
  pharmacologyTool,
  executePharmacology,
  isPharmacologyAvailable,
} from './pharmacology-tool';
export { photonicsTool, executePhotonics, isPhotonicsAvailable } from './photonics-tool';
export { pkiTool, executePki, isPkiAvailable } from './pki-tool';
export {
  plasmaPhysicsTool,
  executePlasmaPhysics,
  isPlasmaPhysicsAvailable,
} from './plasma-physics-tool';
export {
  polymerChemistryTool,
  executePolymerChemistry,
  isPolymerChemistryAvailable,
} from './polymer-chemistry-tool';
export { portScannerTool, executePortScanner, isPortScannerAvailable } from './port-scanner-tool';
export {
  powerSystemsTool,
  executePowerSystems,
  isPowerSystemsAvailable,
} from './power-systems-tool';
export { privacyTool, executePrivacy, isPrivacyAvailable } from './privacy-tool';
export {
  privacyEngineeringTool,
  executePrivacyEngineering,
  isPrivacyEngineeringAvailable,
} from './privacy-engineering-tool';
export { psychologyTool, executePsychology, isPsychologyAvailable } from './psychology-tool';
export { roboticsTool, executeRobotics, isRoboticsAvailable } from './robotics-tool';
export { saseTool, executeSase, isSaseAvailable } from './sase-tool';
export { scadaIcsTool, executeScadaIcs, isScadaIcsAvailable } from './scada-ics-tool';
export {
  secretsManagementTool,
  executeSecretsManagement,
  isSecretsManagementAvailable,
} from './secrets-management-tool';
export {
  secureCommunicationsTool,
  executeSecureCommunications,
  isSecureCommunicationsAvailable,
} from './secure-communications-tool';
export { secureSdlcTool, executeSecureSdlc, isSecureSdlcAvailable } from './secure-sdlc-tool';
export {
  semiconductorTool,
  executeSemiconductor,
  isSemiconductorAvailable,
} from './semiconductor-tool';
export { surveyingTool, executeSurveying, isSurveyingAvailable } from './surveying-tool';
export {
  trafficEngineeringTool,
  executeTrafficEngineering,
  isTrafficEngineeringAvailable,
} from './traffic-engineering-tool';
export { vpnTool, executeVpn, isVpnAvailable } from './vpn-tool';

// ============================================================================
// TOOL REGISTRY
// ============================================================================

/**
 * All chat tools with their executors
 */
export const CHAT_TOOLS: {
  tool: UnifiedTool;
  executor: (call: UnifiedToolCall) => Promise<UnifiedToolResult>;
  checkAvailability: () => boolean | Promise<boolean>;
}[] = [];

// Lazy initialization to avoid circular dependencies
let toolsInitialized = false;

async function initializeTools() {
  if (toolsInitialized) return;

  const { webSearchTool, executeWebSearch, isWebSearchAvailable } = await import('./web-search');
  const { fetchUrlTool, executeFetchUrl, isFetchUrlAvailable } = await import('./fetch-url');
  const { runCodeTool, executeRunCode, isRunCodeAvailable } = await import('./run-code');
  const { visionAnalyzeTool, executeVisionAnalyze, isVisionAnalyzeAvailable } = await import(
    './vision-analyze'
  );

  const { browserVisitTool, executeBrowserVisitTool, isBrowserVisitAvailable } = await import(
    './browser-visit'
  );

  const { extractPdfTool, executeExtractPdf, isExtractPdfAvailable } = await import(
    './extract-pdf'
  );

  const { extractTableTool, executeExtractTable, isExtractTableAvailable } = await import(
    './extract-table'
  );

  const { miniAgentTool, executeMiniAgent, isMiniAgentAvailable } = await import('./mini-agent');
  const { dynamicToolTool, executeDynamicTool, isDynamicToolAvailable } = await import(
    './dynamic-tool'
  );

  const { youtubeTranscriptTool, executeYouTubeTranscript, isYouTubeTranscriptAvailable } =
    await import('./youtube-transcript');
  // GitHub tool removed - now handled by Composio GitHub connector
  const { screenshotTool, executeScreenshot, isScreenshotAvailable } = await import(
    './screenshot-tool'
  );

  const { chartTool, executeChart, isChartAvailable } = await import('./chart-tool');
  const { documentTool, executeDocument, isDocumentAvailable } = await import('./document-tool');
  const { audioTranscribeTool, executeAudioTranscribe, isAudioTranscribeAvailable } = await import(
    './audio-transcribe'
  );

  const { spreadsheetTool, executeSpreadsheet, isSpreadsheetAvailable } = await import(
    './spreadsheet-tool'
  );

  const { httpRequestTool, executeHttpRequest, isHttpRequestAvailable } = await import(
    './http-request-tool'
  );

  const { qrCodeTool, executeQRCode, isQRCodeAvailable } = await import('./qr-code-tool');
  const { imageTransformTool, executeImageTransform, isImageTransformAvailable } = await import(
    './image-transform-tool'
  );

  const { fileConvertTool, executeFileConvert, isFileConvertAvailable } = await import(
    './file-convert-tool'
  );

  const { linkShortenTool, executeLinkShorten, isLinkShortenAvailable } = await import(
    './link-shorten-tool'
  );

  const { mermaidDiagramTool, executeMermaidDiagram, isMermaidDiagramAvailable } = await import(
    './mermaid-diagram-tool'
  );

  const { fakerTool, executeFaker, isFakerAvailable } = await import('./faker-tool');
  const { diffTool, executeDiff, isDiffAvailable } = await import('./diff-tool');
  const { nlpTool, executeNLP, isNLPAvailable } = await import('./nlp-tool');
  await import('./entity-extraction-tool');
  const { barcodeTool, executeBarcode, isBarcodeAvailable } = await import('./barcode-tool');

  // New Tier S/A/B tools (19 new tools)
  const { ocrTool, executeOCR, isOCRAvailable } = await import('./ocr-tool');
  const { pdfTool, executePDF, isPDFAvailable } = await import('./pdf-tool');
  const { mediaTool, executeMedia, isMediaAvailable } = await import('./media-tool');
  const { sqlTool, executeSQL, isSQLAvailable } = await import('./sql-tool');
  const { excelTool, executeExcel, isExcelAvailable } = await import('./excel-tool');
  const { prettierTool, executePrettier, isPrettierAvailable } = await import('./prettier-tool');
  const { cryptoTool, executeCryptoTool, isCryptoToolAvailable } = await import('./crypto-tool');
  const { zipTool, executeZip, isZipAvailable } = await import('./zip-tool');
  const { webCaptureTool, executeWebCapture, isWebCaptureAvailable } = await import(
    './web-capture-tool'
  );

  const { exifTool, executeExif, isExifAvailable } = await import('./exif-tool');
  const { searchIndexTool, executeSearchIndex, isSearchIndexAvailable } = await import(
    './search-index-tool'
  );

  const { validatorTool, executeValidator, isValidatorAvailable } = await import(
    './validator-tool'
  );

  const { audioSynthTool, executeAudioSynth, isAudioSynthAvailable } = await import(
    './audio-synth-tool'
  );

  const { geospatialTool, executeGeospatial, isGeospatialAvailable } = await import(
    './geospatial-tool'
  );

  const { phoneTool, executePhone, isPhoneAvailable } = await import('./phone-tool');

  const { dnaBioTool, executeDnaBio, isDnaBioAvailable } = await import('./dna-bio-tool');

  const { signalTool, executeSignal, isSignalAvailable } = await import('./signal-tool');
  const { accessibilityTool, executeAccessibility, isAccessibilityAvailable } = await import(
    './accessibility-tool'
  );

  const { parserTool, executeParser, isParserAvailable } = await import('./parser-tool');

  const { constraintTool, executeConstraint, isConstraintAvailable } = await import(
    './constraint-tool'
  );

  const { sequenceAnalyzeTool, executeSequenceAnalyze, isSequenceAnalyzeAvailable } = await import(
    './sequence-analyze-tool'
  );

  const { medicalCalcTool, executeMedicalCalc, isMedicalCalcAvailable } = await import(
    './medical-calc-tool'
  );

  const { graphics3dTool, executeGraphics3D, isGraphics3DAvailable } = await import(
    './graphics-3d-tool'
  );

  const { errorCorrectionTool, executeErrorCorrection, isErrorCorrectionAvailable } = await import(
    './error-correction-tool'
  );

  const { houghVisionTool, executeHoughVision, isHoughVisionAvailable } = await import(
    './hough-vision-tool'
  );

  await import('./solar-environmental-tool');

  // TIER VISUAL MADNESS - Graphics & Animation Tools
  const { svgGeneratorTool, executeSVGGenerator, isSVGGeneratorAvailable } = await import(
    './svg-generator-tool'
  );

  const { fractalGeneratorTool, executeFractalGenerator, isFractalGeneratorAvailable } =
    await import('./fractal-generator-tool');

  const { particleSystemTool, executeParticleSystem, isParticleSystemAvailable } = await import(
    './particle-system-tool'
  );
  // TIER SOUND & MUSIC - Audio Tools
  // musicTheoryTool already imported in Computational & Algorithmic tools section

  // TIER EDUCATION - Interactive Learning Tools
  const { sortingVisualizerTool, executeSortingVisualizer, isSortingVisualizerAvailable } =
    await import('./sorting-visualizer-tool');
  const { dataStructuresTool, executeDataStructures, isDataStructuresAvailable } = await import(
    './data-structures-tool'
  );
  // TIER ADVANCED SCIENCE - Cutting-Edge Scientific Tools
  const { quantumComputingTool, executeQuantumComputing, isQuantumComputingAvailable } =
    await import('./quantum-computing-tool');
  const { shaderGeneratorTool, executeShaderGenerator, isShaderGeneratorAvailable } = await import(
    './shader-generator-tool'
  );

  const { neuralNetworkTool, executeNeuralNetwork, isNeuralNetworkAvailable } = await import(
    './neural-network-tool'
  );
  const { proceduralGenerationTool, executeProceduralGeneration, isProceduralGenerationAvailable } =
    await import('./procedural-generation-tool');
  const { rayTracingTool, executeRayTracing, isRayTracingAvailable } = await import(
    './ray-tracing-tool'
  );

  const { automataTheoryTool, executeAutomataTheory, isAutomataTheoryAvailable } = await import(
    './automata-theory-tool'
  );

  // TIER PHYSICS & CHEMISTRY - Deep Science Tools (6 new tools)
  const { reactionKineticsTool, executeReactionKinetics, isReactionKineticsAvailable } =
    await import('./reaction-kinetics-tool');
  const { electrochemistryTool, executeElectrochemistry, isElectrochemistryAvailable } =
    await import('./electrochemistry-tool');
  const { spectroscopyTool, executeSpectroscopy, isSpectroscopyAvailable } = await import(
    './spectroscopy-tool'
  );

  const { quantumMechanicsTool, executeQuantumMechanics, isQuantumMechanicsAvailable } =
    await import('./quantum-mechanics-tool');

  const { statisticalMechanicsTool, executeStatisticalMechanics, isStatisticalMechanicsAvailable } =
    await import('./statistical-mechanics-tool');

  // TIER ENGINEERING & APPLIED SCIENCE (15 new compact tools)

  const { photonicsTool, executePhotonics, isPhotonicsAvailable } = await import(
    './photonics-tool'
  );

  const { semiconductorTool, executeSemiconductor, isSemiconductorAvailable } = await import(
    './semiconductor-tool'
  );

  const { crystallographyTool, executeCrystallography, isCrystallographyAvailable } = await import(
    './crystallography-tool'
  );

  const { polymerChemistryTool, executePolymerChemistry, isPolymerChemistryAvailable } =
    await import('./polymer-chemistry-tool');

  const { powerSystemsTool, executePowerSystems, isPowerSystemsAvailable } = await import(
    './power-systems-tool'
  );

  const { psychologyTool, executePsychology, isPsychologyAvailable } = await import(
    './psychology-tool'
  );

  const { surveyingTool, executeSurveying, isSurveyingAvailable } = await import(
    './surveying-tool'
  );

  const { trafficEngineeringTool, executeTrafficEngineering, isTrafficEngineeringAvailable } =
    await import('./traffic-engineering-tool');

  // TIER INDUSTRY & APPLIED SCIENCE (20 more compact tools)

  const { roboticsTool, executeRobotics, isRoboticsAvailable } = await import('./robotics-tool');

  // TIER MANUFACTURING PROCESSES (10 more compact tools)

  // TIER BUILDING & INDUSTRIAL SYSTEMS (10 more compact tools)

  // TIER LIFE SCIENCES (9 more compact tools)

  // TIER EARTH & SOCIAL SCIENCES (9 more compact tools)

  // TIER ADVANCED SCIENCE DOMAINS (7 more compact tools)

  // TIER ENGINEERING SPECIALTIES (6 more compact tools)

  // TIER CHEMICAL ENGINEERING (5 more compact tools)

  // TIER PROCESS ENGINEERING (4 more compact tools)

  // TIER SEPARATION PROCESSES (4 more compact tools)

  // TIER MASS TRANSFER OPERATIONS (3 more compact tools)

  // TIER MINERAL PROCESSING (2 more compact tools)

  // TIER ADDITIONAL SCIENCES (15 more compact tools)
  const { agricultureTool, executeAgriculture, isAgricultureAvailable } = await import(
    './agriculture-tool'
  );

  const { ecologyTool, executeEcology, isEcologyAvailable } = await import('./ecology-tool');

  const { geologyTool, executeGeology, isGeologyAvailable } = await import('./geology-tool');

  const { meteorologyTool, executeMeteorology, isMeteorologyAvailable } = await import(
    './meteorology-tool'
  );

  const { networkAnalysisTool, executeNetworkAnalysis, isNetworkAnalysisAvailable } = await import(
    './network-analysis-tool'
  );

  const { nuclearPhysicsTool, executeNuclearPhysics, isNuclearPhysicsAvailable } = await import(
    './nuclear-physics-tool'
  );

  const { nutritionTool, executeNutrition, isNutritionAvailable } = await import(
    './nutrition-tool'
  );

  const { oceanographyTool, executeOceanography, isOceanographyAvailable } = await import(
    './oceanography-tool'
  );

  const { pharmacologyTool, executePharmacology, isPharmacologyAvailable } = await import(
    './pharmacology-tool'
  );

  const { plasmaPhysicsTool, executePlasmaPhysics, isPlasmaPhysicsAvailable } = await import(
    './plasma-physics-tool'
  );

  const { encryptionTool, executeEncryption, isEncryptionAvailable } = await import(
    './encryption-tool'
  );
  // New science tools batch 3 (5 new tools)

  const { mineralogyTool, executeMineralogy, isMineralogyAvailable } = await import(
    './mineralogy-tool'
  );

  // Cybersecurity tools batch 1 (15 new tools)

  const { jwtTool, executeJwt, isJwtAvailable } = await import('./jwt-tool');

  const { certificateTool, executeCertificate, isCertificateAvailable } = await import(
    './certificate-tool'
  );

  const { entropyAnalysisTool, executeEntropyAnalysis, isEntropyAnalysisAvailable } = await import(
    './entropy-analysis-tool'
  );

  const { portScannerTool, executePortScanner, isPortScannerAvailable } = await import(
    './port-scanner-tool'
  );

  const { owaspTool, executeOwasp, isOwaspAvailable } = await import('./owasp-tool');

  // Cybersecurity tools batch 2 (55 more tools)
  const { authProtocolTool, executeAuthProtocol, isAuthProtocolAvailable } = await import(
    './auth-protocol-tool'
  );

  const { logAnalysisTool, executeLogAnalysis, isLogAnalysisAvailable } = await import(
    './log-analysis-tool'
  );

  const { secureSdlcTool, executeSecureSdlc, isSecureSdlcAvailable } = await import(
    './secure-sdlc-tool'
  );

  const { privacyTool, executePrivacy, isPrivacyAvailable } = await import('./privacy-tool');
  const { accessControlTool, executeAccessControl, isAccessControlAvailable } = await import(
    './access-control-tool'
  );

  const { businessContinuityTool, executeBusinessContinuity, isBusinessContinuityAvailable } =
    await import('./business-continuity-tool');

  const { devsecOpsTool, executeDevsecOps, isDevsecOpsAvailable } = await import(
    './devsecops-tool'
  );

  const { vpnTool, executeVpn, isVpnAvailable } = await import('./vpn-tool');
  const { pkiTool, executePki, isPkiAvailable } = await import('./pki-tool');
  const { dataLossPreventionTool, executeDataLossPrevention, isDataLossPreventionAvailable } =
    await import('./data-loss-prevention-tool');
  const { identityManagementTool, executeIdentityManagement, isIdentityManagementAvailable } =
    await import('./identity-management-tool');

  const { patchManagementTool, executePatchManagement, isPatchManagementAvailable } = await import(
    './patch-management-tool'
  );

  const { scadaIcsTool, executeScadaIcs, isScadaIcsAvailable } = await import('./scada-ics-tool');

  const { dataClassificationTool, executeDataClassification, isDataClassificationAvailable } =
    await import('./data-classification-tool');
  const { keyManagementTool, executeKeyManagement, isKeyManagementAvailable } = await import(
    './key-management-tool'
  );

  const { assetManagementTool, executeAssetManagement, isAssetManagementAvailable } = await import(
    './asset-management-tool'
  );

  const { networkDefenseTool, executeNetworkDefense, isNetworkDefenseAvailable } = await import(
    './network-defense-tool'
  );

  const { secretsManagementTool, executeSecretsManagement, isSecretsManagementAvailable } =
    await import('./secrets-management-tool');
  const { privacyEngineeringTool, executePrivacyEngineering, isPrivacyEngineeringAvailable } =
    await import('./privacy-engineering-tool');
  const { secureCommunicationsTool, executeSecureCommunications, isSecureCommunicationsAvailable } =
    await import('./secure-communications-tool');

  const { industrialControlTool, executeIndustrialControl, isIndustrialControlAvailable } =
    await import('./industrial-control-tool');

  const { logManagementTool, executeLogManagement, isLogManagementAvailable } = await import(
    './log-management-tool'
  );

  const { authenticationTool, executeAuthentication, isAuthenticationAvailable } = await import(
    './authentication-tool'
  );

  const { backupRecoveryTool, executeBackupRecovery, isBackupRecoveryAvailable } = await import(
    './backup-recovery-tool'
  );

  const { saseTool, executeSase, isSaseAvailable } = await import('./sase-tool');
  const { identityGovernanceTool, executeIdentityGovernance, isIdentityGovernanceAvailable } =
    await import('./identity-governance-tool');
  // ============================================================================
  // CODE AGENT BRAIN TOOLS - Full coding capabilities
  // ============================================================================
  const { workspaceTool, executeWorkspace, isWorkspaceAvailable } = await import(
    './workspace-tool'
  );

  const { codeGenerationTool, executeCodeGeneration, isCodeGenerationAvailable } = await import(
    './code-generation-tool'
  );

  const { codeAnalysisTool, executeCodeAnalysis, isCodeAnalysisAvailable } = await import(
    './code-analysis-tool'
  );

  const { projectBuilderTool, executeProjectBuilder, isProjectBuilderAvailable } = await import(
    './project-builder-tool'
  );

  const { testGeneratorTool, executeTestGenerator, isTestGeneratorAvailable } = await import(
    './test-generator-tool'
  );

  const { errorFixerTool, executeErrorFixer, isErrorFixerAvailable } = await import(
    './error-fixer-tool'
  );

  const { refactorTool, executeRefactor, isRefactorAvailable } = await import('./refactor-tool');
  const { docGeneratorTool, executeDocGenerator, isDocGeneratorAvailable } = await import(
    './doc-generator-tool'
  );
  // ============================================================================
  // ULTRA DEVELOPER TOOLKIT - Advanced DevOps, Architecture & AI Tools
  // ============================================================================
  // Code Intelligence
  const { astAnalyzerTool, executeAstAnalyzer, isAstAnalyzerAvailable } = await import(
    './ast-analyzer-tool'
  );

  const { codeComplexityTool, executeCodeComplexity, isCodeComplexityAvailable } = await import(
    './code-complexity-tool'
  );

  const { designPatternTool, executeDesignPattern, isDesignPatternAvailable } = await import(
    './design-pattern-tool'
  );

  const { dependencyGraphTool, executeDependencyGraph, isDependencyGraphAvailable } = await import(
    './dependency-graph-tool'
  );

  const { refactorSuggesterTool, executeRefactorSuggester, isRefactorSuggesterAvailable } =
    await import('./refactor-suggester-tool');
  const { techDebtTool, executeTechDebt, isTechDebtAvailable } = await import('./tech-debt-tool');
  const { codeSmellDetectorTool, executeCodeSmellDetector, isCodeSmellDetectorAvailable } =
    await import('./code-smell-detector-tool');
  // DevOps & Infrastructure
  const { kubernetesGenTool, executeKubernetesGen, isKubernetesGenAvailable } = await import(
    './kubernetes-gen-tool'
  );

  const { dockerOptimizerTool, executeDockerOptimizer, isDockerOptimizerAvailable } = await import(
    './docker-optimizer-tool'
  );

  const { ciCdGeneratorTool, executeCiCdGenerator, isCiCdGeneratorAvailable } = await import(
    './ci-cd-generator-tool'
  );

  const { terraformGenTool, executeTerraformGen, isTerraformGenAvailable } = await import(
    './terraform-gen-tool'
  );

  const { helmChartTool, executeHelmChart, isHelmChartAvailable } = await import(
    './helm-chart-tool'
  );

  const { observabilityTool, executeObservability, isObservabilityAvailable } = await import(
    './observability-tool'
  );
  // Database & Data
  const { sqlOptimizerTool, executeSqlOptimizer, isSqlOptimizerAvailable } = await import(
    './sql-optimizer-tool'
  );

  const { migrationGeneratorTool, executeMigrationGenerator, isMigrationGeneratorAvailable } =
    await import('./migration-generator-tool');
  const { nosqlSchemaTool, executeNosqlSchema, isNosqlSchemaAvailable } = await import(
    './nosql-schema-tool'
  );

  const { dataPipelineTool, executeDataPipeline, isDataPipelineAvailable } = await import(
    './data-pipeline-tool'
  );
  // API Development
  const { apiDesignTool, executeApiDesign, isApiDesignAvailable } = await import(
    './api-design-tool'
  );

  // Architecture & Design
  const { systemDesignTool, executeSystemDesign, isSystemDesignAvailable } = await import(
    './system-design-tool'
  );

  const { microservicesTool, executeMicroservices, isMicroservicesAvailable } = await import(
    './microservices-tool'
  );

  const { cacheStrategyTool, executeCacheStrategy, isCacheStrategyAvailable } = await import(
    './cache-strategy-tool'
  );

  const { circuitBreakerTool, executeCircuitBreaker, isCircuitBreakerAvailable } = await import(
    './circuit-breaker-tool'
  );

  const { featureFlagTool, executeFeatureFlag, isFeatureFlagAvailable } = await import(
    './feature-flag-tool'
  );
  // Testing & Quality
  const { unitTestGenTool, executeUnitTestGen, isUnitTestGenAvailable } = await import(
    './unit-test-gen-tool'
  );

  const { e2eTestGenTool, executeE2eTestGen, isE2eTestGenAvailable } = await import(
    './e2e-test-gen-tool'
  );

  const { loadTestDesignTool, executeLoadTestDesign, isLoadTestDesignAvailable } = await import(
    './load-test-design-tool'
  );
  // AI/ML Development
  const { promptEngineeringTool, executePromptEngineering, isPromptEngineeringAvailable } =
    await import('./prompt-engineering-tool');
  const { modelEvaluationTool, executeModelEvaluation, isModelEvaluationAvailable } = await import(
    './model-evaluation-tool'
  );

  const { mlModelServingTool, executeMlModelServing, isMlModelServingAvailable } = await import(
    './ml-model-serving-tool'
  );
  // Blockchain & Web3
  const { smartContractTool, executeSmartContract, isSmartContractAvailable } = await import(
    './smart-contract-tool'
  );
  // Documentation
  const { readmeGeneratorTool, executeReadmeGenerator, isReadmeGeneratorAvailable } = await import(
    './readme-generator-tool'
  );
  // ============================================================================
  // PROCEDURAL GENERATION & GAME DEV TOOLS (New Batch)
  // ============================================================================
  const { perlinNoiseTool, executePerlinNoise, isPerlinNoiseAvailable } = await import(
    './perlin-noise-tool'
  );

  const { mazeGeneratorTool, executeMazeGenerator, isMazeGeneratorAvailable } = await import(
    './maze-generator-tool'
  );

  const { lSystemTool, executeLSystem, isLSystemAvailable } = await import('./l-system-tool');

  const { pathfindingTool, executePathfinding, isPathfindingAvailable } = await import(
    './pathfinding-tool'
  );

  const { particleEffectTool, executeParticleEffect, isParticleEffectAvailable } = await import(
    './particle-effect-tool'
  );

  const { collisionDetectionTool, executeCollisionDetection, isCollisionDetectionAvailable } =
    await import('./collision-detection-tool');
  const { steeringBehaviorsTool, executeSteeringBehaviors, isSteeringBehaviorsAvailable } =
    await import('./steering-behaviors-tool');
  const { behaviorTreeTool, executeBehaviorTree, isBehaviorTreeAvailable } = await import(
    './behavior-tree-tool'
  );

  const { quadtreeTool, executeQuadtree, isQuadtreeAvailable } = await import('./quadtree-tool');
  const { cssGeneratorTool, executeCssGenerator, isCssGeneratorAvailable } = await import(
    './css-generator-tool'
  );

  const { chordProgressionTool, executeChordProgression, isChordProgressionAvailable } =
    await import('./chord-progression-tool');

  const { lootTableTool, executeLootTable, isLootTableAvailable } = await import(
    './loot-table-tool'
  );

  const { proceduralDungeonTool, executeProceduralDungeon, isProceduralDungeonAvailable } =
    await import('./procedural-dungeon-tool');
  const { nameGeneratorTool, executeNameGenerator, isNameGeneratorAvailable } = await import(
    './name-generator-tool'
  );

  const { waveFunctionCollapseTool, executeWaveFunctionCollapse, isWaveFunctionCollapseAvailable } =
    await import('./wave-function-collapse-tool');
  const { terrainHeightmapTool, executeTerrainHeightmap, isTerrainHeightmapAvailable } =
    await import('./terrain-heightmap-tool');
  const { biomeGeneratorTool, executeBiomeGenerator, isBiomeGeneratorAvailable } = await import(
    './biome-generator-tool'
  );

  const { planetGeneratorTool, executePlanetGenerator, isPlanetGeneratorAvailable } = await import(
    './planet-generator-tool'
  );

  const { cityGeneratorTool, executeCityGenerator, isCityGeneratorAvailable } = await import(
    './city-generator-tool'
  );

  const { spellSystemTool, executeSpellSystem, isSpellSystemAvailable } = await import(
    './spell-system-tool'
  );

  const { dialogueTreeTool, executeDialogueTree, isDialogueTreeAvailable } = await import(
    './dialogue-tree-tool'
  );

  const { questGeneratorTool, executeQuestGenerator, isQuestGeneratorAvailable } = await import(
    './quest-generator-tool'
  );

  const { skillTreeTool, executeSkillTree, isSkillTreeAvailable } = await import(
    './skill-tree-tool'
  );

  const { inventorySystemTool, executeInventorySystem, isInventorySystemAvailable } = await import(
    './inventory-system-tool'
  );

  const { drumPatternTool, executeDrumPattern, isDrumPatternAvailable } = await import(
    './drum-pattern-tool'
  );

  const { melodyGeneratorTool, executeMelodyGenerator, isMelodyGeneratorAvailable } = await import(
    './melody-generator-tool'
  );

  const { dataCompressionTool, executeDataCompression, isDataCompressionAvailable } = await import(
    './data-compression-tool'
  );

  const { stateMachineTool, executeStateMachine, isStateMachineAvailable } = await import(
    './state-machine-tool'
  );

  const { entityComponentTool, executeEntityComponent, isEntityComponentAvailable } = await import(
    './entity-component-tool'
  );

  const { pathPlanningTool, executePathPlanning, isPathPlanningAvailable } = await import(
    './path-planning-tool'
  );

  const { tileMapTool, executeTileMap, isTileMapAvailable } = await import('./tile-map-tool');
  const { cameraSystemTool, executeCameraSystem, isCameraSystemAvailable } = await import(
    './camera-system-tool'
  );

  const { audioWaveformTool, executeAudioWaveform, isAudioWaveformAvailable } = await import(
    './audio-waveform-tool'
  );

  const { textAdventureTool, executeTextAdventure, isTextAdventureAvailable } = await import(
    './text-adventure-tool'
  );

  const { proceduralStoryTool, executeProceduralStory, isProceduralStoryAvailable } = await import(
    './procedural-story-tool'
  );

  const { dataVisualizationTool, executeDataVisualization, isDataVisualizationAvailable } =
    await import('./data-visualization-tool');

  // MEGA BATCH #2 - Game Dev, Finance, AI/ML, Scientific Tools
  const { spriteAnimationTool, executeSpriteAnimation, isSpriteAnimationAvailable } = await import(
    './sprite-animation-tool'
  );

  const { gameInputTool, executeGameInput, isGameInputAvailable } = await import(
    './game-input-tool'
  );

  const { saveSystemTool, executeSaveSystem, isSaveSystemAvailable } = await import(
    './save-system-tool'
  );

  const { dialogSystemTool, executeDialogSystem, isDialogSystemAvailable } = await import(
    './dialog-system-tool'
  );

  const { questSystemTool, executeQuestSystem, isQuestSystemAvailable } = await import(
    './quest-system-tool'
  );

  const { achievementSystemTool, executeAchievementSystem, isAchievementSystemAvailable } =
    await import('./achievement-system-tool');
  const { leaderboardTool, executeLeaderboard, isLeaderboardAvailable } = await import(
    './leaderboard-tool'
  );

  const { levelEditorTool, executeLevelEditor, isLevelEditorAvailable } = await import(
    './level-editor-tool'
  );

  const { stockAnalysisTool, executeStockAnalysis, isStockAnalysisAvailable } = await import(
    './stock-analysis-tool'
  );

  const { apiRateLimiterTool, executeApiRateLimiter, isApiRateLimiterAvailable } = await import(
    './api-rate-limiter-tool'
  );

  const { blockchainTool, executeBlockchain, isBlockchainAvailable } = await import(
    './blockchain-tool'
  );

  const { chessEngineTool, executeChessEngine, isChessEngineAvailable } = await import(
    './chess-engine-tool'
  );

  const { artificialLifeTool, executeArtificialLife, isArtificialLifeAvailable } = await import(
    './artificial-life-tool'
  );

  const { compilerTool, executeCompiler, isCompilerAvailable } = await import('./compiler-tool');
  const { typeInferenceTool, executeTypeInference, isTypeInferenceAvailable } = await import(
    './type-inference-tool'
  );

  const { knowledgeGraphTool, executeKnowledgeGraph, isKnowledgeGraphAvailable } = await import(
    './knowledge-graph-tool'
  );

  const { proteinFoldingTool, executeProteinFolding, isProteinFoldingAvailable } = await import(
    './protein-folding-tool'
  );

  const { cspSolverTool, executeCspSolver, isCspSolverAvailable } = await import(
    './csp-solver-tool'
  );

  const { virtualMachineTool, executeVirtualMachine, isVirtualMachineAvailable } = await import(
    './virtual-machine-tool'
  );

  const { garbageCollectorTool, executeGarbageCollector, isGarbageCollectorAvailable } =
    await import('./garbage-collector-tool');
  // Medical tools
  const { medicaldiagnosisTool, executemedicaldiagnosis, ismedicaldiagnosisAvailable } =
    await import('./medical-diagnosis-tool');
  const { druginteractionTool, executedruginteraction, isdruginteractionAvailable } = await import(
    './drug-interaction-tool'
  );

  const { ecganalyzerTool, executeecganalyzer, isecganalyzerAvailable } = await import(
    './ecg-analyzer-tool'
  );

  const { dosagecalculatorTool, executedosagecalculator, isdosagecalculatorAvailable } =
    await import('./dosage-calculator-tool');
  const { labvaluesTool, executelabvalues, islabvaluesAvailable } = await import(
    './lab-values-tool'
  );
  // Creative writing tools

  // Education tools

  // Legal tools

  // Algorithm tools

  const { divideconquerTool, executedivideconquer, isdivideconquerAvailable } = await import(
    './divide-conquer-tool'
  );

  const { branchboundTool, executebranchbound, isbranchboundAvailable } = await import(
    './branch-bound-tool'
  );
  // MEGA BATCH #4 - IoT, Robotics, Computer Vision, Distributed Systems
  // IoT/Embedded
  const { mqttprotocolTool, executemqttprotocol, ismqttprotocolAvailable } = await import(
    './mqtt-protocol-tool'
  );

  const { modbusTool, executemodbus, ismodbusAvailable } = await import('./modbus-tool');

  const { pwmcontrollerTool, executepwmcontroller, ispwmcontrollerAvailable } = await import(
    './pwm-controller-tool'
  );

  const { i2cprotocolTool, executei2cprotocol, isi2cprotocolAvailable } = await import(
    './i2c-protocol-tool'
  );

  const { spiprotocolTool, executespiprotocol, isspiprotocolAvailable } = await import(
    './spi-protocol-tool'
  );

  const { uartprotocolTool, executeuartprotocol, isuartprotocolAvailable } = await import(
    './uart-protocol-tool'
  );

  const { gpiosimulatorTool, executegpiosimulator, isgpiosimulatorAvailable } = await import(
    './gpio-simulator-tool'
  );

  const { watchdogtimerTool, executewatchdogtimer, iswatchdogtimerAvailable } = await import(
    './watchdog-timer-tool'
  );

  const { firmwareupdateTool, executefirmwareupdate, isfirmwareupdateAvailable } = await import(
    './firmware-update-tool'
  );
  // Robotics

  const { forwardkinematicsTool, executeforwardkinematics, isforwardkinematicsAvailable } =
    await import('./forward-kinematics-tool');
  const { motionplanningTool, executemotionplanning, ismotionplanningAvailable } = await import(
    './motion-planning-tool'
  );

  const { slamalgorithmTool, executeslamalgorithm, isslamalgorithmAvailable } = await import(
    './slam-algorithm-tool'
  );

  const { lidarprocessingTool, executelidarprocessing, islidarprocessingAvailable } = await import(
    './lidar-processing-tool'
  );

  // Computer Vision
  const { edgedetectionTool, executeedgedetection, isedgedetectionAvailable } = await import(
    './edge-detection-tool'
  );

  const { harriscornersTool, executeharriscorners, isharriscornersAvailable } = await import(
    './harris-corners-tool'
  );

  const { siftfeaturesTool, executesiftfeatures, issiftfeaturesAvailable } = await import(
    './sift-features-tool'
  );

  const { orbfeaturesTool, executeorbfeatures, isorbfeaturesAvailable } = await import(
    './orb-features-tool'
  );

  const { opticalflowTool, executeopticalflow, isopticalflowAvailable } = await import(
    './optical-flow-tool'
  );

  const { imagesegmentationTool, executeimagesegmentation, isimagesegmentationAvailable } =
    await import('./image-segmentation-tool');
  const { objecttrackingTool, executeobjecttracking, isobjecttrackingAvailable } = await import(
    './object-tracking-tool'
  );

  const { stereovisionTool, executestereovision, isstereovisionAvailable } = await import(
    './stereo-vision-tool'
  );

  const { cameracalibrationTool, executecameracalibration, iscameracalibrationAvailable } =
    await import('./camera-calibration-tool');
  const { homographyTool, executehomography, ishomographyAvailable } = await import(
    './homography-tool'
  );

  const { morphologicalopsTool, executemorphologicalops, ismorphologicalopsAvailable } =
    await import('./morphological-ops-tool');
  const { contourdetectionTool, executecontourdetection, iscontourdetectionAvailable } =
    await import('./contour-detection-tool');
  // Distributed Systems
  const { raftconsensusTool, executeraftconsensus, israftconsensusAvailable } = await import(
    './raft-consensus-tool'
  );

  const { paxosTool, executepaxos, ispaxosAvailable } = await import('./paxos-tool');
  const { gossipprotocolTool, executegossipprotocol, isgossipprotocolAvailable } = await import(
    './gossip-protocol-tool'
  );

  const { consistenthashingTool, executeconsistenthashing, isconsistenthashingAvailable } =
    await import('./consistent-hashing-tool');

  const { lamportclockTool, executelamportclock, islamportclockAvailable } = await import(
    './lamport-clock-tool'
  );

  const { twophasecommitTool, executetwophasecommit, istwophasecommitAvailable } = await import(
    './two-phase-commit-tool'
  );

  const { sagapatternTool, executesagapattern, issagapatternAvailable } = await import(
    './saga-pattern-tool'
  );

  // AI/ML Advanced
  const {
    reinforcementlearningTool,
    executereinforcementlearning,
    isreinforcementlearningAvailable,
  } = await import('./reinforcement-learning-tool');
  const { alphabetaTool, executealphabeta, isalphabetaAvailable } = await import(
    './alpha-beta-tool'
  );

  const { bayesiannetworkTool, executebayesiannetwork, isbayesiannetworkAvailable } = await import(
    './bayesian-network-tool'
  );

  const { cmaesTool, executecmaes, iscmaesAvailable } = await import('./cma-es-tool');

  const { antcolonyTool, executeantcolony, isantcolonyAvailable } = await import(
    './ant-colony-tool'
  );
  // Physics Simulations
  const { latticeboltzmannTool, executelatticeboltzmann, islatticeboltzmannAvailable } =
    await import('./lattice-boltzmann-tool');
  const { sphfluidTool, executesphfluid, issphfluidAvailable } = await import('./sph-fluid-tool');

  const { clothsimulationTool, executeclothsimulation, isclothsimulationAvailable } = await import(
    './cloth-simulation-tool'
  );

  const { softbodyTool, executesoftbody, issoftbodyAvailable } = await import('./soft-body-tool');
  const { ropephysicsTool, executeropephysics, isropephysicsAvailable } = await import(
    './rope-physics-tool'
  );

  const { ragdollphysicsTool, executeragdollphysics, isragdollphysicsAvailable } = await import(
    './ragdoll-physics-tool'
  );

  const { buoyancysimTool, executebuoyancysim, isbuoyancysimAvailable } = await import(
    './buoyancy-sim-tool'
  );

  const { pendulumsimTool, executependulumsim, ispendulumsimAvailable } = await import(
    './pendulum-sim-tool'
  );

  // Formal Methods

  const { automataminimizerTool, executeautomataminimizer, isautomataminimizerAvailable } =
    await import('./automata-minimizer-tool');

  const { grammarparserTool, executegrammarparser, isgrammarparserAvailable } = await import(
    './grammar-parser-tool'
  );

  const { llparserTool, executellparser, isllparserAvailable } = await import('./ll-parser-tool');
  const { lrparserTool, executelrparser, islrparserAvailable } = await import('./lr-parser-tool');
  // Database Internals
  const { btreeindexTool, executebtreeindex, isbtreeindexAvailable } = await import(
    './btree-index-tool'
  );

  const { bloomfilterTool, executebloomfilter, isbloomfilterAvailable } = await import(
    './bloom-filter-tool'
  );

  const { lsmtreeTool, executelsmtree, islsmtreeAvailable } = await import('./lsm-tree-tool');
  const { wallogTool, executewallog, iswallogAvailable } = await import('./wal-log-tool');
  const { mvccTool, executemvcc, ismvccAvailable } = await import('./mvcc-tool');
  const { queryplannerTool, executequeryplanner, isqueryplannerAvailable } = await import(
    './query-planner-tool'
  );

  const { joinalgorithmsTool, executejoinalgorithms, isjoinalgorithmsAvailable } = await import(
    './join-algorithms-tool'
  );

  const { bufferpoolTool, executebufferpool, isbufferpoolAvailable } = await import(
    './buffer-pool-tool'
  );

  const { lockmanagerTool, executelockmanager, islockmanagerAvailable } = await import(
    './lock-manager-tool'
  );
  // OS Internals
  const { processschedulerTool, executeprocessscheduler, isprocessschedulerAvailable } =
    await import('./process-scheduler-tool');
  const { memoryallocatorTool, executememoryallocator, ismemoryallocatorAvailable } = await import(
    './memory-allocator-tool'
  );

  const { pagereplacementTool, executepagereplacement, ispagereplacementAvailable } = await import(
    './page-replacement-tool'
  );

  const { diskschedulerTool, executediskscheduler, isdiskschedulerAvailable } = await import(
    './disk-scheduler-tool'
  );

  const { deadlockdetectorTool, executedeadlockdetector, isdeadlockdetectorAvailable } =
    await import('./deadlock-detector-tool');
  const { semaphoreTool, executesemaphore, issemaphoreAvailable } = await import(
    './semaphore-tool'
  );

  const { mutexlockTool, executemutexlock, ismutexlockAvailable } = await import(
    './mutex-lock-tool'
  );

  const { diningphilosophersTool, executediningphilosophers, isdiningphilosophersAvailable } =
    await import('./dining-philosophers-tool');
  // Graphics
  const { rasterizerTool, executerasterizer, israsterizerAvailable } = await import(
    './rasterizer-tool'
  );

  const { zbufferTool, executezbuffer, iszbufferAvailable } = await import('./z-buffer-tool');

  const { phongshadingTool, executephongshading, isphongshadingAvailable } = await import(
    './phong-shading-tool'
  );

  const { pbrmaterialTool, executepbrmaterial, ispbrmaterialAvailable } = await import(
    './pbr-material-tool'
  );

  const { shadowmappingTool, executeshadowmapping, isshadowmappingAvailable } = await import(
    './shadow-mapping-tool'
  );

  const { ambientocclusionTool, executeambientocclusion, isambientocclusionAvailable } =
    await import('./ambient-occlusion-tool');
  const { bloomeffectTool, executebloomeffect, isbloomeffectAvailable } = await import(
    './bloom-effect-tool'
  );

  const { dofeffectTool, executedofeffect, isdofeffectAvailable } = await import(
    './dof-effect-tool'
  );

  const { motionblurTool, executemotionblur, ismotionblurAvailable } = await import(
    './motion-blur-tool'
  );

  const { antialiasingTool, executeantialiasing, isantialiasingAvailable } = await import(
    './anti-aliasing-tool'
  );

  const { equalizerTool, executeequalizer, isequalizerAvailable } = await import(
    './equalizer-tool'
  );

  const { compressorTool, executecompressor, iscompressorAvailable } = await import(
    './compressor-tool'
  );

  const { reverbTool, executereverb, isreverbAvailable } = await import('./reverb-tool');
  const { delayeffectTool, executedelayeffect, isdelayeffectAvailable } = await import(
    './delay-effect-tool'
  );

  const { choruseffectTool, executechoruseffect, ischoruseffectAvailable } = await import(
    './chorus-effect-tool'
  );

  const { distortionTool, executedistortion, isdistortionAvailable } = await import(
    './distortion-tool'
  );

  const { limiterTool, executelimiter, islimiterAvailable } = await import('./limiter-tool');

  // Cryptography & Security
  const { aesencryptionTool, executeaesencryption, isaesencryptionAvailable } = await import(
    './aes-encryption-tool'
  );

  const { rsaencryptionTool, executeraesncryption, isrsaencryptionAvailable } = await import(
    './rsa-encryption-tool'
  );

  const { shahashTool, executeshahash, isshahashAvailable } = await import('./sha-hash-tool');
  const { hmacTool, executehmac, ishmacAvailable } = await import('./hmac-tool');

  const { digitalsignatureTool, executedigitalsignature, isdigitalsignatureAvailable } =
    await import('./digital-signature-tool');

  const { keyderivationTool, executekeyderivation, iskeyderivationAvailable } = await import(
    './key-derivation-tool'
  );

  // Quantum Computing
  const { qubitsimulatorTool, executequbitsimulator, isqubitsimulatorAvailable } = await import(
    './qubit-simulator-tool'
  );

  const { quantumgateTool, executequantumgate, isquantumgateAvailable } = await import(
    './quantum-gate-tool'
  );

  const { groveralgorithmTool, executegroveralgorithm, isgroveralgorithmAvailable } = await import(
    './grover-algorithm-tool'
  );

  const { shoralgorithmTool, executeshoralgorithm, isshoralgorithmAvailable } = await import(
    './shor-algorithm-tool'
  );

  const { quantumentanglementTool, executequantumentanglement, isquantumentanglementAvailable } =
    await import('./quantum-entanglement-tool');
  const {
    quantumerrorcorrectionTool,
    executequantumerrorcorrection,
    isquantumerrorcorrectionAvailable,
  } = await import('./quantum-error-correction-tool');
  const { vqeTool, executevqe, isvqeAvailable } = await import('./vqe-tool');
  const { qaoaTool, executeqaoa, isqaoaAvailable } = await import('./qaoa-tool');
  const { qftTool, executeqft, isqftAvailable } = await import('./qft-tool');
  // NLP Tools
  const { wordembeddingsTool, executewordembeddings, iswordembeddingsAvailable } = await import(
    './word-embeddings-tool'
  );

  const { berttokenizerTool, executeberttokenizer, isberttokenizerAvailable } = await import(
    './bert-tokenizer-tool'
  );

  const { postaggerTool, executepostagger, ispostaggerAvailable } = await import(
    './pos-tagger-tool'
  );

  const { nerTool, executener, isnerAvailable } = await import('./ner-tool');
  const { dependencyparserTool, executedependencyparser, isdependencyparserAvailable } =
    await import('./dependency-parser-tool');
  const { coreferenceTool, executecoreference, iscoreferenceAvailable } = await import(
    './coreference-tool'
  );

  const { textclassificationTool, executetextclassification, istextclassificationAvailable } =
    await import('./text-classification-tool');
  const { textgenerationTool, executetextgeneration, istextgenerationAvailable } = await import(
    './text-generation-tool'
  );
  // Bioinformatics
  const { sequencealignmentTool, executesequencealignment, issequencealignmentAvailable } =
    await import('./sequence-alignment-tool');
  const { geneexpressionTool, executegeneexpression, isgeneexpressionAvailable } = await import(
    './gene-expression-tool'
  );

  // Signal Processing & Control
  const { filterdesignTool, executefilterdesign, isfilterdesignAvailable } = await import(
    './filter-design-tool'
  );

  const { signalconvolutionTool, executesignalconvolution, issignalconvolutionAvailable } =
    await import('./signal-convolution-tool');

  const { bodeplotTool, executebodeplot, isbodeplotAvailable } = await import('./bode-plot-tool');
  const { rootlocusTool, executerootlocus, isrootlocusAvailable } = await import(
    './root-locus-tool'
  );

  const { nyquistplotTool, executenyquistplot, isnyquistplotAvailable } = await import(
    './nyquist-plot-tool'
  );

  const {
    portfoliooptimizationTool,
    executeportfoliooptimization,
    isportfoliooptimizationAvailable,
  } = await import('./portfolio-optimization-tool');

  const { kdtreeTool, executekdtree, iskdtreeAvailable } = await import('./kd-tree-tool');
  const { rtreeTool, executertree, isrtreeAvailable } = await import('./r-tree-tool');
  const { lineintersectionTool, executelineintersection, islineintersectionAvailable } =
    await import('./line-intersection-tool');
  const { polygontriangulationTool, executepolygontriangulation, ispolygontriangulationAvailable } =
    await import('./polygon-triangulation-tool');
  const { agentbasedmodelTool, executeagentbasedmodel, isagentbasedmodelAvailable } = await import(
    './agent-based-model-tool'
  );

  // Earth & Space Sciences
  const { epidemicmodelTool, executeepidemicmodel, isepidemicmodelAvailable } = await import(
    './epidemic-model-tool'
  );

  const { trafficsimulationTool, executetrafficsimulation, istrafficsimulationAvailable } =
    await import('./traffic-simulation-tool');
  const { weathermodelTool, executeweathermodel, isweathermodelAvailable } = await import(
    './weather-model-tool'
  );

  const { climatemodelTool, executeclimatemodel, isclimatemodelAvailable } = await import(
    './climate-model-tool'
  );

  const { oceanmodelTool, executeoceanmodel, isoceanmodelAvailable } = await import(
    './ocean-model-tool'
  );

  const { seismicanalysisTool, executeseismicanalysis, isseismicanalysisAvailable } = await import(
    './seismic-analysis-tool'
  );

  const { rocketequationTool, executerocketequation, isrocketequationAvailable } = await import(
    './rocket-equation-tool'
  );

  const { stellarevolutionTool, executestellarevolution, isstellarevolutionAvailable } =
    await import('./stellar-evolution-tool');
  // MEGA BATCH #6-8: Blockchain, Compiler, Computer Architecture
  const { defiprotocolTool, executedefiprotocol, isdefiprotocolAvailable } = await import(
    './defi-protocol-tool'
  );

  const { tokeneconomicsTool, executetokeneconomics, istokeneconomicsAvailable } = await import(
    './token-economics-tool'
  );

  const { lexergeneratorTool, executelexergenerator, islexergeneratorAvailable } = await import(
    './lexer-generator-tool'
  );

  const { parsergeneratorTool, executeparsergenerator, isparsergeneratorAvailable } = await import(
    './parser-generator-tool'
  );

  const { asttransformerTool, executeasttransformer, isasttransformerAvailable } = await import(
    './ast-transformer-tool'
  );

  const { iroptimizerTool, executeiroptimizer, isiroptimizerAvailable } = await import(
    './ir-optimizer-tool'
  );

  const { interpreterTool, executeinterpreter, isinterpreterAvailable } = await import(
    './interpreter-tool'
  );

  const { cpusimulatorTool, executecpusimulator, iscpusimulatorAvailable } = await import(
    './cpu-simulator-tool'
  );

  const { cachesimulatorTool, executecachesimulator, iscachesimulatorAvailable } = await import(
    './cache-simulator-tool'
  );

  const { branchpredictorTool, executebranchpredictor, isbranchpredictorAvailable } = await import(
    './branch-predictor-tool'
  );
  // MEGA BATCH #9-10: Networking, Information Theory
  const { routingalgorithmTool, executeroutingalgorithm, isroutingalgorithmAvailable } =
    await import('./routing-algorithm-tool');
  const { dnsresolverTool, executednsresolver, isdnsresolverAvailable } = await import(
    './dns-resolver-tool'
  );

  const { lzcompressionTool, executelzcompression, islzcompressionAvailable } = await import(
    './lz-compression-tool'
  );

  const { reedsolomonTool, executereedsolomon, isreedsolomonAvailable } = await import(
    './reed-solomon-tool'
  );
  // MEGA BATCH #11-13: Sciences, Social Sciences, Industry
  const { particlephysicsTool, executeparticlephysics, isparticlephysicsAvailable } = await import(
    './particle-physics-tool'
  );

  const { crisprTool, executecrispr, iscrisprAvailable } = await import('./crispr-tool');
  const { votingsystemTool, executevotingsystem, isvotingsystemAvailable } = await import(
    './voting-system-tool'
  );

  const { economicssimulatorTool, executeeconomicssimulator, iseconomicssimulatorAvailable } =
    await import('./economics-simulator-tool');

  const { realestateTool, executerealestate, isrealestateAvailable } = await import(
    './real-estate-tool'
  );

  const { sportsanalyticsTool, executesportsanalytics, issportsanalyticsAvailable } = await import(
    './sports-analytics-tool'
  );
  // MEGA BATCH #7: Music, Linguistics, Physics, Anthropology, Industry

  const { phoneticsTool, executephonetics, isphoneticsAvailable } = await import(
    './phonetics-tool'
  );

  const { morphologyTool, executemorphology, ismorphologyAvailable } = await import(
    './morphology-tool'
  );

  const { radioactivedecayTool, executeradioactivedecay, isradioactivedecayAvailable } =
    await import('./radioactive-decay-tool');
  const { gravitationalwaveTool, executegravitationalwave, isgravitationalwaveAvailable } =
    await import('./gravitational-wave-tool');
  const { blackholeTool, executeblackhole, isblackholeAvailable } = await import(
    './black-hole-tool'
  );

  const { fashionanalysisTool, executefashionanalysis, isfashionanalysisAvailable } = await import(
    './fashion-analysis-tool'
  );

  const { urbanplanningTool, executeurbanplanning, isurbanplanningAvailable } = await import(
    './urban-planning-tool'
  );

  const { carbonfootprintTool, executecarbonfootprint, iscarbonfootprintAvailable } = await import(
    './carbon-footprint-tool'
  );
  const { causalinferenceTool, executecausalinference, iscausalinferenceAvailable } = await import(
    './causal-inference-tool'
  );

  const {
    transformerarchitectureTool,
    executetransformerarchitecture,
    istransformerarchitectureAvailable,
  } = await import('./transformer-architecture-tool');
  const { diffusionmodelTool, executediffusionmodel, isdiffusionmodelAvailable } = await import(
    './diffusion-model-tool'
  );

  const { rlhfTool, executerlhf, isrlhfAvailable } = await import('./rlhf-tool');
  const {
    cognitivearchitectureTool,
    executecognitivearchitecture,
    iscognitivearchitectureAvailable,
  } = await import('./cognitive-architecture-tool');

  CHAT_TOOLS.push(
    { tool: webSearchTool, executor: executeWebSearch, checkAvailability: isWebSearchAvailable },
    { tool: fetchUrlTool, executor: executeFetchUrl, checkAvailability: isFetchUrlAvailable },
    {
      tool: runCodeTool,
      executor: executeRunCode,
      checkAvailability: isRunCodeAvailable,
    },
    {
      tool: visionAnalyzeTool,
      executor: executeVisionAnalyze,
      checkAvailability: isVisionAnalyzeAvailable,
    },
    {
      tool: browserVisitTool,
      executor: executeBrowserVisitTool,
      checkAvailability: isBrowserVisitAvailable,
    },
    {
      tool: extractPdfTool,
      executor: executeExtractPdf,
      checkAvailability: isExtractPdfAvailable,
    },
    {
      tool: extractTableTool,
      executor: executeExtractTable,
      checkAvailability: isExtractTableAvailable,
    },
    { tool: miniAgentTool, executor: executeMiniAgent, checkAvailability: isMiniAgentAvailable },
    {
      tool: dynamicToolTool,
      executor: executeDynamicTool,
      checkAvailability: isDynamicToolAvailable,
    },
    {
      tool: youtubeTranscriptTool,
      executor: executeYouTubeTranscript,
      checkAvailability: isYouTubeTranscriptAvailable,
    },
    // GitHub tool removed - now handled by Composio GitHub connector
    { tool: screenshotTool, executor: executeScreenshot, checkAvailability: isScreenshotAvailable },
    { tool: chartTool, executor: executeChart, checkAvailability: isChartAvailable },
    { tool: documentTool, executor: executeDocument, checkAvailability: isDocumentAvailable },
    {
      tool: audioTranscribeTool,
      executor: executeAudioTranscribe,
      checkAvailability: isAudioTranscribeAvailable,
    },
    {
      tool: spreadsheetTool,
      executor: executeSpreadsheet,
      checkAvailability: isSpreadsheetAvailable,
    },
    {
      tool: httpRequestTool,
      executor: executeHttpRequest,
      checkAvailability: isHttpRequestAvailable,
    },
    { tool: qrCodeTool, executor: executeQRCode, checkAvailability: isQRCodeAvailable },
    {
      tool: imageTransformTool,
      executor: executeImageTransform,
      checkAvailability: isImageTransformAvailable,
    },
    {
      tool: fileConvertTool,
      executor: executeFileConvert,
      checkAvailability: isFileConvertAvailable,
    },
    {
      tool: linkShortenTool,
      executor: executeLinkShorten,
      checkAvailability: isLinkShortenAvailable,
    },
    {
      tool: mermaidDiagramTool,
      executor: executeMermaidDiagram,
      checkAvailability: isMermaidDiagramAvailable,
    },
    { tool: fakerTool, executor: executeFaker, checkAvailability: isFakerAvailable },
    { tool: diffTool, executor: executeDiff, checkAvailability: isDiffAvailable },
    { tool: nlpTool, executor: executeNLP, checkAvailability: isNLPAvailable },

    { tool: barcodeTool, executor: executeBarcode, checkAvailability: isBarcodeAvailable },
    // New Tier S/A/B tools (19 new)
    { tool: ocrTool, executor: executeOCR, checkAvailability: isOCRAvailable },
    { tool: pdfTool, executor: executePDF, checkAvailability: isPDFAvailable },
    { tool: mediaTool, executor: executeMedia, checkAvailability: isMediaAvailable },
    { tool: sqlTool, executor: executeSQL, checkAvailability: isSQLAvailable },
    { tool: excelTool, executor: executeExcel, checkAvailability: isExcelAvailable },
    { tool: prettierTool, executor: executePrettier, checkAvailability: isPrettierAvailable },
    { tool: cryptoTool, executor: executeCryptoTool, checkAvailability: isCryptoToolAvailable },
    { tool: zipTool, executor: executeZip, checkAvailability: isZipAvailable },
    { tool: webCaptureTool, executor: executeWebCapture, checkAvailability: isWebCaptureAvailable },
    { tool: exifTool, executor: executeExif, checkAvailability: isExifAvailable },
    {
      tool: searchIndexTool,
      executor: executeSearchIndex,
      checkAvailability: isSearchIndexAvailable,
    },
    { tool: validatorTool, executor: executeValidator, checkAvailability: isValidatorAvailable },
    { tool: audioSynthTool, executor: executeAudioSynth, checkAvailability: isAudioSynthAvailable },
    { tool: geospatialTool, executor: executeGeospatial, checkAvailability: isGeospatialAvailable },
    { tool: phoneTool, executor: executePhone, checkAvailability: isPhoneAvailable },
    { tool: dnaBioTool, executor: executeDnaBio, checkAvailability: isDnaBioAvailable },
    { tool: signalTool, executor: executeSignal, checkAvailability: isSignalAvailable },
    {
      tool: accessibilityTool,
      executor: executeAccessibility,
      checkAvailability: isAccessibilityAvailable,
    },
    { tool: parserTool, executor: executeParser, checkAvailability: isParserAvailable },
    {
      tool: constraintTool,
      executor: executeConstraint,
      checkAvailability: isConstraintAvailable,
    },
    {
      tool: sequenceAnalyzeTool,
      executor: executeSequenceAnalyze,
      checkAvailability: isSequenceAnalyzeAvailable,
    },
    {
      tool: medicalCalcTool,
      executor: executeMedicalCalc,
      checkAvailability: isMedicalCalcAvailable,
    },
    {
      tool: graphics3dTool,
      executor: executeGraphics3D,
      checkAvailability: isGraphics3DAvailable,
    },
    {
      tool: errorCorrectionTool,
      executor: executeErrorCorrection,
      checkAvailability: isErrorCorrectionAvailable,
    },
    {
      tool: houghVisionTool,
      executor: executeHoughVision,
      checkAvailability: isHoughVisionAvailable,
    },

    // TIER VISUAL MADNESS - Graphics & Animation Tools (6 new)
    {
      tool: svgGeneratorTool,
      executor: executeSVGGenerator,
      checkAvailability: isSVGGeneratorAvailable,
    },
    {
      tool: fractalGeneratorTool,
      executor: executeFractalGenerator,
      checkAvailability: isFractalGeneratorAvailable,
    },
    {
      tool: particleSystemTool,
      executor: executeParticleSystem,
      checkAvailability: isParticleSystemAvailable,
    },
    // TIER EDUCATION - Interactive Learning Tools
    {
      tool: sortingVisualizerTool,
      executor: executeSortingVisualizer,
      checkAvailability: isSortingVisualizerAvailable,
    },
    {
      tool: dataStructuresTool,
      executor: executeDataStructures,
      checkAvailability: isDataStructuresAvailable,
    },
    // TIER ADVANCED SCIENCE - Cutting-Edge Scientific Tools
    {
      tool: quantumComputingTool,
      executor: executeQuantumComputing,
      checkAvailability: isQuantumComputingAvailable,
    },
    {
      tool: shaderGeneratorTool,
      executor: executeShaderGenerator,
      checkAvailability: isShaderGeneratorAvailable,
    },
    {
      tool: neuralNetworkTool,
      executor: executeNeuralNetwork,
      checkAvailability: isNeuralNetworkAvailable,
    },
    {
      tool: proceduralGenerationTool,
      executor: executeProceduralGeneration,
      checkAvailability: isProceduralGenerationAvailable,
    },
    {
      tool: rayTracingTool,
      executor: executeRayTracing,
      checkAvailability: isRayTracingAvailable,
    },
    {
      tool: automataTheoryTool,
      executor: executeAutomataTheory,
      checkAvailability: isAutomataTheoryAvailable,
    },
    // TIER PHYSICS & CHEMISTRY - Deep Science Tools (6 new tools)
    {
      tool: reactionKineticsTool,
      executor: executeReactionKinetics,
      checkAvailability: isReactionKineticsAvailable,
    },
    {
      tool: electrochemistryTool,
      executor: executeElectrochemistry,
      checkAvailability: isElectrochemistryAvailable,
    },
    {
      tool: spectroscopyTool,
      executor: executeSpectroscopy,
      checkAvailability: isSpectroscopyAvailable,
    },
    {
      tool: quantumMechanicsTool,
      executor: executeQuantumMechanics,
      checkAvailability: isQuantumMechanicsAvailable,
    },
    {
      tool: statisticalMechanicsTool,
      executor: executeStatisticalMechanics,
      checkAvailability: isStatisticalMechanicsAvailable,
    },
    // TIER ENGINEERING & APPLIED SCIENCE (15 new compact tools)

    { tool: photonicsTool, executor: executePhotonics, checkAvailability: isPhotonicsAvailable },
    {
      tool: semiconductorTool,
      executor: executeSemiconductor,
      checkAvailability: isSemiconductorAvailable,
    },
    {
      tool: crystallographyTool,
      executor: executeCrystallography,
      checkAvailability: isCrystallographyAvailable,
    },
    {
      tool: polymerChemistryTool,
      executor: executePolymerChemistry,
      checkAvailability: isPolymerChemistryAvailable,
    },
    {
      tool: powerSystemsTool,
      executor: executePowerSystems,
      checkAvailability: isPowerSystemsAvailable,
    },
    { tool: psychologyTool, executor: executePsychology, checkAvailability: isPsychologyAvailable },
    { tool: surveyingTool, executor: executeSurveying, checkAvailability: isSurveyingAvailable },
    {
      tool: trafficEngineeringTool,
      executor: executeTrafficEngineering,
      checkAvailability: isTrafficEngineeringAvailable,
    },
    // TIER INDUSTRY & APPLIED SCIENCE (20 more compact tools)
    { tool: roboticsTool, executor: executeRobotics, checkAvailability: isRoboticsAvailable },

    // TIER MANUFACTURING PROCESSES (10 more compact tools)

    // TIER BUILDING & INDUSTRIAL SYSTEMS (10 more compact tools)

    // TIER LIFE SCIENCES (9 more compact tools)

    // TIER EARTH & SOCIAL SCIENCES (9 more compact tools)

    // TIER ADVANCED SCIENCE DOMAINS (7 more compact tools)

    // TIER ENGINEERING SPECIALTIES (6 more compact tools)

    // TIER CHEMICAL ENGINEERING (5 more compact tools)

    // TIER PROCESS ENGINEERING (4 more compact tools)

    // TIER SEPARATION PROCESSES (4 more compact tools)

    // TIER MASS TRANSFER OPERATIONS (3 more compact tools)

    // TIER MINERAL PROCESSING (2 more compact tools)

    // TIER ADDITIONAL SCIENCES (15 more compact tools)
    {
      tool: agricultureTool,
      executor: executeAgriculture,
      checkAvailability: isAgricultureAvailable,
    },
    { tool: ecologyTool, executor: executeEcology, checkAvailability: isEcologyAvailable },
    { tool: geologyTool, executor: executeGeology, checkAvailability: isGeologyAvailable },
    {
      tool: meteorologyTool,
      executor: executeMeteorology,
      checkAvailability: isMeteorologyAvailable,
    },
    {
      tool: networkAnalysisTool,
      executor: executeNetworkAnalysis,
      checkAvailability: isNetworkAnalysisAvailable,
    },
    {
      tool: nuclearPhysicsTool,
      executor: executeNuclearPhysics,
      checkAvailability: isNuclearPhysicsAvailable,
    },
    { tool: nutritionTool, executor: executeNutrition, checkAvailability: isNutritionAvailable },
    {
      tool: oceanographyTool,
      executor: executeOceanography,
      checkAvailability: isOceanographyAvailable,
    },
    {
      tool: pharmacologyTool,
      executor: executePharmacology,
      checkAvailability: isPharmacologyAvailable,
    },
    {
      tool: plasmaPhysicsTool,
      executor: executePlasmaPhysics,
      checkAvailability: isPlasmaPhysicsAvailable,
    },
    { tool: encryptionTool, executor: executeEncryption, checkAvailability: isEncryptionAvailable },
    // Previously unregistered tools (95 tools)
    { tool: runCodeTool, executor: executeRunCode, checkAvailability: isRunCodeAvailable },
    {
      tool: visionAnalyzeTool,
      executor: executeVisionAnalyze,
      checkAvailability: isVisionAnalyzeAvailable,
    },
    {
      tool: browserVisitTool,
      executor: executeBrowserVisitTool,
      checkAvailability: isBrowserVisitAvailable,
    },
    { tool: extractPdfTool, executor: executeExtractPdf, checkAvailability: isExtractPdfAvailable },
    {
      tool: extractTableTool,
      executor: executeExtractTable,
      checkAvailability: isExtractTableAvailable,
    },
    {
      tool: dynamicToolTool,
      executor: executeDynamicTool,
      checkAvailability: isDynamicToolAvailable,
    },
    {
      tool: youtubeTranscriptTool,
      executor: executeYouTubeTranscript,
      checkAvailability: isYouTubeTranscriptAvailable,
    },
    {
      tool: audioTranscribeTool,
      executor: executeAudioTranscribe,
      checkAvailability: isAudioTranscribeAvailable,
    },
    {
      tool: spreadsheetTool,
      executor: executeSpreadsheet,
      checkAvailability: isSpreadsheetAvailable,
    },
    {
      tool: httpRequestTool,
      executor: executeHttpRequest,
      checkAvailability: isHttpRequestAvailable,
    },
    {
      tool: imageTransformTool,
      executor: executeImageTransform,
      checkAvailability: isImageTransformAvailable,
    },
    {
      tool: fileConvertTool,
      executor: executeFileConvert,
      checkAvailability: isFileConvertAvailable,
    },
    {
      tool: linkShortenTool,
      executor: executeLinkShorten,
      checkAvailability: isLinkShortenAvailable,
    },
    {
      tool: mermaidDiagramTool,
      executor: executeMermaidDiagram,
      checkAvailability: isMermaidDiagramAvailable,
    },

    {
      tool: searchIndexTool,
      executor: executeSearchIndex,
      checkAvailability: isSearchIndexAvailable,
    },
    {
      tool: accessibilityTool,
      executor: executeAccessibility,
      checkAvailability: isAccessibilityAvailable,
    },
    { tool: constraintTool, executor: executeConstraint, checkAvailability: isConstraintAvailable },
    {
      tool: sequenceAnalyzeTool,
      executor: executeSequenceAnalyze,
      checkAvailability: isSequenceAnalyzeAvailable,
    },
    {
      tool: medicalCalcTool,
      executor: executeMedicalCalc,
      checkAvailability: isMedicalCalcAvailable,
    },
    { tool: graphics3dTool, executor: executeGraphics3D, checkAvailability: isGraphics3DAvailable },
    {
      tool: errorCorrectionTool,
      executor: executeErrorCorrection,
      checkAvailability: isErrorCorrectionAvailable,
    },
    {
      tool: houghVisionTool,
      executor: executeHoughVision,
      checkAvailability: isHoughVisionAvailable,
    },

    {
      tool: svgGeneratorTool,
      executor: executeSVGGenerator,
      checkAvailability: isSVGGeneratorAvailable,
    },
    {
      tool: fractalGeneratorTool,
      executor: executeFractalGenerator,
      checkAvailability: isFractalGeneratorAvailable,
    },
    {
      tool: particleSystemTool,
      executor: executeParticleSystem,
      checkAvailability: isParticleSystemAvailable,
    },
    {
      tool: sortingVisualizerTool,
      executor: executeSortingVisualizer,
      checkAvailability: isSortingVisualizerAvailable,
    },
    {
      tool: dataStructuresTool,
      executor: executeDataStructures,
      checkAvailability: isDataStructuresAvailable,
    },
    {
      tool: quantumComputingTool,
      executor: executeQuantumComputing,
      checkAvailability: isQuantumComputingAvailable,
    },
    {
      tool: shaderGeneratorTool,
      executor: executeShaderGenerator,
      checkAvailability: isShaderGeneratorAvailable,
    },
    {
      tool: neuralNetworkTool,
      executor: executeNeuralNetwork,
      checkAvailability: isNeuralNetworkAvailable,
    },
    {
      tool: proceduralGenerationTool,
      executor: executeProceduralGeneration,
      checkAvailability: isProceduralGenerationAvailable,
    },
    { tool: rayTracingTool, executor: executeRayTracing, checkAvailability: isRayTracingAvailable },
    {
      tool: automataTheoryTool,
      executor: executeAutomataTheory,
      checkAvailability: isAutomataTheoryAvailable,
    },
    {
      tool: reactionKineticsTool,
      executor: executeReactionKinetics,
      checkAvailability: isReactionKineticsAvailable,
    },
    {
      tool: electrochemistryTool,
      executor: executeElectrochemistry,
      checkAvailability: isElectrochemistryAvailable,
    },
    {
      tool: spectroscopyTool,
      executor: executeSpectroscopy,
      checkAvailability: isSpectroscopyAvailable,
    },
    {
      tool: quantumMechanicsTool,
      executor: executeQuantumMechanics,
      checkAvailability: isQuantumMechanicsAvailable,
    },
    {
      tool: statisticalMechanicsTool,
      executor: executeStatisticalMechanics,
      checkAvailability: isStatisticalMechanicsAvailable,
    },
    // New science tools batch 3 (5 new tools)
    { tool: mineralogyTool, executor: executeMineralogy, checkAvailability: isMineralogyAvailable },
    // Cybersecurity tools batch 1 (15 new tools)

    { tool: jwtTool, executor: executeJwt, checkAvailability: isJwtAvailable },
    {
      tool: certificateTool,
      executor: executeCertificate,
      checkAvailability: isCertificateAvailable,
    },
    {
      tool: entropyAnalysisTool,
      executor: executeEntropyAnalysis,
      checkAvailability: isEntropyAnalysisAvailable,
    },
    {
      tool: portScannerTool,
      executor: executePortScanner,
      checkAvailability: isPortScannerAvailable,
    },
    { tool: owaspTool, executor: executeOwasp, checkAvailability: isOwaspAvailable },
    // Cybersecurity tools batch 2 (55 more tools)
    {
      tool: authProtocolTool,
      executor: executeAuthProtocol,
      checkAvailability: isAuthProtocolAvailable,
    },
    {
      tool: logAnalysisTool,
      executor: executeLogAnalysis,
      checkAvailability: isLogAnalysisAvailable,
    },
    { tool: secureSdlcTool, executor: executeSecureSdlc, checkAvailability: isSecureSdlcAvailable },
    { tool: privacyTool, executor: executePrivacy, checkAvailability: isPrivacyAvailable },
    {
      tool: accessControlTool,
      executor: executeAccessControl,
      checkAvailability: isAccessControlAvailable,
    },
    {
      tool: businessContinuityTool,
      executor: executeBusinessContinuity,
      checkAvailability: isBusinessContinuityAvailable,
    },
    { tool: devsecOpsTool, executor: executeDevsecOps, checkAvailability: isDevsecOpsAvailable },
    { tool: vpnTool, executor: executeVpn, checkAvailability: isVpnAvailable },
    { tool: pkiTool, executor: executePki, checkAvailability: isPkiAvailable },
    {
      tool: dataLossPreventionTool,
      executor: executeDataLossPrevention,
      checkAvailability: isDataLossPreventionAvailable,
    },
    {
      tool: identityManagementTool,
      executor: executeIdentityManagement,
      checkAvailability: isIdentityManagementAvailable,
    },
    {
      tool: patchManagementTool,
      executor: executePatchManagement,
      checkAvailability: isPatchManagementAvailable,
    },
    { tool: scadaIcsTool, executor: executeScadaIcs, checkAvailability: isScadaIcsAvailable },
    {
      tool: dataClassificationTool,
      executor: executeDataClassification,
      checkAvailability: isDataClassificationAvailable,
    },
    {
      tool: keyManagementTool,
      executor: executeKeyManagement,
      checkAvailability: isKeyManagementAvailable,
    },
    {
      tool: assetManagementTool,
      executor: executeAssetManagement,
      checkAvailability: isAssetManagementAvailable,
    },
    {
      tool: networkDefenseTool,
      executor: executeNetworkDefense,
      checkAvailability: isNetworkDefenseAvailable,
    },
    {
      tool: secretsManagementTool,
      executor: executeSecretsManagement,
      checkAvailability: isSecretsManagementAvailable,
    },
    {
      tool: privacyEngineeringTool,
      executor: executePrivacyEngineering,
      checkAvailability: isPrivacyEngineeringAvailable,
    },
    {
      tool: secureCommunicationsTool,
      executor: executeSecureCommunications,
      checkAvailability: isSecureCommunicationsAvailable,
    },
    {
      tool: industrialControlTool,
      executor: executeIndustrialControl,
      checkAvailability: isIndustrialControlAvailable,
    },
    {
      tool: logManagementTool,
      executor: executeLogManagement,
      checkAvailability: isLogManagementAvailable,
    },
    {
      tool: authenticationTool,
      executor: executeAuthentication,
      checkAvailability: isAuthenticationAvailable,
    },
    {
      tool: backupRecoveryTool,
      executor: executeBackupRecovery,
      checkAvailability: isBackupRecoveryAvailable,
    },
    { tool: saseTool, executor: executeSase, checkAvailability: isSaseAvailable },
    {
      tool: identityGovernanceTool,
      executor: executeIdentityGovernance,
      checkAvailability: isIdentityGovernanceAvailable,
    },
    // Code Agent Brain Tools - Full coding capabilities (8 new tools)
    { tool: workspaceTool, executor: executeWorkspace, checkAvailability: isWorkspaceAvailable },
    {
      tool: codeGenerationTool,
      executor: executeCodeGeneration,
      checkAvailability: isCodeGenerationAvailable,
    },
    {
      tool: codeAnalysisTool,
      executor: executeCodeAnalysis,
      checkAvailability: isCodeAnalysisAvailable,
    },
    {
      tool: projectBuilderTool,
      executor: executeProjectBuilder,
      checkAvailability: isProjectBuilderAvailable,
    },
    {
      tool: testGeneratorTool,
      executor: executeTestGenerator,
      checkAvailability: isTestGeneratorAvailable,
    },
    { tool: errorFixerTool, executor: executeErrorFixer, checkAvailability: isErrorFixerAvailable },
    { tool: refactorTool, executor: executeRefactor, checkAvailability: isRefactorAvailable },
    {
      tool: docGeneratorTool,
      executor: executeDocGenerator,
      checkAvailability: isDocGeneratorAvailable,
    },
    // ULTRA DEVELOPER TOOLKIT - Advanced DevOps, Architecture & AI Tools
    // Code Intelligence
    {
      tool: astAnalyzerTool,
      executor: executeAstAnalyzer,
      checkAvailability: isAstAnalyzerAvailable,
    },
    {
      tool: codeComplexityTool,
      executor: executeCodeComplexity,
      checkAvailability: isCodeComplexityAvailable,
    },
    {
      tool: designPatternTool,
      executor: executeDesignPattern,
      checkAvailability: isDesignPatternAvailable,
    },
    {
      tool: dependencyGraphTool,
      executor: executeDependencyGraph,
      checkAvailability: isDependencyGraphAvailable,
    },
    {
      tool: refactorSuggesterTool,
      executor: executeRefactorSuggester,
      checkAvailability: isRefactorSuggesterAvailable,
    },
    { tool: techDebtTool, executor: executeTechDebt, checkAvailability: isTechDebtAvailable },
    {
      tool: codeSmellDetectorTool,
      executor: executeCodeSmellDetector,
      checkAvailability: isCodeSmellDetectorAvailable,
    },
    // DevOps & Infrastructure
    {
      tool: kubernetesGenTool,
      executor: executeKubernetesGen,
      checkAvailability: isKubernetesGenAvailable,
    },
    {
      tool: dockerOptimizerTool,
      executor: executeDockerOptimizer,
      checkAvailability: isDockerOptimizerAvailable,
    },
    {
      tool: ciCdGeneratorTool,
      executor: executeCiCdGenerator,
      checkAvailability: isCiCdGeneratorAvailable,
    },
    {
      tool: terraformGenTool,
      executor: executeTerraformGen,
      checkAvailability: isTerraformGenAvailable,
    },
    { tool: helmChartTool, executor: executeHelmChart, checkAvailability: isHelmChartAvailable },
    {
      tool: observabilityTool,
      executor: executeObservability,
      checkAvailability: isObservabilityAvailable,
    },
    // Database & Data
    {
      tool: sqlOptimizerTool,
      executor: executeSqlOptimizer,
      checkAvailability: isSqlOptimizerAvailable,
    },
    {
      tool: migrationGeneratorTool,
      executor: executeMigrationGenerator,
      checkAvailability: isMigrationGeneratorAvailable,
    },
    {
      tool: nosqlSchemaTool,
      executor: executeNosqlSchema,
      checkAvailability: isNosqlSchemaAvailable,
    },
    {
      tool: dataPipelineTool,
      executor: executeDataPipeline,
      checkAvailability: isDataPipelineAvailable,
    },
    // API Development
    { tool: apiDesignTool, executor: executeApiDesign, checkAvailability: isApiDesignAvailable },
    // Architecture & Design
    {
      tool: systemDesignTool,
      executor: executeSystemDesign,
      checkAvailability: isSystemDesignAvailable,
    },
    {
      tool: microservicesTool,
      executor: executeMicroservices,
      checkAvailability: isMicroservicesAvailable,
    },
    {
      tool: cacheStrategyTool,
      executor: executeCacheStrategy,
      checkAvailability: isCacheStrategyAvailable,
    },
    {
      tool: circuitBreakerTool,
      executor: executeCircuitBreaker,
      checkAvailability: isCircuitBreakerAvailable,
    },
    {
      tool: featureFlagTool,
      executor: executeFeatureFlag,
      checkAvailability: isFeatureFlagAvailable,
    },
    // Testing & Quality
    {
      tool: unitTestGenTool,
      executor: executeUnitTestGen,
      checkAvailability: isUnitTestGenAvailable,
    },
    { tool: e2eTestGenTool, executor: executeE2eTestGen, checkAvailability: isE2eTestGenAvailable },
    {
      tool: loadTestDesignTool,
      executor: executeLoadTestDesign,
      checkAvailability: isLoadTestDesignAvailable,
    },
    // AI/ML Development
    {
      tool: promptEngineeringTool,
      executor: executePromptEngineering,
      checkAvailability: isPromptEngineeringAvailable,
    },
    {
      tool: modelEvaluationTool,
      executor: executeModelEvaluation,
      checkAvailability: isModelEvaluationAvailable,
    },
    {
      tool: mlModelServingTool,
      executor: executeMlModelServing,
      checkAvailability: isMlModelServingAvailable,
    },
    // Blockchain & Web3
    {
      tool: smartContractTool,
      executor: executeSmartContract,
      checkAvailability: isSmartContractAvailable,
    },
    // Documentation
    {
      tool: readmeGeneratorTool,
      executor: executeReadmeGenerator,
      checkAvailability: isReadmeGeneratorAvailable,
    },
    // ============================================================================
    // PROCEDURAL GENERATION & GAME DEV TOOLS (New Batch - 36 tools)
    // ============================================================================
    {
      tool: perlinNoiseTool,
      executor: executePerlinNoise,
      checkAvailability: isPerlinNoiseAvailable,
    },
    {
      tool: mazeGeneratorTool,
      executor: executeMazeGenerator,
      checkAvailability: isMazeGeneratorAvailable,
    },
    { tool: lSystemTool, executor: executeLSystem, checkAvailability: isLSystemAvailable },
    {
      tool: pathfindingTool,
      executor: executePathfinding,
      checkAvailability: isPathfindingAvailable,
    },
    {
      tool: particleEffectTool,
      executor: executeParticleEffect,
      checkAvailability: isParticleEffectAvailable,
    },
    {
      tool: collisionDetectionTool,
      executor: executeCollisionDetection,
      checkAvailability: isCollisionDetectionAvailable,
    },
    {
      tool: steeringBehaviorsTool,
      executor: executeSteeringBehaviors,
      checkAvailability: isSteeringBehaviorsAvailable,
    },
    {
      tool: behaviorTreeTool,
      executor: executeBehaviorTree,
      checkAvailability: isBehaviorTreeAvailable,
    },
    { tool: quadtreeTool, executor: executeQuadtree, checkAvailability: isQuadtreeAvailable },
    {
      tool: cssGeneratorTool,
      executor: executeCssGenerator,
      checkAvailability: isCssGeneratorAvailable,
    },
    {
      tool: chordProgressionTool,
      executor: executeChordProgression,
      checkAvailability: isChordProgressionAvailable,
    },
    { tool: lootTableTool, executor: executeLootTable, checkAvailability: isLootTableAvailable },
    {
      tool: proceduralDungeonTool,
      executor: executeProceduralDungeon,
      checkAvailability: isProceduralDungeonAvailable,
    },
    {
      tool: nameGeneratorTool,
      executor: executeNameGenerator,
      checkAvailability: isNameGeneratorAvailable,
    },
    {
      tool: waveFunctionCollapseTool,
      executor: executeWaveFunctionCollapse,
      checkAvailability: isWaveFunctionCollapseAvailable,
    },
    {
      tool: terrainHeightmapTool,
      executor: executeTerrainHeightmap,
      checkAvailability: isTerrainHeightmapAvailable,
    },
    {
      tool: biomeGeneratorTool,
      executor: executeBiomeGenerator,
      checkAvailability: isBiomeGeneratorAvailable,
    },
    {
      tool: planetGeneratorTool,
      executor: executePlanetGenerator,
      checkAvailability: isPlanetGeneratorAvailable,
    },
    {
      tool: cityGeneratorTool,
      executor: executeCityGenerator,
      checkAvailability: isCityGeneratorAvailable,
    },
    {
      tool: spellSystemTool,
      executor: executeSpellSystem,
      checkAvailability: isSpellSystemAvailable,
    },
    {
      tool: dialogueTreeTool,
      executor: executeDialogueTree,
      checkAvailability: isDialogueTreeAvailable,
    },
    {
      tool: questGeneratorTool,
      executor: executeQuestGenerator,
      checkAvailability: isQuestGeneratorAvailable,
    },
    { tool: skillTreeTool, executor: executeSkillTree, checkAvailability: isSkillTreeAvailable },
    {
      tool: inventorySystemTool,
      executor: executeInventorySystem,
      checkAvailability: isInventorySystemAvailable,
    },
    {
      tool: drumPatternTool,
      executor: executeDrumPattern,
      checkAvailability: isDrumPatternAvailable,
    },
    {
      tool: melodyGeneratorTool,
      executor: executeMelodyGenerator,
      checkAvailability: isMelodyGeneratorAvailable,
    },
    {
      tool: dataCompressionTool,
      executor: executeDataCompression,
      checkAvailability: isDataCompressionAvailable,
    },

    {
      tool: stateMachineTool,
      executor: executeStateMachine,
      checkAvailability: isStateMachineAvailable,
    },
    {
      tool: entityComponentTool,
      executor: executeEntityComponent,
      checkAvailability: isEntityComponentAvailable,
    },
    {
      tool: pathPlanningTool,
      executor: executePathPlanning,
      checkAvailability: isPathPlanningAvailable,
    },
    { tool: tileMapTool, executor: executeTileMap, checkAvailability: isTileMapAvailable },
    {
      tool: cameraSystemTool,
      executor: executeCameraSystem,
      checkAvailability: isCameraSystemAvailable,
    },
    {
      tool: audioWaveformTool,
      executor: executeAudioWaveform,
      checkAvailability: isAudioWaveformAvailable,
    },
    {
      tool: textAdventureTool,
      executor: executeTextAdventure,
      checkAvailability: isTextAdventureAvailable,
    },
    {
      tool: proceduralStoryTool,
      executor: executeProceduralStory,
      checkAvailability: isProceduralStoryAvailable,
    },
    {
      tool: dataVisualizationTool,
      executor: executeDataVisualization,
      checkAvailability: isDataVisualizationAvailable,
    },
    // MEGA BATCH #2 - 17 more incredible tools
    {
      tool: spriteAnimationTool,
      executor: executeSpriteAnimation,
      checkAvailability: isSpriteAnimationAvailable,
    },
    { tool: gameInputTool, executor: executeGameInput, checkAvailability: isGameInputAvailable },
    { tool: saveSystemTool, executor: executeSaveSystem, checkAvailability: isSaveSystemAvailable },
    {
      tool: dialogSystemTool,
      executor: executeDialogSystem,
      checkAvailability: isDialogSystemAvailable,
    },
    {
      tool: questSystemTool,
      executor: executeQuestSystem,
      checkAvailability: isQuestSystemAvailable,
    },
    {
      tool: achievementSystemTool,
      executor: executeAchievementSystem,
      checkAvailability: isAchievementSystemAvailable,
    },
    {
      tool: leaderboardTool,
      executor: executeLeaderboard,
      checkAvailability: isLeaderboardAvailable,
    },
    {
      tool: levelEditorTool,
      executor: executeLevelEditor,
      checkAvailability: isLevelEditorAvailable,
    },
    {
      tool: stockAnalysisTool,
      executor: executeStockAnalysis,
      checkAvailability: isStockAnalysisAvailable,
    },
    {
      tool: apiRateLimiterTool,
      executor: executeApiRateLimiter,
      checkAvailability: isApiRateLimiterAvailable,
    },
    { tool: blockchainTool, executor: executeBlockchain, checkAvailability: isBlockchainAvailable },
    {
      tool: chessEngineTool,
      executor: executeChessEngine,
      checkAvailability: isChessEngineAvailable,
    },
    {
      tool: artificialLifeTool,
      executor: executeArtificialLife,
      checkAvailability: isArtificialLifeAvailable,
    },
    { tool: compilerTool, executor: executeCompiler, checkAvailability: isCompilerAvailable },
    {
      tool: typeInferenceTool,
      executor: executeTypeInference,
      checkAvailability: isTypeInferenceAvailable,
    },
    {
      tool: knowledgeGraphTool,
      executor: executeKnowledgeGraph,
      checkAvailability: isKnowledgeGraphAvailable,
    },
    {
      tool: proteinFoldingTool,
      executor: executeProteinFolding,
      checkAvailability: isProteinFoldingAvailable,
    },
    { tool: cspSolverTool, executor: executeCspSolver, checkAvailability: isCspSolverAvailable },
    {
      tool: virtualMachineTool,
      executor: executeVirtualMachine,
      checkAvailability: isVirtualMachineAvailable,
    },
    {
      tool: garbageCollectorTool,
      executor: executeGarbageCollector,
      checkAvailability: isGarbageCollectorAvailable,
    },
    // Medical tools
    {
      tool: medicaldiagnosisTool,
      executor: executemedicaldiagnosis,
      checkAvailability: ismedicaldiagnosisAvailable,
    },
    {
      tool: druginteractionTool,
      executor: executedruginteraction,
      checkAvailability: isdruginteractionAvailable,
    },
    {
      tool: ecganalyzerTool,
      executor: executeecganalyzer,
      checkAvailability: isecganalyzerAvailable,
    },
    {
      tool: dosagecalculatorTool,
      executor: executedosagecalculator,
      checkAvailability: isdosagecalculatorAvailable,
    },
    { tool: labvaluesTool, executor: executelabvalues, checkAvailability: islabvaluesAvailable },
    // Creative writing tools

    // Education tools

    // Legal tools

    // Algorithm tools

    {
      tool: divideconquerTool,
      executor: executedivideconquer,
      checkAvailability: isdivideconquerAvailable,
    },
    {
      tool: branchboundTool,
      executor: executebranchbound,
      checkAvailability: isbranchboundAvailable,
    },
    // IoT & Embedded Systems tools
    {
      tool: mqttprotocolTool,
      executor: executemqttprotocol,
      checkAvailability: ismqttprotocolAvailable,
    },
    { tool: modbusTool, executor: executemodbus, checkAvailability: ismodbusAvailable },

    {
      tool: pwmcontrollerTool,
      executor: executepwmcontroller,
      checkAvailability: ispwmcontrollerAvailable,
    },
    {
      tool: i2cprotocolTool,
      executor: executei2cprotocol,
      checkAvailability: isi2cprotocolAvailable,
    },
    {
      tool: spiprotocolTool,
      executor: executespiprotocol,
      checkAvailability: isspiprotocolAvailable,
    },
    {
      tool: uartprotocolTool,
      executor: executeuartprotocol,
      checkAvailability: isuartprotocolAvailable,
    },
    {
      tool: gpiosimulatorTool,
      executor: executegpiosimulator,
      checkAvailability: isgpiosimulatorAvailable,
    },
    {
      tool: watchdogtimerTool,
      executor: executewatchdogtimer,
      checkAvailability: iswatchdogtimerAvailable,
    },

    {
      tool: firmwareupdateTool,
      executor: executefirmwareupdate,
      checkAvailability: isfirmwareupdateAvailable,
    },
    // Robotics & Control tools

    {
      tool: forwardkinematicsTool,
      executor: executeforwardkinematics,
      checkAvailability: isforwardkinematicsAvailable,
    },

    {
      tool: motionplanningTool,
      executor: executemotionplanning,
      checkAvailability: ismotionplanningAvailable,
    },
    {
      tool: slamalgorithmTool,
      executor: executeslamalgorithm,
      checkAvailability: isslamalgorithmAvailable,
    },
    {
      tool: lidarprocessingTool,
      executor: executelidarprocessing,
      checkAvailability: islidarprocessingAvailable,
    },

    // Computer Vision tools
    {
      tool: edgedetectionTool,
      executor: executeedgedetection,
      checkAvailability: isedgedetectionAvailable,
    },
    {
      tool: harriscornersTool,
      executor: executeharriscorners,
      checkAvailability: isharriscornersAvailable,
    },
    {
      tool: siftfeaturesTool,
      executor: executesiftfeatures,
      checkAvailability: issiftfeaturesAvailable,
    },
    {
      tool: orbfeaturesTool,
      executor: executeorbfeatures,
      checkAvailability: isorbfeaturesAvailable,
    },
    {
      tool: opticalflowTool,
      executor: executeopticalflow,
      checkAvailability: isopticalflowAvailable,
    },
    {
      tool: imagesegmentationTool,
      executor: executeimagesegmentation,
      checkAvailability: isimagesegmentationAvailable,
    },
    {
      tool: objecttrackingTool,
      executor: executeobjecttracking,
      checkAvailability: isobjecttrackingAvailable,
    },
    {
      tool: stereovisionTool,
      executor: executestereovision,
      checkAvailability: isstereovisionAvailable,
    },
    {
      tool: cameracalibrationTool,
      executor: executecameracalibration,
      checkAvailability: iscameracalibrationAvailable,
    },
    { tool: homographyTool, executor: executehomography, checkAvailability: ishomographyAvailable },

    {
      tool: morphologicalopsTool,
      executor: executemorphologicalops,
      checkAvailability: ismorphologicalopsAvailable,
    },
    {
      tool: contourdetectionTool,
      executor: executecontourdetection,
      checkAvailability: iscontourdetectionAvailable,
    },

    // Distributed Systems tools
    {
      tool: raftconsensusTool,
      executor: executeraftconsensus,
      checkAvailability: israftconsensusAvailable,
    },
    { tool: paxosTool, executor: executepaxos, checkAvailability: ispaxosAvailable },
    {
      tool: gossipprotocolTool,
      executor: executegossipprotocol,
      checkAvailability: isgossipprotocolAvailable,
    },
    {
      tool: consistenthashingTool,
      executor: executeconsistenthashing,
      checkAvailability: isconsistenthashingAvailable,
    },
    {
      tool: lamportclockTool,
      executor: executelamportclock,
      checkAvailability: islamportclockAvailable,
    },
    {
      tool: twophasecommitTool,
      executor: executetwophasecommit,
      checkAvailability: istwophasecommitAvailable,
    },
    {
      tool: sagapatternTool,
      executor: executesagapattern,
      checkAvailability: issagapatternAvailable,
    },

    // AI/ML Advanced tools
    {
      tool: reinforcementlearningTool,
      executor: executereinforcementlearning,
      checkAvailability: isreinforcementlearningAvailable,
    },
    { tool: alphabetaTool, executor: executealphabeta, checkAvailability: isalphabetaAvailable },
    {
      tool: bayesiannetworkTool,
      executor: executebayesiannetwork,
      checkAvailability: isbayesiannetworkAvailable,
    },

    { tool: cmaesTool, executor: executecmaes, checkAvailability: iscmaesAvailable },

    { tool: antcolonyTool, executor: executeantcolony, checkAvailability: isantcolonyAvailable },

    // Physics Simulation tools
    {
      tool: latticeboltzmannTool,
      executor: executelatticeboltzmann,
      checkAvailability: islatticeboltzmannAvailable,
    },
    { tool: sphfluidTool, executor: executesphfluid, checkAvailability: issphfluidAvailable },

    {
      tool: clothsimulationTool,
      executor: executeclothsimulation,
      checkAvailability: isclothsimulationAvailable,
    },
    { tool: softbodyTool, executor: executesoftbody, checkAvailability: issoftbodyAvailable },
    {
      tool: ropephysicsTool,
      executor: executeropephysics,
      checkAvailability: isropephysicsAvailable,
    },
    {
      tool: ragdollphysicsTool,
      executor: executeragdollphysics,
      checkAvailability: isragdollphysicsAvailable,
    },
    {
      tool: buoyancysimTool,
      executor: executebuoyancysim,
      checkAvailability: isbuoyancysimAvailable,
    },
    {
      tool: pendulumsimTool,
      executor: executependulumsim,
      checkAvailability: ispendulumsimAvailable,
    },

    // Formal Methods tools

    {
      tool: automataminimizerTool,
      executor: executeautomataminimizer,
      checkAvailability: isautomataminimizerAvailable,
    },
    {
      tool: grammarparserTool,
      executor: executegrammarparser,
      checkAvailability: isgrammarparserAvailable,
    },
    { tool: llparserTool, executor: executellparser, checkAvailability: isllparserAvailable },
    { tool: lrparserTool, executor: executelrparser, checkAvailability: islrparserAvailable },
    // Database Internals tools
    { tool: btreeindexTool, executor: executebtreeindex, checkAvailability: isbtreeindexAvailable },
    {
      tool: bloomfilterTool,
      executor: executebloomfilter,
      checkAvailability: isbloomfilterAvailable,
    },
    { tool: lsmtreeTool, executor: executelsmtree, checkAvailability: islsmtreeAvailable },
    { tool: wallogTool, executor: executewallog, checkAvailability: iswallogAvailable },
    { tool: mvccTool, executor: executemvcc, checkAvailability: ismvccAvailable },
    {
      tool: queryplannerTool,
      executor: executequeryplanner,
      checkAvailability: isqueryplannerAvailable,
    },

    {
      tool: joinalgorithmsTool,
      executor: executejoinalgorithms,
      checkAvailability: isjoinalgorithmsAvailable,
    },
    { tool: bufferpoolTool, executor: executebufferpool, checkAvailability: isbufferpoolAvailable },
    {
      tool: lockmanagerTool,
      executor: executelockmanager,
      checkAvailability: islockmanagerAvailable,
    },
    // OS Internals tools
    {
      tool: processschedulerTool,
      executor: executeprocessscheduler,
      checkAvailability: isprocessschedulerAvailable,
    },
    {
      tool: memoryallocatorTool,
      executor: executememoryallocator,
      checkAvailability: ismemoryallocatorAvailable,
    },
    {
      tool: pagereplacementTool,
      executor: executepagereplacement,
      checkAvailability: ispagereplacementAvailable,
    },
    {
      tool: diskschedulerTool,
      executor: executediskscheduler,
      checkAvailability: isdiskschedulerAvailable,
    },

    {
      tool: deadlockdetectorTool,
      executor: executedeadlockdetector,
      checkAvailability: isdeadlockdetectorAvailable,
    },
    { tool: semaphoreTool, executor: executesemaphore, checkAvailability: issemaphoreAvailable },
    { tool: mutexlockTool, executor: executemutexlock, checkAvailability: ismutexlockAvailable },

    {
      tool: diningphilosophersTool,
      executor: executediningphilosophers,
      checkAvailability: isdiningphilosophersAvailable,
    },
    // Graphics & Rendering tools
    { tool: rasterizerTool, executor: executerasterizer, checkAvailability: israsterizerAvailable },
    { tool: zbufferTool, executor: executezbuffer, checkAvailability: iszbufferAvailable },

    {
      tool: phongshadingTool,
      executor: executephongshading,
      checkAvailability: isphongshadingAvailable,
    },
    {
      tool: pbrmaterialTool,
      executor: executepbrmaterial,
      checkAvailability: ispbrmaterialAvailable,
    },
    {
      tool: shadowmappingTool,
      executor: executeshadowmapping,
      checkAvailability: isshadowmappingAvailable,
    },
    {
      tool: ambientocclusionTool,
      executor: executeambientocclusion,
      checkAvailability: isambientocclusionAvailable,
    },
    {
      tool: bloomeffectTool,
      executor: executebloomeffect,
      checkAvailability: isbloomeffectAvailable,
    },
    { tool: dofeffectTool, executor: executedofeffect, checkAvailability: isdofeffectAvailable },
    { tool: motionblurTool, executor: executemotionblur, checkAvailability: ismotionblurAvailable },
    {
      tool: antialiasingTool,
      executor: executeantialiasing,
      checkAvailability: isantialiasingAvailable,
    },
    { tool: equalizerTool, executor: executeequalizer, checkAvailability: isequalizerAvailable },
    { tool: compressorTool, executor: executecompressor, checkAvailability: iscompressorAvailable },
    { tool: reverbTool, executor: executereverb, checkAvailability: isreverbAvailable },
    {
      tool: delayeffectTool,
      executor: executedelayeffect,
      checkAvailability: isdelayeffectAvailable,
    },
    {
      tool: choruseffectTool,
      executor: executechoruseffect,
      checkAvailability: ischoruseffectAvailable,
    },
    { tool: distortionTool, executor: executedistortion, checkAvailability: isdistortionAvailable },
    { tool: limiterTool, executor: executelimiter, checkAvailability: islimiterAvailable },

    // Cryptography & Security tools
    {
      tool: aesencryptionTool,
      executor: executeaesencryption,
      checkAvailability: isaesencryptionAvailable,
    },
    {
      tool: rsaencryptionTool,
      executor: executeraesncryption,
      checkAvailability: isrsaencryptionAvailable,
    },
    { tool: shahashTool, executor: executeshahash, checkAvailability: isshahashAvailable },
    { tool: hmacTool, executor: executehmac, checkAvailability: ishmacAvailable },

    {
      tool: digitalsignatureTool,
      executor: executedigitalsignature,
      checkAvailability: isdigitalsignatureAvailable,
    },
    {
      tool: keyderivationTool,
      executor: executekeyderivation,
      checkAvailability: iskeyderivationAvailable,
    },
    // Quantum Computing tools
    {
      tool: qubitsimulatorTool,
      executor: executequbitsimulator,
      checkAvailability: isqubitsimulatorAvailable,
    },
    {
      tool: quantumgateTool,
      executor: executequantumgate,
      checkAvailability: isquantumgateAvailable,
    },
    {
      tool: groveralgorithmTool,
      executor: executegroveralgorithm,
      checkAvailability: isgroveralgorithmAvailable,
    },
    {
      tool: shoralgorithmTool,
      executor: executeshoralgorithm,
      checkAvailability: isshoralgorithmAvailable,
    },
    {
      tool: quantumentanglementTool,
      executor: executequantumentanglement,
      checkAvailability: isquantumentanglementAvailable,
    },
    {
      tool: quantumerrorcorrectionTool,
      executor: executequantumerrorcorrection,
      checkAvailability: isquantumerrorcorrectionAvailable,
    },
    { tool: vqeTool, executor: executevqe, checkAvailability: isvqeAvailable },
    { tool: qaoaTool, executor: executeqaoa, checkAvailability: isqaoaAvailable },
    { tool: qftTool, executor: executeqft, checkAvailability: isqftAvailable },
    // NLP tools
    {
      tool: wordembeddingsTool,
      executor: executewordembeddings,
      checkAvailability: iswordembeddingsAvailable,
    },
    {
      tool: berttokenizerTool,
      executor: executeberttokenizer,
      checkAvailability: isberttokenizerAvailable,
    },
    { tool: postaggerTool, executor: executepostagger, checkAvailability: ispostaggerAvailable },
    { tool: nerTool, executor: executener, checkAvailability: isnerAvailable },
    {
      tool: dependencyparserTool,
      executor: executedependencyparser,
      checkAvailability: isdependencyparserAvailable,
    },
    {
      tool: coreferenceTool,
      executor: executecoreference,
      checkAvailability: iscoreferenceAvailable,
    },
    {
      tool: textclassificationTool,
      executor: executetextclassification,
      checkAvailability: istextclassificationAvailable,
    },
    {
      tool: textgenerationTool,
      executor: executetextgeneration,
      checkAvailability: istextgenerationAvailable,
    },
    // Bioinformatics tools
    {
      tool: sequencealignmentTool,
      executor: executesequencealignment,
      checkAvailability: issequencealignmentAvailable,
    },

    {
      tool: geneexpressionTool,
      executor: executegeneexpression,
      checkAvailability: isgeneexpressionAvailable,
    },
    // Signal Processing & Control tools
    {
      tool: filterdesignTool,
      executor: executefilterdesign,
      checkAvailability: isfilterdesignAvailable,
    },
    {
      tool: signalconvolutionTool,
      executor: executesignalconvolution,
      checkAvailability: issignalconvolutionAvailable,
    },
    { tool: bodeplotTool, executor: executebodeplot, checkAvailability: isbodeplotAvailable },
    { tool: rootlocusTool, executor: executerootlocus, checkAvailability: isrootlocusAvailable },
    {
      tool: nyquistplotTool,
      executor: executenyquistplot,
      checkAvailability: isnyquistplotAvailable,
    },
    {
      tool: portfoliooptimizationTool,
      executor: executeportfoliooptimization,
      checkAvailability: isportfoliooptimizationAvailable,
    },
    { tool: kdtreeTool, executor: executekdtree, checkAvailability: iskdtreeAvailable },
    { tool: rtreeTool, executor: executertree, checkAvailability: isrtreeAvailable },
    {
      tool: lineintersectionTool,
      executor: executelineintersection,
      checkAvailability: islineintersectionAvailable,
    },
    {
      tool: polygontriangulationTool,
      executor: executepolygontriangulation,
      checkAvailability: ispolygontriangulationAvailable,
    },
    {
      tool: agentbasedmodelTool,
      executor: executeagentbasedmodel,
      checkAvailability: isagentbasedmodelAvailable,
    },
    // Earth & Space Sciences tools
    {
      tool: epidemicmodelTool,
      executor: executeepidemicmodel,
      checkAvailability: isepidemicmodelAvailable,
    },
    {
      tool: trafficsimulationTool,
      executor: executetrafficsimulation,
      checkAvailability: istrafficsimulationAvailable,
    },
    {
      tool: weathermodelTool,
      executor: executeweathermodel,
      checkAvailability: isweathermodelAvailable,
    },
    {
      tool: climatemodelTool,
      executor: executeclimatemodel,
      checkAvailability: isclimatemodelAvailable,
    },
    { tool: oceanmodelTool, executor: executeoceanmodel, checkAvailability: isoceanmodelAvailable },
    {
      tool: seismicanalysisTool,
      executor: executeseismicanalysis,
      checkAvailability: isseismicanalysisAvailable,
    },
    {
      tool: rocketequationTool,
      executor: executerocketequation,
      checkAvailability: isrocketequationAvailable,
    },
    {
      tool: stellarevolutionTool,
      executor: executestellarevolution,
      checkAvailability: isstellarevolutionAvailable,
    },
    // MEGA BATCH #6-8: Blockchain, Compiler, Computer Architecture
    {
      tool: defiprotocolTool,
      executor: executedefiprotocol,
      checkAvailability: isdefiprotocolAvailable,
    },

    {
      tool: tokeneconomicsTool,
      executor: executetokeneconomics,
      checkAvailability: istokeneconomicsAvailable,
    },
    {
      tool: lexergeneratorTool,
      executor: executelexergenerator,
      checkAvailability: islexergeneratorAvailable,
    },
    {
      tool: parsergeneratorTool,
      executor: executeparsergenerator,
      checkAvailability: isparsergeneratorAvailable,
    },
    {
      tool: asttransformerTool,
      executor: executeasttransformer,
      checkAvailability: isasttransformerAvailable,
    },
    {
      tool: iroptimizerTool,
      executor: executeiroptimizer,
      checkAvailability: isiroptimizerAvailable,
    },

    {
      tool: interpreterTool,
      executor: executeinterpreter,
      checkAvailability: isinterpreterAvailable,
    },
    {
      tool: cpusimulatorTool,
      executor: executecpusimulator,
      checkAvailability: iscpusimulatorAvailable,
    },
    {
      tool: cachesimulatorTool,
      executor: executecachesimulator,
      checkAvailability: iscachesimulatorAvailable,
    },

    {
      tool: branchpredictorTool,
      executor: executebranchpredictor,
      checkAvailability: isbranchpredictorAvailable,
    },
    // MEGA BATCH #9-10: Networking, Information Theory
    {
      tool: routingalgorithmTool,
      executor: executeroutingalgorithm,
      checkAvailability: isroutingalgorithmAvailable,
    },
    {
      tool: dnsresolverTool,
      executor: executednsresolver,
      checkAvailability: isdnsresolverAvailable,
    },
    {
      tool: lzcompressionTool,
      executor: executelzcompression,
      checkAvailability: islzcompressionAvailable,
    },
    {
      tool: reedsolomonTool,
      executor: executereedsolomon,
      checkAvailability: isreedsolomonAvailable,
    },
    // MEGA BATCH #11-13: Sciences, Social Sciences, Industry
    {
      tool: particlephysicsTool,
      executor: executeparticlephysics,
      checkAvailability: isparticlephysicsAvailable,
    },

    { tool: crisprTool, executor: executecrispr, checkAvailability: iscrisprAvailable },
    {
      tool: votingsystemTool,
      executor: executevotingsystem,
      checkAvailability: isvotingsystemAvailable,
    },
    {
      tool: economicssimulatorTool,
      executor: executeeconomicssimulator,
      checkAvailability: iseconomicssimulatorAvailable,
    },
    { tool: realestateTool, executor: executerealestate, checkAvailability: isrealestateAvailable },
    {
      tool: sportsanalyticsTool,
      executor: executesportsanalytics,
      checkAvailability: issportsanalyticsAvailable,
    },
    // MEGA BATCH #7: Music, Linguistics, Physics, Anthropology, Industry

    { tool: phoneticsTool, executor: executephonetics, checkAvailability: isphoneticsAvailable },
    { tool: morphologyTool, executor: executemorphology, checkAvailability: ismorphologyAvailable },

    {
      tool: radioactivedecayTool,
      executor: executeradioactivedecay,
      checkAvailability: isradioactivedecayAvailable,
    },
    {
      tool: gravitationalwaveTool,
      executor: executegravitationalwave,
      checkAvailability: isgravitationalwaveAvailable,
    },
    { tool: blackholeTool, executor: executeblackhole, checkAvailability: isblackholeAvailable },

    {
      tool: fashionanalysisTool,
      executor: executefashionanalysis,
      checkAvailability: isfashionanalysisAvailable,
    },

    {
      tool: urbanplanningTool,
      executor: executeurbanplanning,
      checkAvailability: isurbanplanningAvailable,
    },
    {
      tool: carbonfootprintTool,
      executor: executecarbonfootprint,
      checkAvailability: iscarbonfootprintAvailable,
    },
    {
      tool: causalinferenceTool,
      executor: executecausalinference,
      checkAvailability: iscausalinferenceAvailable,
    },

    {
      tool: transformerarchitectureTool,
      executor: executetransformerarchitecture,
      checkAvailability: istransformerarchitectureAvailable,
    },
    {
      tool: diffusionmodelTool,
      executor: executediffusionmodel,
      checkAvailability: isdiffusionmodelAvailable,
    },

    { tool: rlhfTool, executor: executerlhf, checkAvailability: isrlhfAvailable },
    {
      tool: cognitivearchitectureTool,
      executor: executecognitivearchitecture,
      checkAvailability: iscognitivearchitectureAvailable,
    }
  );

  toolsInitialized = true;
}

/**
 * Get all available chat tools
 */
export async function getAvailableChatTools(): Promise<UnifiedTool[]> {
  await initializeTools();

  const available: UnifiedTool[] = [];

  for (const { tool, checkAvailability } of CHAT_TOOLS) {
    const isAvailable = await checkAvailability();
    if (isAvailable) {
      available.push(tool);
    }
  }

  return available;
}

/**
 * Execute a tool by name
 */
export async function executeChatTool(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  // Skip native server tools (web_search) — handled by Anthropic server-side
  if (_isNativeServerTool(toolCall.name)) {
    return {
      toolCallId: toolCall.id,
      content: 'Handled by server',
      isError: false,
    };
  }

  await initializeTools();

  const toolEntry = CHAT_TOOLS.find((t) => t.tool.name === toolCall.name);

  if (!toolEntry) {
    return {
      toolCallId: toolCall.id,
      content: `Unknown tool: ${toolCall.name}`,
      isError: true,
    };
  }

  // Check availability
  const isAvailable = await toolEntry.checkAvailability();
  if (!isAvailable) {
    return {
      toolCallId: toolCall.id,
      content: `Tool ${toolCall.name} is not currently available. Required services may not be configured.`,
      isError: true,
    };
  }

  // Execute
  return toolEntry.executor(toolCall);
}

/**
 * Get tool definitions for Claude API
 */
export async function getChatToolDefinitions(): Promise<UnifiedTool[]> {
  return getAvailableChatTools();
}

/**
 * Legacy export for backward compatibility
 * Note: This is async now - callers should use getAvailableChatTools() instead
 */
export async function getAvailableTools(): Promise<UnifiedTool[]> {
  const { webSearchTool, isWebSearchAvailable } = await import('./web-search');
  return isWebSearchAvailable() ? [webSearchTool] : [];
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Cleanup all sandbox resources
 * Call this when the application shuts down
 */
export async function cleanupAllSandboxes(): Promise<void> {
  const { cleanupCodeSandbox } = await import('./run-code');
  const { cleanupBrowserSandbox } = await import('./browser-visit');

  await Promise.all([cleanupCodeSandbox(), cleanupBrowserSandbox()]);
}
