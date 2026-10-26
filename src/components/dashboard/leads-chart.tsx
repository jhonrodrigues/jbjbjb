"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/ui/empty-state";
import { formatNumber } from "@/lib/utils";

type Point = { date: string; label: string; value: number };

export function LeadsChart({ leads, lps }: { leads: Point[]; lps: Point[] }) {
  const total = leads.reduce((sum, point) => sum + point.value, 0) + lps.reduce((sum, point) => sum + point.value, 0);
  if (!total) {
    return (
      <EmptyState
        compact
        title="Sem movimentação no período"
        description="Os volumes diários de empresas e landing pages aparecerão aqui."
      />
    );
  }

  const lpMap = new Map(lps.map((point) => [point.date, point.value]));
  const data = leads.map((point) => ({
    label: point.label,
    leads: point.value,
    lps: lpMap.get(point.date) ?? 0,
  }));

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id="fill-leads" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fill-lps" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--muted-2)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--muted-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted-2)", fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            minTickGap={26}
          />
          <YAxis
            tick={{ fill: "var(--muted-2)", fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              fontSize: 11,
              color: "var(--ink)",
              boxShadow: "var(--shadow-pop)",
            }}
            labelStyle={{ color: "var(--muted)", marginBottom: 4 }}
            formatter={(value, name) => [formatNumber(Number(value)), name === "leads" ? "Empresas" : "LPs"]}
          />
          <Area
            type="monotone"
            dataKey="lps"
            stroke="var(--muted-2)"
            strokeWidth={1.5}
            fill="url(#fill-lps)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="leads"
            stroke="var(--accent)"
            strokeWidth={1.75}
            fill="url(#fill-leads)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
