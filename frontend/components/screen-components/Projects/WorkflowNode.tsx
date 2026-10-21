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
    stage,
    touring,
    visited,
    connecting,
    validTarget,
  } = data;
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(id);
  }, [direction, id, updateNodeInternals]);
  const Icon = roleIcons[(step.roleKey ?? step.kind) as keyof typeof roleIcons] ?? RobotIcon;
  const vertical = direction === 'vertical';
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
            isConnectable={isConnectable}
            title={'Incoming connections to ' + step.label}
            aria-label={'Connect into ' + step.label}
          />
          <Handle
            id="feedback-in"
            type="target"
            position={vertical ? Position.Left : Position.Top}
            className={styles.feedbackHandle}
            isConnectable={isConnectable}
            title={'Return to ' + step.label + ' for a bounded review conversation'}
            aria-label={'Review loop back to ' + step.label}
          />
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
        isConnectable={isConnectable}
        title={'Drag to connect from ' + step.label}
        aria-label={'Connect from ' + step.label}
      />
    </div>
  );
});
