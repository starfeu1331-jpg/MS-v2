/**
 * Lazy Recharts Wrapper
 * 
 * This splits recharts imports into a separate async chunk that loads
 * AFTER the main app renders, preventing the 10-minute blank screen.
 * 
 * Usage: Import this module instead of importing directly from 'recharts'
 */

import { lazy, Suspense } from 'react';
import type { ComponentType } from 'react';

// Create a wrapper for recharts that loads asynchronously
const createLazyChart = (importPath: string, componentName: string) => {
  return lazy(() =>
    import('recharts').then((module) => ({
      default: module[componentName as keyof typeof module] as ComponentType<any>,
    }))
  );
};

// Export lazy versions of recharts components
export const LazyResponsiveContainer = createLazyChart('recharts', 'ResponsiveContainer');
export const LazyLineChart = createLazyChart('recharts', 'LineChart');
export const LazyBarChart = createLazyChart('recharts', 'BarChart');
export const LazyLine = createLazyChart('recharts', 'Line');
export const LazyBar = createLazyChart('recharts', 'Bar');
export const LazyXAxis = createLazyChart('recharts', 'XAxis');
export const LazyYAxis = createLazyChart('recharts', 'YAxis');
export const LazyCartesianGrid = createLazyChart('recharts', 'CartesianGrid');
export const LazyTooltip = createLazyChart('recharts', 'Tooltip');
export const LazyLegend = createLazyChart('recharts', 'Legend');
export const LazyPieChart = createLazyChart('recharts', 'PieChart');
export const LazyPie = createLazyChart('recharts', 'Pie');
export const LazyCell = createLazyChart('recharts', 'Cell');
export const LazyAreaChart = createLazyChart('recharts', 'AreaChart');
export const LazyArea = createLazyChart('recharts', 'Area');
export const LazyComposedChart = createLazyChart('recharts', 'ComposedChart');
export const LazyScatterChart = createLazyChart('recharts', 'ScatterChart');
export const LazyScatter = createLazyChart('recharts', 'Scatter');

// Fallback component for chart loading
export const ChartFallback = () => (
  <div className="flex items-center justify-center w-full h-64 bg-zinc-900 rounded-lg border border-zinc-800">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
      <p className="text-zinc-500 text-sm">Chargement du graphique...</p>
    </div>
  </div>
);

/**
 * Usage in your components:
 * 
 * BEFORE (synchronous - SLOW):
 * import { ResponsiveContainer, LineChart, Line } from 'recharts'
 * 
 * AFTER (async - FAST):
 * import { LazyResponsiveContainer as ResponsiveContainer, LazyLineChart as LineChart, LazyLine as Line, ChartFallback } from '@/utils/lazyRecharts'
 * 
 * Then wrap in Suspense:
 * <Suspense fallback={<ChartFallback />}>
 *   <ResponsiveContainer width="100%" height={300}>
 *     <LineChart data={data}>
 *       <Line dataKey="value" />
 *     </LineChart>
 *   </ResponsiveContainer>
 * </Suspense>
 */
