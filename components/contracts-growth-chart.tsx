'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { CHART_TOOLTIP_STYLE } from '@/lib/chart-config';
import type { Contract } from '@/lib/types';

// Fixed palette that works in both light and dark mode
const COLORS = [
  'hsl(210, 70%, 55%)',
  'hsl(160, 60%, 45%)',
  'hsl(30,  70%, 50%)',
  'hsl(280, 55%, 55%)',
  'hsl(0,   65%, 55%)',
  'hsl(200, 60%, 50%)',
  'hsl(80,  60%, 45%)',
];

interface ContractsGrowthChartProps {
  contracts: Contract[];
  /** When true, show one line per company + a dashed Total. When false, single line. */
  multiCompany?: boolean;
}

export function ContractsGrowthChart({ contracts, multiCompany = true }: ContractsGrowthChartProps) {
  const { chartData, companyNames } = useMemo(() => {
    if (!contracts.length) return { chartData: [], companyNames: [] };

    // Use startDate if present (supports historical back-dating), else createdAt
    const dateOf = (c: Contract) =>
      c.startDate ? new Date(c.startDate) : new Date(c.createdAt);

    // Sort oldest → newest
    const sorted = [...contracts].sort((a, b) => dateOf(a).getTime() - dateOf(b).getTime());

    // Build ordered list of unique month keys
    const monthKeys: string[]   = [];
    const monthTs: Record<string, number> = {};
    sorted.forEach(c => {
      const key = dateOf(c).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!monthTs[key]) {
        monthTs[key] = dateOf(c).getTime();
        monthKeys.push(key);
      }
    });

    // Count per company per month
    const countMap: Record<string, Record<string, number>> = {};
    monthKeys.forEach(m => { countMap[m] = {}; });

    // Collect distinct company names (preserving insertion order = chronological first appearance)
    const nameSet = new Set<string>();
    sorted.forEach(c => {
      const name = c.company?.name ?? `Company ${c.companyId?.slice(-4) ?? '?'}`;
      nameSet.add(name);
      const key = dateOf(c).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      countMap[key][name] = (countMap[key][name] ?? 0) + 1;
    });

    const names = [...nameSet];

    // Build cumulative rows
    const cumulative: Record<string, number> = {};
    names.forEach(n => { cumulative[n] = 0; });
    let totalCum = 0;

    const data = monthKeys.map(month => {
      const row: Record<string, string | number> = { month };
      names.forEach(name => {
        cumulative[name] += countMap[month][name] ?? 0;
        if (multiCompany && names.length > 1) {
          row[name] = cumulative[name];
        }
      });
      const monthTotal = Object.values(countMap[month]).reduce((s, v) => s + v, 0);
      totalCum += monthTotal;
      if (!multiCompany || names.length === 1) {
        row['Contracts'] = totalCum;
      } else {
        row['Total'] = totalCum;
      }
      return row;
    });

    return { chartData: data, companyNames: names };
  }, [contracts, multiCompany]);

  if (chartData.length === 0) return null;

  const showPerCompany = multiCompany && companyNames.length > 1;

  // Lines: one per company + dashed Total (when multi-company)
  const lines: Array<{ key: string; color: string; dashed: boolean; width: number }> = [];
  if (showPerCompany) {
    companyNames.forEach((name, i) => {
      lines.push({ key: name, color: COLORS[i % COLORS.length], dashed: false, width: 2 });
    });
    lines.push({ key: 'Total', color: 'hsl(var(--muted-foreground))', dashed: true, width: 1.5 });
  } else {
    lines.push({ key: 'Contracts', color: COLORS[0], dashed: false, width: 2 });
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Contracts Growth Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              allowDecimals={false}
              tickFormatter={v => String(v)}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number, name: string) => [value, name]}
            />
            {showPerCompany && <Legend />}
            {lines.map(l => (
              <Line
                key={l.key}
                type="monotone"
                dataKey={l.key}
                stroke={l.color}
                strokeWidth={l.width}
                strokeDasharray={l.dashed ? '5 3' : undefined}
                dot={!l.dashed && chartData.length <= 24}
                activeDot={{ r: 4 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        {showPerCompany && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Cumulative contracts — dashed line shows system-wide total
          </p>
        )}
      </CardContent>
    </Card>
  );
}
