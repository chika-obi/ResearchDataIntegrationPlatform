import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Bar,
  ComposedChart
} from 'recharts';
import { Project } from '../types';

interface DashboardCompletionTrendsProps {
  projects: Project[];
  onNavigateToAnalytics?: () => void;
  onSelectProject?: (project: Project) => void;
}

interface TrendDayData {
  dayIndex: number;
  dateKey: string;
  formattedDate: string;
  fullDate: string;
  completions: number;
  verified: number;
  offlineSynced: number;
  cumulative: number;
  targetRate: number;
  projectContributions: { [projectId: string]: number };
}

export const DashboardCompletionTrends: React.FC<DashboardCompletionTrendsProps> = ({
  projects,
  onNavigateToAnalytics,
  onSelectProject
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [timeRange, setTimeRange] = useState<30 | 14 | 7>(30);
  const [chartMetric, setChartMetric] = useState<'daily' | 'cumulative'>('daily');
  const [liveOffset, setLiveOffset] = useState<number>(0);

  // Synchronize live field sync events
  useEffect(() => {
    const handleSync = () => {
      setLiveOffset((prev) => prev + 1);
    };
    window.addEventListener('rdip_response_synced', handleSync);
    window.addEventListener('rdip_enumerator_location_updated', handleSync);
    return () => {
      window.removeEventListener('rdip_response_synced', handleSync);
      window.removeEventListener('rdip_enumerator_location_updated', handleSync);
    };
  }, []);

  // Compute 30-day series based on project response metrics
  const fullTrendData = useMemo(() => {
    // Generate dates for the past 30 days up to today
    const now = new Date();
    const days: TrendDayData[] = [];

    // Calculate weighting and scale from active project metrics
    const totalFleetResponses = projects.reduce((acc, p) => acc + (p.responsesCount || 0), 0);
    const activeProjects = projects.filter((p) => p.status === 'Active' || p.status === 'Collection');

    // Pseudo-random deterministic seed generator based on project code and day
    const getProjectDailyVolume = (proj: Project, dayOffset: number, dayOfWeek: number) => {
      // Base daily rate derived from project responses and duration
      const total = proj.responsesCount || 1000;
      const baseDaily = Math.max(12, Math.round(total / 90)); // Approx 90-day collection cycle

      // Weekend deceleration factor (Saturday 75%, Sunday 40%)
      const weekdayMultiplier = dayOfWeek === 0 ? 0.38 : dayOfWeek === 6 ? 0.72 : 1.05 + ((dayOffset % 5) * 0.08);

      // Mid-cycle momentum curve: slight growth over time
      const momentum = 0.85 + (dayOffset / 30) * 0.35;

      // Project-specific variation
      const charCode = proj.id.charCodeAt(proj.id.length - 1) || 1;
      const wave = Math.sin((dayOffset + charCode) * 0.7) * 0.22;

      const daily = Math.max(3, Math.round(baseDaily * weekdayMultiplier * momentum * (1 + wave)));
      return daily;
    };

    let runningCumulative = 0;

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday
      const dayOffset = 29 - i; // 0 (30 days ago) to 29 (today)

      const formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const fullDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      const dateKey = d.toISOString().split('T')[0];

      let dayTotal = 0;
      const projectContributions: { [projectId: string]: number } = {};

      if (selectedProjectId === 'ALL') {
        projects.forEach((proj) => {
          const vol = getProjectDailyVolume(proj, dayOffset, dayOfWeek);
          projectContributions[proj.id] = vol;
          dayTotal += vol;
        });
      } else {
        const targetProj = projects.find((p) => p.id === selectedProjectId);
        if (targetProj) {
          const vol = getProjectDailyVolume(targetProj, dayOffset, dayOfWeek);
          projectContributions[targetProj.id] = vol;
          dayTotal = vol;
        }
      }

      // Add dynamic live response offset to the latest day
      if (i === 0 && liveOffset > 0) {
        dayTotal += liveOffset;
      }

      const verified = Math.round(dayTotal * (0.94 + Math.sin(dayOffset) * 0.03));
      const offlineSynced = Math.round(dayTotal * 0.38);

      runningCumulative += dayTotal;

      // Target benchmark trajectory (ideal linear quota pace)
      const avgTargetPace = selectedProjectId === 'ALL'
        ? Math.round(totalFleetResponses / 85)
        : Math.round(((projects.find((p) => p.id === selectedProjectId)?.responsesCount || 1000) / 85));
      const targetRate = Math.round(avgTargetPace * 1.02);

      days.push({
        dayIndex: dayOffset,
        dateKey,
        formattedDate,
        fullDate,
        completions: dayTotal,
        verified,
        offlineSynced,
        cumulative: runningCumulative,
        targetRate,
        projectContributions
      });
    }

    return days;
  }, [projects, selectedProjectId, liveOffset]);

  // Slice based on active time range selection (7, 14, 30 days)
  const displayData = useMemo(() => {
    return fullTrendData.slice(fullTrendData.length - timeRange);
  }, [fullTrendData, timeRange]);

  // Summary Metrics for the active window
  const summaryMetrics = useMemo(() => {
    const totalInPeriod = displayData.reduce((acc, d) => acc + d.completions, 0);
    const verifiedInPeriod = displayData.reduce((acc, d) => acc + d.verified, 0);
    const offlineInPeriod = displayData.reduce((acc, d) => acc + d.offlineSynced, 0);
    const dailyAvg = Math.round((totalInPeriod / displayData.length) * 10) / 10;
    
    // Find peak intake day
    let peakDay = displayData[0];
    displayData.forEach((d) => {
      if (d.completions > peakDay.completions) peakDay = d;
    });

    // Velocity trend (% difference between first half and second half of window)
    const midPoint = Math.floor(displayData.length / 2);
    const firstHalfSum = displayData.slice(0, midPoint).reduce((a, b) => a + b.completions, 0);
    const secondHalfSum = displayData.slice(midPoint).reduce((a, b) => a + b.completions, 0);
    const velocityPct = firstHalfSum > 0
      ? Math.round(((secondHalfSum - firstHalfSum) / firstHalfSum) * 1000) / 10
      : 0;

    const verificationRate = totalInPeriod > 0
      ? Math.round((verifiedInPeriod / totalInPeriod) * 1000) / 10
      : 96.2;

    return {
      totalInPeriod,
      verifiedInPeriod,
      offlineInPeriod,
      dailyAvg,
      peakDay,
      velocityPct,
      verificationRate
    };
  }, [displayData]);

  // Active project object
  const activeSelectedProject = selectedProjectId === 'ALL'
    ? null
    : projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="bg-white rounded-2xl border border-[#c4c6cf]/50 card-shadow overflow-hidden flex flex-col">
      {/* Card Header & Controls */}
      <div className="p-5 md:p-6 border-b border-[#c4c6cf]/40 bg-[#f9f9ff] flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-8 h-8 rounded-lg bg-[#1a365d] text-white flex items-center justify-center shadow-xs shrink-0">
              <span className="material-symbols-outlined text-[18px]">trending_up</span>
            </div>
            <h3 className="text-base md:text-lg font-bold text-[#002045] flex items-center gap-2">
              <span>Survey Completion Trends</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#006a68]/10 text-[#006a68] border border-[#006a68]/30">
                LAST {timeRange} DAYS
              </span>
            </h3>
          </div>
          <p className="text-xs text-[#43474e] mt-1">
            Temporal collection velocity, daily intake curves, and field verification throughput derived from active project responses.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Project Filter Dropdown */}
          <div className="relative flex-1 sm:flex-initial">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full sm:w-auto pl-3 pr-8 py-1.5 bg-white border border-[#c4c6cf] rounded-lg text-xs font-semibold text-[#002045] focus:border-[#1a365d] focus:ring-1 focus:ring-[#1a365d] outline-none cursor-pointer appearance-none shadow-2xs"
            >
              <option value="ALL">All Active Projects ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}: {p.title.length > 32 ? p.title.slice(0, 32) + '...' : p.title} ({p.responsesCount.toLocaleString()})
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[#74777f] text-[16px] pointer-events-none">
              expand_more
            </span>
          </div>

          {/* Metric View Mode Toggle */}
          <div className="inline-flex rounded-lg border border-[#c4c6cf] bg-white p-0.5 text-xs font-semibold text-[#002045] shadow-2xs">
            <button
              onClick={() => setChartMetric('daily')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                chartMetric === 'daily'
                  ? 'bg-[#1a365d] text-white shadow-xs'
                  : 'hover:bg-[#f1f3ff] text-[#43474e]'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">bar_chart</span>
              <span>Daily Volume</span>
            </button>
            <button
              onClick={() => setChartMetric('cumulative')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                chartMetric === 'cumulative'
                  ? 'bg-[#1a365d] text-white shadow-xs'
                  : 'hover:bg-[#f1f3ff] text-[#43474e]'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">show_chart</span>
              <span>Cumulative</span>
            </button>
          </div>

          {/* Time Window Range Buttons */}
          <div className="inline-flex rounded-lg border border-[#c4c6cf] bg-white p-0.5 text-xs font-semibold text-[#002045] shadow-2xs">
            {([7, 14, 30] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-2.5 py-1.5 rounded-md transition-all cursor-pointer ${
                  timeRange === r
                    ? 'bg-[#006a68] text-white shadow-xs'
                    : 'hover:bg-[#f1f3ff] text-[#43474e]'
                }`}
              >
                {r}D
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Ribbon Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#c4c6cf]/30 border-b border-[#c4c6cf]/40 bg-[#f1f3ff]/40 text-xs">
        <div className="p-3.5 px-5">
          <span className="text-[#74777f] font-medium block text-[11px]">Period Total Completions</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl font-bold font-mono text-[#002045]">
              {summaryMetrics.totalInPeriod.toLocaleString()}
            </span>
            <span className="text-[10px] text-[#006a68] font-bold flex items-center">
              <span className="material-symbols-outlined text-[12px]">arrow_upward</span>
              <span>{summaryMetrics.velocityPct > 0 ? `+${summaryMetrics.velocityPct}%` : `${summaryMetrics.velocityPct}%`}</span>
            </span>
          </div>
        </div>

        <div className="p-3.5 px-5">
          <span className="text-[#74777f] font-medium block text-[11px]">Daily Intake Velocity (Mean)</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl font-bold font-mono text-[#002045]">
              {summaryMetrics.dailyAvg}
            </span>
            <span className="text-[11px] text-[#43474e] font-medium">surveys/day</span>
          </div>
        </div>

        <div className="p-3.5 px-5">
          <span className="text-[#74777f] font-medium block text-[11px]">Peak Intake Day</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl font-bold font-mono text-[#1a365d]">
              {summaryMetrics.peakDay?.completions || 0}
            </span>
            <span className="text-[11px] text-[#43474e]">({summaryMetrics.peakDay?.formattedDate})</span>
          </div>
        </div>

        <div className="p-3.5 px-5">
          <span className="text-[#74777f] font-medium block text-[11px]">Audit Verification Rate</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl font-bold font-mono text-[#006a68]">
              {summaryMetrics.verificationRate}%
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#006a68]/10 text-[#006a68] font-bold">
              PASS
            </span>
          </div>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="p-4 md:p-6 bg-white">
        <div className="h-[240px] md:h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartMetric === 'daily' ? (
              <ComposedChart
                data={displayData}
                margin={{ top: 10, right: 12, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="completionGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1a365d" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#1a365d" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="verifiedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#006a68" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#006a68" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="formattedDate"
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  interval={timeRange === 30 ? 3 : timeRange === 14 ? 1 : 0}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(val) => `${val}`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as TrendDayData;
                      return (
                        <div className="bg-[#002045]/95 text-white p-3 px-4 rounded-xl shadow-xl border border-white/10 text-xs backdrop-blur-md min-w-[200px] animate-in fade-in-50">
                          <div className="flex items-center justify-between border-b border-white/15 pb-2 mb-2">
                            <span className="font-bold text-[#91f0ed]">{data.fullDate}</span>
                            <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/80">
                              Day {data.dayIndex + 1}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="flex items-center gap-1.5 text-white/80">
                                <span className="w-2 h-2 rounded-full bg-[#91f0ed]" />
                                <span>Completed Surveys:</span>
                              </span>
                              <span className="font-mono font-bold text-white">{data.completions}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="flex items-center gap-1.5 text-white/80">
                                <span className="w-2 h-2 rounded-full bg-[#34d399]" />
                                <span>Quality Verified:</span>
                              </span>
                              <span className="font-mono font-bold text-[#34d399]">{data.verified}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="flex items-center gap-1.5 text-white/80">
                                <span className="w-2 h-2 rounded-full bg-[#f97316]" />
                                <span>Offline Synced:</span>
                              </span>
                              <span className="font-mono font-bold text-[#fb923c]">{data.offlineSynced}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="completions"
                  stroke="#1a365d"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#completionGrad)"
                  name="Completed"
                />
                <Area
                  type="monotone"
                  dataKey="verified"
                  stroke="#006a68"
                  strokeWidth={1.8}
                  strokeDasharray="4 2"
                  fillOpacity={1}
                  fill="url(#verifiedGrad)"
                  name="Verified"
                />
                <Line
                  type="monotone"
                  dataKey="targetRate"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  dot={false}
                  name="Quota Target"
                />
              </ComposedChart>
            ) : (
              <AreaChart
                data={displayData}
                margin={{ top: 10, right: 12, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="cumulGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#006a68" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#006a68" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="formattedDate"
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  interval={timeRange === 30 ? 3 : timeRange === 14 ? 1 : 0}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(val) => `${val.toLocaleString()}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as TrendDayData;
                      return (
                        <div className="bg-[#002045]/95 text-white p-3 px-4 rounded-xl shadow-xl border border-white/10 text-xs backdrop-blur-md min-w-[200px]">
                          <div className="flex items-center justify-between border-b border-white/15 pb-2 mb-2">
                            <span className="font-bold text-[#91f0ed]">{data.fullDate}</span>
                            <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/80">
                              Cumulative Trajectory
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-white/80">Cumulative Collected:</span>
                              <span className="font-mono font-bold text-[#91f0ed] text-sm">
                                {data.cumulative.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[11px] text-white/70">
                              <span>Added on this date:</span>
                              <span className="font-mono text-white">+{data.completions}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#006a68"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#cumulGrad)"
                  name="Cumulative Total"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Bottom Legend & Quick Navigation */}
        <div className="mt-3 pt-3 border-t border-[#c4c6cf]/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-[#43474e]">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-[#1a365d] rounded-full inline-block" />
              <span className="font-medium">Daily Intake</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-[#006a68] border-b border-dashed border-[#006a68] inline-block" />
              <span className="font-medium">Quality Verified</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t border-dashed border-[#94a3b8] inline-block" />
              <span className="font-medium text-[#74777f]">Daily Target Rate</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeSelectedProject && onSelectProject && (
              <button
                onClick={() => onSelectProject(activeSelectedProject)}
                className="text-[#1a365d] hover:text-[#002045] font-semibold text-xs flex items-center gap-1 hover:underline cursor-pointer"
              >
                <span>Inspect {activeSelectedProject.code}</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            )}

            {onNavigateToAnalytics && (
              <button
                onClick={onNavigateToAnalytics}
                className="text-[#006a68] hover:text-[#00504e] font-semibold text-xs flex items-center gap-1 hover:underline cursor-pointer"
              >
                <span>Deep Visualizations & Breakdown</span>
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
