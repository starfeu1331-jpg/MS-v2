/**
 * Recharts re-exports
 * 
 * Direct re-exports from recharts. Code splitting is handled automatically
 * by Vite because every component importing this file is already lazy-loaded
 * via React.lazy() in App.tsx.
 * 
 * NOTE: Do NOT use React.lazy() wrappers around individual recharts exports.
 * Vite/Rollup freezes ES module namespace objects in production, which breaks
 * React.lazy's _status writes → "Cannot assign to read only property '_status'"
 */

import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ComposedChart,
  ScatterChart,
  Scatter,
} from 'recharts';

// Keep "Lazy" prefix aliases so existing imports don't break
export const LazyResponsiveContainer = ResponsiveContainer;
export const LazyLineChart = LineChart;
export const LazyBarChart = BarChart;
export const LazyLine = Line;
export const LazyBar = Bar;
export const LazyXAxis = XAxis;
export const LazyYAxis = YAxis;
export const LazyCartesianGrid = CartesianGrid;
export const LazyTooltip = Tooltip;
export const LazyLegend = Legend;
export const LazyPieChart = PieChart;
export const LazyPie = Pie;
export const LazyCell = Cell;
export const LazyAreaChart = AreaChart;
export const LazyArea = Area;
export const LazyComposedChart = ComposedChart;
export const LazyScatterChart = ScatterChart;
export const LazyScatter = Scatter;

// ChartFallback kept for Suspense boundaries (harmless around non-lazy content)
export const ChartFallback = () => (
  <div className="w-full h-64 bg-zinc-900/50 rounded-xl border border-zinc-800 skel-breath">
    <div className="h-full bg-zinc-800/20 rounded-xl" />
  </div>
);
