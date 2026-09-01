import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export const VisualizationsView: React.FC = () => {
  const [selectedMetric, setSelectedMetric] = useState<'trends' | 'demographics' | 'regional'>('demographics');

  const trendData = [
    { date: 'Mon', responses: 420, verified: 395 },
    { date: 'Tue', responses: 680, verified: 650 },
    { date: 'Wed', responses: 890, verified: 860 },
    { date: 'Thu', responses: 1120, verified: 1080 },
    { date: 'Fri', responses: 980, verified: 940 },
    { date: 'Sat', responses: 1350, verified: 1310 },
    { date: 'Sun', responses: 1540, verified: 1490 }
  ];

  const educationPie = [
    { name: "Bachelor's Degree", value: 3700, color: '#1a365d' },
    { name: 'High School', value: 2000, color: '#006a68' },
    { name: 'Postgraduate (MS/PhD)', value: 1400, color: '#e88532' }
  ];

  const regionData = [
    { region: 'North District', completed: 3400, target: 3500 },
    { region: 'East District', completed: 2890, target: 3000 },
    { region: 'South District', completed: 3120, target: 3000 },
    { region: 'West District', completed: 2100, target: 2500 }
  ];

  return (
    <div className="max-w-[1280px] mx-auto p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#002045] tracking-tight">
            Data Visualizations & Exploratory Analytics
          </h1>
          <p className="text-[#43474e] text-sm md:text-base mt-1">
            Real-time visual telemetry, demographic distributions, and temporal collection curves.
          </p>
        </div>

        <div className="flex bg-[#f1f3ff] p-1 rounded-xl border border-[#c4c6cf]/60 text-xs font-semibold">
          <button
            onClick={() => setSelectedMetric('demographics')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              selectedMetric === 'demographics'
                ? 'bg-[#1a365d] text-white shadow-xs'
                : 'text-[#43474e] hover:text-[#002045]'
            }`}
          >
            Demographics
          </button>
          <button
            onClick={() => setSelectedMetric('trends')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              selectedMetric === 'trends'
                ? 'bg-[#1a365d] text-white shadow-xs'
                : 'text-[#43474e] hover:text-[#002045]'
            }`}
          >
            Collection Trends
          </button>
          <button
            onClick={() => setSelectedMetric('regional')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              selectedMetric === 'regional'
                ? 'bg-[#1a365d] text-white shadow-xs'
                : 'text-[#43474e] hover:text-[#002045]'
            }`}
          >
            Regional Targets
          </button>
        </div>
      </div>

      {/* Grid of Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Temporal Intake Area Chart */}
        <div className="lg:col-span-8 bg-white rounded-xl p-6 card-shadow border border-[#c4c6cf]/40">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-base font-bold text-[#002045]">
                Daily Response Ingestion & Verification Rate
              </h3>
              <p className="text-xs text-[#43474e] mt-0.5">
                Ingested payload volume vs. automated schema pass
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-[#006a68] bg-[#006a68]/10 px-2.5 py-1 rounded">
              97.4% Pass Rate
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorResp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1a365d" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#1a365d" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorVerif" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#006a68" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#006a68" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3e8f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#43474e' }} />
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
                <Area
                  type="monotone"
                  dataKey="responses"
                  stroke="#1a365d"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorResp)"
                  name="Total Ingested"
                />
                <Area
                  type="monotone"
                  dataKey="verified"
                  stroke="#006a68"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorVerif)"
                  name="Verified Valid"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Education Breakdown Pie Chart */}
        <div className="lg:col-span-4 bg-white rounded-xl p-6 card-shadow border border-[#c4c6cf]/40 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-[#002045] mb-1">
              Sample Stratification
            </h3>
            <p className="text-xs text-[#43474e] mb-4">Education Level Demographic</p>

            <div className="h-56 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={educationPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {educationPie.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-[#002045]">7,100</span>
                <span className="text-[10px] text-[#74777f] font-semibold uppercase">Cohort N</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-[#c4c6cf]/30 pt-3 text-xs">
            {educationPie.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[#43474e]">{item.name}</span>
                </div>
                <span className="font-mono font-bold text-[#161c27]">
                  {Math.round((item.value / 7100) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Regional Quota Fulfillment Bar Chart */}
        <div className="lg:col-span-12 bg-white rounded-xl p-6 card-shadow border border-[#c4c6cf]/40">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-base font-bold text-[#002045]">
                District Target Quotas vs. Actual Enumerations
              </h3>
              <p className="text-xs text-[#43474e] mt-0.5">
                Sampling quota tracking across designated field clusters
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3e8f9" />
                <XAxis dataKey="region" tick={{ fontSize: 11, fill: '#43474e' }} />
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
                <Bar dataKey="completed" fill="#1a365d" radius={[4, 4, 0, 0]} name="Completed Surveys" />
                <Bar dataKey="target" fill="#adc7f7" radius={[4, 4, 0, 0]} name="Target Sampling Quota" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
