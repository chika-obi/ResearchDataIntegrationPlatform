import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { CROSS_TAB_DATA, STAT_RECOMMENDATIONS } from '../data/mockData';
import { StatisticalRecommendation } from '../types';

export const StatisticalAnalysisView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'recommendations' | 'crosstab' | 'regression'>('crosstab');
  const [selectedRec, setSelectedRec] = useState<StatisticalRecommendation | null>(null);
  const [showRowPercent, setShowRowPercent] = useState(true);
  const [copiedApa, setCopiedApa] = useState(false);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [rowVar, setRowVar] = useState('Education Level (Q4)');
  const [colVar, setColVar] = useState('Employment Status (Q8)');

  const chartData = [
    { education: 'High School', Employed: 1420, PartTime: 380, Unemployed: 200 },
    { education: "Bachelor's", Employed: 3100, PartTime: 450, Unemployed: 150 },
    { education: 'Postgraduate', Employed: 1250, PartTime: 120, Unemployed: 30 }
  ];

  const handleRunRec = (rec: StatisticalRecommendation) => {
    setIsRunningTest(true);
    setSelectedRec(rec);
    setTimeout(() => {
      setIsRunningTest(false);
      setActiveTab('crosstab');
    }, 800);
  };

  const handleCopyApa = () => {
    const apaTable = `Table 1
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
Note. χ²(4, N = 7100) = 48.21, p < .001, Cramér's V = .197.`;

    navigator.clipboard?.writeText(apaTable);
    setCopiedApa(true);
    setTimeout(() => setCopiedApa(false), 2500);
  };

  return (
    <div className="max-w-[1280px] mx-auto p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#002045] tracking-tight">
            Statistical Analysis & Inference
          </h1>
          <p className="text-[#43474e] text-sm md:text-base mt-1">
            Run hypothesis tests, cross-tabulations, regression models, and view automated statistical recommendations.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-[#f1f3ff] p-1 rounded-xl border border-[#c4c6cf]/60 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('crosstab')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'crosstab'
                ? 'bg-[#1a365d] text-white shadow-xs'
                : 'text-[#43474e] hover:text-[#002045]'
            }`}
          >
            Cross-Tabulation & χ²
          </button>
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'recommendations'
                ? 'bg-[#1a365d] text-white shadow-xs'
                : 'text-[#43474e] hover:text-[#002045]'
            }`}
          >
            AI Test Recommendations
          </button>
          <button
            onClick={() => setActiveTab('regression')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'regression'
                ? 'bg-[#1a365d] text-white shadow-xs'
                : 'text-[#43474e] hover:text-[#002045]'
            }`}
          >
            Regression Models
          </button>
        </div>
      </div>

      {/* Tab 1: AI Recommendations (Screen 9) */}
      {activeTab === 'recommendations' && (
        <div className="space-y-6">
          <div className="bg-[#e3e8f9]/50 border border-[#adc7f7] rounded-xl p-4 flex items-center gap-3">
            <span className="material-symbols-outlined text-[#002045] text-2xl">psychology</span>
            <div>
              <h3 className="text-xs font-bold text-[#002045] uppercase tracking-wider">
                Automated Model Selector
              </h3>
              <p className="text-xs text-[#43474e] mt-0.5">
                The engine analyzed your 12,450 records and variable types (nominal, ordinal, continuous) to recommend optimal parametric and non-parametric tests.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STAT_RECOMMENDATIONS.map((rec) => (
              <div
                key={rec.id}
                className="bg-white rounded-xl p-6 card-shadow border border-[#c4c6cf]/40 flex flex-col justify-between hover:border-[#1a365d] transition-all space-y-4"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-[#006a68]/10 text-[#006a68] px-2 py-0.5 rounded">
                      {rec.type}
                    </span>
                    <span className="text-xs font-mono font-bold text-[#1a365d]">
                      {rec.confidence}% Match
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[#002045] mb-2">{rec.title}</h3>
                  <p className="text-xs text-[#43474e] leading-relaxed mb-4">{rec.reason}</p>

                  <div className="space-y-2 bg-[#f9f9ff] p-3 rounded-lg border border-[#c4c6cf]/30 text-xs">
                    <div>
                      <span className="font-semibold text-[#161c27]">Variables: </span>
                      <span className="text-[#43474e]">{rec.variables.join(', ')}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-[#161c27]">Expected Output: </span>
                      <span className="text-[#43474e]">{rec.expectedOutput}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleRunRec(rec)}
                  className="w-full bg-[#1a365d] hover:bg-[#002045] text-white text-xs font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-xs transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                  <span>Run This Analysis</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Cross-Tabulation & Chi-Square Matrix (Screen 10) */}
      {activeTab === 'crosstab' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white p-5 rounded-xl card-shadow border border-[#c4c6cf]/40 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full md:w-auto">
              <div>
                <label className="block text-[11px] font-bold text-[#43474e] uppercase mb-1">
                  Row Variable (Independent)
                </label>
                <select
                  value={rowVar}
                  onChange={(e) => setRowVar(e.target.value)}
                  className="w-full md:w-64 p-2 bg-[#f9f9ff] border border-[#c4c6cf] rounded-lg text-xs font-semibold text-[#002045] focus:border-[#1a365d] outline-none"
                >
                  <option>Education Level (Q4)</option>
                  <option>Geographic Region (Q1)</option>
                  <option>Household Income Bracket (Q6)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#43474e] uppercase mb-1">
                  Column Variable (Dependent)
                </label>
                <select
                  value={colVar}
                  onChange={(e) => setColVar(e.target.value)}
                  className="w-full md:w-64 p-2 bg-[#f9f9ff] border border-[#c4c6cf] rounded-lg text-xs font-semibold text-[#002045] focus:border-[#1a365d] outline-none"
                >
                  <option>Employment Status (Q8)</option>
                  <option>Digital Literacy Level (Q10)</option>
                  <option>Healthcare Access (Q14)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#43474e]">
                <input
                  type="checkbox"
                  checked={showRowPercent}
                  onChange={(e) => setShowRowPercent(e.target.checked)}
                  className="rounded text-[#1a365d]"
                />
                <span>Show Row %</span>
              </label>

              <button
                onClick={handleCopyApa}
                className="px-3.5 py-2 border border-[#c4c6cf] text-[#002045] hover:bg-[#f1f3ff] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {copiedApa ? 'check' : 'content_copy'}
                </span>
                <span>{copiedApa ? 'Copied APA Table' : 'Copy APA Table'}</span>
              </button>
            </div>
          </div>

          {/* Cross-Tabulation Matrix Table */}
          <div className="bg-white rounded-xl card-shadow border border-[#c4c6cf]/40 overflow-hidden">
            <div className="p-5 border-b border-[#c4c6cf]/40 flex justify-between items-center bg-[#f9f9ff]">
              <div>
                <h3 className="text-base font-bold text-[#002045]">
                  Cross-Tabulation Contingency Matrix
                </h3>
                <p className="text-xs text-[#43474e] mt-0.5">
                  Observed Frequencies & Row Proportions (N = 7,100)
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-[#006a68] bg-[#006a68]/10 px-2.5 py-1 rounded">
                Valid Cases: 100%
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f1f3ff]/60 border-b border-[#c4c6cf]/40 text-xs font-semibold text-[#43474e] uppercase tracking-wider">
                    <th className="py-3 px-5">Education Level</th>
                    <th className="py-3 px-5 text-right">Formal Employed</th>
                    <th className="py-3 px-5 text-right">Informal / Trade</th>
                    <th className="py-3 px-5 text-right">Farming / Ag</th>
                    <th className="py-3 px-5 text-right">Unemployed</th>
                    <th className="py-3 px-5 text-right font-bold text-[#002045]">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c4c6cf]/30 text-xs">
                  {CROSS_TAB_DATA.map((row) => (
                    <tr key={row.education} className="hover:bg-[#f1f3ff]/40 transition-colors">
                      <td className="py-4 px-5 font-bold text-[#002045]">{row.education}</td>
                      <td className="py-4 px-5 text-right">
                        <span className="font-mono font-semibold text-[#161c27]">
                          {row.employed.toLocaleString()}
                        </span>
                        {showRowPercent && (
                          <span className="block text-[11px] text-[#74777f]">
                            ({Math.round((row.employed / row.total) * 100)}%)
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <span className="font-mono font-semibold text-[#161c27]">
                          {row.informal.toLocaleString()}
                        </span>
                        {showRowPercent && (
                          <span className="block text-[11px] text-[#74777f]">
                            ({Math.round((row.informal / row.total) * 100)}%)
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <span className="font-mono font-semibold text-[#161c27]">
                          {row.farming.toLocaleString()}
                        </span>
                        {showRowPercent && (
                          <span className="block text-[11px] text-[#74777f]">
                            ({Math.round((row.farming / row.total) * 100)}%)
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <span className="font-mono font-semibold text-[#161c27]">
                          {row.unemployed.toLocaleString()}
                        </span>
                        {showRowPercent && (
                          <span className="block text-[11px] text-[#74777f]">
                            ({Math.round((row.unemployed / row.total) * 100)}%)
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-right font-mono font-bold text-[#002045]">
                        {row.total.toLocaleString()}
                        {showRowPercent && (
                          <span className="block text-[11px] text-[#74777f]">(100%)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-[#f1f3ff]/70 font-bold text-[#002045]">
                    <td className="py-3 px-5">Total Sample</td>
                    <td className="py-3 px-5 text-right font-mono">5,770 (81.3%)</td>
                    <td className="py-3 px-5 text-right font-mono">950 (13.4%)</td>
                    <td className="py-3 px-5 text-right font-mono">380 (5.4%)</td>
                    <td className="py-3 px-5 text-right font-mono text-sm">7,100 (100%)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Statistical Test Inference Box & Chart Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Chart */}
            <div className="lg:col-span-7 bg-white rounded-xl p-6 card-shadow border border-[#c4c6cf]/40">
              <h3 className="text-base font-bold text-[#002045] mb-4">
                Conditional Distribution Chart
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e3e8f9" />
                    <XAxis dataKey="education" tick={{ fontSize: 11, fill: '#43474e' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#43474e' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#c4c6cf',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="Employed" fill="#1a365d" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="PartTime" fill="#006a68" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Unemployed" fill="#ba1a1a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Test Summary Box */}
            <div className="lg:col-span-5 bg-white rounded-xl p-6 card-shadow border border-[#c4c6cf]/40 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between border-b border-[#c4c6cf]/30 pb-3 mb-4">
                  <h3 className="text-base font-bold text-[#002045]">
                    Chi-Square Test Results
                  </h3>
                  <span className="material-symbols-outlined text-[#006a68]">verified</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-[#f1f3ff] rounded-lg flex justify-between items-center">
                    <span className="text-[#43474e]">Pearson Chi-Square (χ²)</span>
                    <span className="font-mono font-bold text-[#002045]">48.214</span>
                  </div>

                  <div className="p-3 bg-[#f1f3ff] rounded-lg flex justify-between items-center">
                    <span className="text-[#43474e]">Degrees of Freedom (df)</span>
                    <span className="font-mono font-bold text-[#002045]">4</span>
                  </div>

                  <div className="p-3 bg-[#006a68]/10 rounded-lg flex justify-between items-center border border-[#006a68]/20">
                    <span className="text-[#006a68] font-bold">Asymptotic Sig. (2-sided)</span>
                    <span className="font-mono font-bold text-[#006a68]">p &lt; 0.001 ***</span>
                  </div>

                  <div className="p-3 bg-[#f1f3ff] rounded-lg flex justify-between items-center">
                    <span className="text-[#43474e]">Cramér's V Effect Size</span>
                    <span className="font-mono font-bold text-[#002045]">0.197 (Moderate)</span>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-lg bg-[#f9f9ff] border border-[#c4c6cf]/40 text-[11px] text-[#43474e] leading-relaxed">
                  <strong className="text-[#002045]">Statistical Conclusion: </strong>
                  The null hypothesis of independence is rejected at α = 0.01. Higher education levels correlate with significantly higher full-time employment rates.
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleCopyApa}
                  className="w-full bg-[#1a365d] text-white text-xs font-semibold py-2.5 rounded-lg hover:bg-[#002045] transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  <span>{copiedApa ? 'Copied APA Citation' : 'Copy Formatted APA Citation'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Regression Models */}
      {activeTab === 'regression' && (
        <div className="bg-white rounded-xl card-shadow border border-[#c4c6cf]/40 p-6 space-y-6">
          <div className="flex justify-between items-start border-b border-[#c4c6cf]/30 pb-4">
            <div>
              <h2 className="text-lg font-bold text-[#002045]">
                Ordinary Least Squares (OLS) Multiple Regression
              </h2>
              <p className="text-xs text-[#43474e] mt-0.5">
                Dependent Variable: Monthly Household Income (USD) • N = 12,450
              </p>
            </div>
            <span className="px-3 py-1 bg-[#006a68]/10 text-[#006a68] text-xs font-bold rounded-full">
              R² = 0.442 • F(3, 12446) = 3,281.4 (p &lt; .001)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f1f3ff]/60 border-b border-[#c4c6cf]/40 font-semibold text-[#43474e] uppercase tracking-wider">
                  <th className="py-3 px-4">Predictor Variable</th>
                  <th className="py-3 px-4 text-right">B (Unstandardized)</th>
                  <th className="py-3 px-4 text-right">Std. Error</th>
                  <th className="py-3 px-4 text-right">β (Standardized)</th>
                  <th className="py-3 px-4 text-right">t-statistic</th>
                  <th className="py-3 px-4 text-right">p-value</th>
                  <th className="py-3 px-4 text-right">95% Confidence Interval</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c4c6cf]/30">
                <tr className="hover:bg-[#f1f3ff]/40">
                  <td className="py-3.5 px-4 font-bold text-[#002045]">Constant (Intercept)</td>
                  <td className="py-3.5 px-4 text-right font-mono">1,120.45</td>
                  <td className="py-3.5 px-4 text-right font-mono">42.10</td>
                  <td className="py-3.5 px-4 text-right font-mono">—</td>
                  <td className="py-3.5 px-4 text-right font-mono">26.61</td>
                  <td className="py-3.5 px-4 text-right font-mono">&lt; .001</td>
                  <td className="py-3.5 px-4 text-right font-mono">[1,037.9, 1,202.9]</td>
                </tr>
                <tr className="hover:bg-[#f1f3ff]/40">
                  <td className="py-3.5 px-4 font-bold text-[#002045]">Years of Education (Q4)</td>
                  <td className="py-3.5 px-4 text-right font-mono">245.80</td>
                  <td className="py-3.5 px-4 text-right font-mono">5.20</td>
                  <td className="py-3.5 px-4 text-right font-mono">0.412</td>
                  <td className="py-3.5 px-4 text-right font-mono">47.27</td>
                  <td className="py-3.5 px-4 text-right font-mono text-[#006a68] font-bold">&lt; .001</td>
                  <td className="py-3.5 px-4 text-right font-mono">[235.6, 256.0]</td>
                </tr>
                <tr className="hover:bg-[#f1f3ff]/40">
                  <td className="py-3.5 px-4 font-bold text-[#002045]">Respondent Age (Q1)</td>
                  <td className="py-3.5 px-4 text-right font-mono">34.12</td>
                  <td className="py-3.5 px-4 text-right font-mono">1.84</td>
                  <td className="py-3.5 px-4 text-right font-mono">0.185</td>
                  <td className="py-3.5 px-4 text-right font-mono">18.54</td>
                  <td className="py-3.5 px-4 text-right font-mono text-[#006a68] font-bold">&lt; .001</td>
                  <td className="py-3.5 px-4 text-right font-mono">[30.5, 37.7]</td>
                </tr>
                <tr className="hover:bg-[#f1f3ff]/40">
                  <td className="py-3.5 px-4 font-bold text-[#002045]">Urban Location (Dummy)</td>
                  <td className="py-3.5 px-4 text-right font-mono">410.20</td>
                  <td className="py-3.5 px-4 text-right font-mono">24.50</td>
                  <td className="py-3.5 px-4 text-right font-mono">0.224</td>
                  <td className="py-3.5 px-4 text-right font-mono">16.74</td>
                  <td className="py-3.5 px-4 text-right font-mono text-[#006a68] font-bold">&lt; .001</td>
                  <td className="py-3.5 px-4 text-right font-mono">[362.2, 458.2]</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
