"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    ScatterChart,
    Scatter,
    ZAxis,
    AreaChart,
    Area,
    Legend,
} from "recharts";
import {
    TrendingUp,
    Users,
    LayoutDashboard,
    Clock,
    CheckCircle2,
    Download,
    AlertTriangle,
    Activity,
    FolderOpen,
    Shield,
    Zap,
    ArrowUpRight,
    ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
    range: number;
    stats: {
        total: number;
        completed: number;
        overdue: number;
        totalHours: number;
        memberCount: number;
        workspaceCount: number;
        projectCount: number;
        completionRate: number;
        avgCycleDays: number;
        sparklines: Array<{ created: number; completed: number; overdue: number; hours: number }>;
    };
    byStatus: { status: string; count: number }[];
    byPriority: { priority: string; count: number }[];
    byMember: {
        user_id: string;
        name: string;
        role: string;
        total: number;
        completed: number;
        overdue: number;
        hours: number;
        completionRate: number;
    }[];
    byProject: {
        id: string;
        name: string;
        color: string;
        total: number;
        completed: number;
        overdue: number;
        completionRate: number;
    }[];
    byWorkspace: { id: string; name: string; total: number; completed: number }[];
    weeklyTrend: { label: string; completed: number; created: number; weekStart: string }[];
    dailyActivity: { date: string; count: number }[];
    cycleTimeBuckets: { label: string; count: number }[];
    agingBuckets: { label: string; count: number; color: string }[];
    funnelData: { name: string; value: number; fill: string }[];
    priorityStatusMatrix: { priority: string; status: string; count: number }[];
    activityByType: { type: string; label: string; count: number }[];
    overdueList: {
        id: string;
        name: string;
        priority: string;
        daysOverdue: number;
        assignee: string;
        status: string;
    }[];
    memberEfficiency: { name: string; tasks: number; hours: number; completionRate: number }[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BRAND_BLUE = "#0051e6";
const BRAND_GREEN = "#22be66";
const BRAND_PURPLE = "#5e5ce6";
const BRAND_RED = "#ff3b30";
const BRAND_ORANGE = "#f5a623";
const CHART_COLORS = [BRAND_BLUE, BRAND_GREEN, BRAND_PURPLE, BRAND_RED, BRAND_ORANGE, "#8e8e93"];

const PRIORITY_COLORS: Record<string, string> = {
    Urgent: BRAND_RED,
    High: BRAND_ORANGE,
    Medium: BRAND_BLUE,
    Low: "#8e8e93",
};

const STATUS_COLORS: Record<string, string> = {
    "To Do": "#8e8e93",
    "In Progress": BRAND_BLUE,
    "In Review": BRAND_PURPLE,
    Blocked: BRAND_RED,
    Completed: BRAND_GREEN,
};

const TABS = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "flow", label: "Flow & Velocity", icon: TrendingUp },
    { id: "team", label: "Team", icon: Users },
    { id: "projects", label: "Projects", icon: FolderOpen },
    { id: "risk", label: "Risk", icon: Shield },
    { id: "activity", label: "Activity", icon: Activity },
];

const RANGES = [
    { value: 7, label: "7d" },
    { value: 30, label: "30d" },
    { value: 90, label: "90d" },
    { value: 365, label: "1y" },
];

// ─── Helper components ────────────────────────────────────────────────────────

type TooltipRow = { label: string; value: string | number; color?: string };

function DarkTooltip({
    active,
    payload,
    label,
    rows,
}: {
    active?: boolean;
    payload?: readonly any[];
    label?: string | number;
    rows?: (payload: readonly any[]) => TooltipRow[];
}) {
    if (!active || !payload?.length) return null;
    const items: TooltipRow[] = rows
        ? rows(payload)
        : payload.map(p => ({ label: p.name as string, value: p.value as string | number, color: p.color as string | undefined }));
    const labelStr = label != null ? String(label) : undefined;
    return (
        <div className="bg-[#1d1d1f] text-white p-3 rounded-xl shadow-2xl text-[11px] min-w-[160px] pointer-events-none">
            {labelStr && (
                <p className="font-bold uppercase tracking-widest opacity-50 mb-2 text-[9px]">{labelStr}</p>
            )}
            {items.map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-6 mb-0.5 last:mb-0">
                    <span className="opacity-70">{r.label}</span>
                    <span className="font-bold" style={r.color ? { color: r.color } : {}}>
                        {r.value}
                    </span>
                </div>
            ))}
        </div>
    );
}

function SparkLine({ data, color = BRAND_BLUE }: { data: number[]; color?: string }) {
    const chartData = data.map((v, i) => ({ i, v }));
    return (
        <ResponsiveContainer width="100%" height={36}>
            <LineChart data={chartData}>
                <Line
                    type="monotone"
                    dataKey="v"
                    stroke={color}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                />
            </LineChart>
        </ResponsiveContainer>
    );
}

function SectionCard({
    title,
    subtitle,
    children,
    className,
}: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("bg-white rounded-[20px] p-6 border border-[#e5e5ea]", className)}>
            <div className="mb-5">
                <h3 className="text-[13px] font-bold text-[#1d1d1f]">{title}</h3>
                {subtitle && <p className="text-[10px] text-[#86868b] mt-0.5">{subtitle}</p>}
            </div>
            {children}
        </div>
    );
}

