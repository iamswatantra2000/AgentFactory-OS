'use client';

import { BaseEdge, type Edge, type EdgeProps } from '@xyflow/react';
import { factoryRoutePath, type RoutePlan } from './workflow-graph';

export type FactoryRouteEdge = Edge<RoutePlan, 'factoryRoute'>;

/** Draw each handoff as a separate, rounded production route. */
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
  const geometry = factoryRoutePath(
    sourceX,
    sourceY,
    targetX,
    targetY,
    data ?? {
      direction: 'horizontal',
      kind: 'direct',
    },
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
