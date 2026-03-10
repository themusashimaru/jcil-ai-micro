/**
 * BUSINESS PLAN PDF GENERATION
 *
 * Parses markdown business plan content into structured data and
 * renders it as a professional PDF using jsPDF.
 * Extracted from route.ts for modularity.
 */

import { jsPDF } from 'jspdf';
// Business Plan data structure
export interface BusinessPlanData {
  companyName: string;
  confidentialityNotice: string;
  executiveSummary: {
    missionStatement: string;
    companyOverview: string;
    leadershipTeam: string;
    financialHighlights: Array<{
      metric: string;
      year1: string;
      year2: string;
      year3: string;
      year4: string;
      year5: string;
    }>;
    objectives: string[];
  };
  companyDescription: {
    overview: string;
    competitiveAdvantages: string;
    legalStructure: string;
  };
  marketAnalysis: {
    industryAnalysis: string;
    targetMarket: string;
    competitiveAnalysis: Array<{
      factor: string;
      yourBusiness: string;
      competitorA: string;
      competitorB: string;
      competitorC: string;
    }>;
  };
  organizationManagement: {
    orgStructure: string;
    managementTeam: string;
    advisoryBoard: string;
  };
  productsServices: {
    description: string;
    intellectualProperty: string;
    researchDevelopment: string;
  };
  marketingSales: {
    marketingStrategy: string;
    salesStrategy: string;
    distributionChannels: string;
  };
  financialProjections: {
    assumptions: string[];
    incomeStatement: Array<{
      category: string;
      year1: string;
      year2: string;
      year3: string;
      year4: string;
      year5: string;
    }>;
    cashFlow: Array<{
      category: string;
      year1: string;
      year2: string;
      year3: string;
      year4: string;
      year5: string;
    }>;
    balanceSheet: Array<{
      category: string;
      year1: string;
      year2: string;
      year3: string;
      year4: string;
      year5: string;
    }>;
    breakEvenAnalysis: string;
  };
  fundingRequest: {
    currentFunding: string;
    requirements: string;
    futureFunding: string;
  };
  appendix: string[];
}

