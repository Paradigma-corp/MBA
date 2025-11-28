import React, { forwardRef, useMemo, useRef, useState } from 'react';
import { formatCurrency, formatNumber, formatPercent } from '../../utils/formatters.js';

const PADDING = { top: 20, right: 12, bottom: 60, left: 70 };
const BOX_WIDTH = 44;
const WHISKER_WIDTH = 18;

const axisTicks = (min, max, steps = 5) => {
  if (max === min) return [min];
  const span = max - min;
  const step = span / steps;
  return Array.from({ length: steps + 1 }, (_, idx) => min + idx * step);
};

const BoxPlot = forwardRef(({ data = [], showOutliers = true }, ref) => {
  const [tooltip, setTooltip] = useState(null);
  const containerRef = useRef(null);

  const { minValue, maxValue } = useMemo(() => {
    const values = data.flatMap((item) => {
      const extremes = [item.p10 ?? 0, item.p90 ?? 0];
      const outs = showOutliers ? item.outliers ?? [] : [];
      return [...extremes, ...outs];
    });
    if (!values.length) return { minValue: 0, maxValue: 0 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { minValue: min, maxValue: max === min ? min + 1 : max };
  }, [data, showOutliers]);

  const chartWidth = Math.max(360, data.length * 130 + PADDING.left + PADDING.right);
  const chartHeight = 360;
  const usableHeight = chartHeight - PADDING.top - PADDING.bottom;

  const yScale = (value) => {
    if (maxValue === minValue) return chartHeight - PADDING.bottom;
    const ratio = (value - minValue) / (maxValue - minValue);
    return chartHeight - PADDING.bottom - ratio * usableHeight;
  };

  const groups = useMemo(
    () =>
      data.map((item, idx) => ({
        ...item,
        x: PADDING.left + (idx + 0.5) * ((chartWidth - PADDING.left - PADDING.right) / Math.max(data.length, 1)),
      })),
    [chartWidth, data],
  );

  const handleMove = (event, item) => {
    setTooltip({
      item,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleLeave = () => setTooltip(null);

  if (!data.length) {
    return (
      <div ref={ref} className="h-[340px] flex items-center justify-center text-sm text-slate-500">
        Sin datos de márgenes para el filtro actual.
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <svg ref={containerRef} viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-[340px]">
        <g>
          {/* Axes */}
          <line
            x1={PADDING.left}
            y1={chartHeight - PADDING.bottom}
            x2={chartWidth - PADDING.right}
            y2={chartHeight - PADDING.bottom}
            stroke="#CBD5E1"
            strokeWidth={1}
          />
          <line
            x1={PADDING.left}
            y1={PADDING.top}
            x2={PADDING.left}
            y2={chartHeight - PADDING.bottom}
            stroke="#CBD5E1"
            strokeWidth={1}
          />
          {axisTicks(minValue, maxValue, 4).map((tick) => {
            const y = yScale(tick);
            return (
              <g key={`tick-${tick}`}>
                <line x1={PADDING.left - 6} x2={PADDING.left} y1={y} y2={y} stroke="#CBD5E1" strokeWidth={1} />
                <text x={PADDING.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#475569">
                  {formatNumber(tick)}
                </text>
              </g>
            );
          })}
        </g>

        {groups.map((item) => {
          const boxTop = yScale(item.q3);
          const boxBottom = yScale(item.q1);
          const medianY = yScale(item.median);
          const ciTop = yScale(item.ciUpper);
          const ciBottom = yScale(item.ciLower);
          const whiskerTop = yScale(item.p90);
          const whiskerBottom = yScale(item.p10);
          const boxHeight = Math.max(4, boxBottom - boxTop);

          return (
            <g
              key={item.line}
              onMouseMove={(event) => handleMove(event, item)}
              onMouseLeave={handleLeave}
              className="cursor-crosshair"
            >
              {/* Whiskers P10-P90 */}
              <line x1={item.x} x2={item.x} y1={whiskerTop} y2={whiskerBottom} stroke="#94A3B8" strokeWidth={1.5} />
              <line
                x1={item.x - WHISKER_WIDTH / 2}
                x2={item.x + WHISKER_WIDTH / 2}
                y1={whiskerTop}
                y2={whiskerTop}
                stroke="#94A3B8"
                strokeWidth={1.5}
              />
              <line
                x1={item.x - WHISKER_WIDTH / 2}
                x2={item.x + WHISKER_WIDTH / 2}
                y1={whiskerBottom}
                y2={whiskerBottom}
                stroke="#94A3B8"
                strokeWidth={1.5}
              />

              {/* Bootstrap median band */}
              <rect
                x={item.x - BOX_WIDTH / 2}
                y={Math.min(ciTop, ciBottom)}
                width={BOX_WIDTH}
                height={Math.abs(ciTop - ciBottom) || 2}
                fill="#22c7f2"
                opacity={0.18}
                rx={6}
              />

              {/* Box IQR */}
              <rect
                x={item.x - BOX_WIDTH / 2}
                y={boxTop}
                width={BOX_WIDTH}
                height={boxHeight}
                fill="#E2E8F0"
                stroke="#0EA5E9"
                strokeWidth={1.2}
                rx={8}
              />

              {/* Median */}
              <line
                x1={item.x - BOX_WIDTH / 2}
                x2={item.x + BOX_WIDTH / 2}
                y1={medianY}
                y2={medianY}
                stroke="#0EA5E9"
                strokeWidth={2.2}
              />

              {/* Outliers */}
              {showOutliers &&
                (item.outliers || []).map((value, idx) => {
                  const jitter = ((idx % 3) - 1) * 6;
                  return (
                    <circle
                      key={`${item.line}-out-${idx}`}
                      cx={item.x + jitter}
                      cy={yScale(value)}
                      r={4}
                      fill="#F59E0B"
                      opacity={0.9}
                    />
                  );
                })}

              <text
                x={item.x}
                y={chartHeight - PADDING.bottom + 24}
                textAnchor="middle"
                fontSize="12"
                fill="#0F172A"
              >
                {item.line}
              </text>
            </g>
          );
        })}

        <text
          x={PADDING.left}
          y={chartHeight - 14}
          fontSize="11"
          fill="#475569"
        >
          Bigotes = P10–P90 · Banda = IC95% mediana (bootstrap B=2000)
        </text>
        <text x={16} y={18} fontSize="12" fill="#0F172A" fontWeight="600">
          Márgenes por línea de negocio
        </text>
      </svg>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs"
          style={{ left: tooltip.x - 220, top: tooltip.y - 120 }}
        >
          <p className="font-semibold text-slate-900">{tooltip.item.line}</p>
          <p className="text-slate-600">Años: {tooltip.item.years?.length ? tooltip.item.years.join(', ') : '—'}</p>
          <p className="text-slate-600">
            N: {formatNumber(tooltip.item.n)} · Mediana: {formatCurrency(tooltip.item.median)}
          </p>
          <p className="text-slate-600">IQR: {formatCurrency(tooltip.item.q1)} – {formatCurrency(tooltip.item.q3)}</p>
          <p className="text-slate-600">% outliers: {formatPercent(tooltip.item.outlierPct / 100)}</p>
        </div>
      )}
    </div>
  );
});

BoxPlot.displayName = 'BoxPlot';

export default BoxPlot;
