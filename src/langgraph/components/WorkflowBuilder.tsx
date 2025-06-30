import React, { useState, useCallback } from 'react';
import { WorkflowNode, WorkflowEdge, Workflow } from '../types';
import { FaPlus, FaTrash, FaPlay, FaSave } from 'react-icons/fa';
import './WorkflowBuilder.css';

interface WorkflowBuilderProps {
  workflow?: Workflow;
  onSave?: (workflow: Workflow) => void;
  onExecute?: (workflow: Workflow) => void;
}

export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({
  workflow: initialWorkflow,
  onSave,
  onExecute,
}) => {
  const [workflow, setWorkflow] = useState<Workflow>(
    initialWorkflow || {
      id: `workflow-${Date.now()}`,
      name: 'New Workflow',
      description: '',
      nodes: [],
      edges: [],
      entryPoint: '',
    }
  );

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);

  const addNode = useCallback((type: WorkflowNode['type']) => {
    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      name: `${type} Node`,
      type,
      config: {},
    };

    setWorkflow(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
      entryPoint: prev.nodes.length === 0 ? newNode.id : prev.entryPoint,
    }));
  }, []);

  const updateNode = useCallback((nodeId: string, updates: Partial<WorkflowNode>) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.map(node =>
        node.id === nodeId ? { ...node, ...updates } : node
      ),
    }));
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.filter(node => node.id !== nodeId),
      edges: prev.edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId),
      entryPoint: prev.entryPoint === nodeId ? '' : prev.entryPoint,
    }));
    setSelectedNode(null);
  }, []);

  const addEdge = useCallback((source: string, target: string) => {
    const newEdge: WorkflowEdge = {
      id: `edge-${Date.now()}`,
      source,
      target,
    };

    setWorkflow(prev => ({
      ...prev,
      edges: [...prev.edges, newEdge],
    }));
  }, []);

  const deleteEdge = useCallback((edgeId: string) => {
    setWorkflow(prev => ({
      ...prev,
      edges: prev.edges.filter(edge => edge.id !== edgeId),
    }));
    setSelectedEdge(null);
  }, []);

  const handleSave = () => {
    if (onSave) {
      onSave(workflow);
    }
  };

  const handleExecute = () => {
    if (onExecute) {
      onExecute(workflow);
    }
  };

  return (
    <div className="workflow-builder">
      <div className="workflow-header">
        <input
          type="text"
          className="workflow-name"
          value={workflow.name}
          onChange={(e) => setWorkflow(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Workflow Name"
        />
        <div className="workflow-actions">
          <button className="workflow-btn" onClick={handleSave} title="Save Workflow">
            <FaSave />
          </button>
          <button className="workflow-btn workflow-btn-primary" onClick={handleExecute} title="Execute Workflow">
            <FaPlay />
          </button>
        </div>
      </div>

      <div className="workflow-content">
        <div className="workflow-sidebar">
          <h3>Add Nodes</h3>
          <div className="node-palette">
            <button
              className="node-type-btn"
              onClick={() => addNode('llm')}
            >
              <FaPlus /> LLM Node
            </button>
            <button
              className="node-type-btn"
              onClick={() => addNode('tool')}
            >
              <FaPlus /> Tool Node
            </button>
            <button
              className="node-type-btn"
              onClick={() => addNode('conditional')}
            >
              <FaPlus /> Conditional
            </button>
            <button
              className="node-type-btn"
              onClick={() => addNode('human')}
            >
              <FaPlus /> Human Input
            </button>
          </div>

          {selectedNode && (
            <div className="node-properties">
              <h3>Node Properties</h3>
              {workflow.nodes.find(n => n.id === selectedNode) && (
                <div className="properties-form">
                  <label>
                    Name:
                    <input
                      type="text"
                      value={workflow.nodes.find(n => n.id === selectedNode)?.name || ''}
                      onChange={(e) => updateNode(selectedNode, { name: e.target.value })}
                    />
                  </label>
                  <button
                    className="delete-btn"
                    onClick={() => deleteNode(selectedNode)}
                  >
                    <FaTrash /> Delete Node
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="workflow-canvas">
          <svg className="workflow-svg">
            {/* Render edges */}
            {workflow.edges.map(edge => {
              const sourceNode = workflow.nodes.find(n => n.id === edge.source);
              const targetNode = workflow.nodes.find(n => n.id === edge.target);
              
              if (!sourceNode || !targetNode) return null;

              // Simple positioning - in a real implementation, you'd have draggable nodes
              const sourceIndex = workflow.nodes.indexOf(sourceNode);
              const targetIndex = workflow.nodes.indexOf(targetNode);
              const sourceX = 100 + sourceIndex * 200;
              const sourceY = 100;
              const targetX = 100 + targetIndex * 200;
              const targetY = 200;

              return (
                <g key={edge.id}>
                  <line
                    className={`workflow-edge ${selectedEdge === edge.id ? 'selected' : ''}`}
                    x1={sourceX}
                    y1={sourceY}
                    x2={targetX}
                    y2={targetY}
                    onClick={() => setSelectedEdge(edge.id)}
                  />
                </g>
              );
            })}

            {/* Render nodes */}
            {workflow.nodes.map((node, index) => {
              const x = 100 + index * 200;
              const y = 100;

              return (
                <g key={node.id} transform={`translate(${x}, ${y})`}>
                  <rect
                    className={`workflow-node ${node.type} ${selectedNode === node.id ? 'selected' : ''}`}
                    x={-60}
                    y={-30}
                    width={120}
                    height={60}
                    rx={5}
                    onClick={() => setSelectedNode(node.id)}
                  />
                  <text
                    className="node-label"
                    textAnchor="middle"
                    y={5}
                  >
                    {node.name}
                  </text>
                  {workflow.entryPoint === node.id && (
                    <circle
                      className="entry-point"
                      cx={-70}
                      cy={0}
                      r={5}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          <div className="workflow-description">
            <textarea
              placeholder="Workflow description..."
              value={workflow.description}
              onChange={(e) => setWorkflow(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
};