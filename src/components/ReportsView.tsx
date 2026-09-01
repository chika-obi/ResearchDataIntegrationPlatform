import React, { useState } from 'react';

export const ReportsView: React.FC = () => {
  const [reportFormat, setReportFormat] = useState<'apa' | 'chicago' | 'harvard'>('apa');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeSection, setActiveSection] = useState<'chapter4' | 'executive' | 'methodology'>('chapter4');
  const [copiedNotification, setCopiedNotification] = useState(false);

  const handleExport = (type: 'pdf' | 'docx' | 'latex') => {
    alert(`Exporting complete Academic Research Monograph in .${type} format.`);
  };

  const handleCopyText = () => {
    navigator.clipboard?.writeText(chapter4Content);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  const chapter4Content = `CHAPTER 4: RESULTS AND DATA ANALYSIS

4.1 Demographic Characteristics of the Sample
A total of N = 12,450 household surveys were collected across four regional sampling clusters (North, East, South, and West Districts). Following rigorous data validation using the automated RDIP anomaly detection algorithm, n = 7,100 records were selected for primary cross-tabulation and inferential analysis. As summarized in Table 4.1, respondents with a Bachelor's degree comprised 52.1% (n = 3,700) of the primary sample, while High School graduates represented 28.2% (n = 2,000), and Postgraduate degree holders constituted 19.7% (n = 1,400).

Table 4.1
Cross-Tabulation of Education Level and Employment Status (N = 7,100)
-------------------------------------------------------------------------------------
Education Level      Employed Full-time     Part-time     Unemployed     Total
-------------------------------------------------------------------------------------
High School          1,420 (71.0%)          380 (19.0%)   200 (10.0%)    2,000 (100%)
Bachelor's           3,100 (83.8%)          450 (12.2%)   150 (4.0%)     3,700 (100%)
Postgraduate         1,250 (89.3%)          120 (8.6%)     30 (2.1%)     1,400 (100%)
-------------------------------------------------------------------------------------
Total                5,770 (81.3%)          950 (13.4%)   380 (5.4%)     7,100 (100%)
-------------------------------------------------------------------------------------
Note. χ²(4, N = 7100) = 48.21, p < .001, Cramér's V = .197.

4.2 Hypothesis Testing & Inferential Statistics
A Pearson Chi-Square test of independence was conducted to evaluate the relationship between formal education level and employment status. The relationship between these variables was statistically significant, χ²(4, N = 7100) = 48.21, p < .001. The effect size, as assessed by Cramér's V, was .197, indicating a moderate association. Consequently, the null hypothesis (H₀) of demographic independence was rejected.

4.3 Multiple Linear Regression of Household Income
Multiple regression analysis was conducted to predict monthly household income from years of formal education, respondent age, and urbanicity. The overall regression model was statistically significant, F(3, 12446) = 3,281.4, p < .001, accounting for 44.2% of the variance in household income (R² = .442, Adjusted R² = .441). Education was the strongest unique predictor (β = .412, p < .001), followed by urbanicity (β = .224, p < .001) and age (β = .185, p < .001).`;

  return (
    <div className="max-w-[1280px] mx-auto p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#002045] tracking-tight">
            Academic Report & Thesis Synthesis
          </h1>
          <p className="text-[#43474e] text-sm md:text-base mt-1">
            Automated generation of publication-ready Chapter 4 Results, APA 7th tables, and peer-review manuscripts.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleExport('docx')}
            className="px-3.5 py-2 border border-[#c4c6cf] text-[#002045] hover:bg-[#f1f3ff] rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-white shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">description</span>
            <span>Export .DOCX</span>
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="px-3.5 py-2 border border-[#c4c6cf] text-[#002045] hover:bg-[#f1f3ff] rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-white shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
            <span>Export .PDF</span>
          </button>
          <button
            onClick={() => handleExport('latex')}
            className="px-4 py-2 bg-[#1a365d] text-white hover:bg-[#002045] rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">code</span>
            <span>Export LaTeX</span>
          </button>
        </div>
      </div>

      {/* Grid: Document Sidebar & Manuscript Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar Controls */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl p-6 card-shadow border border-[#c4c6cf]/40 space-y-4">
            <h3 className="text-base font-bold text-[#002045]">Report Configuration</h3>

            <div>
              <label className="block text-xs font-semibold text-[#43474e] mb-1.5">
                Citation & Formatting Style
              </label>
              <select
                value={reportFormat}
                onChange={(e) => setReportFormat(e.target.value as any)}
                className="w-full p-2.5 bg-[#f9f9ff] border border-[#c4c6cf] rounded-lg text-xs font-semibold text-[#002045] focus:border-[#1a365d] outline-none"
              >
                <option value="apa">APA 7th Edition (American Psychological Assoc.)</option>
                <option value="chicago">Chicago Manual of Style (17th Ed.)</option>
                <option value="harvard">Harvard Referencing Standard</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#43474e] mb-1.5">
                Document Sections
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => setActiveSection('chapter4')}
                  className={`w-full text-left p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                    activeSection === 'chapter4'
                      ? 'bg-[#1a365d] text-white border-[#1a365d]'
                      : 'bg-[#f9f9ff] text-[#43474e] border-[#c4c6cf]/60 hover:bg-[#f1f3ff]'
                  }`}
                >
                  <span>Chapter 4: Results & Inference</span>
                  <span className="material-symbols-outlined text-[16px]">article</span>
                </button>

                <button
                  onClick={() => setActiveSection('executive')}
                  className={`w-full text-left p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                    activeSection === 'executive'
                      ? 'bg-[#1a365d] text-white border-[#1a365d]'
                      : 'bg-[#f9f9ff] text-[#43474e] border-[#c4c6cf]/60 hover:bg-[#f1f3ff]'
                  }`}
                >
                  <span>Executive Policy Brief</span>
                  <span className="material-symbols-outlined text-[16px]">summarize</span>
                </button>

                <button
                  onClick={() => setActiveSection('methodology')}
                  className={`w-full text-left p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                    activeSection === 'methodology'
                      ? 'bg-[#1a365d] text-white border-[#1a365d]'
                      : 'bg-[#f9f9ff] text-[#43474e] border-[#c4c6cf]/60 hover:bg-[#f1f3ff]'
                  }`}
                >
                  <span>Sampling & Methodology Note</span>
                  <span className="material-symbols-outlined text-[16px]">tune</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[#f1f3ff] rounded-xl p-6 card-shadow border border-[#adc7f7] space-y-3">
            <h4 className="text-xs font-bold text-[#002045] uppercase tracking-wider">
              Academic Compliance Note
            </h4>
            <p className="text-xs text-[#43474e] leading-relaxed">
              All statistical tables conform to APA 7th standards: zero vertical rules, bold column headers, italicized statistical symbols (<i>p</i>, <i>F</i>, <i>t</i>, <i>χ²</i>, <i>N</i>), and standard probability note legends.
            </p>
          </div>
        </div>

        {/* Manuscript Viewer */}
        <div className="lg:col-span-8 bg-white rounded-xl card-shadow border border-[#c4c6cf]/40 p-6 md:p-8 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center pb-4 border-b border-[#c4c6cf]/30 mb-6">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1a365d]">menu_book</span>
                <span className="text-sm font-bold text-[#002045]">
                  Manuscript Preview • {reportFormat.toUpperCase()} Format
                </span>
              </div>
              <button
                onClick={handleCopyText}
                className="text-xs font-semibold text-[#1a365d] hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                <span>{copiedNotification ? 'Copied to Clipboard' : 'Copy All Text'}</span>
              </button>
            </div>

            {/* Document Paper Representation */}
            <div className="bg-[#fcfcff] border border-[#c4c6cf]/50 rounded-xl p-6 md:p-8 font-serif text-[#161c27] text-sm md:text-[15px] leading-relaxed space-y-4 shadow-xs max-h-[580px] overflow-y-auto">
              <h2 className="text-lg md:text-xl font-bold font-sans text-[#002045] tracking-tight">
                CHAPTER 4: RESULTS AND STATISTICAL DATA ANALYSIS
              </h2>

              <p>
                <strong>4.1 Demographic Characteristics of the Sample</strong>
                <br />
                A total of <i>N</i> = 12,450 household surveys were collected across four regional sampling clusters (North, East, South, and West Districts). Following rigorous data validation using the automated RDIP anomaly detection algorithm, <i>n</i> = 7,100 records were selected for primary cross-tabulation and inferential analysis.
              </p>

              {/* Formatted APA Table */}
              <div className="my-4 font-sans text-xs bg-white border-y-2 border-[#161c27] p-3 overflow-x-auto">
                <div className="font-bold text-[#161c27] mb-1">Table 4.1</div>
                <div className="italic text-[#43474e] mb-2">
                  Cross-Tabulation of Education Level and Employment Status (N = 7,100)
                </div>
                <table className="w-full text-left border-collapse border-b border-[#161c27]">
                  <thead>
                    <tr className="border-b border-[#161c27] font-bold">
                      <th className="py-2">Education Level</th>
                      <th className="py-2 text-right">Employed Full-time</th>
                      <th className="py-2 text-right">Part-time</th>
                      <th className="py-2 text-right">Unemployed</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="py-2">High School</td>
                      <td className="py-2 text-right">1,420 (71.0%)</td>
                      <td className="py-2 text-right">380 (19.0%)</td>
                      <td className="py-2 text-right">200 (10.0%)</td>
                      <td className="py-2 text-right font-semibold">2,000 (100%)</td>
                    </tr>
                    <tr>
                      <td className="py-2">Bachelor's</td>
                      <td className="py-2 text-right">3,100 (83.8%)</td>
                      <td className="py-2 text-right">450 (12.2%)</td>
                      <td className="py-2 text-right">150 (4.0%)</td>
                      <td className="py-2 text-right font-semibold">3,700 (100%)</td>
                    </tr>
                    <tr>
                      <td className="py-2">Postgraduate</td>
                      <td className="py-2 text-right">1,250 (89.3%)</td>
                      <td className="py-2 text-right">120 (8.6%)</td>
                      <td className="py-2 text-right">30 (2.1%)</td>
                      <td className="py-2 text-right font-semibold">1,400 (100%)</td>
                    </tr>
                  </tbody>
                </table>
                <div className="text-[10px] text-[#74777f] mt-2 italic">
                  Note. χ²(4, N = 7100) = 48.21, p &lt; .001, Cramér's V = .197.
                </div>
              </div>

              <p>
                <strong>4.2 Hypothesis Testing & Inferential Statistics</strong>
                <br />
                A Pearson Chi-Square test of independence was conducted to evaluate the relationship between formal education level and employment status. The relationship between these variables was statistically significant, <i>χ²</i>(4, <i>N</i> = 7100) = 48.21, <i>p</i> &lt; .001. The effect size, as assessed by Cramér's <i>V</i>, was .197, indicating a moderate association. Consequently, the null hypothesis (<i>H₀</i>) of demographic independence was rejected.
              </p>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[#c4c6cf]/30 flex justify-between items-center text-xs text-[#74777f]">
            <span>Generated using RDIP Statistical Synthesizer v2.4</span>
            <span className="font-mono">Word Count: 1,842 words</span>
          </div>
        </div>
      </div>
    </div>
  );
};
