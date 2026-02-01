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

// Web Search (existing)
export { webSearchTool, executeWebSearch, isWebSearchAvailable } from './web-search';

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

// GitHub Tool
export { githubTool, executeGitHub, isGitHubAvailable } from './github-tool';

// Screenshot Tool
export { screenshotTool, executeScreenshot, isScreenshotAvailable } from './screenshot-tool';

// Calculator/Math Tool
export { calculatorTool, executeCalculator, isCalculatorAvailable } from './calculator-tool';

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

// Advanced Math (math.js)
export { mathTool, executeMath, isMathAvailable } from './math-tool';

// EXIF/Image Metadata (exifr)
export { exifTool, executeExif, isExifAvailable } from './exif-tool';

// Search Index (Lunr.js)
export { searchIndexTool, executeSearchIndex, isSearchIndexAvailable } from './search-index-tool';

// ASCII Art (FIGlet)
export { asciiArtTool, executeAsciiArt, isAsciiArtAvailable } from './ascii-art-tool';

// Color Tools (chroma-js)
export { colorTool, executeColor, isColorAvailable } from './color-tool';

// Data Validation (validator.js)
export { validatorTool, executeValidator, isValidatorAvailable } from './validator-tool';

// Cron Expression (cron-parser)
export { cronTool, executeCron, isCronAvailable } from './cron-tool';

// Unit Conversion (convert-units)
export { unitConvertTool, executeUnitConvert, isUnitConvertAvailable } from './unit-convert-tool';

// Audio Synthesis (Tone.js)
export { audioSynthTool, executeAudioSynth, isAudioSynthAvailable } from './audio-synth-tool';

// ============================================================================
// SCIENTIFIC & RESEARCH TOOLS (12 new tools)
// ============================================================================

// Statistical Analysis (simple-statistics + jstat)
export { statisticsTool, executeStatistics, isStatisticsAvailable } from './statistics-tool';

// Geospatial Calculations (turf.js)
export { geospatialTool, executeGeospatial, isGeospatialAvailable } from './geospatial-tool';

// Phone Validation (libphonenumber-js)
export { phoneTool, executePhone, isPhoneAvailable } from './phone-tool';

// Password Strength (zxcvbn)
export {
  passwordStrengthTool,
  executePasswordStrength,
  isPasswordStrengthAvailable,
} from './password-strength-tool';

// Chemistry/Molecules (openchemlib-js)
export { chemistryTool, executeChemistry, isChemistryAvailable } from './chemistry-tool';

// DNA/Bio Sequences (custom)
export { dnaBioTool, executeDnaBio, isDnaBioAvailable } from './dna-bio-tool';

// Matrix/Linear Algebra (ml-matrix)
export { matrixTool, executeMatrix, isMatrixAvailable } from './matrix-tool';

// Graph/Network Analysis (graphology)
export { graphTool, executeGraph, isGraphAvailable } from './graph-tool';

// Periodic Table (custom)
export {
  periodicTableTool,
  executePeriodicTable,
  isPeriodicTableAvailable,
} from './periodic-table-tool';

// Physics Constants (custom)
export {
  physicsConstantsTool,
  executePhysicsConstants,
  isPhysicsConstantsAvailable,
} from './physics-constants-tool';

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

// Symbolic Math / CAS (nerdamer)
export {
  symbolicMathTool,
  executeSymbolicMath,
  isSymbolicMathAvailable,
} from './symbolic-math-tool';

// ODE Solver (odex)
export { odeSolverTool, executeOdeSolver, isOdeSolverAvailable } from './ode-solver-tool';

// Optimization / LP (javascript-lp-solver)
export {
  optimizationTool,
  executeOptimization,
  isOptimizationAvailable,
} from './optimization-tool';

// Financial Math (financial)
export { financialTool, executeFinancial, isFinancialAvailable } from './financial-tool';

// Music Theory (tonal)
export { musicTheoryTool, executeMusicTheory, isMusicTheoryAvailable } from './music-theory-tool';

// Computational Geometry (delaunator + earcut)
export { geometryTool, executeGeometry, isGeometryAvailable } from './geometry-tool';

// Parser / Grammar (nearley)
export { parserTool, executeParser, isParserAvailable } from './parser-tool';

// Recurrence Rules (rrule)
export { recurrenceTool, executeRecurrence, isRecurrenceAvailable } from './recurrence-tool';

// Constraint Solver (logic-solver)
export { constraintTool, executeConstraint, isConstraintAvailable } from './constraint-tool';

// Time Series Analysis
export { timeseriesTool, executeTimeseries, isTimeseriesAvailable } from './timeseries-tool';

// Tensor / N-dimensional Arrays (ndarray)
export { tensorTool, executeTensor, isTensorAvailable } from './tensor-tool';

// String Distance / Fuzzy Matching (fastest-levenshtein)
export {
  stringDistanceTool,
  executeStringDistance,
  isStringDistanceAvailable,
} from './string-distance-tool';

// ============================================================================
// ADVANCED SCIENTIFIC COMPUTING TOOLS (12 new tools)
// ============================================================================

// Numerical Integration (Simpson's, Gaussian, Romberg)
export {
  numericalIntegrateTool,
  executeNumericalIntegrate,
  isNumericalIntegrateAvailable,
} from './numerical-integrate-tool';

// Root Finding (Newton, Bisection, Brent)
export { rootFinderTool, executeRootFinder, isRootFinderAvailable } from './root-finder-tool';

// Interpolation (Lagrange, Spline, Polynomial)
export {
  interpolationTool,
  executeInterpolation,
  isInterpolationAvailable,
} from './interpolation-tool';

// Special Functions (Gamma, Bessel, erf, Legendre)
export {
  specialFunctionsTool,
  executeSpecialFunctions,
  isSpecialFunctionsAvailable,
} from './special-functions-tool';

// Complex Math (complex.js)
export { complexMathTool, executeComplexMath, isComplexMathAvailable } from './complex-math-tool';

// Combinatorics (js-combinatorics)
export {
  combinatoricsTool,
  executeCombinatorics,
  isCombinatoricsAvailable,
} from './combinatorics-tool';

// Number Theory (big-integer)
export {
  numberTheoryTool,
  executeNumberTheory,
  isNumberTheoryAvailable,
} from './number-theory-tool';

// Probability Distributions
export {
  probabilityDistTool,
  executeProbabilityDist,
  isProbabilityDistAvailable,
} from './probability-dist-tool';

// Polynomial Operations
export {
  polynomialOpsTool,
  executePolynomialOps,
  isPolynomialOpsAvailable,
} from './polynomial-ops-tool';

// Astronomy Calculations (astronomy-engine)
export { astronomyTool, executeAstronomy, isAstronomyAvailable } from './astronomy-tool';

// Coordinate Transformations (proj4)
export {
  coordinateTransformTool,
  executeCoordinateTransform,
  isCoordinateTransformAvailable,
} from './coordinate-transform-tool';

// Sequence Analysis
export {
  sequenceAnalyzeTool,
  executeSequenceAnalyze,
  isSequenceAnalyzeAvailable,
} from './sequence-analyze-tool';

// ============================================================================
// TIER OMEGA - ADVANCED SCIENTIFIC COMPUTING TOOLS (12 new tools)
// ============================================================================

// Machine Learning Toolkit (K-means, PCA, regression, neural networks)
export { mlToolkitTool, executeMLToolkit, isMLToolkitAvailable } from './ml-toolkit-tool';

// Quantum Circuit Simulator (gates, Bell states, Grover's algorithm)
export {
  quantumCircuitTool,
  executeQuantumCircuit,
  isQuantumCircuitAvailable,
} from './quantum-circuit-tool';

// Control Theory (transfer functions, PID tuning, Bode plots)
export {
  controlTheoryTool,
  executeControlTheory,
  isControlTheoryAvailable,
} from './control-theory-tool';

// Monte Carlo Simulation (integration, option pricing, VaR, bootstrap)
export { monteCarloTool, executeMonteCarlo, isMonteCarloAvailable } from './monte-carlo-tool';

// Game Theory Solver (Nash equilibrium, minimax, replicator dynamics)
export { gameTheoryTool, executeGameTheory, isGameTheoryAvailable } from './game-theory-tool';

// Orbital Mechanics (Hohmann transfers, delta-v, orbital elements)
export {
  orbitalMechanicsTool,
  executeOrbitalMechanics,
  isOrbitalMechanicsAvailable,
} from './orbital-mechanics-tool';

// Thermodynamics (gas laws, Carnot cycle, heat transfer)
export {
  thermodynamicsTool,
  executeThermodynamics,
  isThermodynamicsAvailable,
} from './thermodynamics-tool';

// Electromagnetics (E/B fields, transmission lines, antennas)
export { emFieldsTool, executeEMFields, isEMFieldsAvailable } from './em-fields-tool';

// Image Processing (convolution, edge detection, morphology)
export {
  imageComputeTool,
  executeImageCompute,
  isImageComputeAvailable,
} from './image-compute-tool';

// Wavelet Transforms (DWT, CWT, denoising, multi-resolution analysis)
export {
  waveletTransformTool,
  executeWaveletTransform,
  isWaveletTransformAvailable,
} from './wavelet-transform-tool';

// LaTeX Rendering (MathML/SVG output, equation templates)
export { latexRenderTool, executeLatexRender, isLatexRenderAvailable } from './latex-render-tool';

// ============================================================================
// TIER INFINITY - ROCKET SCIENCE & ENGINEERING TOOLS (12 new tools)
// ============================================================================

// Rocket Propulsion (Tsiolkovsky, staging, thrust curves)
export {
  rocketPropulsionTool,
  executeRocketPropulsion,
  isRocketPropulsionAvailable,
} from './rocket-propulsion-tool';

// Fluid Dynamics (Reynolds, Bernoulli, pipe flow, drag)
export {
  fluidDynamicsTool,
  executeFluidDynamics,
  isFluidDynamicsAvailable,
} from './fluid-dynamics-tool';

// Aerodynamics (lift/drag, airfoils, atmosphere)
export {
  aerodynamicsTool,
  executeAerodynamics,
  isAerodynamicsAvailable,
} from './aerodynamics-tool';

// Drone/UAV Flight (hover, endurance, waypoints, battery)
export { droneFlightTool, executeDroneFlight, isDroneFlightAvailable } from './drone-flight-tool';

// Pathfinding Algorithms (A*, Dijkstra, TSP, BFS)
export { pathfinderTool, executePathfinder, isPathfinderAvailable } from './pathfinder-tool';

// Circuit Simulation (RC/RLC, impedance, filters)
export { circuitSimTool, executeCircuitSim, isCircuitSimAvailable } from './circuit-sim-tool';

// Ballistics (projectile motion, drag, wind, Coriolis)
export { ballisticsTool, executeBallistics, isBallisticsAvailable } from './ballistics-tool';

// Genetic Algorithm (evolutionary optimization)
export {
  geneticAlgorithmTool,
  executeGeneticAlgorithm,
  isGeneticAlgorithmAvailable,
} from './genetic-algorithm-tool';

// Chaos Dynamics (Lorenz, Lyapunov, bifurcation, fractals)
export {
  chaosDynamicsTool,
  executeChaosDynamics,
  isChaosDynamicsAvailable,
} from './chaos-dynamics-tool';

// Robotics Kinematics (forward/inverse kinematics, Jacobian)
export {
  roboticsKinematicsTool,
  executeRoboticsKinematics,
  isRoboticsKinematicsAvailable,
} from './robotics-kinematics-tool';

// Optics Simulation (Snell's law, lenses, diffraction)
export { opticsSimTool, executeOpticsSim, isOpticsSimAvailable } from './optics-sim-tool';

// Epidemiology (SIR/SEIR models, R0, herd immunity)
export {
  epidemiologyTool,
  executeEpidemiology,
  isEpidemiologyAvailable,
} from './epidemiology-tool';

// ============================================================================
// TIER BEYOND - ADVANCED ENGINEERING TOOLS (6 bonus tools)
// ============================================================================

// Finite Element Analysis (stress/strain, beams, buckling)
export {
  finiteElementTool,
  executeFiniteElement,
  isFiniteElementAvailable,
} from './finite-element-tool';

// Antenna/RF Engineering (link budgets, path loss, impedance)
export { antennaRfTool, executeAntennaRf, isAntennaRfAvailable } from './antenna-rf-tool';

// Materials Science (crystals, phase diagrams, Hall-Petch)
export {
  materialsScienceTool,
  executeMaterialsScience,
  isMaterialsScienceAvailable,
} from './materials-science-tool';

// Seismology (earthquake magnitude, waves, ground motion)
export { seismologyTool, executeSeismology, isSeismologyAvailable } from './seismology-tool';

// Advanced Bioinformatics (Needleman-Wunsch, Smith-Waterman, phylogenetics)
export {
  bioinformaticsProTool,
  executeBioinformaticsPro,
  isBioinformaticsProAvailable,
} from './bioinformatics-pro-tool';

// Acoustics (room modes, RT60, speaker design)
export { acousticsTool, executeAcoustics, isAcousticsAvailable } from './acoustics-tool';

// ============================================================================
// TIER GODMODE - ULTIMATE INTELLIGENCE TOOLS (9 new tools)
// ============================================================================

// Symbolic Logic - Formal logic, theorem proving, SAT solving
export {
  symbolicLogicTool,
  executeSymbolicLogic,
  isSymbolicLogicAvailable,
} from './symbolic-logic-tool';

// Cellular Automata - Game of Life, Wolfram rules, Langton's Ant
export {
  cellularAutomataTool,
  executeCellularAutomata,
  isCellularAutomataAvailable,
} from './cellular-automata-tool';

// Medical Calculator - Clinical scores, drug dosing, body calculations
export {
  medicalCalcTool,
  executeMedicalCalc,
  isMedicalCalcAvailable,
} from './medical-calc-tool';

// Graphics 3D - 3D mesh generation, OBJ/STL export, scene composition
export {
  graphics3dTool,
  executeGraphics3D,
  isGraphics3DAvailable,
} from './graphics-3d-tool';

// Compression Algorithms - Huffman, LZ77, RLE, BWT demonstrations
export {
  compressionAlgoTool,
  executeCompressionAlgo,
  isCompressionAlgoAvailable,
} from './compression-algo-tool';

// Error Correction - Hamming codes, CRC, checksums, SECDED
export {
  errorCorrectionTool,
  executeErrorCorrection,
  isErrorCorrectionAvailable,
} from './error-correction-tool';

// Hough Vision - Computer vision: edge detection, Hough transform, corners
export {
  houghVisionTool,
  executeHoughVision,
  isHoughVisionAvailable,
} from './hough-vision-tool';

