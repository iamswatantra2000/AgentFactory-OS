'use client';

import { memo, useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals, type Node, type NodeProps } from '@xyflow/react';
import {
  ChartBarIcon,
  FileTextIcon,
  GitBranchIcon,
  HeadsetIcon,
  ImageIcon,
  LightningIcon,
  RobotIcon,
  UserCircleIcon,
} from '@phosphor-icons/react';
import { kindLabels, type GraphNode, type LayoutDirection } from './workflow-graph';
import { modelName } from './model-catalog';
import styles from './factory.module.css';

export const roleIcons = {
  'data-analyst': ChartBarIcon,
  'research-writer': FileTextIcon,
  'visual-creator': ImageIcon,
  'support-agent': HeadsetIcon,
  'custom-agent': RobotIcon,
  trigger: LightningIcon,
  handoff: GitBranchIcon,
  review: UserCircleIcon,
  output: FileTextIcon,
};
export type WorkflowCanvasNode = Node<
  {
    step: GraphNode;
    direction: LayoutDirection;
    incoming: number;
    outgoing: number;
    forwardOutgoing: number;
    incomingForwardIds: string[];
    outgoingForwardIds: string[];
    incomingFeedbackIds: string[];
    outgoingFeedbackIds: string[];
    portSignature: string;
    stage: number;
    touring: boolean;
    visited: boolean;
    connecting: boolean;
    validTarget: boolean;
  },
  'workflow'
>;