function PriorityBadge({ priority }: { priority: string }) {
    const color = PRIORITY_COLORS[priority] || "#8e8e93";
    return (
        <span
            className="text-[9px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: color + "20", color }}
        >
            {priority}
        </span>
    );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({ stats, byStatus, weeklyTrend, funnelData }: Pick<Props, "stats" | "byStatus" | "weeklyTrend" | "funnelData">) {
    const kpiCards = [
        {
            label: "Total Tasks",
            value: stats.total,
            sparkData: stats.sparklines.map(s => s.created),
            icon: <LayoutDashboard size={15} />,
            color: BRAND_BLUE,
            bg: "#0051e6/5",
            delta: (() => {
                const curr = stats.sparklines[3]?.created ?? 0;
                const prev = stats.sparklines[2]?.created ?? 0;
                return prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 0;
            })(),
        },
        {
            label: "Completed",
            value: stats.completed,
            sparkData: stats.sparklines.map(s => s.completed),
            icon: <CheckCircle2 size={15} />,
            color: BRAND_GREEN,
            bg: "#22be66/5",
            delta: (() => {
                const curr = stats.sparklines[3]?.completed ?? 0;
                const prev = stats.sparklines[2]?.completed ?? 0;
                return prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 0;
            })(),
        },
        {
            label: "Overdue",
            value: stats.overdue,
            sparkData: stats.sparklines.map(s => s.overdue),
            icon: <AlertTriangle size={15} />,
            color: BRAND_RED,
            bg: "#ff3b30/5",
            delta: (() => {
                const curr = stats.sparklines[3]?.overdue ?? 0;
                const prev = stats.sparklines[2]?.overdue ?? 0;
                return prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 0;
            })(),
        },
        {
            label: "Hours Logged",
            value: `${stats.totalHours}h`,
            sparkData: stats.sparklines.map(s => s.hours),
            icon: <Clock size={15} />,
            color: BRAND_PURPLE,
            bg: "#5e5ce6/5",
            delta: (() => {
                const curr = stats.sparklines[3]?.hours ?? 0;
                const prev = stats.sparklines[2]?.hours ?? 0;
                return prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 0;
            })(),
        },
        {
            label: "Completion Rate",
            value: `${stats.completionRate}%`,
            sparkData: stats.sparklines.map(s =>
                s.created > 0 ? Math.round((s.completed / s.created) * 100) : 0
            ),
            icon: <Zap size={15} />,
            color: BRAND_ORANGE,
            bg: "#f5a623/5",
            delta: 0,
        },
        {
            label: "Avg Cycle Time",
            value: `${stats.avgCycleDays}d`,
            sparkData: [stats.avgCycleDays, stats.avgCycleDays],
            icon: <TrendingUp size={15} />,
            color: "#8e8e93",
            bg: "#8e8e93/5",
            delta: 0,
        },
    ];

    const pieData = byStatus.map(s => ({
        name: s.status,
        value: s.count,
    }));

    return (
        <div className="space-y-6">
            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {kpiCards.map((card, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="bg-white rounded-[16px] p-4 border border-[#e5e5ea] hover:border-[#0051e6]/30 hover:shadow-md transition-all group cursor-default"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{
                                    backgroundColor: card.color + "15",
                                    color: card.color,
                                }}
                            >
                                {card.icon}
                            </div>
                            {card.delta !== 0 && (
                                <span
                                    className="text-[9px] font-bold flex items-center gap-0.5"
                                    style={{
                                        color: card.delta > 0
                                            ? card.label === "Overdue" ? BRAND_RED : BRAND_GREEN
                                            : card.label === "Overdue" ? BRAND_GREEN : BRAND_RED,
                                    }}
                                >
                                    {card.delta > 0 ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}
                                    {Math.abs(card.delta)}%
                                </span>
                            )}
                        </div>
                        <p className="text-[9px] font-bold text-[#86868b] uppercase tracking-tight mb-0.5">
                            {card.label}
                        </p>
                        <h4 className="text-lg font-bold text-[#1d1d1f] tracking-tight leading-none mb-2">
                            {card.value}
                        </h4>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <SparkLine data={card.sparkData} color={card.color} />
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Velocity + Status Pie */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <SectionCard
                    title="Velocity Tracking"
                    subtitle="Tasks created vs completed per week"
                    className="lg:col-span-2"
                >
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={weeklyTrend}>
                                <defs>
                                    <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={BRAND_BLUE} stopOpacity={0.15} />
                                        <stop offset="95%" stopColor={BRAND_BLUE} stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={BRAND_GREEN} stopOpacity={0.15} />
                                        <stop offset="95%" stopColor={BRAND_GREEN} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f0f0f2" />
                                <XAxis
                                    dataKey="label"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 600, fill: "#86868b" }}
                                    dy={8}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 600, fill: "#86868b" }}
                                />
                                <Tooltip
                                    content={({ active, payload, label }) => (
                                        <DarkTooltip
                                            active={active}
                                            payload={payload}
                                            label={label}
                                            rows={p => [
                                                { label: "Created", value: p.find(x => x.dataKey === "created")?.value ?? 0, color: BRAND_BLUE },
                                                { label: "Completed", value: p.find(x => x.dataKey === "completed")?.value ?? 0, color: BRAND_GREEN },
                                                {
                                                    label: "Net Delta",
                                                    value: `${(p.find(x => x.dataKey === "completed")?.value ?? 0) - (p.find(x => x.dataKey === "created")?.value ?? 0) >= 0 ? "+" : ""}${(p.find(x => x.dataKey === "completed")?.value ?? 0) - (p.find(x => x.dataKey === "created")?.value ?? 0)}`,
                                                },
                                            ]}
                                        />
                                    )}
                                />
                                <Area type="monotone" dataKey="created" stroke={BRAND_BLUE} strokeWidth={2} fill="url(#gradCreated)" dot={{ r: 3, fill: BRAND_BLUE, strokeWidth: 0 }} />
                                <Area type="monotone" dataKey="completed" stroke={BRAND_GREEN} strokeWidth={2} fill="url(#gradCompleted)" dot={{ r: 3, fill: BRAND_GREEN, strokeWidth: 0 }} />
                                <Legend
                                    iconType="circle"
                                    iconSize={8}
                                    wrapperStyle={{ fontSize: "10px", fontWeight: 600, paddingTop: "12px" }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </SectionCard>

                <SectionCard title="Status Distribution" subtitle="Current task breakdown">
                    <div className="relative h-44">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="55%"
                                    outerRadius="78%"
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {pieData.map((entry, i) => (
                                        <Cell
                                            key={entry.name}
                                            fill={STATUS_COLORS[entry.name] ?? CHART_COLORS[i]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (!active || !payload?.length) return null;
                                        const d = payload[0];
                                        const total = pieData.reduce((s, x) => s + x.value, 0);
                                        return (
                                            <DarkTooltip
                                                active={active}
                                                payload={payload}
                                                rows={() => [
                                                    { label: "Status", value: d.name ?? "" },
                                                    { label: "Count", value: d.value as number },
                                                    {
                                                        label: "Share",
                                                        value: `${total > 0 ? Math.round(((d.value as number) / total) * 100) : 0}%`,
                                                        color: STATUS_COLORS[d.name ?? ""] ?? BRAND_BLUE,
                                                    },
                                                ]}
                                            />
                                        );
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-2xl font-bold text-[#1d1d1f]">{stats.completionRate}%</span>
                            <span className="text-[9px] font-bold text-[#86868b] uppercase tracking-widest">Done</span>
                        </div>
                    </div>
                    <div className="mt-3 space-y-1.5">
                        {byStatus.map(s => (
                            <div key={s.status} className="flex items-center justify-between group/row hover:bg-[#f5f5f7] rounded-lg px-2 py-0.5 transition-colors cursor-default">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s.status] }} />
                                    <span className="text-[10px] font-semibold text-[#86868b]">{s.status}</span>
                                </div>
                                <span className="text-[10px] font-bold text-[#1d1d1f]">{s.count}</span>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            </div>

            {/* Funnel */}
            <SectionCard title="Pipeline Funnel" subtitle="Task distribution across stages — bar width shows share of total pipeline">
                {(() => {
                    const total = funnelData.reduce((s, d) => s + d.value, 0) || 1;
                    const maxVal = Math.max(...funnelData.map(d => d.value), 1);
                    return (
                        <div className="space-y-2.5">
                            {funnelData.map((stage, i) => {
                                // bar width = proportion of the largest stage (so the biggest stage = 100% wide)
                                const barPct = Math.round((stage.value / maxVal) * 100);
                                // label = share of all pipeline tasks
                                const sharePct = Math.round((stage.value / total) * 100);
                                // conversion from previous stage
                                const convPct = i > 0 && funnelData[i - 1].value > 0
                                    ? Math.round((stage.value / funnelData[i - 1].value) * 100)
                                    : null;
                                return (
                                    <div key={stage.name} className="group/funnel cursor-default">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-tight">{stage.name}</span>
                                            <div className="flex items-center gap-3">
                                                {convPct !== null && (
                                                    <span className="text-[9px] font-semibold text-[#86868b] opacity-0 group-hover/funnel:opacity-100 transition-opacity">
                                                        {convPct}% conversion from prev
                                                    </span>
                                                )}
                                                <span className="text-[11px] font-bold" style={{ color: stage.fill }}>
                                                    {stage.value} tasks
                                                </span>
                                                <span className="text-[10px] font-semibold text-[#86868b] w-8 text-right">{sharePct}%</span>
                                            </div>
                                        </div>
                                        <div className="h-6 bg-[#f5f5f7] rounded-lg overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${barPct}%` }}
                                                transition={{ duration: 0.6, delay: i * 0.1 }}
                                                className="h-full rounded-lg"
                                                style={{ backgroundColor: stage.fill }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            <p className="text-[10px] text-[#86868b] pt-1">
                                Total pipeline: <span className="font-bold text-[#1d1d1f]">{total} tasks</span>
                            </p>
                        </div>
                    );
                })()}
            </SectionCard>
        </div>
    );
}

// ─── Tab: Flow & Velocity ─────────────────────────────────────────────────────

function FlowTab({ weeklyTrend, cycleTimeBuckets, agingBuckets, byPriority }: Pick<Props, "weeklyTrend" | "cycleTimeBuckets" | "agingBuckets" | "byPriority">) {
    const totalCycle = cycleTimeBuckets.reduce((s, b) => s + b.count, 0);
    const totalAging = agingBuckets.reduce((s, b) => s + b.count, 0);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Created vs Completed */}
                <SectionCard title="Weekly Throughput" subtitle="Tasks created vs closed per week">
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklyTrend} barGap={3}>
                                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f0f0f2" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: "#86868b" }} dy={8} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: "#86868b" }} />
                                <Tooltip
                                    content={({ active, payload, label }) => (
                                        <DarkTooltip
                                            active={active}
                                            payload={payload}
                                            label={label}
                                            rows={p => {
                                                const created = p.find(x => x.dataKey === "created")?.value ?? 0;
                                                const completed = p.find(x => x.dataKey === "completed")?.value ?? 0;
                                                return [
                                                    { label: "Created", value: created as number, color: BRAND_BLUE },
                                                    { label: "Completed", value: completed as number, color: BRAND_GREEN },
                                                    { label: "Net", value: `${(completed as number) - (created as number) >= 0 ? "+" : ""}${(completed as number) - (created as number)}` },
                                                ];
                                            }}
                                        />
                                    )}
                                />
                                <Bar dataKey="created" fill={BRAND_BLUE} radius={[4, 4, 0, 0]} />
                                <Bar dataKey="completed" fill={BRAND_GREEN} radius={[4, 4, 0, 0]} />
                                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "10px", fontWeight: 600, paddingTop: "12px" }} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </SectionCard>

                {/* Cycle Time */}
                <SectionCard title="Cycle Time Distribution" subtitle="Time from start to completion">
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={cycleTimeBuckets}>
                                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f0f0f2" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: "#86868b" }} dy={8} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: "#86868b" }} />
                                <Tooltip
                                    content={({ active, payload, label }) => (
                                        <DarkTooltip
                                            active={active}
                                            payload={payload}
                                            label={label ?? ""}
                                            rows={p => {
                                                const count = p[0]?.value as number ?? 0;
                                                return [
                                                    { label: "Tasks", value: count, color: BRAND_PURPLE },
                                                    { label: "Of completed", value: `${totalCycle > 0 ? Math.round((count / totalCycle) * 100) : 0}%` },
                                                ];
                                            }}
                                        />
                                    )}
                                />
                                <Bar dataKey="count" fill={BRAND_PURPLE} radius={[4, 4, 0, 0]}>
                                    {cycleTimeBuckets.map((_, i) => (
                                        <Cell key={i} fill={`${BRAND_PURPLE}${Math.round(60 + (i / cycleTimeBuckets.length) * 195).toString(16).padStart(2, "0")}`} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </SectionCard>
            </div>

            {/* WIP Aging */}
            <SectionCard title="WIP Aging" subtitle="How long active tasks have been open">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                    {agingBuckets.map(b => (
                        <div
                            key={b.label}
                            className="rounded-2xl p-4 border border-[#e5e5ea] hover:shadow-md transition-all cursor-default group"
                            style={{ borderLeftWidth: "3px", borderLeftColor: b.color }}
                        >
                            <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-tight">{b.label}</p>
                            <p className="text-2xl font-bold mt-1" style={{ color: b.color }}>{b.count}</p>
                            <p className="text-[9px] text-[#86868b] mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                {totalAging > 0 ? Math.round((b.count / totalAging) * 100) : 0}% of active
                            </p>
                        </div>
                    ))}
                </div>
                <div className="h-8 bg-[#f5f5f7] rounded-full overflow-hidden flex">
                    {agingBuckets.map(b => {
                        const pct = totalAging > 0 ? (b.count / totalAging) * 100 : 0;
                        return pct > 0 ? (
                            <motion.div
                                key={b.label}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.6 }}
                                className="h-full relative group/bar flex items-center justify-center"
                                style={{ backgroundColor: b.color }}
                                title={`${b.label}: ${b.count} tasks (${Math.round(pct)}%)`}
                            >
                                {pct > 8 && (
                                    <span className="text-[9px] font-bold text-white">{Math.round(pct)}%</span>
                                )}
                            </motion.div>
                        ) : null;
                    })}
                </div>
                <div className="flex gap-4 mt-3 flex-wrap">
                    {agingBuckets.map(b => (
                        <div key={b.label} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
                            <span className="text-[10px] font-semibold text-[#86868b]">{b.label}</span>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* Priority Distribution */}
            <SectionCard title="Priority Distribution" subtitle="Task count by priority level">
                <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={byPriority} layout="vertical">
                            <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#f0f0f2" />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: "#86868b" }} />
                            <YAxis type="category" dataKey="priority" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: "#86868b" }} width={55} />
                            <Tooltip
                                content={({ active, payload, label }) => (
                                    <DarkTooltip
                                        active={active}
                                        payload={payload}
                                        label={label}
                                        rows={p => [
                                            { label: "Tasks", value: p[0]?.value as number ?? 0, color: PRIORITY_COLORS[label ?? ""] ?? BRAND_BLUE },
                                        ]}
                                    />
                                )}
                            />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                {byPriority.map(p => (
                                    <Cell key={p.priority} fill={PRIORITY_COLORS[p.priority] ?? BRAND_BLUE} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </SectionCard>
        </div>
    );
}

// ─── Tab: Team ────────────────────────────────────────────────────────────────

function TeamTab({ byMember, memberEfficiency }: Pick<Props, "byMember" | "memberEfficiency">) {
    const maxTotal = Math.max(...byMember.map(m => m.total), 1);
    const scatterData = memberEfficiency.map(m => ({ x: m.tasks, y: m.hours, name: m.name, rate: m.completionRate }));

    return (
        <div className="space-y-6">
            {/* Workload Balance */}
            <SectionCard title="Workload Distribution" subtitle="Task assignment across all team members">
                <div className="space-y-2.5">
                    {byMember.map(m => (
                        <div key={m.user_id} className="group/row cursor-default">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center text-[9px] font-bold text-[#1d1d1f]">
                                        {m.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-[11px] font-semibold text-[#1d1d1f]">{m.name}</span>
                                    <span className="text-[9px] text-[#86868b]">{m.role}</span>
                                </div>
                                <div className="flex items-center gap-3 text-[10px]">
                                    <span className="text-[#86868b] opacity-0 group-hover/row:opacity-100 transition-opacity">
                                        {m.completed}/{m.total} done · {m.overdue > 0 ? <span className="text-[#ff3b30]">{m.overdue} overdue</span> : "0 overdue"} · {m.hours}h
                                    </span>
                                    <span className="font-bold text-[#1d1d1f]">{m.total}</span>
                                </div>
                            </div>
                            <div className="h-2 bg-[#f5f5f7] rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(m.total / maxTotal) * 100}%` }}
                                    transition={{ duration: 0.5 }}
                                    className="h-full rounded-full relative"
                                    style={{
                                        background: `linear-gradient(90deg, ${BRAND_BLUE}, ${BRAND_PURPLE})`,
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Efficiency Scatter */}
                <SectionCard title="Efficiency Matrix" subtitle="Completed tasks vs hours logged per member">
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart>
                                <CartesianGrid strokeDasharray="4 4" stroke="#f0f0f2" />
                                <XAxis
                                    type="number"
                                    dataKey="x"
                                    name="Tasks Completed"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 600, fill: "#86868b" }}
                                    label={{ value: "Tasks Completed", position: "insideBottom", offset: -4, style: { fontSize: 9, fill: "#86868b", fontWeight: 600 } }}
                                />
                                <YAxis
                                    type="number"
                                    dataKey="y"
                                    name="Hours"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 600, fill: "#86868b" }}
                                    label={{ value: "Hours", angle: -90, position: "insideLeft", style: { fontSize: 9, fill: "#86868b", fontWeight: 600 } }}
                                />
                                <ZAxis range={[50, 200]} />
                                <Tooltip
                                    cursor={{ strokeDasharray: "3 3" }}
                                    content={({ active, payload }) => {
                                        if (!active || !payload?.length) return null;
                                        const d = payload[0].payload;
                                        return (
                                            <DarkTooltip
                                                active={active}
                                                payload={payload}
                                                rows={() => [
                                                    { label: "Member", value: d.name },
                                                    { label: "Tasks done", value: d.x, color: BRAND_GREEN },
                                                    { label: "Hours", value: `${d.y}h`, color: BRAND_BLUE },
                                                    {
                                                        label: "Efficiency",
                                                        value: d.y > 0 ? `${(d.x / d.y).toFixed(2)} tasks/h` : "—",
                                                        color: BRAND_PURPLE,
                                                    },
                                                    { label: "Completion %", value: `${d.rate}%` },
                                                ]}
                                            />
                                        );
                                    }}
                                />
                                <Scatter data={scatterData} fill={BRAND_BLUE} fillOpacity={0.8} />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                </SectionCard>

                {/* Top Contributors */}
                <SectionCard title="Top Contributors" subtitle="Ranked by task completion">
                    <div className="space-y-3">
                        {byMember.slice(0, 6).map((m, i) => (
                            <div
                                key={m.user_id}
                                className="flex items-center gap-3 group/contributor hover:bg-[#f5f5f7] rounded-xl p-2 -mx-2 transition-colors cursor-default"
                            >
                                <div className="w-5 text-[10px] font-bold text-[#86868b] text-center">{i + 1}</div>
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0051e6] to-[#5e5ce6] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                                    {m.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-bold text-[#1d1d1f] truncate">{m.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <div className="h-1 flex-1 bg-[#f5f5f7] rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-[#22be66]"
                                                style={{ width: `${m.completionRate}%` }}
                                            />
                                        </div>
                                        <span className="text-[9px] font-bold text-[#22be66]">{m.completionRate}%</span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-[12px] font-bold text-[#1d1d1f]">{m.completed}</div>
                                    <div className="text-[9px] text-[#86868b] group-hover/contributor:text-[#0051e6] transition-colors">
                                        {m.hours}h logged
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            </div>
        </div>
    );
}

// ─── Tab: Projects ────────────────────────────────────────────────────────────

function ProjectsTab({ byProject, byWorkspace }: Pick<Props, "byProject" | "byWorkspace">) {
    return (
        <div className="space-y-6">
            <SectionCard title="Project Completion" subtitle="Tasks and completion rates per project">
                {byProject.length === 0 ? (
                    <p className="text-[11px] text-[#86868b] py-8 text-center">No projects found in this period.</p>
                ) : (
                    <div className="space-y-3">
                        {byProject.map(p => (
                            <div key={p.id} className="group/proj cursor-default">
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                                        <span className="text-[12px] font-semibold text-[#1d1d1f]">{p.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px]">
                                        <span className="text-[#86868b] opacity-0 group-hover/proj:opacity-100 transition-opacity">
                                            {p.completed}/{p.total} tasks · {p.overdue > 0 ? `${p.overdue} overdue` : "no overdue"}
                                        </span>
                                        <span className="font-bold" style={{ color: p.color }}>{p.completionRate}%</span>
                                    </div>
                                </div>
                                <div className="h-2.5 bg-[#f5f5f7] rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${p.completionRate}%` }}
                                        transition={{ duration: 0.6 }}
                                        className="h-full rounded-full"
                                        style={{ backgroundColor: p.color }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>

            {byWorkspace.length > 1 && (
                <SectionCard title="Workspace Breakdown" subtitle="Task distribution across workspaces">
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={byWorkspace} layout="vertical">
                                <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#f0f0f2" />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: "#86868b" }} />
                                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: "#86868b" }} width={90} />
                                <Tooltip
                                    content={({ active, payload, label }) => (
                                        <DarkTooltip
                                            active={active}
                                            payload={payload}
                                            label={label}
                                            rows={p => [
                                                { label: "Total", value: p.find(x => x.dataKey === "total")?.value as number ?? 0, color: BRAND_BLUE },
                                                { label: "Completed", value: p.find(x => x.dataKey === "completed")?.value as number ?? 0, color: BRAND_GREEN },
                                            ]}
                                        />
                                    )}
                                />
                                <Bar dataKey="total" fill={`${BRAND_BLUE}40`} radius={[0, 4, 4, 0]} />
                                <Bar dataKey="completed" fill={BRAND_GREEN} radius={[0, 4, 4, 0]} />
                                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "10px", fontWeight: 600, paddingTop: "12px" }} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </SectionCard>
            )}
        </div>
    );
}

// ─── Tab: Risk ────────────────────────────────────────────────────────────────

function RiskTab({ priorityStatusMatrix, overdueList }: Pick<Props, "priorityStatusMatrix" | "overdueList">) {
    const priorities = ["Urgent", "High", "Medium", "Low"];
    const statuses = ["To Do", "In Progress", "In Review", "Blocked", "Completed"];
    const matrixMax = Math.max(...priorityStatusMatrix.map(c => c.count), 1);

    const overdueByPriority = priorities.map(p => ({
        priority: p,
        count: overdueList.filter(t => t.priority === p).length,
        avgDays: overdueList.filter(t => t.priority === p).length > 0
            ? Math.round(overdueList.filter(t => t.priority === p).reduce((s, t) => s + t.daysOverdue, 0) / overdueList.filter(t => t.priority === p).length)
            : 0,
    }));

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Priority × Status Matrix */}
                <SectionCard title="Priority × Status Matrix" subtitle="Task count at each intersection — hover for details">
                    <div className="overflow-x-auto">
                        <table className="w-full text-[10px]">
                            <thead>
                                <tr>
                                    <th className="text-left font-bold text-[#86868b] pb-2 pr-3 uppercase tracking-tight w-16" />
                                    {statuses.map(s => (
                                        <th key={s} className="text-center font-bold text-[#86868b] pb-2 uppercase tracking-tight text-[9px] px-1">
                                            {s === "In Progress" ? "In Prog." : s === "In Review" ? "Review" : s}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {priorities.map(priority => (
                                    <tr key={priority}>
                                        <td className="font-bold pr-3 py-1" style={{ color: PRIORITY_COLORS[priority] }}>
                                            {priority}
                                        </td>
                                        {statuses.map(status => {
                                            const cell = priorityStatusMatrix.find(
                                                c => c.priority === priority && c.status === status
                                            );
                                            const count = cell?.count ?? 0;
                                            const intensity = count / matrixMax;
                                            const baseColor = status === "Completed" ? BRAND_GREEN : status === "Blocked" ? BRAND_RED : BRAND_BLUE;
                                            return (
                                                <td key={status} className="px-1 py-1 text-center">
                                                    <div
                                                        className="rounded-lg py-2 px-1 transition-transform hover:scale-110 cursor-default group/cell relative"
                                                        style={{
                                                            backgroundColor: count > 0 ? baseColor + Math.round(10 + intensity * 230).toString(16).padStart(2, "0") : "#f5f5f7",
                                                        }}
                                                        title={`${priority} × ${status}: ${count} task${count !== 1 ? "s" : ""}`}
                                                    >
                                                        <span
                                                            className="font-bold"
                                                            style={{ color: intensity > 0.5 ? "white" : count > 0 ? baseColor : "#86868b" }}
                                                        >
                                                            {count}
                                                        </span>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>

                {/* Overdue by Priority */}
                <SectionCard title="Overdue by Priority" subtitle="Count and average days overdue">
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={overdueByPriority}>
                                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f0f0f2" />
                                <XAxis dataKey="priority" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: "#86868b" }} dy={8} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: "#86868b" }} />
                                <Tooltip
                                    content={({ active, payload, label }) => (
                                        <DarkTooltip
                                            active={active}
                                            payload={payload}
                                            label={label}
                                            rows={() => {
                                                const d = overdueByPriority.find(x => x.priority === label);
                                                return [
                                                    { label: "Overdue tasks", value: d?.count ?? 0, color: PRIORITY_COLORS[label ?? ""] ?? BRAND_RED },
                                                    { label: "Avg days late", value: `${d?.avgDays ?? 0}d`, color: BRAND_ORANGE },
                                                ];
                                            }}
                                        />
                                    )}
                                />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {overdueByPriority.map(p => (
                                        <Cell key={p.priority} fill={PRIORITY_COLORS[p.priority] ?? BRAND_RED} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </SectionCard>
            </div>

            {/* Overdue Task List */}
            <SectionCard title="Overdue Tasks" subtitle={`${overdueList.length} tasks past deadline — sorted by severity`}>
                {overdueList.length === 0 ? (
                    <div className="flex items-center gap-3 py-6 justify-center">
                        <CheckCircle2 size={20} className="text-[#22be66]" />
                        <p className="text-[12px] font-semibold text-[#86868b]">No overdue tasks. Great work!</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {overdueList.map(t => {
                            const severity = t.daysOverdue > 14 ? "high" : t.daysOverdue > 7 ? "medium" : "low";
                            const severityColor = severity === "high" ? BRAND_RED : severity === "medium" ? BRAND_ORANGE : "#8e8e93";
                            return (
                                <div
                                    key={t.id}
                                    className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#fff5f5] group/overdue transition-colors cursor-default"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: severityColor }} />
                                        <span className="text-[11px] font-semibold text-[#1d1d1f] truncate group-hover/overdue:text-[#ff3b30] transition-colors">
                                            {t.name}
                                        </span>
                                        <PriorityBadge priority={t.priority} />
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0 ml-3">
                                        <span className="text-[10px] text-[#86868b] opacity-0 group-hover/overdue:opacity-100 transition-opacity">
                                            {t.assignee}
                                        </span>
                                        <span className="text-[10px] font-bold" style={{ color: severityColor }}>
                                            {t.daysOverdue}d late
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </SectionCard>
        </div>
    );
}

// ─── Tab: Activity ────────────────────────────────────────────────────────────

function ActivityHeatmap({ dailyActivity }: { dailyActivity: { date: string; count: number }[] }) {
    const maxCount = Math.max(...dailyActivity.map(d => d.count), 1);
    const [hoveredCell, setHoveredCell] = useState<{ date: string; count: number; x: number; y: number } | null>(null);

    // Reshape into 12 weeks × 7 days (columns = weeks, rows = days)
    // dailyActivity[0] is oldest, [83] is today
    const weeks: { date: string; count: number }[][] = [];
    for (let w = 0; w < 12; w++) {
        weeks.push(dailyActivity.slice(w * 7, w * 7 + 7));
    }

    // Month labels: detect first day of each month and which column it falls in
    const monthLabels: { col: number; month: string }[] = [];
    weeks.forEach((week, col) => {
        week.forEach(day => {
            if (day.date.endsWith("-01")) {
                const [, m] = day.date.split("-");
                const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                monthLabels.push({ col, month: monthNames[parseInt(m) - 1] });
            }
        });
    });

    const totalTasks = dailyActivity.reduce((s, d) => s + d.count, 0);
    const activeDays = dailyActivity.filter(d => d.count > 0).length;

    const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    function cellColor(count: number) {
        if (count === 0) return "#e5e5ea";
        const intensity = count / maxCount;
        if (intensity < 0.25) return "#93b4f5";
        if (intensity < 0.5) return "#4d86f0";
        if (intensity < 0.75) return "#1a5fd9";
        return BRAND_BLUE;
    }

    return (
        <SectionCard
            title="Task Creation Heatmap"
            subtitle={`${totalTasks} tasks created over 12 weeks · ${activeDays} active days · darker = more tasks`}
        >
            {/* Stats row */}
            <div className="flex gap-4 mb-4 flex-wrap">
                <div className="flex items-center gap-2 bg-[#f5f5f7] rounded-xl px-3 py-2">
                    <div className="w-2 h-2 rounded-full bg-[#22be66]" />
                    <span className="text-[10px] font-bold text-[#1d1d1f]">{totalTasks} total tasks</span>
                </div>
                <div className="flex items-center gap-2 bg-[#f5f5f7] rounded-xl px-3 py-2">
                    <div className="w-2 h-2 rounded-full bg-[#0051e6]" />
                    <span className="text-[10px] font-bold text-[#1d1d1f]">{activeDays} active days</span>
                </div>
                <div className="flex items-center gap-2 bg-[#f5f5f7] rounded-xl px-3 py-2">
                    <div className="w-2 h-2 rounded-full bg-[#5e5ce6]" />
                    <span className="text-[10px] font-bold text-[#1d1d1f]">peak: {maxCount} tasks/day</span>
                </div>
            </div>

            <div className="relative overflow-x-auto">
                {/* Month labels row */}
                <div className="flex mb-1 pl-8" style={{ gap: "3px" }}>
                    {weeks.map((_, col) => {
                        const label = monthLabels.find(m => m.col === col);
                        return (
                            <div key={col} className="text-[9px] font-bold text-[#86868b]" style={{ width: 16, flexShrink: 0 }}>
                                {label?.month ?? ""}
                            </div>
                        );
                    })}
                </div>

                <div className="flex gap-0" style={{ gap: "3px" }}>
                    {/* Day labels */}
                    <div className="flex flex-col mr-1" style={{ gap: "3px" }}>
                        {DAY_LABELS.map((d, i) => (
                            <div key={i} className="text-[8px] font-semibold text-[#86868b] flex items-center" style={{ height: 16, width: 28 }}>
                                {i % 2 === 1 ? d : ""}
                            </div>
                        ))}
                    </div>

                    {/* Week columns */}
                    {weeks.map((week, col) => (
                        <div key={col} className="flex flex-col" style={{ gap: "3px" }}>
                            {week.map((day, row) => (
                                <div
                                    key={row}
                                    className="rounded-sm cursor-default transition-transform hover:scale-125 hover:z-10 relative"
                                    style={{ width: 16, height: 16, backgroundColor: cellColor(day.count), flexShrink: 0 }}
                                    onMouseEnter={e => {
                                        const rect = (e.target as HTMLElement).getBoundingClientRect();
                                        setHoveredCell({ date: day.date, count: day.count, x: rect.left, y: rect.top });
                                    }}
                                    onMouseLeave={() => setHoveredCell(null)}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* Inline tooltip */}
            {hoveredCell && (
                <div
                    className="fixed z-50 bg-[#1d1d1f] text-white text-[11px] px-3 py-2 rounded-xl shadow-2xl pointer-events-none"
                    style={{ left: hoveredCell.x + 20, top: hoveredCell.y - 40 }}
                >
                    <p className="font-bold">{hoveredCell.count} task{hoveredCell.count !== 1 ? "s" : ""} created</p>
                    <p className="opacity-60 text-[9px] mt-0.5">{new Date(hoveredCell.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
                </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-2 mt-4">
                <span className="text-[9px] font-bold text-[#86868b] uppercase tracking-wider">Less</span>
                {["#e5e5ea", "#93b4f5", "#4d86f0", "#1a5fd9", BRAND_BLUE].map((c, i) => (
                    <div key={i} className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: c }} />
                ))}
                <span className="text-[9px] font-bold text-[#86868b] uppercase tracking-wider">More</span>
            </div>
        </SectionCard>
    );
}

function ActivityTab({ dailyActivity, activityByType }: Pick<Props, "dailyActivity" | "activityByType">) {
    const totalActivity = activityByType.reduce((s, a) => s + a.count, 0);

    // Weekly totals for the trend chart
    const trendData = Array.from({ length: 12 }, (_, i) => {
        const week = dailyActivity.slice(i * 7, i * 7 + 7);
        const weekTotal = week.reduce((s, d) => s + d.count, 0);
        const lastDay = week[week.length - 1]?.date ?? "";
        return { date: lastDay.slice(5), count: weekTotal };
    });

    return (
        <div className="space-y-6">
            <ActivityHeatmap dailyActivity={dailyActivity} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Activity by type */}
                <SectionCard title="Activity by Type" subtitle="What types of events were logged in the last 90 days">
                    {activityByType.length === 0 ? (
                        <div className="py-10 flex flex-col items-center gap-2">
                            <Activity size={24} className="text-[#e5e5ea]" />
                            <p className="text-[11px] text-[#86868b]">No activity logs found for this period.</p>
                            <p className="text-[10px] text-[#86868b] opacity-70">Activity is recorded when tasks are created, updated, commented on, or assigned.</p>
                        </div>
                    ) : (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={activityByType} layout="vertical">
                                    <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#f0f0f2" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: "#86868b" }} />
                                    <YAxis type="category" dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: "#86868b" }} width={100} />
                                    <Tooltip
                                        content={({ active, payload, label }) => (
                                            <DarkTooltip
                                                active={active}
                                                payload={payload}
                                                label={label}
                                                rows={p => [
                                                    { label: "Events", value: p[0]?.value as number ?? 0, color: BRAND_BLUE },
                                                    { label: "Share", value: `${totalActivity > 0 ? Math.round(((p[0]?.value as number ?? 0) / totalActivity) * 100) : 0}%` },
                                                ]}
                                            />
                                        )}
                                    />
                                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                        {activityByType.map((_, i) => (
                                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </SectionCard>

                {/* Weekly activity trend */}
                <SectionCard title="Weekly Task Creation Trend" subtitle="How many tasks were created each week over the last 12 weeks">
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={BRAND_BLUE} stopOpacity={0.2} />
                                        <stop offset="95%" stopColor={BRAND_BLUE} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f0f0f2" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: "#86868b" }} dy={8} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: "#86868b" }} />
                                <Tooltip
                                    content={({ active, payload, label }) => (
                                        <DarkTooltip
                                            active={active}
                                            payload={payload}
                                            label={label}
                                            rows={p => [
                                                { label: "Tasks created", value: p[0]?.value as number ?? 0, color: BRAND_BLUE },
                                            ]}
                                        />
                                    )}
                                />
                                <Area type="monotone" dataKey="count" stroke={BRAND_BLUE} strokeWidth={2} fill="url(#actGrad)" dot={{ r: 3, fill: BRAND_BLUE, strokeWidth: 0 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </SectionCard>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ReportsDashboard(props: Props) {
    const [activeTab, setActiveTab] = useState("overview");
    const [activeRange, setActiveRange] = useState(props.range);
    const [data, setData] = useState<Props>(props);
    const [loading, setLoading] = useState(false);

    async function handleRangeChange(newRange: number) {
        if (newRange === activeRange) return;
        setActiveRange(newRange);
        setLoading(true);
        try {
            const res = await fetch(`/api/reports?range=${newRange}`);
            if (res.ok) {
                const json = await res.json();
                setData({ ...json });
            }
        } finally {
            setLoading(false);
        }
    }

    const { stats, byStatus, byPriority, byMember, byProject, byWorkspace,
        weeklyTrend, dailyActivity, cycleTimeBuckets, agingBuckets, funnelData,
        priorityStatusMatrix, activityByType, overdueList, memberEfficiency } = data;

    const handleExport = () => {
        const rows: (string | number)[][] = [
            ["Section", "Metric", "Value", "Extra"],
            ["Overview", "Total Tasks", stats.total, ""],
            ["Overview", "Completed", stats.completed, ""],
            ["Overview", "Overdue", stats.overdue, ""],
            ["Overview", "Total Hours", Math.round(stats.totalHours), ""],
            [],
            ["Status Breakdown", "Status", "Count", "Percentage"]
        ];
        
        byStatus.forEach(s => {
            const pct = Math.round((s.count / (stats.total || 1)) * 100);
            rows.push(["Status", s.status, s.count, `${pct}%`]);
        });
        
        rows.push([]);
        rows.push(["Team Performance", "Member", "Tasks", "Hours"]);
        
        byMember.forEach(m => {
            rows.push(["Member", m.name, m.count, `${Math.round(m.hours)}h`]);
        });

        // Proper CSV formatting with quoting and escaping
        const csvContent = rows.map(r => 
            r.map(field => `"${String(field).replace(/"/g, '""')}"`).join(",")
        ).join("\n");

        // Add BOM for UTF-8 to ensure Excel compatibility
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `knotless_analytics_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6 pb-16">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#f0f0f2] pb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[#1d1d1f] tracking-tight">Reports & Intelligence</h1>
                    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mt-1 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#22be66] animate-pulse" />
                        {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                        {loading && <span className="text-[9px] text-[#0051e6] animate-pulse">Updating…</span>}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Range selector */}
                    <div className="flex items-center bg-[#f5f5f7] rounded-xl p-1 gap-0.5">
                        {RANGES.map(r => (
                            <button
                                key={r.value}
                                onClick={() => handleRangeChange(r.value)}
                                disabled={loading}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all",
                                    activeRange === r.value
                                        ? "bg-white text-[#1d1d1f] shadow-sm"
                                        : "text-[#86868b] hover:text-[#1d1d1f]",
                                    loading && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                    <button 
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-[#0051e6] text-white rounded-xl text-[11px] font-bold hover:bg-[#0041b3] transition-all"
                    >
                        <Download size={13} /> Export
                    </button>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-[#f0f0f2]">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all",
                                isActive
                                    ? "bg-[#0051e6] text-white"
                                    : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                            )}
                        >
                            <Icon size={13} />
                            {tab.label}
                            {tab.id === "risk" && overdueList.length > 0 && (
                                <span className="bg-[#ff3b30] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                    {overdueList.length > 9 ? "9+" : overdueList.length}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                >
                    {activeTab === "overview" && (
                        <OverviewTab stats={stats} byStatus={byStatus} weeklyTrend={weeklyTrend} funnelData={funnelData} />
                    )}
                    {activeTab === "flow" && (
                        <FlowTab weeklyTrend={weeklyTrend} cycleTimeBuckets={cycleTimeBuckets} agingBuckets={agingBuckets} byPriority={byPriority} />
                    )}
                    {activeTab === "team" && (
                        <TeamTab byMember={byMember} memberEfficiency={memberEfficiency} />
                    )}
                    {activeTab === "projects" && (
                        <ProjectsTab byProject={byProject} byWorkspace={byWorkspace} />
                    )}
                    {activeTab === "risk" && (
                        <RiskTab priorityStatusMatrix={priorityStatusMatrix} overdueList={overdueList} />
                    )}
                    {activeTab === "activity" && (
                        <ActivityTab dailyActivity={dailyActivity} activityByType={activityByType} />
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