// Cryptography Advanced - Elliptic curves, DH, ECDSA, zero-knowledge proofs
export {
  cryptographyAdvancedTool,
  executeCryptographyAdvanced,
  isCryptographyAdvancedAvailable,
} from './cryptography-advanced-tool';

// Solar Environmental - Solar energy, carbon footprint, sustainability
export {
  solarEnvironmentalTool,
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

// Color Theory - Color manipulation, harmonies, palettes
export {
  colorTheoryTool,
  executeColorTheory,
  isColorTheoryAvailable,
} from './color-theory-tool';

// Animation Easing - Easing functions for smooth animation
export {
  animationEasingTool,
  executeAnimationEasing,
  isAnimationEasingAvailable,
} from './animation-easing-tool';

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

// Bezier Curves - Mathematical bezier curve calculations
export {
  bezierCurvesTool,
  executeBezierCurves,
  isBezierCurvesAvailable,
} from './bezier-curves-tool';

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

// Signal Processing - FFT, filters, DSP
export {
  signalProcessingTool,
  executeSignalProcessing,
  isSignalProcessingAvailable,
} from './signal-processing-tool';

// Neural Network - Educational neural network demonstrations
export {
  neuralNetworkTool,
  executeNeuralNetwork,
  isNeuralNetworkAvailable,
} from './neural-network-tool';

// Information Theory - Entropy, coding, compression bounds
export {
  informationTheoryTool,
  executeInformationTheory,
  isInformationTheoryAvailable,
} from './information-theory-tool';

// Procedural Generation - Terrain, noise, dungeons, mazes
export {
  proceduralGenerationTool,
  executeProceduralGeneration,
  isProceduralGenerationAvailable,
} from './procedural-generation-tool';

// Ray Tracing - 3D graphics ray tracing fundamentals
export {
  rayTracingTool,
  executeRayTracing,
  isRayTracingAvailable,
} from './ray-tracing-tool';

// Automata Theory - DFA, NFA, regex, formal languages
export {
  automataTheoryTool,
  executeAutomataTheory,
  isAutomataTheoryAvailable,
} from './automata-theory-tool';

// Computational Complexity - Big-O, recurrences, algorithm analysis
export {
  computationalComplexityTool,
  executeComputationalComplexity,
  isComputationalComplexityAvailable,
} from './computational-complexity-tool';

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

// Relativity - Lorentz transformations, time dilation
export {
  relativityTool,
  executeRelativity,
  isRelativityAvailable,
} from './relativity-tool';

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
export {
  errorFixerTool,
  executeErrorFixer,
  isErrorFixerAvailable,
} from './error-fixer-tool';

// Refactor Tool - Improve code quality
export {
  refactorTool,
  executeRefactor,
  isRefactorAvailable,
} from './refactor-tool';

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

// GitHub Context Tool - Understand user codebases (Enhancement #4)
export {
  githubContextTool,
  executeGitHubContext,
  isGitHubContextAvailable,
  getRepoSummaryForPrompt,
} from './github-context-tool';

// ============================================================================
// CYBERSECURITY TOOLS (32 tools) - Full Security Operations Suite
// ============================================================================

// Network & Infrastructure Security
export {
  networkSecurityTool,
  executeNetworkSecurity,
  isNetworkSecurityAvailable,
} from './network-security-tool';

export {
  dnsSecurityTool,
  executeDnsSecurity,
  isDnsSecurityAvailable,
} from './dns-security-tool';

export {
  ipSecurityTool,
  executeIpSecurity,
  isIpSecurityAvailable,
} from './ip-security-tool';

export {
  wirelessSecurityTool,
  executeWirelessSecurity,
  isWirelessSecurityAvailable,
} from './wireless-security-tool';

// Application Security
export {
  apiSecurityTool,
  executeApiSecurity,
  isApiSecurityAvailable,
} from './api-security-tool';

export {
  webSecurityTool,
  executeWebSecurity,
  isWebSecurityAvailable,
} from './web-security-tool';

export {
  browserSecurityTool,
  executeBrowserSecurity,
  isBrowserSecurityAvailable,
} from './browser-security-tool';

export {
  mobileSecurityTool,
  executeMobileSecurity,
  isMobileSecurityAvailable,
} from './mobile-security-tool';

// Cloud & Container Security
export {
  cloudSecurityTool,
  executeCloudSecurity,
  isCloudSecurityAvailable,
} from './cloud-security-tool';

export {
  cloudNativeSecurityTool,
  executeCloudNativeSecurity,
  isCloudNativeSecurityAvailable,
} from './cloud-native-security-tool';

export {
  containerSecurityTool,
  executeContainerSecurity,
  isContainerSecurityAvailable,
} from './container-security-tool';

// Data & Identity Security
export {
  dataSecurityTool,
  executeDataSecurity,
  isDataSecurityAvailable,
} from './data-security-tool';

export {
  databaseSecurityTool,
  executeDatabaseSecurity,
  isDatabaseSecurityAvailable,
} from './database-security-tool';

export {
  credentialSecurityTool,
  executeCredentialSecurity,
  isCredentialSecurityAvailable,
} from './credential-security-tool';

export {
  emailSecurityTool,
  executeEmailSecurity,
  isEmailSecurityAvailable,
} from './email-security-tool';

// Endpoint & IoT Security
export {
  endpointSecurityTool,
  executeEndpointSecurity,
  isEndpointSecurityAvailable,
} from './endpoint-security-tool';

export {
  iotSecurityTool,
  executeIotSecurity,
  isIotSecurityAvailable,
} from './iot-security-tool';

export {
  physicalSecurityTool,
  executePhysicalSecurity,
  isPhysicalSecurityAvailable,
} from './physical-security-tool';

// Specialized Security
export {
  blockchainSecurityTool,
  executeBlockchainSecurity,
  isBlockchainSecurityAvailable,
} from './blockchain-security-tool';

export {
  aiSecurityTool,
  executeAiSecurity,
  isAiSecurityAvailable,
} from './ai-security-tool';

export {
  supplyChainSecurityTool,
  executeSupplyChainSecurity,
  isSupplyChainSecurityAvailable,
} from './supply-chain-security-tool';

// Security Operations & Analysis
export {
  securityOperationsTool,
  executeSecurityOperations,
  isSecurityOperationsAvailable,
} from './security-operations-tool';

export {
  securityMetricsTool,
  executeSecurityMetrics,
  isSecurityMetricsAvailable,
} from './security-metrics-tool';

export {
  securityHeadersTool,
  executeSecurityHeaders,
  isSecurityHeadersAvailable,
} from './security-headers-tool';

export {
  securityTestingTool,
  executeSecurityTesting,
  isSecurityTestingAvailable,
} from './security-testing-tool';

export {
  securityAuditTool,
  executeSecurityAudit,
  isSecurityAuditAvailable,
} from './security-audit-tool';

// Security Architecture & Governance
export {
  securityArchitectureTool,
  executeSecurityArchitecture,
  isSecurityArchitectureAvailable,
} from './security-architecture-tool';

export {
  securityArchitecturePatternsTool,
  executeSecurityArchitecturePatterns,
  isSecurityArchitecturePatternsAvailable,
} from './security-architecture-patterns-tool';

export {
  securityPolicyTool,
  executeSecurityPolicy,
  isSecurityPolicyAvailable,
} from './security-policy-tool';

// Security Culture & Awareness
export {
  securityAwarenessTool,
  executeSecurityAwareness,
  isSecurityAwarenessAvailable,
} from './security-awareness-tool';

export {
  securityCultureTool,
  executeSecurityCulture,
  isSecurityCultureAvailable,
} from './security-culture-tool';

export {
  securityBudgetTool,
  executeSecurityBudget,
  isSecurityBudgetAvailable,
} from './security-budget-tool';

// Advanced Cybersecurity (30 more tools)
export { threatHuntingTool, executeThreatHunting, isThreatHuntingAvailable } from './threat-hunting-tool';
export { threatIntelTool, executeThreatIntel, isThreatIntelAvailable } from './threat-intel-tool';
export { threatModelTool, executeThreatModel, isThreatModelAvailable } from './threat-model-tool';
export { threatModelingTool, executeThreatModeling, isThreatModelingAvailable } from './threat-modeling-tool';
export { malwareAnalysisTool, executeMalwareAnalysis, isMalwareAnalysisAvailable } from './malware-analysis-tool';
export { malwareIndicatorsTool, executeMalwareIndicators, isMalwareIndicatorsAvailable } from './malware-indicators-tool';
export { siemTool, executeSiem, isSiemAvailable } from './siem-tool';
export { forensicsTool, executeForensics, isForensicsAvailable } from './forensics-tool';
export { soarTool, executeSoar, isSoarAvailable } from './soar-tool';
export { socTool, executeSoc, isSocAvailable } from './soc-tool';
export { xdrTool, executeXdr, isXdrAvailable } from './xdr-tool';
export { redTeamTool, executeRedTeam, isRedTeamAvailable } from './red-team-tool';
export { blueTeamTool, executeBlueTeam, isBlueTeamAvailable } from './blue-team-tool';
export { osintTool, executeOsint, isOsintAvailable } from './osint-tool';
export { ransomwareDefenseTool, executeRansomwareDefense, isRansomwareDefenseAvailable } from './ransomware-defense-tool';
export { complianceFrameworkTool, executeComplianceFramework, isComplianceFrameworkAvailable } from './compliance-framework-tool';
export { riskManagementTool, executeRiskManagement, isRiskManagementAvailable } from './risk-management-tool';
export { incidentResponseTool, executeIncidentResponse, isIncidentResponseAvailable } from './incident-response-tool';
export { idsIpsTool, executeIdsIps, isIdsIpsAvailable } from './ids-ips-tool';
export { firewallTool, executeFirewall, isFirewallAvailable } from './firewall-tool';
export { honeypotTool, executeHoneypot, isHoneypotAvailable } from './honeypot-tool';
export { penTestTool, executePenTest, isPenTestAvailable } from './pen-test-tool';
export { vulnAssessmentTool, executeVulnAssessment, isVulnAssessmentAvailable } from './vuln-assessment-tool';
export { vulnerabilityScannerTool, executeVulnerabilityScanner, isVulnerabilityScannerAvailable } from './vulnerability-scanner-tool';
export { zeroTrustTool, executeZeroTrust, isZeroTrustAvailable } from './zero-trust-tool';
export { attackSurfaceTool, executeAttackSurface, isAttackSurfaceAvailable } from './attack-surface-tool';
export { networkDefenseTool, executeNetworkDefense, isNetworkDefenseAvailable } from './network-defense-tool';
export { cyberInsuranceTool, executeCyberInsurance, isCyberInsuranceAvailable } from './cyber-insurance-tool';
export { vendorRiskTool, executeVendorRisk, isVendorRiskAvailable } from './vendor-risk-tool';
export { socialEngineeringTool, executeSocialEngineering, isSocialEngineeringAvailable } from './social-engineering-tool';

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
  const { githubTool, executeGitHub, isGitHubAvailable } = await import('./github-tool');
  const { screenshotTool, executeScreenshot, isScreenshotAvailable } = await import(
    './screenshot-tool'
  );
  const { calculatorTool, executeCalculator, isCalculatorAvailable } = await import(
    './calculator-tool'
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
  const { entityExtractionTool, executeEntityExtraction, isEntityExtractionAvailable } =
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
  const { mathTool, executeMath, isMathAvailable } = await import('./math-tool');
  const { exifTool, executeExif, isExifAvailable } = await import('./exif-tool');
  const { searchIndexTool, executeSearchIndex, isSearchIndexAvailable } = await import(
    './search-index-tool'
  );
  const { asciiArtTool, executeAsciiArt, isAsciiArtAvailable } = await import('./ascii-art-tool');
  const { colorTool, executeColor, isColorAvailable } = await import('./color-tool');
  const { validatorTool, executeValidator, isValidatorAvailable } = await import(
    './validator-tool'
  );
  const { cronTool, executeCron, isCronAvailable } = await import('./cron-tool');
  const { unitConvertTool, executeUnitConvert, isUnitConvertAvailable } = await import(
    './unit-convert-tool'
  );
  const { audioSynthTool, executeAudioSynth, isAudioSynthAvailable } = await import(
    './audio-synth-tool'
  );

  // Scientific & Research tools (12 new)
  const { statisticsTool, executeStatistics, isStatisticsAvailable } = await import(
    './statistics-tool'
  );
  const { geospatialTool, executeGeospatial, isGeospatialAvailable } = await import(
    './geospatial-tool'
  );
  const { phoneTool, executePhone, isPhoneAvailable } = await import('./phone-tool');
  const { passwordStrengthTool, executePasswordStrength, isPasswordStrengthAvailable } =
    await import('./password-strength-tool');
  const { chemistryTool, executeChemistry, isChemistryAvailable } = await import(
    './chemistry-tool'
  );
  const { dnaBioTool, executeDnaBio, isDnaBioAvailable } = await import('./dna-bio-tool');
  const { matrixTool, executeMatrix, isMatrixAvailable } = await import('./matrix-tool');
  const { graphTool, executeGraph, isGraphAvailable } = await import('./graph-tool');
  const { periodicTableTool, executePeriodicTable, isPeriodicTableAvailable } = await import(
    './periodic-table-tool'
  );
  const { physicsConstantsTool, executePhysicsConstants, isPhysicsConstantsAvailable } =
    await import('./physics-constants-tool');
  const { signalTool, executeSignal, isSignalAvailable } = await import('./signal-tool');
  const { accessibilityTool, executeAccessibility, isAccessibilityAvailable } = await import(
    './accessibility-tool'
  );

  // Computational & Algorithmic tools (12 new)
  const { symbolicMathTool, executeSymbolicMath, isSymbolicMathAvailable } = await import(
    './symbolic-math-tool'
  );
  const { odeSolverTool, executeOdeSolver, isOdeSolverAvailable } = await import(
    './ode-solver-tool'
  );
  const { optimizationTool, executeOptimization, isOptimizationAvailable } = await import(
    './optimization-tool'
  );
  const { financialTool, executeFinancial, isFinancialAvailable } = await import(
    './financial-tool'
  );
  const { musicTheoryTool, executeMusicTheory, isMusicTheoryAvailable } = await import(
    './music-theory-tool'
  );
  const { geometryTool, executeGeometry, isGeometryAvailable } = await import('./geometry-tool');
  const { parserTool, executeParser, isParserAvailable } = await import('./parser-tool');
  const { recurrenceTool, executeRecurrence, isRecurrenceAvailable } = await import(
    './recurrence-tool'
  );
  const { constraintTool, executeConstraint, isConstraintAvailable } = await import(
    './constraint-tool'
  );
  const { timeseriesTool, executeTimeseries, isTimeseriesAvailable } = await import(
    './timeseries-tool'
  );
  const { tensorTool, executeTensor, isTensorAvailable } = await import('./tensor-tool');
  const { stringDistanceTool, executeStringDistance, isStringDistanceAvailable } = await import(
    './string-distance-tool'
  );

  // Advanced Scientific Computing tools (12 new)
  const { numericalIntegrateTool, executeNumericalIntegrate, isNumericalIntegrateAvailable } =
    await import('./numerical-integrate-tool');
  const { rootFinderTool, executeRootFinder, isRootFinderAvailable } = await import(
    './root-finder-tool'
  );
  const { interpolationTool, executeInterpolation, isInterpolationAvailable } = await import(
    './interpolation-tool'
  );
  const { specialFunctionsTool, executeSpecialFunctions, isSpecialFunctionsAvailable } =
    await import('./special-functions-tool');
  const { complexMathTool, executeComplexMath, isComplexMathAvailable } = await import(
    './complex-math-tool'
  );
  const { combinatoricsTool, executeCombinatorics, isCombinatoricsAvailable } = await import(
    './combinatorics-tool'
  );
  const { numberTheoryTool, executeNumberTheory, isNumberTheoryAvailable } = await import(
    './number-theory-tool'
  );
  const { probabilityDistTool, executeProbabilityDist, isProbabilityDistAvailable } = await import(
    './probability-dist-tool'
  );
  const { polynomialOpsTool, executePolynomialOps, isPolynomialOpsAvailable } = await import(
    './polynomial-ops-tool'
  );
  const { astronomyTool, executeAstronomy, isAstronomyAvailable } = await import(
    './astronomy-tool'
  );
  const { coordinateTransformTool, executeCoordinateTransform, isCoordinateTransformAvailable } =
    await import('./coordinate-transform-tool');
  const { sequenceAnalyzeTool, executeSequenceAnalyze, isSequenceAnalyzeAvailable } = await import(
    './sequence-analyze-tool'
  );

  // Tier Omega - Advanced Scientific Computing tools (12 new)
  const { mlToolkitTool, executeMLToolkit, isMLToolkitAvailable } = await import(
    './ml-toolkit-tool'
  );
  const { quantumCircuitTool, executeQuantumCircuit, isQuantumCircuitAvailable } = await import(
    './quantum-circuit-tool'
  );
  const { controlTheoryTool, executeControlTheory, isControlTheoryAvailable } = await import(
    './control-theory-tool'
  );
  const { monteCarloTool, executeMonteCarlo, isMonteCarloAvailable } = await import(
    './monte-carlo-tool'
  );
  const { gameTheoryTool, executeGameTheory, isGameTheoryAvailable } = await import(
    './game-theory-tool'
  );
  const { orbitalMechanicsTool, executeOrbitalMechanics, isOrbitalMechanicsAvailable } =
    await import('./orbital-mechanics-tool');
  const { thermodynamicsTool, executeThermodynamics, isThermodynamicsAvailable } = await import(
    './thermodynamics-tool'
  );
  const { emFieldsTool, executeEMFields, isEMFieldsAvailable } = await import('./em-fields-tool');
  const { imageComputeTool, executeImageCompute, isImageComputeAvailable } = await import(
    './image-compute-tool'
  );
  const { waveletTransformTool, executeWaveletTransform, isWaveletTransformAvailable } =
    await import('./wavelet-transform-tool');
  const { latexRenderTool, executeLatexRender, isLatexRenderAvailable } = await import(
    './latex-render-tool'
  );

  // Tier Infinity - Rocket Science & Engineering tools (12 new)
  const { rocketPropulsionTool, executeRocketPropulsion, isRocketPropulsionAvailable } =
    await import('./rocket-propulsion-tool');
  const { fluidDynamicsTool, executeFluidDynamics, isFluidDynamicsAvailable } = await import(
    './fluid-dynamics-tool'
  );
  const { aerodynamicsTool, executeAerodynamics, isAerodynamicsAvailable } = await import(
    './aerodynamics-tool'
  );
  const { droneFlightTool, executeDroneFlight, isDroneFlightAvailable } = await import(
    './drone-flight-tool'
  );
  const { pathfinderTool, executePathfinder, isPathfinderAvailable } = await import(
    './pathfinder-tool'
  );
  const { circuitSimTool, executeCircuitSim, isCircuitSimAvailable } = await import(
    './circuit-sim-tool'
  );
  const { ballisticsTool, executeBallistics, isBallisticsAvailable } = await import(
    './ballistics-tool'
  );
  const { geneticAlgorithmTool, executeGeneticAlgorithm, isGeneticAlgorithmAvailable } =
    await import('./genetic-algorithm-tool');
  const { chaosDynamicsTool, executeChaosDynamics, isChaosDynamicsAvailable } = await import(
    './chaos-dynamics-tool'
  );
  const { roboticsKinematicsTool, executeRoboticsKinematics, isRoboticsKinematicsAvailable } =
    await import('./robotics-kinematics-tool');
  const { opticsSimTool, executeOpticsSim, isOpticsSimAvailable } = await import(
    './optics-sim-tool'
  );
  const { epidemiologyTool, executeEpidemiology, isEpidemiologyAvailable } = await import(
    './epidemiology-tool'
  );

  // Tier Beyond - Advanced Engineering tools (6 new)
  const { finiteElementTool, executeFiniteElement, isFiniteElementAvailable } = await import(
    './finite-element-tool'
  );
  const { antennaRfTool, executeAntennaRf, isAntennaRfAvailable } = await import(
    './antenna-rf-tool'
  );
  const { materialsScienceTool, executeMaterialsScience, isMaterialsScienceAvailable } =
    await import('./materials-science-tool');
  const { seismologyTool, executeSeismology, isSeismologyAvailable } = await import(
    './seismology-tool'
  );
  const { bioinformaticsProTool, executeBioinformaticsPro, isBioinformaticsProAvailable } =
    await import('./bioinformatics-pro-tool');
  const { acousticsTool, executeAcoustics, isAcousticsAvailable } = await import(
    './acoustics-tool'
  );

  // Tier GODMODE - Ultimate Intelligence tools (9 new)
  const { symbolicLogicTool, executeSymbolicLogic, isSymbolicLogicAvailable } = await import(
    './symbolic-logic-tool'
  );
  const { cellularAutomataTool, executeCellularAutomata, isCellularAutomataAvailable } =
    await import('./cellular-automata-tool');
  const { medicalCalcTool, executeMedicalCalc, isMedicalCalcAvailable } = await import(
    './medical-calc-tool'
  );
  const { graphics3dTool, executeGraphics3D, isGraphics3DAvailable } = await import(
    './graphics-3d-tool'
  );
  const { compressionAlgoTool, executeCompressionAlgo, isCompressionAlgoAvailable } = await import(
    './compression-algo-tool'
  );
  const { errorCorrectionTool, executeErrorCorrection, isErrorCorrectionAvailable } = await import(
    './error-correction-tool'
  );
  const { houghVisionTool, executeHoughVision, isHoughVisionAvailable } = await import(
    './hough-vision-tool'
  );
  const { cryptographyAdvancedTool, executeCryptographyAdvanced, isCryptographyAdvancedAvailable } =
    await import('./cryptography-advanced-tool');
  const { solarEnvironmentalTool, executeSolarEnvironmental, isSolarEnvironmentalAvailable } =
    await import('./solar-environmental-tool');

  // TIER VISUAL MADNESS - Graphics & Animation Tools
  const { svgGeneratorTool, executeSVGGenerator, isSVGGeneratorAvailable } = await import(
    './svg-generator-tool'
  );
  const { fractalGeneratorTool, executeFractalGenerator, isFractalGeneratorAvailable } = await import(
    './fractal-generator-tool'
  );
  const { colorTheoryTool, executeColorTheory, isColorTheoryAvailable } = await import(
    './color-theory-tool'
  );
  const { animationEasingTool, executeAnimationEasing, isAnimationEasingAvailable } = await import(
    './animation-easing-tool'
  );
  const { particleSystemTool, executeParticleSystem, isParticleSystemAvailable } = await import(
    './particle-system-tool'
  );

  // TIER SOUND & MUSIC - Audio Tools
  // musicTheoryTool already imported in Computational & Algorithmic tools section

  // Additional VISUAL MADNESS
  const { bezierCurvesTool, executeBezierCurves, isBezierCurvesAvailable } = await import(
    './bezier-curves-tool'
  );

  // TIER EDUCATION - Interactive Learning Tools
  const { sortingVisualizerTool, executeSortingVisualizer, isSortingVisualizerAvailable } = await import(
    './sorting-visualizer-tool'
  );
  const { dataStructuresTool, executeDataStructures, isDataStructuresAvailable } = await import(
    './data-structures-tool'
  );

  // TIER ADVANCED SCIENCE - Cutting-Edge Scientific Tools
  const { quantumComputingTool, executeQuantumComputing, isQuantumComputingAvailable } = await import(
    './quantum-computing-tool'
  );
  const { shaderGeneratorTool, executeShaderGenerator, isShaderGeneratorAvailable } = await import(
    './shader-generator-tool'
  );
  const { signalProcessingTool, executeSignalProcessing, isSignalProcessingAvailable } = await import(
    './signal-processing-tool'
  );
  const { neuralNetworkTool, executeNeuralNetwork, isNeuralNetworkAvailable } = await import(
    './neural-network-tool'
  );

  // TIER ADVANCED SCIENCE - Part 2 (5 more tools)
  const { informationTheoryTool, executeInformationTheory, isInformationTheoryAvailable } = await import(
    './information-theory-tool'
  );
  const { proceduralGenerationTool, executeProceduralGeneration, isProceduralGenerationAvailable } = await import(
    './procedural-generation-tool'
  );
  const { rayTracingTool, executeRayTracing, isRayTracingAvailable } = await import(
    './ray-tracing-tool'
  );
  const { automataTheoryTool, executeAutomataTheory, isAutomataTheoryAvailable } = await import(
    './automata-theory-tool'
  );
  const { computationalComplexityTool, executeComputationalComplexity, isComputationalComplexityAvailable } = await import(
    './computational-complexity-tool'
  );

  // TIER PHYSICS & CHEMISTRY - Deep Science Tools (6 new tools)
  const { reactionKineticsTool, executeReactionKinetics, isReactionKineticsAvailable } = await import(
    './reaction-kinetics-tool'
  );
  const { electrochemistryTool, executeElectrochemistry, isElectrochemistryAvailable } = await import(
    './electrochemistry-tool'
  );
  const { spectroscopyTool, executeSpectroscopy, isSpectroscopyAvailable } = await import(
    './spectroscopy-tool'
  );
  const { quantumMechanicsTool, executeQuantumMechanics, isQuantumMechanicsAvailable } = await import(
    './quantum-mechanics-tool'
  );
  const { relativityTool, executeRelativity, isRelativityAvailable } = await import(
    './relativity-tool'
  );
  const { statisticalMechanicsTool, executeStatisticalMechanics, isStatisticalMechanicsAvailable } = await import(
    './statistical-mechanics-tool'
  );

  // TIER ENGINEERING & APPLIED SCIENCE (15 new compact tools)
  const { hydrologyTool, executeHydrology, isHydrologyAvailable } = await import('./hydrology-tool');
  const { structuralEngineeringTool, executeStructuralEngineering, isStructuralEngineeringAvailable } = await import('./structural-engineering-tool');
  const { geotechnicalTool, executeGeotechnical, isGeotechnicalAvailable } = await import('./geotechnical-tool');
  const { photonicsTool, executePhotonics, isPhotonicsAvailable } = await import('./photonics-tool');
  const { semiconductorTool, executeSemiconductor, isSemiconductorAvailable } = await import('./semiconductor-tool');
  const { cosmologyTool, executeCosmology, isCosmologyAvailable } = await import('./cosmology-tool');
  const { crystallographyTool, executeCrystallography, isCrystallographyAvailable } = await import('./crystallography-tool');
  const { polymerChemistryTool, executePolymerChemistry, isPolymerChemistryAvailable } = await import('./polymer-chemistry-tool');
  const { heatTransferTool, executeHeatTransfer, isHeatTransferAvailable } = await import('./heat-transfer-tool');
  const { powerSystemsTool, executePowerSystems, isPowerSystemsAvailable } = await import('./power-systems-tool');
  const { psychologyTool, executePsychology, isPsychologyAvailable } = await import('./psychology-tool');
  const { tribologyTool, executeTribology, isTribologyAvailable } = await import('./tribology-tool');
  const { hvacTool, executeHvac, isHvacAvailable } = await import('./hvac-tool');
  const { surveyingTool, executeSurveying, isSurveyingAvailable } = await import('./surveying-tool');
  const { trafficEngineeringTool, executeTrafficEngineering, isTrafficEngineeringAvailable } = await import('./traffic-engineering-tool');

  // TIER INDUSTRY & APPLIED SCIENCE (20 more compact tools)
  const { biomedicalTool, executeBiomedical, isBiomedicalAvailable } = await import('./biomedical-tool');
  const { roboticsTool, executeRobotics, isRoboticsAvailable } = await import('./robotics-tool');
  const { environmentalTool, executeEnvironmental, isEnvironmentalAvailable } = await import('./environmental-tool');
  const { manufacturingTool, executeManufacturing, isManufacturingAvailable } = await import('./manufacturing-tool');
  const { logisticsTool, executeLogistics, isLogisticsAvailable } = await import('./logistics-tool');
  const { telecommunicationsTool, executeTelecommunications, isTelecommunicationsAvailable } = await import('./telecommunications-tool');
  const { renewableEnergyTool, executeRenewableEnergy, isRenewableEnergyAvailable } = await import('./renewable-energy-tool');
  const { batteryTool, executeBattery, isBatteryAvailable } = await import('./battery-tool');
  const { automotiveTool, executeAutomotive, isAutomotiveAvailable } = await import('./automotive-tool');
  const { aviationTool, executeAviation, isAviationAvailable } = await import('./aviation-tool');
  const { marineTool, executeMarine, isMarineAvailable } = await import('./marine-tool');
  const { miningTool, executeMining, isMiningAvailable } = await import('./mining-tool');
  const { petroleumTool, executePetroleum, isPetroleumAvailable } = await import('./petroleum-tool');
  const { foodScienceTool, executeFoodScience, isFoodScienceAvailable } = await import('./food-science-tool');
  const { textileTool, executeTextile, isTextileAvailable } = await import('./textile-tool');
  const { paperTool, executePaper, isPaperAvailable } = await import('./paper-tool');
  const { ceramicsTool, executeCeramics, isCeramicsAvailable } = await import('./ceramics-tool');
  const { glassTool, executeGlass, isGlassAvailable } = await import('./glass-tool');
  const { compositesTool, executeComposites, isCompositesAvailable } = await import('./composites-tool');
  const { corrosionTool, executeCorrosion, isCorrosionAvailable } = await import('./corrosion-tool');

  // TIER MANUFACTURING PROCESSES (10 more compact tools)
  const { weldingTool, executeWelding, isWeldingAvailable } = await import('./welding-tool');
  const { castingTool, executeCasting, isCastingAvailable } = await import('./casting-tool');
  const { forgingTool, executeForging, isForgingAvailable } = await import('./forging-tool');
  const { extrusionTool, executeExtrusion, isExtrusionAvailable } = await import('./extrusion-tool');
  const { rollingTool, executeRolling, isRollingAvailable } = await import('./rolling-tool');
  const { injectionMoldingTool, executeInjectionMolding, isInjectionMoldingAvailable } = await import('./injection-molding-tool');
  const { cncTool, executeCnc, isCncAvailable } = await import('./cnc-tool');
  const { printingTool, executePrinting, isPrintingAvailable } = await import('./printing-tool');
  const { laserTool, executeLaser, isLaserAvailable } = await import('./laser-tool');
  const { edmTool, executeEdm, isEdmAvailable } = await import('./edm-tool');

  // TIER BUILDING & INDUSTRIAL SYSTEMS (10 more compact tools)
  const { ndtTool, executeNdt, isNdtAvailable } = await import('./ndt-tool');
  const { metrologyTool, executeMetrology, isMetrologyAvailable } = await import('./metrology-tool');
  const { qualityTool, executeQuality, isQualityAvailable } = await import('./quality-tool');
  const { safetyTool, executeSafety, isSafetyAvailable } = await import('./safety-tool');
  const { ergonomicsTool, executeErgonomics, isErgonomicsAvailable } = await import('./ergonomics-tool');
  const { packagingTool, executePackaging, isPackagingAvailable } = await import('./packaging-tool');
  const { plumbingTool, executePlumbing, isPlumbingAvailable } = await import('./plumbing-tool');
  const { fireProtectionTool, executeFireProtection, isFireProtectionAvailable } = await import('./fire-protection-tool');
  const { elevatorTool, executeElevator, isElevatorAvailable } = await import('./elevator-tool');
  const { lightingTool, executeLighting, isLightingAvailable } = await import('./lighting-tool');

  // TIER LIFE SCIENCES (9 more compact tools)
  const { soilScienceTool, executeSoilScience, isSoilScienceAvailable } = await import('./soil-science-tool');
  const { dendrologyTool, executeDendrology, isDendrologyAvailable } = await import('./dendrology-tool');
  const { entomologyTool, executeEntomology, isEntomologyAvailable } = await import('./entomology-tool');
  const { microbiologyTool, executeMicrobiology, isMicrobiologyAvailable } = await import('./microbiology-tool');
  const { virologyTool, executeVirology, isVirologyAvailable } = await import('./virology-tool');
  const { immunologyTool, executeImmunology, isImmunologyAvailable } = await import('./immunology-tool');
  const { toxicologyTool, executeToxicology, isToxicologyAvailable } = await import('./toxicology-tool');
  const { geneticsTool, executeGenetics, isGeneticsAvailable } = await import('./genetics-tool');
  const { proteomicsTool, executeProteomics, isProteomicsAvailable } = await import('./proteomics-tool');

  // TIER EARTH & SOCIAL SCIENCES (9 more compact tools)
  const { climatologyTool, executeClimatology, isClimatologyAvailable } = await import('./climatology-tool');
  const { volcanologyTool, executeVolcanology, isVolcanologyAvailable } = await import('./volcanology-tool');
  const { glaciologyTool, executeGlaciology, isGlaciologyAvailable } = await import('./glaciology-tool');
  const { limnologyTool, executeLimnology, isLimnologyAvailable } = await import('./limnology-tool');
  const { pedologyTool, executePedology, isPedologyAvailable } = await import('./pedology-tool');
  const { paleontologyTool, executePaleontology, isPaleontologyAvailable } = await import('./paleontology-tool');
  const { archaeologyTool, executeArchaeology, isArchaeologyAvailable } = await import('./archaeology-tool');
  const { demographyTool, executeDemography, isDemographyAvailable } = await import('./demography-tool');
  const { cartographyTool, executeCartography, isCartographyAvailable } = await import('./cartography-tool');

  // TIER ADVANCED SCIENCE DOMAINS (7 more compact tools)
  const { nanotechTool, executeNanotech, isNanotechAvailable } = await import('./nanotech-tool');
  const { tribologyAdvancedTool, executeTribologyAdvanced, isTribologyAdvancedAvailable } = await import('./tribology-advanced-tool');
  const { cryogenicsTool, executeCryogenics, isCryogenicsAvailable } = await import('./cryogenics-tool');
  const { biomechanicsTool, executeBiomechanics, isBiomechanicsAvailable } = await import('./biomechanics-tool');
  const { photogrammetryTool, executePhotogrammetry, isPhotogrammetryAvailable } = await import('./photogrammetry-tool');
  const { rheologyTool, executeRheology, isRheologyAvailable } = await import('./rheology-tool');
  const { acousticsAdvancedTool, executeAcousticsAdvanced, isAcousticsAdvancedAvailable } = await import('./acoustics-advanced-tool');

  // TIER ENGINEERING SPECIALTIES (6 more compact tools)
  const { nuclearEngineeringTool, executeNuclearEngineering, isNuclearEngineeringAvailable } = await import('./nuclear-engineering-tool');
  const { vacuumTool, executeVacuum, isVacuumAvailable } = await import('./vacuum-tool');
  const { spectralAnalysisTool, executeSpectralAnalysis, isSpectralAnalysisAvailable } = await import('./spectral-analysis-tool');
  const { vibrationTool, executeVibration, isVibrationAvailable } = await import('./vibration-tool');
  const { fatigueTool, executeFatigue, isFatigueAvailable } = await import('./fatigue-tool');
  const { fermentationTool, executeFermentation, isFermentationAvailable } = await import('./fermentation-tool');

  // TIER CHEMICAL ENGINEERING (5 more compact tools)
  const { electroplatingTool, executeElectroplating, isElectroplatingAvailable } = await import('./electroplating-tool');
  const { chromatographyTool, executeChromatography, isChromatographyAvailable } = await import('./chromatography-tool');
  const { distillationTool, executeDistillation, isDistillationAvailable } = await import('./distillation-tool');
  const { membraneTool, executeMembrane, isMembraneAvailable } = await import('./membrane-tool');
  const { adsorptionTool, executeAdsorption, isAdsorptionAvailable } = await import('./adsorption-tool');

  // TIER PROCESS ENGINEERING (4 more compact tools)
  const { reactorTool, executeReactor, isReactorAvailable } = await import('./reactor-tool');
  const { fluidizationTool, executeFluidization, isFluidizationAvailable } = await import('./fluidization-tool');
  const { dryingTool, executeDrying, isDryingAvailable } = await import('./drying-tool');
  const { extractionTool, executeExtraction, isExtractionAvailable } = await import('./extraction-tool');

  // TIER SEPARATION PROCESSES (4 more compact tools)
  const { crystallizationTool, executeCrystallization, isCrystallizationAvailable } = await import('./crystallization-tool');
  const { mixingTool, executeMixing, isMixingAvailable } = await import('./mixing-tool');
  const { sedimentationTool, executeSedimentation, isSedimentationAvailable } = await import('./sedimentation-tool');
  const { filtrationTool, executeFiltration, isFiltrationAvailable } = await import('./filtration-tool');

  // TIER MASS TRANSFER OPERATIONS (3 more compact tools)
  const { evaporationTool, executeEvaporation, isEvaporationAvailable } = await import('./evaporation-tool');
  const { humidificationTool, executeHumidification, isHumidificationAvailable } = await import('./humidification-tool');
  const { absorptionTool, executeAbsorption, isAbsorptionAvailable } = await import('./absorption-tool');

  // TIER MINERAL PROCESSING (2 more compact tools)
  const { leachingTool, executeLeaching, isLeachingAvailable } = await import('./leaching-tool');
  const { comminutionTool, executeComminution, isComminutionAvailable } = await import('./comminution-tool');

  // TIER ADDITIONAL SCIENCES (15 more compact tools)
  const { agricultureTool, executeAgriculture, isAgricultureAvailable } = await import('./agriculture-tool');
  const { ecologyTool, executeEcology, isEcologyAvailable } = await import('./ecology-tool');
  const { economicsTool, executeEconomics, isEconomicsAvailable } = await import('./economics-tool');
  const { forensicsTool, executeForensics, isForensicsAvailable } = await import('./forensics-tool');
  const { geologyTool, executeGeology, isGeologyAvailable } = await import('./geology-tool');
  const { linguisticsTool, executeLinguistics, isLinguisticsAvailable } = await import('./linguistics-tool');
  const { meteorologyTool, executeMeteorology, isMeteorologyAvailable } = await import('./meteorology-tool');
  const { networkAnalysisTool, executeNetworkAnalysis, isNetworkAnalysisAvailable } = await import('./network-analysis-tool');
  const { nuclearPhysicsTool, executeNuclearPhysics, isNuclearPhysicsAvailable } = await import('./nuclear-physics-tool');
  const { nutritionTool, executeNutrition, isNutritionAvailable } = await import('./nutrition-tool');
  const { oceanographyTool, executeOceanography, isOceanographyAvailable } = await import('./oceanography-tool');
  const { pharmacologyTool, executePharmacology, isPharmacologyAvailable } = await import('./pharmacology-tool');
  const { plasmaPhysicsTool, executePlasmaPhysics, isPlasmaPhysicsAvailable } = await import('./plasma-physics-tool');
  const { vulnerabilityTool, executeVulnerability, isVulnerabilityAvailable } = await import('./vulnerability-tool');
  const { encryptionTool, executeEncryption, isEncryptionAvailable } = await import('./encryption-tool');

  // New science tools batch 3 (5 new tools)
  const { taxonomyTool, executeTaxonomy, isTaxonomyAvailable } = await import('./taxonomy-tool');
  const { petrologyTool, executePetrology, isPetrologyAvailable } = await import('./petrology-tool');
  const { mineralogyTool, executeMineralogy, isMineralogyAvailable } = await import('./mineralogy-tool');
  const { biophysicsTool, executeBiophysics, isBiophysicsAvailable } = await import('./biophysics-tool');
  const { metallurgyTool, executeMetallurgy, isMetallurgyAvailable } = await import('./metallurgy-tool');

  // Cybersecurity tools batch 1 (15 new tools)
  const { hashAnalysisTool, executeHashAnalysis, isHashAnalysisAvailable } = await import('./hash-analysis-tool');
  const { encodingTool, executeEncoding, isEncodingAvailable } = await import('./encoding-tool');
  const { securityMetricsTool, executeSecurityMetrics, isSecurityMetricsAvailable } = await import('./security-metrics-tool');
  const { jwtTool, executeJwt, isJwtAvailable } = await import('./jwt-tool');
  const { ipSecurityTool, executeIpSecurity, isIpSecurityAvailable } = await import('./ip-security-tool');
  const { certificateTool, executeCertificate, isCertificateAvailable } = await import('./certificate-tool');
  const { entropyAnalysisTool, executeEntropyAnalysis, isEntropyAnalysisAvailable } = await import('./entropy-analysis-tool');
  const { securityHeadersTool, executeSecurityHeaders, isSecurityHeadersAvailable } = await import('./security-headers-tool');
  const { malwareIndicatorsTool, executeMalwareIndicators, isMalwareIndicatorsAvailable } = await import('./malware-indicators-tool');
  const { portScannerTool, executePortScanner, isPortScannerAvailable } = await import('./port-scanner-tool');
  const { owaspTool, executeOwasp, isOwaspAvailable } = await import('./owasp-tool');
  const { dnsSecurityTool, executeDnsSecurity, isDnsSecurityAvailable } = await import('./dns-security-tool');
  const { threatModelTool, executeThreatModel, isThreatModelAvailable } = await import('./threat-model-tool');
  const { complianceTool, executeCompliance, isComplianceAvailable } = await import('./compliance-tool');
  const { cipherTool, executeCipher, isCipherAvailable } = await import('./cipher-tool');

  // Cybersecurity tools batch 2 (55 more tools)
  const { authProtocolTool, executeAuthProtocol, isAuthProtocolAvailable } = await import('./auth-protocol-tool');
  const { vulnAssessmentTool, executeVulnAssessment, isVulnAssessmentAvailable } = await import('./vuln-assessment-tool');
  const { incidentResponseTool, executeIncidentResponse, isIncidentResponseAvailable } = await import('./incident-response-tool');
  const { networkSecurityTool, executeNetworkSecurity, isNetworkSecurityAvailable } = await import('./network-security-tool');
  const { firewallTool, executeFirewall, isFirewallAvailable } = await import('./firewall-tool');
  const { idsIpsTool, executeIdsIps, isIdsIpsAvailable } = await import('./ids-ips-tool');
  const { logAnalysisTool, executeLogAnalysis, isLogAnalysisAvailable } = await import('./log-analysis-tool');
  const { penTestTool, executePenTest, isPenTestAvailable } = await import('./pen-test-tool');
  const { socialEngineeringTool, executeSocialEngineering, isSocialEngineeringAvailable } = await import('./social-engineering-tool');
  const { cryptanalysisTool, executeCryptanalysis, isCryptanalysisAvailable } = await import('./cryptanalysis-tool');
  const { secureSdlcTool, executeSecureSdlc, isSecureSdlcAvailable } = await import('./secure-sdlc-tool');
  const { privacyTool, executePrivacy, isPrivacyAvailable } = await import('./privacy-tool');
  const { accessControlTool, executeAccessControl, isAccessControlAvailable } = await import('./access-control-tool');
  const { siemTool, executeSiem, isSiemAvailable } = await import('./siem-tool');
  const { vulnerabilityScannerTool, executeVulnerabilityScanner, isVulnerabilityScannerAvailable } = await import('./vulnerability-scanner-tool');
  const { malwareAnalysisTool, executeMalwareAnalysis, isMalwareAnalysisAvailable } = await import('./malware-analysis-tool');
  const { endpointSecurityTool, executeEndpointSecurity, isEndpointSecurityAvailable } = await import('./endpoint-security-tool');
  const { cloudSecurityTool, executeCloudSecurity, isCloudSecurityAvailable } = await import('./cloud-security-tool');
  const { containerSecurityTool, executeContainerSecurity, isContainerSecurityAvailable } = await import('./container-security-tool');
  const { apiSecurityTool, executeApiSecurity, isApiSecurityAvailable } = await import('./api-security-tool');
  const { mobileSecurityTool, executeMobileSecurity, isMobileSecurityAvailable } = await import('./mobile-security-tool');
  const { iotSecurityTool, executeIotSecurity, isIotSecurityAvailable } = await import('./iot-security-tool');
  const { zeroTrustTool, executeZeroTrust, isZeroTrustAvailable } = await import('./zero-trust-tool');
  const { securityArchitectureTool, executeSecurityArchitecture, isSecurityArchitectureAvailable } = await import('./security-architecture-tool');
  const { riskManagementTool, executeRiskManagement, isRiskManagementAvailable } = await import('./risk-management-tool');
  const { businessContinuityTool, executeBusinessContinuity, isBusinessContinuityAvailable } = await import('./business-continuity-tool');
  const { securityAwarenessTool, executeSecurityAwareness, isSecurityAwarenessAvailable } = await import('./security-awareness-tool');
  const { threatIntelTool, executeThreatIntel, isThreatIntelAvailable } = await import('./threat-intel-tool');
  const { devsecOpsTool, executeDevsecOps, isDevsecOpsAvailable } = await import('./devsecops-tool');
  const { blockchainSecurityTool, executeBlockchainSecurity, isBlockchainSecurityAvailable } = await import('./blockchain-security-tool');
  const { wirelessSecurityTool, executeWirelessSecurity, isWirelessSecurityAvailable } = await import('./wireless-security-tool');
  const { vpnTool, executeVpn, isVpnAvailable } = await import('./vpn-tool');
  const { pkiTool, executePki, isPkiAvailable } = await import('./pki-tool');
  const { dataLossPreventionTool, executeDataLossPrevention, isDataLossPreventionAvailable } = await import('./data-loss-prevention-tool');
  const { redTeamTool, executeRedTeam, isRedTeamAvailable } = await import('./red-team-tool');
  const { blueTeamTool, executeBlueTeam, isBlueTeamAvailable } = await import('./blue-team-tool');
  const { socTool, executeSoc, isSocAvailable } = await import('./soc-tool');
  const { identityManagementTool, executeIdentityManagement, isIdentityManagementAvailable } = await import('./identity-management-tool');
  const { emailSecurityTool, executeEmailSecurity, isEmailSecurityAvailable } = await import('./email-security-tool');
  const { vendorRiskTool, executeVendorRisk, isVendorRiskAvailable } = await import('./vendor-risk-tool');
  const { patchManagementTool, executePatchManagement, isPatchManagementAvailable } = await import('./patch-management-tool');
  const { threatHuntingTool, executeThreatHunting, isThreatHuntingAvailable } = await import('./threat-hunting-tool');
  const { osintTool, executeOsint, isOsintAvailable } = await import('./osint-tool');
  const { ransomwareDefenseTool, executeRansomwareDefense, isRansomwareDefenseAvailable } = await import('./ransomware-defense-tool');
  const { credentialSecurityTool, executeCredentialSecurity, isCredentialSecurityAvailable } = await import('./credential-security-tool');
  const { databaseSecurityTool, executeDatabaseSecurity, isDatabaseSecurityAvailable } = await import('./database-security-tool');
  const { scadaIcsTool, executeScadaIcs, isScadaIcsAvailable } = await import('./scada-ics-tool');
  const { attackSurfaceTool, executeAttackSurface, isAttackSurfaceAvailable } = await import('./attack-surface-tool');
  const { dataClassificationTool, executeDataClassification, isDataClassificationAvailable } = await import('./data-classification-tool');
  const { keyManagementTool, executeKeyManagement, isKeyManagementAvailable } = await import('./key-management-tool');
  const { securityPolicyTool, executeSecurityPolicy, isSecurityPolicyAvailable } = await import('./security-policy-tool');
  const { securityAuditTool, executeSecurityAudit, isSecurityAuditAvailable } = await import('./security-audit-tool');
  const { assetManagementTool, executeAssetManagement, isAssetManagementAvailable } = await import('./asset-management-tool');
  // Additional security tools batch 3 (13 more tools)
  const { honeypotTool, executeHoneypot, isHoneypotAvailable } = await import('./honeypot-tool');
  const { complianceFrameworkTool, executeComplianceFramework, isComplianceFrameworkAvailable } = await import('./compliance-framework-tool');
  const { securityArchitecturePatternsTool, executeSecurityArchitecturePatterns, isSecurityArchitecturePatternsAvailable } = await import('./security-architecture-patterns-tool');
  const { soarTool, executeSoar, isSoarAvailable } = await import('./soar-tool');
  const { supplyChainSecurityTool, executeSupplyChainSecurity, isSupplyChainSecurityAvailable } = await import('./supply-chain-security-tool');
  const { webSecurityTool, executeWebSecurity, isWebSecurityAvailable } = await import('./web-security-tool');
  const { networkDefenseTool, executeNetworkDefense, isNetworkDefenseAvailable } = await import('./network-defense-tool');
  const { secretsManagementTool, executeSecretsManagement, isSecretsManagementAvailable } = await import('./secrets-management-tool');
  const { xdrTool, executeXdr, isXdrAvailable } = await import('./xdr-tool');
  const { privacyEngineeringTool, executePrivacyEngineering, isPrivacyEngineeringAvailable } = await import('./privacy-engineering-tool');
  const { secureCommunicationsTool, executeSecureCommunications, isSecureCommunicationsAvailable } = await import('./secure-communications-tool');
  const { securityTestingTool, executeSecurityTesting, isSecurityTestingAvailable } = await import('./security-testing-tool');
  const { industrialControlTool, executeIndustrialControl, isIndustrialControlAvailable } = await import('./industrial-control-tool');
  const { cloudNativeSecurityTool, executeCloudNativeSecurity, isCloudNativeSecurityAvailable } = await import('./cloud-native-security-tool');
  const { browserSecurityTool, executeBrowserSecurity, isBrowserSecurityAvailable } = await import('./browser-security-tool');
  const { physicalSecurityTool, executePhysicalSecurity, isPhysicalSecurityAvailable } = await import('./physical-security-tool');
  const { securityOperationsTool, executeSecurityOperations, isSecurityOperationsAvailable } = await import('./security-operations-tool');
  const { threatModelingTool, executeThreatModeling, isThreatModelingAvailable } = await import('./threat-modeling-tool');
  const { aiSecurityTool, executeAiSecurity, isAiSecurityAvailable } = await import('./ai-security-tool');
  const { securityCultureTool, executeSecurityCulture, isSecurityCultureAvailable } = await import('./security-culture-tool');
  const { logManagementTool, executeLogManagement, isLogManagementAvailable } = await import('./log-management-tool');
  const { authenticationTool, executeAuthentication, isAuthenticationAvailable } = await import('./authentication-tool');
  const { backupRecoveryTool, executeBackupRecovery, isBackupRecoveryAvailable } = await import('./backup-recovery-tool');
  // Additional security tools batch 4
  const { securityBudgetTool, executeSecurityBudget, isSecurityBudgetAvailable } = await import('./security-budget-tool');
  const { cyberInsuranceTool, executeCyberInsurance, isCyberInsuranceAvailable } = await import('./cyber-insurance-tool');
  const { saseTool, executeSase, isSaseAvailable } = await import('./sase-tool');
  const { identityGovernanceTool, executeIdentityGovernance, isIdentityGovernanceAvailable } = await import('./identity-governance-tool');
  const { dataSecurityTool, executeDataSecurity, isDataSecurityAvailable } = await import('./data-security-tool');

  // ============================================================================
  // CODE AGENT BRAIN TOOLS - Full coding capabilities
  // ============================================================================
  const { workspaceTool, executeWorkspace, isWorkspaceAvailable } = await import('./workspace-tool');
  const { codeGenerationTool, executeCodeGeneration, isCodeGenerationAvailable } = await import('./code-generation-tool');
  const { codeAnalysisTool, executeCodeAnalysis, isCodeAnalysisAvailable } = await import('./code-analysis-tool');
  const { projectBuilderTool, executeProjectBuilder, isProjectBuilderAvailable } = await import('./project-builder-tool');
  const { testGeneratorTool, executeTestGenerator, isTestGeneratorAvailable } = await import('./test-generator-tool');
  const { errorFixerTool, executeErrorFixer, isErrorFixerAvailable } = await import('./error-fixer-tool');
  const { refactorTool, executeRefactor, isRefactorAvailable } = await import('./refactor-tool');
  const { docGeneratorTool, executeDocGenerator, isDocGeneratorAvailable } = await import('./doc-generator-tool');

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
    { tool: githubTool, executor: executeGitHub, checkAvailability: isGitHubAvailable },
    { tool: screenshotTool, executor: executeScreenshot, checkAvailability: isScreenshotAvailable },
    { tool: calculatorTool, executor: executeCalculator, checkAvailability: isCalculatorAvailable },
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
    {
      tool: entityExtractionTool,
      executor: executeEntityExtraction,
      checkAvailability: isEntityExtractionAvailable,
    },
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
    { tool: mathTool, executor: executeMath, checkAvailability: isMathAvailable },
    { tool: exifTool, executor: executeExif, checkAvailability: isExifAvailable },
    {
      tool: searchIndexTool,
      executor: executeSearchIndex,
      checkAvailability: isSearchIndexAvailable,
    },
    { tool: asciiArtTool, executor: executeAsciiArt, checkAvailability: isAsciiArtAvailable },
    { tool: colorTool, executor: executeColor, checkAvailability: isColorAvailable },
    { tool: validatorTool, executor: executeValidator, checkAvailability: isValidatorAvailable },
    { tool: cronTool, executor: executeCron, checkAvailability: isCronAvailable },
    {
      tool: unitConvertTool,
      executor: executeUnitConvert,
      checkAvailability: isUnitConvertAvailable,
    },
    { tool: audioSynthTool, executor: executeAudioSynth, checkAvailability: isAudioSynthAvailable },
    // Scientific & Research tools (12 new)
    { tool: statisticsTool, executor: executeStatistics, checkAvailability: isStatisticsAvailable },
    { tool: geospatialTool, executor: executeGeospatial, checkAvailability: isGeospatialAvailable },
    { tool: phoneTool, executor: executePhone, checkAvailability: isPhoneAvailable },
    {
      tool: passwordStrengthTool,
      executor: executePasswordStrength,
      checkAvailability: isPasswordStrengthAvailable,
    },
    { tool: chemistryTool, executor: executeChemistry, checkAvailability: isChemistryAvailable },
    { tool: dnaBioTool, executor: executeDnaBio, checkAvailability: isDnaBioAvailable },
    { tool: matrixTool, executor: executeMatrix, checkAvailability: isMatrixAvailable },
    { tool: graphTool, executor: executeGraph, checkAvailability: isGraphAvailable },
    {
      tool: periodicTableTool,
      executor: executePeriodicTable,
      checkAvailability: isPeriodicTableAvailable,
    },
    {
      tool: physicsConstantsTool,
      executor: executePhysicsConstants,
      checkAvailability: isPhysicsConstantsAvailable,
    },
    { tool: signalTool, executor: executeSignal, checkAvailability: isSignalAvailable },
    {
      tool: accessibilityTool,
      executor: executeAccessibility,
      checkAvailability: isAccessibilityAvailable,
    },
    // Computational & Algorithmic tools (12 new)
    {
      tool: symbolicMathTool,
      executor: executeSymbolicMath,
      checkAvailability: isSymbolicMathAvailable,
    },
    { tool: odeSolverTool, executor: executeOdeSolver, checkAvailability: isOdeSolverAvailable },
    {
      tool: optimizationTool,
      executor: executeOptimization,
      checkAvailability: isOptimizationAvailable,
    },
    { tool: financialTool, executor: executeFinancial, checkAvailability: isFinancialAvailable },
    {
      tool: musicTheoryTool,
      executor: executeMusicTheory,
      checkAvailability: isMusicTheoryAvailable,
    },
    { tool: geometryTool, executor: executeGeometry, checkAvailability: isGeometryAvailable },
    { tool: parserTool, executor: executeParser, checkAvailability: isParserAvailable },
    {
      tool: recurrenceTool,
      executor: executeRecurrence,
      checkAvailability: isRecurrenceAvailable,
    },
    {
      tool: constraintTool,
      executor: executeConstraint,
      checkAvailability: isConstraintAvailable,
    },
    {
      tool: timeseriesTool,
      executor: executeTimeseries,
      checkAvailability: isTimeseriesAvailable,
    },
    { tool: tensorTool, executor: executeTensor, checkAvailability: isTensorAvailable },
    {
      tool: stringDistanceTool,
      executor: executeStringDistance,
      checkAvailability: isStringDistanceAvailable,
    },
    // Advanced Scientific Computing tools (12 new)
    {
      tool: numericalIntegrateTool,
      executor: executeNumericalIntegrate,
      checkAvailability: isNumericalIntegrateAvailable,
    },
    { tool: rootFinderTool, executor: executeRootFinder, checkAvailability: isRootFinderAvailable },
    {
      tool: interpolationTool,
      executor: executeInterpolation,
      checkAvailability: isInterpolationAvailable,
    },
    {
      tool: specialFunctionsTool,
      executor: executeSpecialFunctions,
      checkAvailability: isSpecialFunctionsAvailable,
    },
    {
      tool: complexMathTool,
      executor: executeComplexMath,
      checkAvailability: isComplexMathAvailable,
    },
    {
      tool: combinatoricsTool,
      executor: executeCombinatorics,
      checkAvailability: isCombinatoricsAvailable,
    },
    {
      tool: numberTheoryTool,
      executor: executeNumberTheory,
      checkAvailability: isNumberTheoryAvailable,
    },
    {
      tool: probabilityDistTool,
      executor: executeProbabilityDist,
      checkAvailability: isProbabilityDistAvailable,
    },
    {
      tool: polynomialOpsTool,
      executor: executePolynomialOps,
      checkAvailability: isPolynomialOpsAvailable,
    },
    { tool: astronomyTool, executor: executeAstronomy, checkAvailability: isAstronomyAvailable },
    {
      tool: coordinateTransformTool,
      executor: executeCoordinateTransform,
      checkAvailability: isCoordinateTransformAvailable,
    },
    {
      tool: sequenceAnalyzeTool,
      executor: executeSequenceAnalyze,
      checkAvailability: isSequenceAnalyzeAvailable,
    },
    // Tier Omega - Advanced Scientific Computing tools (12 new)
    { tool: mlToolkitTool, executor: executeMLToolkit, checkAvailability: isMLToolkitAvailable },
    {
      tool: quantumCircuitTool,
      executor: executeQuantumCircuit,
      checkAvailability: isQuantumCircuitAvailable,
    },
    {
      tool: controlTheoryTool,
      executor: executeControlTheory,
      checkAvailability: isControlTheoryAvailable,
    },
    { tool: monteCarloTool, executor: executeMonteCarlo, checkAvailability: isMonteCarloAvailable },
    { tool: gameTheoryTool, executor: executeGameTheory, checkAvailability: isGameTheoryAvailable },
    {
      tool: orbitalMechanicsTool,
      executor: executeOrbitalMechanics,
      checkAvailability: isOrbitalMechanicsAvailable,
    },
    {
      tool: thermodynamicsTool,
      executor: executeThermodynamics,
      checkAvailability: isThermodynamicsAvailable,
    },
    { tool: emFieldsTool, executor: executeEMFields, checkAvailability: isEMFieldsAvailable },
    {
      tool: imageComputeTool,
      executor: executeImageCompute,
      checkAvailability: isImageComputeAvailable,
    },
    {
      tool: waveletTransformTool,
      executor: executeWaveletTransform,
      checkAvailability: isWaveletTransformAvailable,
    },
    {
      tool: latexRenderTool,
      executor: executeLatexRender,
      checkAvailability: isLatexRenderAvailable,
    },
    // Tier Infinity - Rocket Science & Engineering tools (12 new)
    {
      tool: rocketPropulsionTool,
      executor: executeRocketPropulsion,
      checkAvailability: isRocketPropulsionAvailable,
    },
    {
      tool: fluidDynamicsTool,
      executor: executeFluidDynamics,
      checkAvailability: isFluidDynamicsAvailable,
    },
    {
      tool: aerodynamicsTool,
      executor: executeAerodynamics,
      checkAvailability: isAerodynamicsAvailable,
    },
    {
      tool: droneFlightTool,
      executor: executeDroneFlight,
      checkAvailability: isDroneFlightAvailable,
    },
    {
      tool: pathfinderTool,
      executor: executePathfinder,
      checkAvailability: isPathfinderAvailable,
    },
    {
      tool: circuitSimTool,
      executor: executeCircuitSim,
      checkAvailability: isCircuitSimAvailable,
    },
    {
      tool: ballisticsTool,
      executor: executeBallistics,
      checkAvailability: isBallisticsAvailable,
    },
    {
      tool: geneticAlgorithmTool,
      executor: executeGeneticAlgorithm,
      checkAvailability: isGeneticAlgorithmAvailable,
    },
    {
      tool: chaosDynamicsTool,
      executor: executeChaosDynamics,
      checkAvailability: isChaosDynamicsAvailable,
    },
    {
      tool: roboticsKinematicsTool,
      executor: executeRoboticsKinematics,
      checkAvailability: isRoboticsKinematicsAvailable,
    },
    {
      tool: opticsSimTool,
      executor: executeOpticsSim,
      checkAvailability: isOpticsSimAvailable,
    },
    {
      tool: epidemiologyTool,
      executor: executeEpidemiology,
      checkAvailability: isEpidemiologyAvailable,
    },
    // Tier Beyond - Advanced Engineering tools (6 new)
    {
      tool: finiteElementTool,
      executor: executeFiniteElement,
      checkAvailability: isFiniteElementAvailable,
    },
    {
      tool: antennaRfTool,
      executor: executeAntennaRf,
      checkAvailability: isAntennaRfAvailable,
    },
    {
      tool: materialsScienceTool,
      executor: executeMaterialsScience,
      checkAvailability: isMaterialsScienceAvailable,
    },
    {
      tool: seismologyTool,
      executor: executeSeismology,
      checkAvailability: isSeismologyAvailable,
    },
    {
      tool: bioinformaticsProTool,
      executor: executeBioinformaticsPro,
      checkAvailability: isBioinformaticsProAvailable,
    },
    {
      tool: acousticsTool,
      executor: executeAcoustics,
      checkAvailability: isAcousticsAvailable,
    },
    // Tier GODMODE - Ultimate Intelligence tools (9 new)
    {
      tool: symbolicLogicTool,
      executor: executeSymbolicLogic,
      checkAvailability: isSymbolicLogicAvailable,
    },
    {
      tool: cellularAutomataTool,
      executor: executeCellularAutomata,
      checkAvailability: isCellularAutomataAvailable,
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
      tool: compressionAlgoTool,
      executor: executeCompressionAlgo,
      checkAvailability: isCompressionAlgoAvailable,
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
    {
      tool: cryptographyAdvancedTool,
      executor: executeCryptographyAdvanced,
      checkAvailability: isCryptographyAdvancedAvailable,
    },
    {
      tool: solarEnvironmentalTool,
      executor: executeSolarEnvironmental,
      checkAvailability: isSolarEnvironmentalAvailable,
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
      tool: colorTheoryTool,
      executor: executeColorTheory,
      checkAvailability: isColorTheoryAvailable,
    },
    {
      tool: animationEasingTool,
      executor: executeAnimationEasing,
      checkAvailability: isAnimationEasingAvailable,
    },
    {
      tool: particleSystemTool,
      executor: executeParticleSystem,
      checkAvailability: isParticleSystemAvailable,
    },
    // TIER SOUND & MUSIC - Audio Tools
    // musicTheoryTool already registered in Computational & Algorithmic tools section
    // Additional VISUAL MADNESS
    {
      tool: bezierCurvesTool,
      executor: executeBezierCurves,
      checkAvailability: isBezierCurvesAvailable,
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
      tool: signalProcessingTool,
      executor: executeSignalProcessing,
      checkAvailability: isSignalProcessingAvailable,
    },
    {
      tool: neuralNetworkTool,
      executor: executeNeuralNetwork,
      checkAvailability: isNeuralNetworkAvailable,
    },
    // TIER ADVANCED SCIENCE - Part 2 (5 more tools)
    {
      tool: informationTheoryTool,
      executor: executeInformationTheory,
      checkAvailability: isInformationTheoryAvailable,
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
    {
      tool: computationalComplexityTool,
      executor: executeComputationalComplexity,
      checkAvailability: isComputationalComplexityAvailable,
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
      tool: relativityTool,
      executor: executeRelativity,
      checkAvailability: isRelativityAvailable,
    },
    {
      tool: statisticalMechanicsTool,
      executor: executeStatisticalMechanics,
      checkAvailability: isStatisticalMechanicsAvailable,
    },
    // TIER ENGINEERING & APPLIED SCIENCE (15 new compact tools)
    { tool: hydrologyTool, executor: executeHydrology, checkAvailability: isHydrologyAvailable },
    { tool: structuralEngineeringTool, executor: executeStructuralEngineering, checkAvailability: isStructuralEngineeringAvailable },
    { tool: geotechnicalTool, executor: executeGeotechnical, checkAvailability: isGeotechnicalAvailable },
    { tool: photonicsTool, executor: executePhotonics, checkAvailability: isPhotonicsAvailable },
    { tool: semiconductorTool, executor: executeSemiconductor, checkAvailability: isSemiconductorAvailable },
    { tool: cosmologyTool, executor: executeCosmology, checkAvailability: isCosmologyAvailable },
    { tool: crystallographyTool, executor: executeCrystallography, checkAvailability: isCrystallographyAvailable },
    { tool: polymerChemistryTool, executor: executePolymerChemistry, checkAvailability: isPolymerChemistryAvailable },
    { tool: heatTransferTool, executor: executeHeatTransfer, checkAvailability: isHeatTransferAvailable },
    { tool: powerSystemsTool, executor: executePowerSystems, checkAvailability: isPowerSystemsAvailable },
    { tool: psychologyTool, executor: executePsychology, checkAvailability: isPsychologyAvailable },
    { tool: tribologyTool, executor: executeTribology, checkAvailability: isTribologyAvailable },
    { tool: hvacTool, executor: executeHvac, checkAvailability: isHvacAvailable },
    { tool: surveyingTool, executor: executeSurveying, checkAvailability: isSurveyingAvailable },
    { tool: trafficEngineeringTool, executor: executeTrafficEngineering, checkAvailability: isTrafficEngineeringAvailable },
    // TIER INDUSTRY & APPLIED SCIENCE (20 more compact tools)
    { tool: biomedicalTool, executor: executeBiomedical, checkAvailability: isBiomedicalAvailable },
    { tool: roboticsTool, executor: executeRobotics, checkAvailability: isRoboticsAvailable },
    { tool: environmentalTool, executor: executeEnvironmental, checkAvailability: isEnvironmentalAvailable },
    { tool: manufacturingTool, executor: executeManufacturing, checkAvailability: isManufacturingAvailable },
    { tool: logisticsTool, executor: executeLogistics, checkAvailability: isLogisticsAvailable },
    { tool: telecommunicationsTool, executor: executeTelecommunications, checkAvailability: isTelecommunicationsAvailable },
    { tool: renewableEnergyTool, executor: executeRenewableEnergy, checkAvailability: isRenewableEnergyAvailable },
    { tool: batteryTool, executor: executeBattery, checkAvailability: isBatteryAvailable },
    { tool: automotiveTool, executor: executeAutomotive, checkAvailability: isAutomotiveAvailable },
    { tool: aviationTool, executor: executeAviation, checkAvailability: isAviationAvailable },
    { tool: marineTool, executor: executeMarine, checkAvailability: isMarineAvailable },
    { tool: miningTool, executor: executeMining, checkAvailability: isMiningAvailable },
    { tool: petroleumTool, executor: executePetroleum, checkAvailability: isPetroleumAvailable },
    { tool: foodScienceTool, executor: executeFoodScience, checkAvailability: isFoodScienceAvailable },
    { tool: textileTool, executor: executeTextile, checkAvailability: isTextileAvailable },
    { tool: paperTool, executor: executePaper, checkAvailability: isPaperAvailable },
    { tool: ceramicsTool, executor: executeCeramics, checkAvailability: isCeramicsAvailable },
    { tool: glassTool, executor: executeGlass, checkAvailability: isGlassAvailable },
    { tool: compositesTool, executor: executeComposites, checkAvailability: isCompositesAvailable },
    { tool: corrosionTool, executor: executeCorrosion, checkAvailability: isCorrosionAvailable },
    // TIER MANUFACTURING PROCESSES (10 more compact tools)
    { tool: weldingTool, executor: executeWelding, checkAvailability: isWeldingAvailable },
    { tool: castingTool, executor: executeCasting, checkAvailability: isCastingAvailable },
    { tool: forgingTool, executor: executeForging, checkAvailability: isForgingAvailable },
    { tool: extrusionTool, executor: executeExtrusion, checkAvailability: isExtrusionAvailable },
    { tool: rollingTool, executor: executeRolling, checkAvailability: isRollingAvailable },
    { tool: injectionMoldingTool, executor: executeInjectionMolding, checkAvailability: isInjectionMoldingAvailable },
    { tool: cncTool, executor: executeCnc, checkAvailability: isCncAvailable },
    { tool: printingTool, executor: executePrinting, checkAvailability: isPrintingAvailable },
    { tool: laserTool, executor: executeLaser, checkAvailability: isLaserAvailable },
    { tool: edmTool, executor: executeEdm, checkAvailability: isEdmAvailable },
    // TIER BUILDING & INDUSTRIAL SYSTEMS (10 more compact tools)
    { tool: ndtTool, executor: executeNdt, checkAvailability: isNdtAvailable },
    { tool: metrologyTool, executor: executeMetrology, checkAvailability: isMetrologyAvailable },
    { tool: qualityTool, executor: executeQuality, checkAvailability: isQualityAvailable },
    { tool: safetyTool, executor: executeSafety, checkAvailability: isSafetyAvailable },
    { tool: ergonomicsTool, executor: executeErgonomics, checkAvailability: isErgonomicsAvailable },
    { tool: packagingTool, executor: executePackaging, checkAvailability: isPackagingAvailable },
    { tool: plumbingTool, executor: executePlumbing, checkAvailability: isPlumbingAvailable },
    { tool: fireProtectionTool, executor: executeFireProtection, checkAvailability: isFireProtectionAvailable },
    { tool: elevatorTool, executor: executeElevator, checkAvailability: isElevatorAvailable },
    { tool: lightingTool, executor: executeLighting, checkAvailability: isLightingAvailable },
    // TIER LIFE SCIENCES (9 more compact tools)
    { tool: soilScienceTool, executor: executeSoilScience, checkAvailability: isSoilScienceAvailable },
    { tool: dendrologyTool, executor: executeDendrology, checkAvailability: isDendrologyAvailable },
    { tool: entomologyTool, executor: executeEntomology, checkAvailability: isEntomologyAvailable },
    { tool: microbiologyTool, executor: executeMicrobiology, checkAvailability: isMicrobiologyAvailable },
    { tool: virologyTool, executor: executeVirology, checkAvailability: isVirologyAvailable },
    { tool: immunologyTool, executor: executeImmunology, checkAvailability: isImmunologyAvailable },
    { tool: toxicologyTool, executor: executeToxicology, checkAvailability: isToxicologyAvailable },
    { tool: geneticsTool, executor: executeGenetics, checkAvailability: isGeneticsAvailable },
    { tool: proteomicsTool, executor: executeProteomics, checkAvailability: isProteomicsAvailable },
    // TIER EARTH & SOCIAL SCIENCES (9 more compact tools)
    { tool: climatologyTool, executor: executeClimatology, checkAvailability: isClimatologyAvailable },
    { tool: volcanologyTool, executor: executeVolcanology, checkAvailability: isVolcanologyAvailable },
    { tool: glaciologyTool, executor: executeGlaciology, checkAvailability: isGlaciologyAvailable },
    { tool: limnologyTool, executor: executeLimnology, checkAvailability: isLimnologyAvailable },
    { tool: pedologyTool, executor: executePedology, checkAvailability: isPedologyAvailable },
    { tool: paleontologyTool, executor: executePaleontology, checkAvailability: isPaleontologyAvailable },
    { tool: archaeologyTool, executor: executeArchaeology, checkAvailability: isArchaeologyAvailable },
    { tool: demographyTool, executor: executeDemography, checkAvailability: isDemographyAvailable },
    { tool: cartographyTool, executor: executeCartography, checkAvailability: isCartographyAvailable },
    // TIER ADVANCED SCIENCE DOMAINS (7 more compact tools)
    { tool: nanotechTool, executor: executeNanotech, checkAvailability: isNanotechAvailable },
    { tool: tribologyAdvancedTool, executor: executeTribologyAdvanced, checkAvailability: isTribologyAdvancedAvailable },
    { tool: cryogenicsTool, executor: executeCryogenics, checkAvailability: isCryogenicsAvailable },
    { tool: biomechanicsTool, executor: executeBiomechanics, checkAvailability: isBiomechanicsAvailable },
    { tool: photogrammetryTool, executor: executePhotogrammetry, checkAvailability: isPhotogrammetryAvailable },
    { tool: rheologyTool, executor: executeRheology, checkAvailability: isRheologyAvailable },
    { tool: acousticsAdvancedTool, executor: executeAcousticsAdvanced, checkAvailability: isAcousticsAdvancedAvailable },
    // TIER ENGINEERING SPECIALTIES (6 more compact tools)
    { tool: nuclearEngineeringTool, executor: executeNuclearEngineering, checkAvailability: isNuclearEngineeringAvailable },
    { tool: vacuumTool, executor: executeVacuum, checkAvailability: isVacuumAvailable },
    { tool: spectralAnalysisTool, executor: executeSpectralAnalysis, checkAvailability: isSpectralAnalysisAvailable },
    { tool: vibrationTool, executor: executeVibration, checkAvailability: isVibrationAvailable },
    { tool: fatigueTool, executor: executeFatigue, checkAvailability: isFatigueAvailable },
    { tool: fermentationTool, executor: executeFermentation, checkAvailability: isFermentationAvailable },
    // TIER CHEMICAL ENGINEERING (5 more compact tools)
    { tool: electroplatingTool, executor: executeElectroplating, checkAvailability: isElectroplatingAvailable },
    { tool: chromatographyTool, executor: executeChromatography, checkAvailability: isChromatographyAvailable },
    { tool: distillationTool, executor: executeDistillation, checkAvailability: isDistillationAvailable },
    { tool: membraneTool, executor: executeMembrane, checkAvailability: isMembraneAvailable },
    { tool: adsorptionTool, executor: executeAdsorption, checkAvailability: isAdsorptionAvailable },
    // TIER PROCESS ENGINEERING (4 more compact tools)
    { tool: reactorTool, executor: executeReactor, checkAvailability: isReactorAvailable },
    { tool: fluidizationTool, executor: executeFluidization, checkAvailability: isFluidizationAvailable },
    { tool: dryingTool, executor: executeDrying, checkAvailability: isDryingAvailable },
    { tool: extractionTool, executor: executeExtraction, checkAvailability: isExtractionAvailable },
    // TIER SEPARATION PROCESSES (4 more compact tools)
    { tool: crystallizationTool, executor: executeCrystallization, checkAvailability: isCrystallizationAvailable },
    { tool: mixingTool, executor: executeMixing, checkAvailability: isMixingAvailable },
    { tool: sedimentationTool, executor: executeSedimentation, checkAvailability: isSedimentationAvailable },
    { tool: filtrationTool, executor: executeFiltration, checkAvailability: isFiltrationAvailable },
    // TIER MASS TRANSFER OPERATIONS (3 more compact tools)
    { tool: evaporationTool, executor: executeEvaporation, checkAvailability: isEvaporationAvailable },
    { tool: humidificationTool, executor: executeHumidification, checkAvailability: isHumidificationAvailable },
    { tool: absorptionTool, executor: executeAbsorption, checkAvailability: isAbsorptionAvailable },
    // TIER MINERAL PROCESSING (2 more compact tools)
    { tool: leachingTool, executor: executeLeaching, checkAvailability: isLeachingAvailable },
    { tool: comminutionTool, executor: executeComminution, checkAvailability: isComminutionAvailable },
    // TIER ADDITIONAL SCIENCES (15 more compact tools)
    { tool: agricultureTool, executor: executeAgriculture, checkAvailability: isAgricultureAvailable },
    { tool: ecologyTool, executor: executeEcology, checkAvailability: isEcologyAvailable },
    { tool: economicsTool, executor: executeEconomics, checkAvailability: isEconomicsAvailable },
    { tool: forensicsTool, executor: executeForensics, checkAvailability: isForensicsAvailable },
    { tool: geologyTool, executor: executeGeology, checkAvailability: isGeologyAvailable },
    { tool: linguisticsTool, executor: executeLinguistics, checkAvailability: isLinguisticsAvailable },
    { tool: meteorologyTool, executor: executeMeteorology, checkAvailability: isMeteorologyAvailable },
    { tool: networkAnalysisTool, executor: executeNetworkAnalysis, checkAvailability: isNetworkAnalysisAvailable },
    { tool: nuclearPhysicsTool, executor: executeNuclearPhysics, checkAvailability: isNuclearPhysicsAvailable },
    { tool: nutritionTool, executor: executeNutrition, checkAvailability: isNutritionAvailable },
    { tool: oceanographyTool, executor: executeOceanography, checkAvailability: isOceanographyAvailable },
    { tool: pharmacologyTool, executor: executePharmacology, checkAvailability: isPharmacologyAvailable },
    { tool: plasmaPhysicsTool, executor: executePlasmaPhysics, checkAvailability: isPlasmaPhysicsAvailable },
    { tool: vulnerabilityTool, executor: executeVulnerability, checkAvailability: isVulnerabilityAvailable },
    { tool: encryptionTool, executor: executeEncryption, checkAvailability: isEncryptionAvailable },
    // Previously unregistered tools (95 tools)
    { tool: runCodeTool, executor: executeRunCode, checkAvailability: isRunCodeAvailable },
    { tool: visionAnalyzeTool, executor: executeVisionAnalyze, checkAvailability: isVisionAnalyzeAvailable },
    { tool: browserVisitTool, executor: executeBrowserVisitTool, checkAvailability: isBrowserVisitAvailable },
    { tool: extractPdfTool, executor: executeExtractPdf, checkAvailability: isExtractPdfAvailable },
    { tool: extractTableTool, executor: executeExtractTable, checkAvailability: isExtractTableAvailable },
    { tool: dynamicToolTool, executor: executeDynamicTool, checkAvailability: isDynamicToolAvailable },
    { tool: youtubeTranscriptTool, executor: executeYouTubeTranscript, checkAvailability: isYouTubeTranscriptAvailable },
    { tool: audioTranscribeTool, executor: executeAudioTranscribe, checkAvailability: isAudioTranscribeAvailable },
    { tool: spreadsheetTool, executor: executeSpreadsheet, checkAvailability: isSpreadsheetAvailable },
    { tool: httpRequestTool, executor: executeHttpRequest, checkAvailability: isHttpRequestAvailable },
    { tool: imageTransformTool, executor: executeImageTransform, checkAvailability: isImageTransformAvailable },
    { tool: fileConvertTool, executor: executeFileConvert, checkAvailability: isFileConvertAvailable },
    { tool: linkShortenTool, executor: executeLinkShorten, checkAvailability: isLinkShortenAvailable },
    { tool: mermaidDiagramTool, executor: executeMermaidDiagram, checkAvailability: isMermaidDiagramAvailable },
    { tool: entityExtractionTool, executor: executeEntityExtraction, checkAvailability: isEntityExtractionAvailable },
    { tool: searchIndexTool, executor: executeSearchIndex, checkAvailability: isSearchIndexAvailable },
    { tool: unitConvertTool, executor: executeUnitConvert, checkAvailability: isUnitConvertAvailable },
    { tool: passwordStrengthTool, executor: executePasswordStrength, checkAvailability: isPasswordStrengthAvailable },
    { tool: periodicTableTool, executor: executePeriodicTable, checkAvailability: isPeriodicTableAvailable },
    { tool: physicsConstantsTool, executor: executePhysicsConstants, checkAvailability: isPhysicsConstantsAvailable },
    { tool: accessibilityTool, executor: executeAccessibility, checkAvailability: isAccessibilityAvailable },
    { tool: symbolicMathTool, executor: executeSymbolicMath, checkAvailability: isSymbolicMathAvailable },
    { tool: optimizationTool, executor: executeOptimization, checkAvailability: isOptimizationAvailable },
    { tool: musicTheoryTool, executor: executeMusicTheory, checkAvailability: isMusicTheoryAvailable },
    { tool: recurrenceTool, executor: executeRecurrence, checkAvailability: isRecurrenceAvailable },
    { tool: constraintTool, executor: executeConstraint, checkAvailability: isConstraintAvailable },
    { tool: timeseriesTool, executor: executeTimeseries, checkAvailability: isTimeseriesAvailable },
    { tool: stringDistanceTool, executor: executeStringDistance, checkAvailability: isStringDistanceAvailable },
    { tool: numericalIntegrateTool, executor: executeNumericalIntegrate, checkAvailability: isNumericalIntegrateAvailable },
    { tool: interpolationTool, executor: executeInterpolation, checkAvailability: isInterpolationAvailable },
    { tool: specialFunctionsTool, executor: executeSpecialFunctions, checkAvailability: isSpecialFunctionsAvailable },
    { tool: complexMathTool, executor: executeComplexMath, checkAvailability: isComplexMathAvailable },
    { tool: combinatoricsTool, executor: executeCombinatorics, checkAvailability: isCombinatoricsAvailable },
    { tool: numberTheoryTool, executor: executeNumberTheory, checkAvailability: isNumberTheoryAvailable },
    { tool: probabilityDistTool, executor: executeProbabilityDist, checkAvailability: isProbabilityDistAvailable },
    { tool: polynomialOpsTool, executor: executePolynomialOps, checkAvailability: isPolynomialOpsAvailable },
    { tool: coordinateTransformTool, executor: executeCoordinateTransform, checkAvailability: isCoordinateTransformAvailable },
    { tool: sequenceAnalyzeTool, executor: executeSequenceAnalyze, checkAvailability: isSequenceAnalyzeAvailable },
    { tool: quantumCircuitTool, executor: executeQuantumCircuit, checkAvailability: isQuantumCircuitAvailable },
    { tool: controlTheoryTool, executor: executeControlTheory, checkAvailability: isControlTheoryAvailable },
    { tool: orbitalMechanicsTool, executor: executeOrbitalMechanics, checkAvailability: isOrbitalMechanicsAvailable },
    { tool: thermodynamicsTool, executor: executeThermodynamics, checkAvailability: isThermodynamicsAvailable },
    { tool: imageComputeTool, executor: executeImageCompute, checkAvailability: isImageComputeAvailable },
    { tool: waveletTransformTool, executor: executeWaveletTransform, checkAvailability: isWaveletTransformAvailable },
    { tool: latexRenderTool, executor: executeLatexRender, checkAvailability: isLatexRenderAvailable },
    { tool: rocketPropulsionTool, executor: executeRocketPropulsion, checkAvailability: isRocketPropulsionAvailable },
    { tool: fluidDynamicsTool, executor: executeFluidDynamics, checkAvailability: isFluidDynamicsAvailable },
    { tool: aerodynamicsTool, executor: executeAerodynamics, checkAvailability: isAerodynamicsAvailable },
    { tool: droneFlightTool, executor: executeDroneFlight, checkAvailability: isDroneFlightAvailable },
    { tool: pathfinderTool, executor: executePathfinder, checkAvailability: isPathfinderAvailable },
    { tool: circuitSimTool, executor: executeCircuitSim, checkAvailability: isCircuitSimAvailable },
    { tool: ballisticsTool, executor: executeBallistics, checkAvailability: isBallisticsAvailable },
    { tool: geneticAlgorithmTool, executor: executeGeneticAlgorithm, checkAvailability: isGeneticAlgorithmAvailable },
    { tool: chaosDynamicsTool, executor: executeChaosDynamics, checkAvailability: isChaosDynamicsAvailable },
    { tool: roboticsKinematicsTool, executor: executeRoboticsKinematics, checkAvailability: isRoboticsKinematicsAvailable },
    { tool: opticsSimTool, executor: executeOpticsSim, checkAvailability: isOpticsSimAvailable },
    { tool: epidemiologyTool, executor: executeEpidemiology, checkAvailability: isEpidemiologyAvailable },
    { tool: finiteElementTool, executor: executeFiniteElement, checkAvailability: isFiniteElementAvailable },
    { tool: antennaRfTool, executor: executeAntennaRf, checkAvailability: isAntennaRfAvailable },
    { tool: materialsScienceTool, executor: executeMaterialsScience, checkAvailability: isMaterialsScienceAvailable },
    { tool: seismologyTool, executor: executeSeismology, checkAvailability: isSeismologyAvailable },
    { tool: bioinformaticsProTool, executor: executeBioinformaticsPro, checkAvailability: isBioinformaticsProAvailable },
    { tool: acousticsTool, executor: executeAcoustics, checkAvailability: isAcousticsAvailable },
    { tool: symbolicLogicTool, executor: executeSymbolicLogic, checkAvailability: isSymbolicLogicAvailable },
    { tool: cellularAutomataTool, executor: executeCellularAutomata, checkAvailability: isCellularAutomataAvailable },
    { tool: medicalCalcTool, executor: executeMedicalCalc, checkAvailability: isMedicalCalcAvailable },
    { tool: graphics3dTool, executor: executeGraphics3D, checkAvailability: isGraphics3DAvailable },
    { tool: compressionAlgoTool, executor: executeCompressionAlgo, checkAvailability: isCompressionAlgoAvailable },
    { tool: errorCorrectionTool, executor: executeErrorCorrection, checkAvailability: isErrorCorrectionAvailable },
    { tool: houghVisionTool, executor: executeHoughVision, checkAvailability: isHoughVisionAvailable },
    { tool: cryptographyAdvancedTool, executor: executeCryptographyAdvanced, checkAvailability: isCryptographyAdvancedAvailable },
    { tool: solarEnvironmentalTool, executor: executeSolarEnvironmental, checkAvailability: isSolarEnvironmentalAvailable },
    { tool: svgGeneratorTool, executor: executeSVGGenerator, checkAvailability: isSVGGeneratorAvailable },
    { tool: fractalGeneratorTool, executor: executeFractalGenerator, checkAvailability: isFractalGeneratorAvailable },
    { tool: colorTheoryTool, executor: executeColorTheory, checkAvailability: isColorTheoryAvailable },
    { tool: animationEasingTool, executor: executeAnimationEasing, checkAvailability: isAnimationEasingAvailable },
    { tool: particleSystemTool, executor: executeParticleSystem, checkAvailability: isParticleSystemAvailable },
    { tool: bezierCurvesTool, executor: executeBezierCurves, checkAvailability: isBezierCurvesAvailable },
    { tool: sortingVisualizerTool, executor: executeSortingVisualizer, checkAvailability: isSortingVisualizerAvailable },
    { tool: dataStructuresTool, executor: executeDataStructures, checkAvailability: isDataStructuresAvailable },
    { tool: quantumComputingTool, executor: executeQuantumComputing, checkAvailability: isQuantumComputingAvailable },
    { tool: shaderGeneratorTool, executor: executeShaderGenerator, checkAvailability: isShaderGeneratorAvailable },
    { tool: signalProcessingTool, executor: executeSignalProcessing, checkAvailability: isSignalProcessingAvailable },
    { tool: neuralNetworkTool, executor: executeNeuralNetwork, checkAvailability: isNeuralNetworkAvailable },
    { tool: informationTheoryTool, executor: executeInformationTheory, checkAvailability: isInformationTheoryAvailable },
    { tool: proceduralGenerationTool, executor: executeProceduralGeneration, checkAvailability: isProceduralGenerationAvailable },
    { tool: rayTracingTool, executor: executeRayTracing, checkAvailability: isRayTracingAvailable },
    { tool: automataTheoryTool, executor: executeAutomataTheory, checkAvailability: isAutomataTheoryAvailable },
    { tool: computationalComplexityTool, executor: executeComputationalComplexity, checkAvailability: isComputationalComplexityAvailable },
    { tool: reactionKineticsTool, executor: executeReactionKinetics, checkAvailability: isReactionKineticsAvailable },
    { tool: electrochemistryTool, executor: executeElectrochemistry, checkAvailability: isElectrochemistryAvailable },
    { tool: spectroscopyTool, executor: executeSpectroscopy, checkAvailability: isSpectroscopyAvailable },
    { tool: quantumMechanicsTool, executor: executeQuantumMechanics, checkAvailability: isQuantumMechanicsAvailable },
    { tool: relativityTool, executor: executeRelativity, checkAvailability: isRelativityAvailable },
    { tool: statisticalMechanicsTool, executor: executeStatisticalMechanics, checkAvailability: isStatisticalMechanicsAvailable },
    // New science tools batch 3 (5 new tools)
    { tool: taxonomyTool, executor: executeTaxonomy, checkAvailability: isTaxonomyAvailable },
    { tool: petrologyTool, executor: executePetrology, checkAvailability: isPetrologyAvailable },
    { tool: mineralogyTool, executor: executeMineralogy, checkAvailability: isMineralogyAvailable },
    { tool: biophysicsTool, executor: executeBiophysics, checkAvailability: isBiophysicsAvailable },
    { tool: metallurgyTool, executor: executeMetallurgy, checkAvailability: isMetallurgyAvailable },
    // Cybersecurity tools batch 1 (15 new tools)
    { tool: hashAnalysisTool, executor: executeHashAnalysis, checkAvailability: isHashAnalysisAvailable },
    { tool: encodingTool, executor: executeEncoding, checkAvailability: isEncodingAvailable },
    { tool: securityMetricsTool, executor: executeSecurityMetrics, checkAvailability: isSecurityMetricsAvailable },
    { tool: jwtTool, executor: executeJwt, checkAvailability: isJwtAvailable },
    { tool: ipSecurityTool, executor: executeIpSecurity, checkAvailability: isIpSecurityAvailable },
    { tool: certificateTool, executor: executeCertificate, checkAvailability: isCertificateAvailable },
    { tool: entropyAnalysisTool, executor: executeEntropyAnalysis, checkAvailability: isEntropyAnalysisAvailable },
    { tool: securityHeadersTool, executor: executeSecurityHeaders, checkAvailability: isSecurityHeadersAvailable },
    { tool: malwareIndicatorsTool, executor: executeMalwareIndicators, checkAvailability: isMalwareIndicatorsAvailable },
    { tool: portScannerTool, executor: executePortScanner, checkAvailability: isPortScannerAvailable },
    { tool: owaspTool, executor: executeOwasp, checkAvailability: isOwaspAvailable },
    { tool: dnsSecurityTool, executor: executeDnsSecurity, checkAvailability: isDnsSecurityAvailable },
    { tool: threatModelTool, executor: executeThreatModel, checkAvailability: isThreatModelAvailable },
    { tool: complianceTool, executor: executeCompliance, checkAvailability: isComplianceAvailable },
    { tool: cipherTool, executor: executeCipher, checkAvailability: isCipherAvailable },
    // Cybersecurity tools batch 2 (55 more tools)
    { tool: authProtocolTool, executor: executeAuthProtocol, checkAvailability: isAuthProtocolAvailable },
    { tool: vulnAssessmentTool, executor: executeVulnAssessment, checkAvailability: isVulnAssessmentAvailable },
    { tool: incidentResponseTool, executor: executeIncidentResponse, checkAvailability: isIncidentResponseAvailable },
    { tool: networkSecurityTool, executor: executeNetworkSecurity, checkAvailability: isNetworkSecurityAvailable },
    { tool: firewallTool, executor: executeFirewall, checkAvailability: isFirewallAvailable },
    { tool: idsIpsTool, executor: executeIdsIps, checkAvailability: isIdsIpsAvailable },
    { tool: logAnalysisTool, executor: executeLogAnalysis, checkAvailability: isLogAnalysisAvailable },
    { tool: penTestTool, executor: executePenTest, checkAvailability: isPenTestAvailable },
    { tool: socialEngineeringTool, executor: executeSocialEngineering, checkAvailability: isSocialEngineeringAvailable },
    { tool: cryptanalysisTool, executor: executeCryptanalysis, checkAvailability: isCryptanalysisAvailable },
    { tool: secureSdlcTool, executor: executeSecureSdlc, checkAvailability: isSecureSdlcAvailable },
    { tool: privacyTool, executor: executePrivacy, checkAvailability: isPrivacyAvailable },
    { tool: accessControlTool, executor: executeAccessControl, checkAvailability: isAccessControlAvailable },
    { tool: siemTool, executor: executeSiem, checkAvailability: isSiemAvailable },
    { tool: vulnerabilityScannerTool, executor: executeVulnerabilityScanner, checkAvailability: isVulnerabilityScannerAvailable },
    { tool: malwareAnalysisTool, executor: executeMalwareAnalysis, checkAvailability: isMalwareAnalysisAvailable },
    { tool: endpointSecurityTool, executor: executeEndpointSecurity, checkAvailability: isEndpointSecurityAvailable },
    { tool: cloudSecurityTool, executor: executeCloudSecurity, checkAvailability: isCloudSecurityAvailable },
    { tool: containerSecurityTool, executor: executeContainerSecurity, checkAvailability: isContainerSecurityAvailable },
    { tool: apiSecurityTool, executor: executeApiSecurity, checkAvailability: isApiSecurityAvailable },
    { tool: mobileSecurityTool, executor: executeMobileSecurity, checkAvailability: isMobileSecurityAvailable },
    { tool: iotSecurityTool, executor: executeIotSecurity, checkAvailability: isIotSecurityAvailable },
    { tool: zeroTrustTool, executor: executeZeroTrust, checkAvailability: isZeroTrustAvailable },
    { tool: securityArchitectureTool, executor: executeSecurityArchitecture, checkAvailability: isSecurityArchitectureAvailable },
    { tool: riskManagementTool, executor: executeRiskManagement, checkAvailability: isRiskManagementAvailable },
    { tool: businessContinuityTool, executor: executeBusinessContinuity, checkAvailability: isBusinessContinuityAvailable },
    { tool: securityAwarenessTool, executor: executeSecurityAwareness, checkAvailability: isSecurityAwarenessAvailable },
    { tool: threatIntelTool, executor: executeThreatIntel, checkAvailability: isThreatIntelAvailable },
    { tool: devsecOpsTool, executor: executeDevsecOps, checkAvailability: isDevsecOpsAvailable },
    { tool: blockchainSecurityTool, executor: executeBlockchainSecurity, checkAvailability: isBlockchainSecurityAvailable },
    { tool: wirelessSecurityTool, executor: executeWirelessSecurity, checkAvailability: isWirelessSecurityAvailable },
    { tool: vpnTool, executor: executeVpn, checkAvailability: isVpnAvailable },
    { tool: pkiTool, executor: executePki, checkAvailability: isPkiAvailable },
    { tool: dataLossPreventionTool, executor: executeDataLossPrevention, checkAvailability: isDataLossPreventionAvailable },
    { tool: redTeamTool, executor: executeRedTeam, checkAvailability: isRedTeamAvailable },
    { tool: blueTeamTool, executor: executeBlueTeam, checkAvailability: isBlueTeamAvailable },
    { tool: socTool, executor: executeSoc, checkAvailability: isSocAvailable },
    { tool: identityManagementTool, executor: executeIdentityManagement, checkAvailability: isIdentityManagementAvailable },
    { tool: emailSecurityTool, executor: executeEmailSecurity, checkAvailability: isEmailSecurityAvailable },
    { tool: vendorRiskTool, executor: executeVendorRisk, checkAvailability: isVendorRiskAvailable },
    { tool: patchManagementTool, executor: executePatchManagement, checkAvailability: isPatchManagementAvailable },
    { tool: threatHuntingTool, executor: executeThreatHunting, checkAvailability: isThreatHuntingAvailable },
    { tool: osintTool, executor: executeOsint, checkAvailability: isOsintAvailable },
    { tool: ransomwareDefenseTool, executor: executeRansomwareDefense, checkAvailability: isRansomwareDefenseAvailable },
    { tool: credentialSecurityTool, executor: executeCredentialSecurity, checkAvailability: isCredentialSecurityAvailable },
    { tool: databaseSecurityTool, executor: executeDatabaseSecurity, checkAvailability: isDatabaseSecurityAvailable },
    { tool: scadaIcsTool, executor: executeScadaIcs, checkAvailability: isScadaIcsAvailable },
    { tool: attackSurfaceTool, executor: executeAttackSurface, checkAvailability: isAttackSurfaceAvailable },
    { tool: dataClassificationTool, executor: executeDataClassification, checkAvailability: isDataClassificationAvailable },
    { tool: keyManagementTool, executor: executeKeyManagement, checkAvailability: isKeyManagementAvailable },
    { tool: securityPolicyTool, executor: executeSecurityPolicy, checkAvailability: isSecurityPolicyAvailable },
    { tool: securityAuditTool, executor: executeSecurityAudit, checkAvailability: isSecurityAuditAvailable },
    { tool: assetManagementTool, executor: executeAssetManagement, checkAvailability: isAssetManagementAvailable },
    // Additional security tools batch 3 (23 more tools)
    { tool: honeypotTool, executor: executeHoneypot, checkAvailability: isHoneypotAvailable },
    { tool: complianceFrameworkTool, executor: executeComplianceFramework, checkAvailability: isComplianceFrameworkAvailable },
    { tool: securityArchitecturePatternsTool, executor: executeSecurityArchitecturePatterns, checkAvailability: isSecurityArchitecturePatternsAvailable },
    { tool: soarTool, executor: executeSoar, checkAvailability: isSoarAvailable },
    { tool: supplyChainSecurityTool, executor: executeSupplyChainSecurity, checkAvailability: isSupplyChainSecurityAvailable },
    { tool: webSecurityTool, executor: executeWebSecurity, checkAvailability: isWebSecurityAvailable },
    { tool: networkDefenseTool, executor: executeNetworkDefense, checkAvailability: isNetworkDefenseAvailable },
    { tool: secretsManagementTool, executor: executeSecretsManagement, checkAvailability: isSecretsManagementAvailable },
    { tool: xdrTool, executor: executeXdr, checkAvailability: isXdrAvailable },
    { tool: privacyEngineeringTool, executor: executePrivacyEngineering, checkAvailability: isPrivacyEngineeringAvailable },
    { tool: secureCommunicationsTool, executor: executeSecureCommunications, checkAvailability: isSecureCommunicationsAvailable },
    { tool: securityTestingTool, executor: executeSecurityTesting, checkAvailability: isSecurityTestingAvailable },
    { tool: industrialControlTool, executor: executeIndustrialControl, checkAvailability: isIndustrialControlAvailable },
    { tool: cloudNativeSecurityTool, executor: executeCloudNativeSecurity, checkAvailability: isCloudNativeSecurityAvailable },
    { tool: browserSecurityTool, executor: executeBrowserSecurity, checkAvailability: isBrowserSecurityAvailable },
    { tool: physicalSecurityTool, executor: executePhysicalSecurity, checkAvailability: isPhysicalSecurityAvailable },
    { tool: securityOperationsTool, executor: executeSecurityOperations, checkAvailability: isSecurityOperationsAvailable },
    { tool: threatModelingTool, executor: executeThreatModeling, checkAvailability: isThreatModelingAvailable },
    { tool: aiSecurityTool, executor: executeAiSecurity, checkAvailability: isAiSecurityAvailable },
    { tool: securityCultureTool, executor: executeSecurityCulture, checkAvailability: isSecurityCultureAvailable },
    { tool: logManagementTool, executor: executeLogManagement, checkAvailability: isLogManagementAvailable },
    { tool: authenticationTool, executor: executeAuthentication, checkAvailability: isAuthenticationAvailable },
    { tool: backupRecoveryTool, executor: executeBackupRecovery, checkAvailability: isBackupRecoveryAvailable },
    // Additional security tools batch 4
    { tool: securityBudgetTool, executor: executeSecurityBudget, checkAvailability: isSecurityBudgetAvailable },
    { tool: cyberInsuranceTool, executor: executeCyberInsurance, checkAvailability: isCyberInsuranceAvailable },
    { tool: saseTool, executor: executeSase, checkAvailability: isSaseAvailable },
    { tool: identityGovernanceTool, executor: executeIdentityGovernance, checkAvailability: isIdentityGovernanceAvailable },
    { tool: dataSecurityTool, executor: executeDataSecurity, checkAvailability: isDataSecurityAvailable },
    // Code Agent Brain Tools - Full coding capabilities (8 new tools)
    { tool: workspaceTool, executor: executeWorkspace, checkAvailability: isWorkspaceAvailable },
    { tool: codeGenerationTool, executor: executeCodeGeneration, checkAvailability: isCodeGenerationAvailable },
    { tool: codeAnalysisTool, executor: executeCodeAnalysis, checkAvailability: isCodeAnalysisAvailable },
    { tool: projectBuilderTool, executor: executeProjectBuilder, checkAvailability: isProjectBuilderAvailable },
    { tool: testGeneratorTool, executor: executeTestGenerator, checkAvailability: isTestGeneratorAvailable },
    { tool: errorFixerTool, executor: executeErrorFixer, checkAvailability: isErrorFixerAvailable },
    { tool: refactorTool, executor: executeRefactor, checkAvailability: isRefactorAvailable },
    { tool: docGeneratorTool, executor: executeDocGenerator, checkAvailability: isDocGeneratorAvailable }
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
