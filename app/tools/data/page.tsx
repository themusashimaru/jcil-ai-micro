/**
 * DATA ANALYSIS TOOL
 * PURPOSE: CSV/XLSX file analysis and insights
 */

'use client';

import { ToolLauncher, type ToolConfig } from '@/components/tools/ToolLauncher';

const DATA_CONFIG: ToolConfig = {
  id: 'data',
  icon: '📊',
  title: 'Data Analyzer',
  description: 'Upload and analyze CSV or Excel files. Get insights, charts, and summaries.',
  fields: [
    {
      name: 'file',
      label: 'Data File',
      type: 'file',
      required: true,
    },
    {
      name: 'analysisType',
      label: 'Analysis Type',
      type: 'select',
      required: true,
      options: [
        { value: 'summary', label: 'Summary Statistics' },
        { value: 'trends', label: 'Trends & Patterns' },
        { value: 'correlations', label: 'Correlations' },
        { value: 'anomalies', label: 'Anomaly Detection' },
        { value: 'forecasting', label: 'Forecasting' },
      ],
    },
    {
      name: 'visualizations',
      label: 'Visualizations',
      type: 'select',
      required: true,
      options: [
        { value: 'auto', label: 'Auto-generate charts' },
        { value: 'none', label: 'No visualizations' },
        { value: 'custom', label: 'Custom (describe below)' },
      ],
    },
    {
      name: 'questions',
      label: 'Specific Questions',
      type: 'textarea',
      placeholder: 'Any specific questions about your data? (optional)\ne.g., What are the top performing categories? Is there a seasonal pattern?',
      rows: 4,
    },
  ],
  examples: [
    'Sales data analysis',
    'Customer behavior patterns',
    'Financial trend analysis',
  ],
};

export default function DataAnalysisPage() {
  return <ToolLauncher config={DATA_CONFIG} />;
}