export function stripMarkdown(text: string): string {
  return (
    text
      // Remove bold/italic markers
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove headers markers
      .replace(/^#{1,6}\s+/gm, '')
      // Clean up extra whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Parse business plan content from markdown/text to structured data
 */
export function parseBusinessPlanContent(content: string): BusinessPlanData {
  const lines = content.split('\n');

  const data: BusinessPlanData = {
    companyName: '[Company Name]',
    confidentialityNotice: 'This document contains confidential and proprietary information.',
    executiveSummary: {
      missionStatement: '',
      companyOverview: '',
      leadershipTeam: '',
      financialHighlights: [],
      objectives: [],
    },
    companyDescription: {
      overview: '',
      competitiveAdvantages: '',
      legalStructure: '',
    },
    marketAnalysis: {
      industryAnalysis: '',
      targetMarket: '',
      competitiveAnalysis: [],
    },
    organizationManagement: {
      orgStructure: '',
      managementTeam: '',
      advisoryBoard: '',
    },
    productsServices: {
      description: '',
      intellectualProperty: '',
      researchDevelopment: '',
    },
    marketingSales: {
      marketingStrategy: '',
      salesStrategy: '',
      distributionChannels: '',
    },
    financialProjections: {
      assumptions: [],
      incomeStatement: [],
      cashFlow: [],
      balanceSheet: [],
      breakEvenAnalysis: '',
    },
    fundingRequest: {
      currentFunding: '',
      requirements: '',
      futureFunding: '',
    },
    appendix: [],
  };

  let currentSection = '';
  let currentSubsection = '';
  let currentContent: string[] = [];

  const saveCurrentContent = () => {
    // Join content and ensure all markdown is stripped
    const text = currentContent
      .map((line) => stripMarkdown(line))
      .join('\n')
      .trim();
    if (!text) return;

    switch (currentSection) {
      case 'executive':
        if (currentSubsection.includes('mission')) data.executiveSummary.missionStatement = text;
        else if (currentSubsection.includes('overview') || currentSubsection.includes('company'))
          data.executiveSummary.companyOverview = text;
        else if (currentSubsection.includes('leadership') || currentSubsection.includes('team'))
          data.executiveSummary.leadershipTeam = text;
        else if (currentSubsection.includes('objective'))
          data.executiveSummary.objectives = text.split('\n').filter((l) => l.trim());
        break;
      case 'company':
        if (currentSubsection.includes('competitive') || currentSubsection.includes('advantage'))
          data.companyDescription.competitiveAdvantages = text;
        else if (currentSubsection.includes('legal') || currentSubsection.includes('structure'))
          data.companyDescription.legalStructure = text;
        else data.companyDescription.overview = text;
        break;
      case 'market':
        if (currentSubsection.includes('industry')) data.marketAnalysis.industryAnalysis = text;
        else if (currentSubsection.includes('target')) data.marketAnalysis.targetMarket = text;
        else if (currentSubsection.includes('competitive'))
          data.marketAnalysis.industryAnalysis += '\n\n' + text;
        break;
      case 'organization':
        if (currentSubsection.includes('management'))
          data.organizationManagement.managementTeam = text;
        else if (currentSubsection.includes('advisory'))
          data.organizationManagement.advisoryBoard = text;
        else data.organizationManagement.orgStructure = text;
        break;
      case 'product':
        if (currentSubsection.includes('intellectual') || currentSubsection.includes('ip'))
          data.productsServices.intellectualProperty = text;
        else if (currentSubsection.includes('r&d') || currentSubsection.includes('research'))
          data.productsServices.researchDevelopment = text;
        else data.productsServices.description = text;
        break;
      case 'marketing':
        if (currentSubsection.includes('sales')) data.marketingSales.salesStrategy = text;
        else if (currentSubsection.includes('distribution'))
          data.marketingSales.distributionChannels = text;
        else data.marketingSales.marketingStrategy = text;
        break;
      case 'financial':
        if (currentSubsection.includes('assumption'))
          data.financialProjections.assumptions = text.split('\n').filter((l) => l.trim());
        else if (currentSubsection.includes('break'))
          data.financialProjections.breakEvenAnalysis = text;
        break;
      case 'funding':
        if (currentSubsection.includes('current')) data.fundingRequest.currentFunding = text;
        else if (currentSubsection.includes('requirement')) data.fundingRequest.requirements = text;
        else if (currentSubsection.includes('future')) data.fundingRequest.futureFunding = text;
        break;
      case 'appendix':
        data.appendix = text.split('\n').filter((l) => l.trim());
        break;
    }
    currentContent = [];
  };

  for (const line of lines) {
    const trimmedLine = line.trim();
    const lowerLine = trimmedLine.toLowerCase();

    // Extract company name from various formats
    if (data.companyName === '[Company Name]') {
      // Pattern 1: "# Company Name" (markdown header)
      if (trimmedLine.startsWith('# ')) {
        const title = stripMarkdown(trimmedLine.slice(2).replace(/business plan/i, ''));
        if (title && title.length > 2) {
          data.companyName = title;
          continue;
        }
      }
      // Pattern 2: "Business Name: Company Name" (common AI format)
      const businessNameMatch = trimmedLine.match(/business\s+name[:\s]+(.+)/i);
      if (businessNameMatch && businessNameMatch[1]) {
        const name = stripMarkdown(businessNameMatch[1]);
        if (name && name.length > 2) {
          data.companyName = name;
          continue;
        }
      }
      // Pattern 3: "Company Name: XYZ" or "Name: XYZ"
      const companyNameMatch = trimmedLine.match(/(?:company\s+)?name[:\s]+(.+)/i);
      if (
        companyNameMatch &&
        companyNameMatch[1] &&
        !trimmedLine.toLowerCase().includes('founder')
      ) {
        const name = stripMarkdown(companyNameMatch[1]);
        if (name && name.length > 2 && !name.toLowerCase().includes('business plan')) {
          data.companyName = name;
          continue;
        }
      }
      // Pattern 4: "Business Plan for Company Name" or "Company Name Business Plan"
      const bpMatch =
        trimmedLine.match(/business\s+plan\s+(?:for\s+)?(.+)/i) ||
        trimmedLine.match(/(.+?)\s+business\s+plan/i);
      if (bpMatch && bpMatch[1]) {
        const name = stripMarkdown(bpMatch[1]);
        if (name && name.length > 2 && !name.toLowerCase().includes('summary')) {
          data.companyName = name;
        }
      }
    }

    // Detect main sections (improved patterns for various AI output formats)
    // Executive Summary
    if (lowerLine.includes('executive summary') || lowerLine.match(/^#+\s*1\.\s/)) {
      saveCurrentContent();
      currentSection = 'executive';
      currentSubsection = '';
      continue;
    }
    // Company Description
    if (lowerLine.includes('company description') || lowerLine.match(/^#+\s*2\.\s/)) {
      saveCurrentContent();
      currentSection = 'company';
      currentSubsection = '';
      continue;
    }
    // Market Analysis (also matches "1. Market Analysis" format)
    if (lowerLine.includes('market analysis') || lowerLine.match(/^\d+\.\s*market/i)) {
      saveCurrentContent();
      currentSection = 'market';
      currentSubsection = '';
      continue;
    }
    // Organization/Management
    if (
      (lowerLine.includes('organization') && lowerLine.includes('management')) ||
      lowerLine.match(/^\d+\.\s*organization/i) ||
      lowerLine.match(/^#+\s*4\.\s/)
    ) {
      saveCurrentContent();
      currentSection = 'organization';
      currentSubsection = '';
      continue;
    }
    // Operational Plan (common AI format)
    if (lowerLine.includes('operational plan') || lowerLine.match(/^\d+\.\s*operational/i)) {
      saveCurrentContent();
      currentSection = 'organization';
      currentSubsection = '';
      continue;
    }
    // Products/Services
    if (
      (lowerLine.includes('product') || lowerLine.includes('service')) &&
      (lowerLine.match(/^\d+\./) || lowerLine.match(/^#+/))
    ) {
      saveCurrentContent();
      currentSection = 'product';
      currentSubsection = '';
      continue;
    }
    // Marketing/Sales
    if (
      (lowerLine.includes('marketing') || lowerLine.includes('sales')) &&
      (lowerLine.match(/^\d+\./) || lowerLine.match(/^#+/))
    ) {
      saveCurrentContent();
      currentSection = 'marketing';
      currentSubsection = '';
      continue;
    }
    // Financial Projections (also matches "3. Financial Projections" format)
    if (lowerLine.includes('financial') || lowerLine.match(/^\d+\.\s*financial/i)) {
      saveCurrentContent();
      currentSection = 'financial';
      currentSubsection = '';
      continue;
    }
    // Initial Investment (treat as funding/financial)
    if (lowerLine.includes('initial investment') || lowerLine.includes('investment breakdown')) {
      saveCurrentContent();
      currentSection = 'funding';
      currentSubsection = 'requirements';
      continue;
    }
    // Funding Request
    if (lowerLine.includes('funding') || lowerLine.match(/^\d+\.\s*funding/i)) {
      saveCurrentContent();
      currentSection = 'funding';
      currentSubsection = '';
      continue;
    }
    if (lowerLine.includes('appendix') || lowerLine.match(/^#*\s*9\./)) {
      saveCurrentContent();
      currentSection = 'appendix';
      currentSubsection = '';
      continue;
    }

    // Detect subsections (##, ###, numbered like 1.1, 2.1, or inline "Label:" format)
    if (trimmedLine.match(/^#{2,3}\s+/) || trimmedLine.match(/^\d+\.\d+/)) {
      saveCurrentContent();
      currentSubsection = lowerLine;
      continue;
    }

    // Handle inline "Label: Content" format (common in AI output)
    const inlineLabelMatch = trimmedLine.match(/^([A-Z][A-Za-z\s]+):\s*(.*)$/);
    if (inlineLabelMatch && currentSection) {
      const label = inlineLabelMatch[1].toLowerCase();
      const value = stripMarkdown(inlineLabelMatch[2]);

      // Save previous content first
      saveCurrentContent();

      // Assign inline values directly to data structure
      if (currentSection === 'executive') {
        if (label.includes('mission')) {
          data.executiveSummary.missionStatement = value;
          continue;
        } else if (label.includes('objective') || label.includes('goal')) {
          if (value) data.executiveSummary.objectives.push(value);
          continue;
        } else if (
          label.includes('location') ||
          label.includes('launch') ||
          label.includes('date')
        ) {
          // Store as part of overview
          const cleanedLine = stripMarkdown(trimmedLine);
          data.executiveSummary.companyOverview +=
            (data.executiveSummary.companyOverview ? '\n' : '') + cleanedLine;
          continue;
        }
      } else if (currentSection === 'market') {
        if (
          label.includes('competitive') ||
          label.includes('edge') ||
          label.includes('advantage')
        ) {
          currentSubsection = 'competitive';
          if (value) currentContent.push(value);
          continue;
        } else if (label.includes('pricing') || label.includes('strategy')) {
          currentSubsection = 'pricing';
          if (value) currentContent.push(value);
          continue;
        } else if (label.includes('target')) {
          currentSubsection = 'target';
          if (value) currentContent.push(value);
          continue;
        }
      } else if (currentSection === 'organization') {
        if (label.includes('hours') || label.includes('staffing') || label.includes('inventory')) {
          if (value) currentContent.push(stripMarkdown(trimmedLine));
          continue;
        }
      }

      // If we couldn't match specifically, use label as subsection
      currentSubsection = label;
      if (value) currentContent.push(value);
      continue;
    }

    // Accumulate content
    if (trimmedLine && currentSection) {
      // Clean up bullet points, list markers, and markdown formatting
      let cleanedLine = trimmedLine.replace(/^[-*•]\s*/, '').replace(/^\d+\)\s*/, '');
      cleanedLine = stripMarkdown(cleanedLine);
      if (cleanedLine) {
        currentContent.push(cleanedLine);
      }
    }
  }

  // Save final content
  saveCurrentContent();

  // Fallback: If still no company name, try to extract from content
  if (data.companyName === '[Company Name]') {
    // Look for patterns like "The [Name] Cafe" or "[Name] Coffee"
    const allText =
      Object.values(data.executiveSummary).join(' ') + ' ' + data.companyDescription.overview;
    const cafeMatch = allText.match(
      /(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Cafe|Coffee|Restaurant|Bistro|Shop)/i
    );
    if (cafeMatch) {
      data.companyName = cafeMatch[0].trim();
    }
  }

  return data;
}

/**
 * Generate professional business plan PDF
 */
export function generateBusinessPlanPDF(doc: jsPDF, data: BusinessPlanData): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;
  let pageNumber = 1;

  // Colors
  const primaryColor: [number, number, number] = [30, 58, 138]; // Dark blue
  const secondaryColor: [number, number, number] = [59, 130, 246]; // Light blue
  const textColor: [number, number, number] = [31, 41, 55]; // Dark gray
  const lightGray: [number, number, number] = [156, 163, 175];

  // Helper to add page break
  const checkPageBreak = (neededHeight: number): boolean => {
    if (y + neededHeight > pageHeight - margin - 15) {
      // Add page number to current page
      doc.setFontSize(9);
      doc.setTextColor(...lightGray);
      doc.text(`Page ${pageNumber}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

      doc.addPage();
      pageNumber++;
      y = margin;
      return true;
    }
    return false;
  };

  // Helper to add section header
  const addSectionHeader = (title: string) => {
    checkPageBreak(20);
    y += 8;
    doc.setFillColor(...primaryColor);
    doc.rect(margin, y - 5, contentWidth, 10, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), margin + 5, y + 2);
    y += 12;
  };

  // Helper to add subsection header
  const addSubsectionHeader = (title: string) => {
    checkPageBreak(15);
    y += 5;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(title, margin, y);
    doc.setDrawColor(...secondaryColor);
    doc.setLineWidth(0.5);
    doc.line(margin, y + 2, margin + doc.getTextWidth(title), y + 2);
    y += 8;
  };

  // Helper to add paragraph
  const addParagraph = (text: string) => {
    if (!text || typeof text !== 'string') return;
    const safeText = String(text).trim();
    if (!safeText) return;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);

    // Limit text length to prevent extremely long content
    const truncatedText = safeText.length > 10000 ? safeText.substring(0, 10000) + '...' : safeText;
    const lines = doc.splitTextToSize(truncatedText, contentWidth);

    // Limit to prevent too many lines on one page
    const maxLines = 200;
    const linesToRender = lines.slice(0, maxLines);

    for (const line of linesToRender) {
      checkPageBreak(5);
      doc.text(String(line), margin, y);
      y += 4.5;
    }
    y += 3;
  };

  // Helper to add bullet list
  const addBulletList = (items: string[]) => {
    if (!items || !Array.isArray(items) || items.length === 0) return;

    // Limit to reasonable number of items
    const safeItems = items.filter((i) => i && typeof i === 'string').slice(0, 50);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);

    for (const item of safeItems) {
      const safeItem = String(item).trim();
      if (!safeItem) continue;
      checkPageBreak(6);
      doc.setFillColor(...primaryColor);
      doc.circle(margin + 2, y - 1.5, 1, 'F');
      const lines = doc.splitTextToSize(safeItem.substring(0, 500), contentWidth - 10);
      doc.text(lines, margin + 7, y);
      y += lines.length * 4.5 + 2;
    }
    y += 2;
  };

  // Helper to add financial table
  const addFinancialTable = (
    title: string,
    rows: Array<{
      category: string;
      year1: string;
      year2: string;
      year3: string;
      year4: string;
      year5: string;
    }>
  ) => {
    if (!rows || !Array.isArray(rows) || rows.length === 0) return;

    // Filter out invalid rows and limit to reasonable size
    const validRows = rows.filter((r) => r && typeof r === 'object').slice(0, 20);
    if (validRows.length === 0) return;

    checkPageBreak(validRows.length * 7 + 20);

    // Table title
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(title || 'Financial Data', margin, y);
    y += 6;

    // Header row
    const colWidths = [
      contentWidth * 0.3,
      contentWidth * 0.14,
      contentWidth * 0.14,
      contentWidth * 0.14,
      contentWidth * 0.14,
      contentWidth * 0.14,
    ];
    const headers = ['Category', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'];

    doc.setFillColor(...primaryColor);
    doc.rect(margin, y - 4, contentWidth, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);

    let x = margin;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], x + 2, y);
      x += colWidths[i];
    }
    y += 5;

    // Data rows
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);

    for (let rowIdx = 0; rowIdx < validRows.length; rowIdx++) {
      const row = validRows[rowIdx];
      if (!row) continue;

      if (rowIdx % 2 === 0) {
        doc.setFillColor(245, 247, 250);
        doc.rect(margin, y - 4, contentWidth, 6, 'F');
      }

      x = margin;
      doc.text(String(row.category || '').substring(0, 25), x + 2, y);
      x += colWidths[0];
      doc.text(String(row.year1 || '-'), x + 2, y);
      x += colWidths[1];
      doc.text(String(row.year2 || '-'), x + 2, y);
      x += colWidths[2];
      doc.text(String(row.year3 || '-'), x + 2, y);
      x += colWidths[3];
      doc.text(String(row.year4 || '-'), x + 2, y);
      x += colWidths[4];
      doc.text(String(row.year5 || '-'), x + 2, y);

      y += 6;
    }
    y += 5;
  };

  // === COVER PAGE ===
  y = pageHeight * 0.3;

  // Company name
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  const companyLines = doc.splitTextToSize(data.companyName, contentWidth);
  doc.text(companyLines, pageWidth / 2, y, { align: 'center' });
  y += companyLines.length * 12 + 10;

  // "Business Plan" title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...secondaryColor);
  doc.text('BUSINESS PLAN', pageWidth / 2, y, { align: 'center' });
  y += 15;

  // Decorative line
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(1);
  doc.line(pageWidth / 2 - 40, y, pageWidth / 2 + 40, y);
  y += 20;

  // Date
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...lightGray);
  doc.text(
    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
    pageWidth / 2,
    y,
    { align: 'center' }
  );

  // Confidentiality notice at bottom
  y = pageHeight - 40;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...lightGray);
  const confidentialLines = doc.splitTextToSize(data.confidentialityNotice, contentWidth - 20);
  doc.text(confidentialLines, pageWidth / 2, y, { align: 'center' });

  // === PAGE 2: TABLE OF CONTENTS ===
  doc.addPage();
  pageNumber++;
  y = margin;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('TABLE OF CONTENTS', pageWidth / 2, y, { align: 'center' });
  y += 15;

  const tocItems = [
    { num: '1', title: 'Executive Summary', page: '3' },
    { num: '2', title: 'Company Description', page: '4' },
    { num: '3', title: 'Market Analysis', page: '5' },
    { num: '4', title: 'Organization and Management', page: '6' },
    { num: '5', title: 'Products or Services', page: '7' },
    { num: '6', title: 'Marketing and Sales Strategy', page: '8' },
    { num: '7', title: 'Financial Projections', page: '9' },
    { num: '8', title: 'Funding Request', page: '11' },
    { num: '9', title: 'Appendix', page: '12' },
  ];

  doc.setFontSize(11);
  for (const item of tocItems) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(`${item.num}.`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    doc.text(item.title, margin + 10, y);

    // Dots
    const dotsX = margin + 10 + doc.getTextWidth(item.title) + 2;
    const pageX = pageWidth - margin - 5;
    doc.setTextColor(...lightGray);
    let dotX = dotsX;
    while (dotX < pageX - 10) {
      doc.text('.', dotX, y);
      dotX += 3;
    }
    doc.text(item.page, pageX, y, { align: 'right' });
    y += 8;
  }

  // === CONTENT PAGES ===
  doc.addPage();
  pageNumber++;
  y = margin;

  // 1. EXECUTIVE SUMMARY
  addSectionHeader('1. Executive Summary');

  if (data.executiveSummary.missionStatement) {
    addSubsectionHeader('1.1 Mission Statement');
    addParagraph(data.executiveSummary.missionStatement);
  }

  if (data.executiveSummary.companyOverview) {
    addSubsectionHeader('1.2 Company Overview');
    addParagraph(data.executiveSummary.companyOverview);
  }

  if (data.executiveSummary.leadershipTeam) {
    addSubsectionHeader('1.3 Leadership Team');
    addParagraph(data.executiveSummary.leadershipTeam);
  }

  if (data.executiveSummary.financialHighlights.length > 0) {
    addSubsectionHeader('1.4 Financial Highlights');
    addFinancialTable(
      '5-Year Financial Summary',
      data.executiveSummary.financialHighlights.map((h) => ({
        category: h.metric,
        year1: h.year1,
        year2: h.year2,
        year3: h.year3,
        year4: h.year4,
        year5: h.year5,
      }))
    );
  }

  if (data.executiveSummary.objectives.length > 0) {
    addSubsectionHeader('1.5 Objectives');
    addBulletList(data.executiveSummary.objectives);
  }

  // 2. COMPANY DESCRIPTION
  addSectionHeader('2. Company Description');

  if (data.companyDescription.overview) {
    addSubsectionHeader('2.1 Company Overview');
    addParagraph(data.companyDescription.overview);
  }

  if (data.companyDescription.competitiveAdvantages) {
    addSubsectionHeader('2.2 Competitive Advantages');
    addParagraph(data.companyDescription.competitiveAdvantages);
  }

  if (data.companyDescription.legalStructure) {
    addSubsectionHeader('2.3 Legal Structure and Ownership');
    addParagraph(data.companyDescription.legalStructure);
  }

  // 3. MARKET ANALYSIS
  addSectionHeader('3. Market Analysis');

  if (data.marketAnalysis.industryAnalysis) {
    addSubsectionHeader('3.1 Industry Analysis');
    addParagraph(data.marketAnalysis.industryAnalysis);
  }

  if (data.marketAnalysis.targetMarket) {
    addSubsectionHeader('3.2 Target Market');
    addParagraph(data.marketAnalysis.targetMarket);
  }

  // 4. ORGANIZATION AND MANAGEMENT
  addSectionHeader('4. Organization and Management');

  if (data.organizationManagement.orgStructure) {
    addSubsectionHeader('4.1 Organizational Structure');
    addParagraph(data.organizationManagement.orgStructure);
  }

  if (data.organizationManagement.managementTeam) {
    addSubsectionHeader('4.2 Management Team');
    addParagraph(data.organizationManagement.managementTeam);
  }

  if (data.organizationManagement.advisoryBoard) {
    addSubsectionHeader('4.3 Advisory Board');
    addParagraph(data.organizationManagement.advisoryBoard);
  }

  // 5. PRODUCTS OR SERVICES
  addSectionHeader('5. Products or Services');

  if (data.productsServices.description) {
    addSubsectionHeader('5.1 Product or Service Description');
    addParagraph(data.productsServices.description);
  }

  if (data.productsServices.intellectualProperty) {
    addSubsectionHeader('5.2 Intellectual Property');
    addParagraph(data.productsServices.intellectualProperty);
  }

  if (data.productsServices.researchDevelopment) {
    addSubsectionHeader('5.3 Research and Development');
    addParagraph(data.productsServices.researchDevelopment);
  }

  // 6. MARKETING AND SALES STRATEGY
  addSectionHeader('6. Marketing and Sales Strategy');

  if (data.marketingSales.marketingStrategy) {
    addSubsectionHeader('6.1 Marketing Strategy');
    addParagraph(data.marketingSales.marketingStrategy);
  }

  if (data.marketingSales.salesStrategy) {
    addSubsectionHeader('6.2 Sales Strategy');
    addParagraph(data.marketingSales.salesStrategy);
  }

  if (data.marketingSales.distributionChannels) {
    addSubsectionHeader('6.3 Distribution Channels');
    addParagraph(data.marketingSales.distributionChannels);
  }

  // 7. FINANCIAL PROJECTIONS
  addSectionHeader('7. Financial Projections');

  if (data.financialProjections.assumptions.length > 0) {
    addSubsectionHeader('7.1 Key Assumptions');
    addBulletList(data.financialProjections.assumptions);
  }

  if (data.financialProjections.incomeStatement.length > 0) {
    addSubsectionHeader('7.2 Projected Income Statement');
    addFinancialTable('Income Statement', data.financialProjections.incomeStatement);
  }

  if (data.financialProjections.cashFlow.length > 0) {
    addSubsectionHeader('7.3 Projected Cash Flow');
    addFinancialTable('Cash Flow Statement', data.financialProjections.cashFlow);
  }

  if (data.financialProjections.balanceSheet.length > 0) {
    addSubsectionHeader('7.4 Projected Balance Sheet');
    addFinancialTable('Balance Sheet', data.financialProjections.balanceSheet);
  }

  if (data.financialProjections.breakEvenAnalysis) {
    addSubsectionHeader('7.5 Break-Even Analysis');
    addParagraph(data.financialProjections.breakEvenAnalysis);
  }

  // 8. FUNDING REQUEST
  addSectionHeader('8. Funding Request');

  if (data.fundingRequest.currentFunding) {
    addSubsectionHeader('8.1 Current Funding');
    addParagraph(data.fundingRequest.currentFunding);
  }

  if (data.fundingRequest.requirements) {
    addSubsectionHeader('8.2 Funding Requirements');
    addParagraph(data.fundingRequest.requirements);
  }

  if (data.fundingRequest.futureFunding) {
    addSubsectionHeader('8.3 Future Funding Plans');
    addParagraph(data.fundingRequest.futureFunding);
  }

  // 9. APPENDIX
  if (data.appendix.length > 0) {
    addSectionHeader('9. Appendix');
    addBulletList(data.appendix);
  }

  // Add final page number
  doc.setFontSize(9);
  doc.setTextColor(...lightGray);
  doc.text(`Page ${pageNumber}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
}

// Get authenticated user ID from session (more secure than trusting request body)
