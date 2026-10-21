'use client';

import { BaseEdge, type Edge, type EdgeProps } from '@xyflow/react';
import { detourPath, type LayoutDirection } from './workflow-graph';

export type FactoryRouteEdge = Edge<{ direction: LayoutDirection; lane: number }, 'factoryRoute'>;

/** Route a skipped-step handoff around cards rather than drawing through them. */
export function WorkflowRoute({
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  markerStart,
  markerEnd,
  style,
  label,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  interactionWidth,
}: EdgeProps<FactoryRouteEdge>) {
  const geometry = detourPath(
    sourceX,
    sourceY,
    targetX,
    targetY,
    data?.direction ?? 'horizontal',
    data?.lane ?? 0,
  );
  return (
    <BaseEdge
      {...geometry}
      markerStart={markerStart}
      markerEnd={markerEnd}
      style={style}
      label={label}
      labelStyle={labelStyle}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
      interactionWidth={interactionWidth}
    />
  );
}