export const WorkflowNode = memo(function WorkflowNode({
  id,
  data,
  selected,
  isConnectable,
}: NodeProps<WorkflowCanvasNode>) {
  const {
    step,
    direction,
    incoming,
    outgoing,
    forwardOutgoing,
    incomingForwardIds,
    outgoingForwardIds,
    incomingFeedbackIds,
    outgoingFeedbackIds,
    portSignature,
    stage,
    touring,
    visited,
    connecting,
    validTarget,
  } = data;
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(id);
  }, [direction, id, portSignature, updateNodeInternals]);
  const Icon = roleIcons[(step.roleKey ?? step.kind) as keyof typeof roleIcons] ?? RobotIcon;
  const vertical = direction === 'vertical';
  const spread = (index: number, total: number, start = 23, end = 72) =>
    `${start + ((index + 1) * (end - start)) / (total + 1)}%`;
  return (
    <div
      className={[
        styles.node,
        styles['node' + step.kind],
        selected ? styles.selectedNode : '',
        connecting && validTarget ? styles.availableTarget : '',
        touring ? styles.touringNode : '',
        visited ? styles.visitedNode : '',
      ].join(' ')}
    >
      {step.kind !== 'trigger' && (
        <>
          <Handle
            id="in"
            type="target"
            position={vertical ? Position.Top : Position.Left}
            className={styles.inputHandle}
            style={
              vertical
                ? { left: incomingForwardIds.length ? '88%' : '50%' }
                : { top: incomingForwardIds.length ? '88%' : '50%' }
            }
            isConnectable={isConnectable}
            title={'Incoming connections to ' + step.label}
            aria-label={'Connect into ' + step.label}
          />
          {incomingForwardIds.map((edgeId, index) => (
            <Handle
              key={edgeId}
              id={`in:${edgeId}`}
              type="target"
              position={vertical ? Position.Top : Position.Left}
              className={`${styles.inputHandle} ${styles.routePort}`}
              style={
                vertical
                  ? { left: spread(index, incomingForwardIds.length) }
                  : { top: spread(index, incomingForwardIds.length) }
              }
              isConnectable={false}
              aria-label={`Incoming route ${index + 1} to ${step.label}`}
            />
          ))}
          <Handle
            id="feedback-in"
            type="target"
            position={vertical ? Position.Left : Position.Top}
            className={styles.feedbackHandle}
            style={
              vertical
                ? { top: incomingFeedbackIds.length ? '45%' : '50%' }
                : { left: incomingFeedbackIds.length ? '45%' : '50%' }
            }
            isConnectable={isConnectable}
            title={'Return to ' + step.label + ' for a bounded review conversation'}
            aria-label={'Review loop back to ' + step.label}
          />
          {incomingFeedbackIds.map((edgeId, index) => (
            <Handle
              key={edgeId}
              id={`feedback-in:${edgeId}`}
              type="target"
              position={vertical ? Position.Left : Position.Top}
              className={`${styles.feedbackHandle} ${styles.routePort}`}
              style={
                vertical
                  ? { top: spread(index, incomingFeedbackIds.length, 12, 36) }
                  : { left: spread(index, incomingFeedbackIds.length, 12, 36) }
              }
              isConnectable={false}
              aria-label={`Review return ${index + 1} to ${step.label}`}
            />
          ))}
        </>
      )}
      <div className={styles.nodeTop}>
        <span className={styles.nodeIcon}>
          <Icon size={21} />
        </span>
        <span className={styles.nodeType}>
          Stage {String(stage).padStart(2, '0')} · {kindLabels[step.kind]}
        </span>
        <span className={styles.nodeGrip} aria-hidden="true">
          ⠿
        </span>
      </div>
      <strong className={styles.nodeName}>{step.label || 'Untitled step'}</strong>
      <p className={styles.nodeDescription}>
        {step.kind === 'trigger'
          ? step.businessPrompt?.trim() || 'Select this start node to define your business model.'
          : step.kind === 'handoff'
            ? 'To ' +
              (step.recipientName?.trim() || 'choose a recipient') +
              ' · ' +
              (step.recipientType ?? 'person')
            : step.description || 'Select this step to define its responsibility.'}
      </p>
      {step.kind === 'trigger' ? (
        <span className={styles.nodeModel}>
          <LightningIcon size={12} aria-hidden="true" />
          {step.businessPrompt?.trim() ? 'Business prompt ready' : 'Add business prompt'}
        </span>
      ) : (
        <span className={styles.nodeModel} title={step.modelConfig?.modelId ?? 'No model selected'}>
          <RobotIcon size={12} aria-hidden="true" />
          {modelName(step.modelConfig)}
          {step.modelConfig && <em>{step.modelConfig.effort}</em>}
        </span>
      )}
      <div className={styles.nodeConnections}>
        <span>{step.kind === 'trigger' ? 'START HERE' : `IN · ${incoming}`}</span>
        <span>
          OUT · {outgoing}
          {forwardOutgoing > 1
            ? ` · ${step.branchMode === 'parallel' ? 'PARALLEL' : 'IN ORDER'}`
            : ''}
        </span>
      </div>
      <Handle
        id="out"
        type="source"
        position={vertical ? Position.Bottom : Position.Right}
        className={styles.outputHandle}
        style={
          vertical
            ? { left: outgoingForwardIds.length ? '88%' : '50%' }
            : { top: outgoingForwardIds.length ? '88%' : '50%' }
        }
        isConnectable={isConnectable}
        title={'Drag to connect from ' + step.label}
        aria-label={'Connect from ' + step.label}
      />
      {outgoingForwardIds.map((edgeId, index) => (
        <Handle
          key={edgeId}
          id={`out:${edgeId}`}
          type="source"
          position={vertical ? Position.Bottom : Position.Right}
          className={`${styles.outputHandle} ${styles.routePort}`}
          style={
            vertical
              ? { left: spread(index, outgoingForwardIds.length) }
              : { top: spread(index, outgoingForwardIds.length) }
          }
          isConnectable={false}
          aria-label={`Outgoing route ${index + 1} from ${step.label}`}
        />
      ))}
      {outgoingFeedbackIds.map((edgeId, index) => (
        <Handle
          key={edgeId}
          id={`feedback-out:${edgeId}`}
          type="source"
          position={vertical ? Position.Left : Position.Top}
          className={`${styles.feedbackHandle} ${styles.routePort}`}
          style={
            vertical
              ? { top: spread(index, outgoingFeedbackIds.length, 64, 88) }
              : { left: spread(index, outgoingFeedbackIds.length, 64, 88) }
          }
          isConnectable={false}
          aria-label={`Review route ${index + 1} from ${step.label}`}
        />
      ))}
    </div>
  );
});
