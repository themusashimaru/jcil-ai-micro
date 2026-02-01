/**
 * CHAT TOOLS INDEX
 *
 * Unified exports for all chat-level tools.
 * These tools extend the main chat with capabilities from Deep Strategy agent.
 *
 * Tools available (136 total):
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

// Music Theory - Scales, chords, progressions, intervals
export {
  musicTheoryTool,
  executeMusicTheory,
  isMusicTheoryAvailable,
} from './music-theory-tool';

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
  const { musicTheoryTool, executeMusicTheory, isMusicTheoryAvailable } = await import(
    './music-theory-tool'
  );

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
    {
      tool: musicTheoryTool,
      executor: executeMusicTheory,
      checkAvailability: isMusicTheoryAvailable,
    },
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
