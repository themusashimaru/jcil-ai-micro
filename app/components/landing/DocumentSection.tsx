/**
 * DOCUMENT GENERATION SECTION
 *
 * Showcases real document generation capabilities
 * Word, Excel, PDF with actual formatting features
 */

import Section, { SectionHeader } from './Section';
import FeatureCard from './FeatureCard';
import { CheckCircleIcon, WordIcon, SpreadsheetIcon, PdfIcon, FormulaIcon } from './Icons';

export default function DocumentSection() {
  return (
    <Section id="documents" padding="lg">
      <SectionHeader
        badge="Document Generation"
        badgeColor="green"
        title="Professional documents in seconds"
        description="Create publication-ready Word docs, Excel spreadsheets, and PDFs with proper formatting, margins, and advanced formulas."
      />

      <div className="max-w-5xl mx-auto">
        {/* Main Feature Card */}
        <div className="relative bg-gradient-to-br from-emerald-950/80 to-slate-950 rounded-3xl p-8 lg:p-12 border border-emerald-500/20 overflow-hidden mb-8">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />

          <div className="relative grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">
                Enterprise-Grade Documents
              </h3>
              <p className="text-slate-300 text-base leading-relaxed mb-6">
                Our document engine generates professional output that rivals dedicated office
                suites. Perfect spacing, proper margins, and intelligent formatting&mdash;whether
                you&apos;re creating a research report or financial spreadsheet.
              </p>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-black/30 rounded-xl p-4 border border-white/5 text-center">
                  <div className="text-3xl font-bold text-emerald-400 mb-1">50+</div>
                  <div className="text-slate-400 text-xs">Excel Formulas</div>
                </div>
                <div className="bg-black/30 rounded-xl p-4 border border-white/5 text-center">
                  <div className="text-3xl font-bold text-emerald-400 mb-1">100%</div>
                  <div className="text-slate-400 text-xs">Type-Safe</div>
                </div>
                <div className="bg-black/30 rounded-xl p-4 border border-white/5 text-center">
                  <div className="text-3xl font-bold text-emerald-400 mb-1">Pro</div>
                  <div className="text-slate-400 text-xs">Typography</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {[
                {
                  title: 'Smart Table Formatting',
                  desc: 'Auto-calculated column widths, alternating row colors, and proper cell padding',
                },
                {
                  title: 'Financial Formulas',
                  desc: 'PMT, NPV, IRR, FV\u2014all the formulas accountants and analysts actually use',
                },
                {
                  title: 'Professional Typography',
                  desc: '1.15 line spacing, proper margins, heading hierarchy\u2014document standards built in',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-3 bg-black/20 rounded-xl p-4 border border-white/5"
                >
                  <CheckCircleIcon className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-white font-medium mb-1">{item.title}</div>
                    <div className="text-slate-400 text-sm">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Document Types Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={<WordIcon className="w-6 h-6" />}
            title="Word Documents"
            description="Reports, letters, and proposals with proper heading styles and professional formatting."
            variant="outlined"
            color="blue"
          />
          <FeatureCard
            icon={<SpreadsheetIcon className="w-6 h-6" />}
            title="Excel Spreadsheets"
            description="Budgets, analyses, and data with SUM, VLOOKUP, SUMIF, and 50+ more formulas."
            variant="outlined"
            color="green"
          />
          <FeatureCard
            icon={<PdfIcon className="w-6 h-6" />}
            title="PDF Reports"
            description="Print-ready documents with headers, footers, and consistent page layout."
            variant="outlined"
            color="pink"
          />
          <FeatureCard
            icon={<FormulaIcon className="w-6 h-6" />}
            title="Smart Formulas"
            description="Type-safe formula builder prevents errors. INDEX/MATCH, IFERROR, financial functions."
            variant="outlined"
            color="purple"
          />
        </div>
      </div>
    </Section>
  );
}
