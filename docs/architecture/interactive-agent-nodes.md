# Interactive agent nodes and execution contracts

Status: proposed engineering specification · 23 October 2026

## 0. Scope and current-state boundary

This specification defines the project-scoped Visual Factory draft, its interactive nodes and routes, and the contract a future execution service must honor. It is not a claim that saving a graph currently runs agents. Today, `VisualFactory.tsx` is a design-time editor; `workflow-graph.ts` stores `trigger | agent | handoff | review | output` nodes and `forward | feedback` edges; `project-service` validates and stores the graph as `ProjectDocument.graphJson` with `schemaVersion = 1`. The existing UI already has responsibility text, a curated provider/model/effort selector, ordered/parallel branches, multiple visually distinct edge handles, and bounded feedback-route intent. It does **not** yet have authored port contracts, mandatory edge transfer definitions, max steps per cycle, provider credentials, or a production execution engine.

The v2 design below keeps the current limits of **80 nodes** and **160 edges** unless a measured capacity review changes them. The Business Brief remains the one prompt-only start node. Agent nodes run an LLM. Handoff, Human Review, and Final Output are distinct step types; they must not silently call an LLM merely because the card displays an agent icon or a model selector.

### Non-goals for this phase

- Autonomous publishing without the existing human-approval policy.
- Arbitrary JavaScript conditions or user-supplied code in edge definitions.
- Credentials in graph JSON, client state, logs, or execution payloads.
- A guarantee that a curated model is available: design-time catalog presence is not provider entitlement.

## 1. Functional and technical specification

### 1.1 Graph aggregate and versioning

`ProjectDocument.schemaVersion = 2` identifies the new shape. The project service remains the authoritative validator and persists a complete graph revision, not independent node mutations. The existing `POST /api/v1/projects/:projectId/graph` optimistic-concurrency contract (`expectedUpdatedAt`) remains, but the response should include an opaque `revisionId`/ETag; new clients must send `If-Match` or `expectedRevisionId`. A run snapshots the graph revision, model catalog version, contract hashes, and actor permissions. Editing a draft never changes an in-flight run.

Recommended aggregate:

```json
{
  "schemaVersion": 2,
  "projectId": "project-uuid",
  "revisionId": "revision-uuid",
  "nodes": [],
  "edges": [],
  "executionPolicy": {
    "maxRunSeconds": 3600,
    "maxNodeInvocations": 256,
    "maxTotalModelSteps": 512,
    "approvalBeforeExternalOutput": true
  }
}
```

IDs above are explanatory placeholders; persisted IDs must be UUIDs. The graph revision and runtime status are server-owned. A client may only edit documented draft fields.

### 1.2 Node configuration schema

The following JSON Schema is the v2 API boundary for a node. Cross-node and provider-capability rules in §4 are additional server-side checks. `criticality` is business risk and `effort` is model reasoning budget; neither is temperature. Temperature is a separate optional sampling control, and unsupported model controls are omitted from requests rather than approximated.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://agentfactory.os/schemas/workflow-node.v2.json",
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "kind", "label", "purpose", "ports", "layout", "appearance"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "kind": { "enum": ["trigger", "agent", "handoff", "review", "output"] },
    "roleKey": { "type": "string", "maxLength": 80 },
    "label": { "type": "string", "minLength": 1, "maxLength": 100 },
    "purpose": {
      "type": "object",
      "additionalProperties": false,
      "required": ["role", "responsibility"],
      "properties": {
        "role": { "type": "string", "maxLength": 1200 },
        "responsibility": { "type": "string", "maxLength": 1200 },
        "decisionProcess": { "type": "string", "maxLength": 1200 },
        "decisionCriteria": { "type": "string", "maxLength": 1200 },
        "handoffInstruction": { "type": "string", "maxLength": 1200 }
      }
    },
    "businessPrompt": { "type": "string", "maxLength": 6000 },
    "ports": {
      "type": "array", "maxItems": 24,
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["id", "name", "direction", "mode", "required"],
        "properties": {
          "id": { "type": "string", "format": "uuid" },
          "name": { "type": "string", "minLength": 1, "maxLength": 60 },
          "direction": { "enum": ["input", "output"] },
          "mode": { "enum": ["data", "feedback", "control"] },
          "required": { "type": "boolean" },
          "maxConnections": { "type": ["integer", "null"], "minimum": 1, "maximum": 160 },
          "join": {
            "type": "object", "additionalProperties": false,
            "required": ["strategy"],
            "properties": {
              "strategy": { "enum": ["all", "any", "quorum"] },
              "quorumCount": { "type": "integer", "minimum": 1, "maximum": 160 }
            }
          }
        }
      }
    },
    "branchMode": { "enum": ["sequential", "parallel"] },
    "agent": {
      "type": "object", "additionalProperties": false,
      "required": ["provider", "modelId", "effort", "criticality", "maxStepsPerCycle"],
      "properties": {
        "provider": { "enum": ["openai", "anthropic", "google"] },
        "modelId": { "type": "string", "minLength": 1, "maxLength": 100 },
        "effort": { "enum": ["low", "medium", "high"] },
        "criticality": { "enum": ["low", "medium", "high"] },
        "temperature": { "type": "number", "minimum": 0, "maximum": 2 },
        "maxStepsPerCycle": { "type": "integer", "minimum": 1, "maximum": 32 },
        "credentialRef": { "type": "string", "format": "uuid" },
        "fallback": {
          "type": "object", "additionalProperties": false,
          "required": ["mode"],
          "properties": {
            "mode": { "enum": ["none", "explicit"] },
            "provider": { "enum": ["openai", "anthropic", "google"] },
            "modelId": { "type": "string", "maxLength": 100 },
            "credentialRef": { "type": "string", "format": "uuid" }
          }
        }
      }
    },
    "recipient": {
      "type": "object", "additionalProperties": false,
      "required": ["type", "name"],
      "properties": {
        "type": { "enum": ["person", "agent"] },
        "name": { "type": "string", "minLength": 1, "maxLength": 100 }
      }
    },
    "layout": {
      "type": "object", "additionalProperties": false,
      "required": ["x", "y", "collapsed"],
      "properties": {
        "x": { "type": "number", "minimum": -100000, "maximum": 100000 },
        "y": { "type": "number", "minimum": -100000, "maximum": 100000 },
        "collapsed": { "type": "boolean" }
      }
    },
    "appearance": {
      "type": "object", "additionalProperties": false,
      "required": ["tone"],
      "properties": {
        "tone": { "enum": ["neutral", "green", "blue", "amber"] },
        "iconKey": { "type": "string", "maxLength": 40 }
      }
    }
  }
}
```

Port IDs are persistent logical identities. A node can have multiple input and output ports, and each port can accept multiple edges up to its `maxConnections` (or the graph limit when `null`). Visual React Flow handles use `in:<portId>` / `out:<portId>` for new connections and a separate edge-specific anchor for each connected route. Re-layout may move a handle but must not change its port ID or edge endpoints. Port labels are editable on agent and review nodes; IDs are not. Feedback ports are visually and semantically separate from ordinary data ports. The Business Brief trigger has one system-managed output port and a prompt-only configuration UI; the output node has input only. There is exactly one trigger per publishable graph.

`agent` is required exactly when `kind = agent`; `businessPrompt` is required and nonblank exactly when `kind = trigger`; `recipient` applies to handoff; Human Review requires a named human or project role. The API enforces these conditional requirements even though the base JSON Schema above expresses the common shape. Non-agent nodes must not have `agent` or `credentialRef`.

### 1.3 Edge definition schema

Every saved edge has a nonempty `definition` that says **what** moves, **when**, and **how**. The structured `condition` is a constrained predicate AST, never executable code. `schemaRef` points to a project-owned, versioned JSON Schema; `schemaHash` pins its content in a run. A small inline schema may be allowed only after passing the same registry/security validation. Mapping paths are RFC 6901 JSON Pointers. Empty definitions are allowed only in a transient, clearly marked incomplete draft and block publish/run.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://agentfactory.os/schemas/workflow-edge.v2.json",
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "source", "sourcePortId", "target", "targetPortId", "kind", "order", "definition"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "source": { "type": "string", "format": "uuid" },
    "sourcePortId": { "type": "string", "format": "uuid" },
    "target": { "type": "string", "format": "uuid" },
    "targetPortId": { "type": "string", "format": "uuid" },
    "kind": { "enum": ["forward", "feedback"] },
    "order": { "type": "integer", "minimum": 1, "maximum": 160 },
    "definition": {
      "type": "object", "additionalProperties": false,
      "required": ["name", "schemaRef", "schemaHash", "condition", "mapping", "classification"],
      "properties": {
        "name": { "type": "string", "minLength": 1, "maxLength": 120 },
        "description": { "type": "string", "maxLength": 500 },
        "schemaRef": { "type": "string", "minLength": 1, "maxLength": 200 },
        "schemaHash": { "type": "string", "pattern": "^[0-9a-f]{64}$" },
        "condition": {
          "type": "object", "additionalProperties": false,
          "required": ["operator"],
          "properties": {
            "operator": { "enum": ["always", "equals", "notEquals", "exists", "greaterThan", "lessThan"] },
            "path": { "type": "string", "maxLength": 200 },
            "value": { "type": ["string", "number", "boolean", "null"] }
          }
        },
        "mapping": {
          "type": "array", "maxItems": 32,
          "items": {
            "type": "object", "additionalProperties": false,
            "required": ["from", "to"],
            "properties": {
              "from": { "type": "string", "pattern": "^/" },
              "to": { "type": "string", "pattern": "^/" }
            }
          }
        },
        "classification": { "enum": ["public", "internal", "confidential"] },
        "onConditionFalse": { "enum": ["skip", "fail"] }
      }
    },
    "maxRounds": { "type": "integer", "minimum": 1, "maximum": 5 }
  }
}
```

An edge's `sourcePortId` and `targetPortId` must exist on the named nodes with matching directions. Data/control/feedback modes must be compatible. The mapped payload is validated against the pinned transfer schema **before** it is delivered; the target validates its input contract as well. Connection order is explicit among siblings and stable when unrelated edges are added. A feedback edge requires `maxRounds`; a forward edge forbids it. Edge definition edits create a new graph revision and are audit logged.

### 1.4 Execution payload and event schema

The runtime is not the canvas. A project-authorized request starts an immutable run of a validated revision. The execution service stores append-only events and materialized node-attempt status. It passes only resolved payload data and opaque credential references to a worker; provider secrets never enter the client-facing envelope.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://agentfactory.os/schemas/node-dispatch.v2.json",
  "type": "object",
  "additionalProperties": false,
  "required": ["runId", "projectId", "revisionId", "nodeId", "attemptId", "cycle", "input", "budget", "trace"],
  "properties": {
    "runId": { "type": "string", "format": "uuid" },
    "projectId": { "type": "string", "format": "uuid" },
    "revisionId": { "type": "string", "format": "uuid" },
    "nodeId": { "type": "string", "format": "uuid" },
    "attemptId": { "type": "string", "format": "uuid" },
    "cycle": { "type": "integer", "minimum": 1 },
    "input": {
      "type": "array",
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["edgeId", "sourceAttemptId", "schemaHash", "data"],
        "properties": {
          "edgeId": { "type": "string", "format": "uuid" },
          "sourceAttemptId": { "type": "string", "format": "uuid" },
          "schemaHash": { "type": "string", "pattern": "^[0-9a-f]{64}$" },
          "data": { "type": "object" }
        }
      }
    },
    "budget": {
      "type": "object", "additionalProperties": false,
      "required": ["maxStepsPerCycle", "deadlineAt"],
      "properties": {
        "maxStepsPerCycle": { "type": "integer", "minimum": 1, "maximum": 32 },
        "deadlineAt": { "type": "string", "format": "date-time" }
      }
    },
    "trace": {
      "type": "object", "additionalProperties": false,
      "required": ["correlationId", "idempotencyKey"],
      "properties": {
        "correlationId": { "type": "string", "format": "uuid" },
        "idempotencyKey": { "type": "string", "minLength": 1, "maxLength": 200 }
      }
    }
  }
}
```

Worker result: `{ runId, nodeId, attemptId, cycle, status: "succeeded" | "failed" | "budget_exhausted", output?: object, error?: { code, retryable, message }, usage: { modelSteps, inputTokens, outputTokens, durationMs } }`. The service validates this shape and the outgoing edge schemas before committing downstream events. Exposed run events are `queued`, `started`, `step_progress`, `succeeded`, `failed`, `skipped`, `approval_requested`, `approved`, `rejected`, and `cancelled`; each carries event ID, ordinal sequence, timestamp, run/revision/node/attempt IDs, and redacted metadata. No chain-of-thought or provider raw request body is persisted by default.

### 1.5 Sequence and dependency semantics

1. **Publish validation:** Forward edges alone must form a DAG. Every executable node must be reachable from the single Business Brief. At least one output must be reachable. A forward edge may skip stages; layout position does not define execution order.
2. **Dispatch:** Topological readiness is based on completed incoming edge decisions. For a sequential node, eligible outgoing edges dispatch by `order`, waiting for each downstream branch to reach its defined completion boundary before dispatching the next. Parallel branches dispatch together within project concurrency limits. Persist the chosen order in run events.
3. **Conditions:** Evaluate against the source's validated output once, using the pinned predicate. A false condition records `skipped`; it is not a dangling dependency. An invalid path/unsupported operator fails validation before run.
4. **Joins:** An `all` input waits for all active incoming edges to resolve and requires each required port to receive data. `any` accepts the first committed eligible delivery and records the winning edge; remaining deliveries are recorded but do not start a duplicate attempt. `quorum` starts after `quorumCount` eligible deliveries. If no viable delivery remains, mark the node `blocked` with a reason instead of waiting forever. A deterministic replay uses persisted event ordinals.
5. **Agent cycle:** One invocation may perform at most `maxStepsPerCycle` model/tool/refinement steps. Reaching the cap produces `budget_exhausted` unless the node has already committed a schema-valid result. A provider's unsupported temperature/effort setting is rejected or omitted according to its capability declaration; never reinterpret it silently.
6. **Human review:** A review node blocks dependent output until an authorized project reviewer acts. Rejection/changes follows an explicit feedback edge. Every feedback edge must return to an ancestor in the forward DAG and has `maxRounds` 1–5. A return starts a new cycle for the affected subgraph and invalidates only descendants between the target and review point. Unrelated completed branches remain committed. Exceeding a feedback or global invocation budget ends the run with an actionable error; no unbounded recursion.
7. **Output:** A final output node accepts only validated, approved inputs and writes one idempotent project artifact. External publication is separately permission-checked and requires approval under project policy.

### 1.6 Provider and failure behavior

The model catalog is versioned server-side and filtered by project entitlement, region, credential health, and supported controls. `credentialRef` is an opaque project-owned secret ID. Provider keys are encrypted server-side with audit-restricted access. The selected model/effort and estimated cost class appear in the details panel before a run. `criticality = high` requires a review gate before output by policy; it does not automatically call a higher-cost model.

On timeout/429/transient 5xx, retry the same provider with bounded exponential backoff and idempotency. Do not retry an already-committed side effect. An explicit fallback is used only when the primary failed in an eligible way, the fallback credential/model is available, output contracts are compatible, and project policy permits the cost/data-region change. Record primary failure and fallback selection in the run audit trail. Missing credentials, unsupported model, permission denial, invalid schema, content refusal, or exhausted budget fail closed with a clear remediation; **never** silently choose another provider. Human Review and Final Output never inherit an agent credential.

## 2. User experience and interaction design

### 2.1 Board structure

- Keep the existing three-region Visual Factory: project navigation, central zoomable factory floor, and right-side library/details panel. On mobile, the details panel is a full-height sheet and the board remains pan/zoom accessible.
- A collapsed 228 × 190 px card shows role icon/name, one-line purpose, model/effort (agent only), run status, distinct I/O counts, and grouped port anchors. Expanded details live in the right panel, not a taller card that shifts neighboring routes. Business Brief displays prompt readiness, not a model badge.
- Each connected edge terminates on a visible, separate anchor. Unused `+` anchors are the drag targets. Distinguish forward routes from amber feedback routes through line style and an accessible label, not color alone. Hover/focus highlights the entire edge and both endpoints; edge click opens its Definition editor.
- Port management is in Node details: Add input/output, rename, set data/control/feedback mode, set join strategy, set optionality, and remove. Removing a connected port requires showing affected edge names and confirming repair/removal. Reordering ports affects only display order, not routing semantics.
- Edge Definition editor displays the transfer name, schema/version, source-to-target mapping, condition builder, classification, delivery order, and feedback round cap where relevant. Connection creation opens this editor immediately; a new edge remains visibly “Needs definition” until valid.
- Agent details group **Purpose**, **Intelligence**, **Execution**, **Connections**. Purpose has Role, Responsibility, Decision process, Decision criteria, and Handoff instruction. Intelligence has provider, model, effort, criticality, and capability-aware temperature. Execution has max steps per cycle, fallback policy, and budget estimate. Provider/model choices display “not configured” rather than a fake working selection.
- Offer explicit `Save draft`, `Validate flow`, `Run test`, and `Publish flow` actions. `Run test` uses sample data and cannot publish externally. Disable publish with a navigable issue list; do not discard the draft. Saving may store incomplete definitions but clearly labels the draft unpublishable.

### 2.2 Card/run states

| State | Card presentation | Interaction |
|---|---|---|
| Idle | Neutral surface, no animated progress; draft validity chip | Edit, connect, duplicate, inspect |
| Queued / blocked | Queue position or dependency name, static indicator | Inspect unmet inputs/approval; no fake progress |
| Running | Green progress rail and elapsed time, restrained motion | Inspect step events; edits create a new draft revision |
| Error | Red error label with short actionable reason | Open detail, retry only if policy allows, inspect trace |
| Success | Checkmark, output summary, duration | Open validated output and evidence |
| Skipped / cancelled | Distinct muted status and reason | Inspect condition/cancellation event |

Status is a per-run overlay keyed by `(runId, nodeId, attemptId)`, never written into graph configuration. If no run is selected, all cards show draft state. Running cards must not animate indefinitely after a disconnect; reconnect from persisted events. Announce state changes through an `aria-live="polite"` region; errors use a focused summary and `aria-live="assertive"` only when action is required. Respect reduced motion, 200% zoom, keyboard connection creation, and visible focus. At 80 nodes/160 edges, pan/zoom, hit targets, and labels remain usable; use virtualization only if it preserves keyboard and screen-reader access.

### 2.3 Editor state and collaboration

Keep server graph revision, local unsaved draft, selection, viewport, and run overlay separate. Undo/redo applies to local graph edits, not to executed events. Background autosave must not overwrite another editor's revision; on conflict show a diff/merge choice and preserve local changes. Switching projects clears project-specific selection/filters. Port and edge IDs survive rename/re-layout. The right panel should announce exactly what will happen when a node's branch mode or route order changes.

## 3. Acceptance criteria (Gherkin)

```gherkin
Feature: Dynamic ports and multi-path connections
  Scenario: One agent accepts two inputs and sends two outputs
    Given an editable project graph with an agent named Romy
    When I add two input ports and two output ports to Romy
    And I connect each port to a compatible step with a Definition
    Then four distinct edge paths and endpoints are visible at 60% and 100% zoom
    And the card and details panel both report two incoming and two outgoing routes
    And saving and reopening preserves each port ID and edge endpoint

  Scenario: Prevent an ambiguous port deletion
    Given a port has two saved edges
    When I request to remove that port
    Then I see both affected edge names and a repair-or-remove choice
    And cancelling leaves the graph unchanged

Feature: Mandatory connection definitions
  Scenario: Create an incomplete edge without losing the draft
    When I connect two compatible ports without selecting a transfer schema
    Then the edge is marked Needs definition
    And Save draft remains available
    But Validate flow and Publish flow identify that edge and cannot pass

  Scenario: Reject incompatible payload mapping
    Given an edge Definition maps /report to /customerId
    When the mapped value fails the pinned target JSON Schema
    Then validation names the edge, field, and expected type
    And no downstream node is dispatched

Feature: Agent purpose and model configuration
  Scenario: Configure a consequential CEO agent
    Given I select a CEO agent node
    When I enter Role, Responsibility, Decision process, Decision criteria, and Handoff instruction
    And I select an available Anthropic model, high effort, high criticality, and eight max steps per cycle
    Then the details panel shows those saved values after reopening the project
    And the card shows the model and effort without exposing credentials
    And output requires a human review gate under project policy

  Scenario: Model change resets unsupported controls
    Given a selected model supports temperature
    When I switch to a model that does not support temperature
    Then the temperature control explains why it is unavailable
    And the outgoing provider request omits temperature rather than approximating it

  Scenario: Business Brief remains prompt-only
    Given the single Business Brief start node
    Then I can edit its business prompt and connect its system-managed output port
    But I cannot set a provider, model, credential, or max steps on that node
    And no edge can point into it

Feature: Step budgets and execution sequence
  Scenario: Stop at max steps per cycle
    Given an agent has maxStepsPerCycle set to three
    When its fourth model or tool step would begin without a valid result
    Then the attempt ends as budget_exhausted
    And downstream nodes do not run
    And the run log reports steps used and a safe remediation

  Scenario: Sequential branches follow explicit order
    Given Romy has two eligible outgoing edges ordered 1 and 2
    And Romy's branch mode is sequential
    When Romy succeeds
    Then route 1 is dispatched before route 2
    And route 2 waits for route 1's completion boundary
    And the persisted event ordinals reproduce that order

  Scenario: Parallel branches join without duplicate execution
    Given two parallel branches feed an all-join input port
    When the first branch succeeds
    Then the joined node stays blocked on the second branch
    When the second branch succeeds
    Then the joined node starts exactly once with both validated inputs

  Scenario: A false condition resolves its dependency
    Given a conditional edge evaluates false
    When its source completes
    Then the edge is recorded as skipped
    And the target either runs from other eligible inputs or is marked blocked with a reason
    And the run never waits forever for that edge

Feature: Bounded feedback conversations
  Scenario: Return an agent result to an upstream CEO
    Given CEO forwards work to Romy through forward edges
    And Romy has a feedback edge to CEO with maxRounds two
    When CEO requests changes
    Then the affected path runs a new cycle and shows a separate amber return route
    And unrelated completed branches are not rerun
    And a third requested return ends with a round-limit error

  Scenario: Reject an ordinary directed cycle
    Given A reaches B through forward edges
    When I try to add a forward edge from B to A
    Then the editor rejects it with Use a bounded review loop
    And the project service rejects the same graph if submitted directly

Feature: Provider outage and fallback
  Scenario: Explicit compatible fallback succeeds
    Given a primary provider returns a retryable outage
    And a project-approved compatible fallback and credential are configured
    When bounded primary retries fail
    Then the fallback is called once using the same edge contract
    And the run audit records both providers without storing their secrets

  Scenario: No silent fallback
    Given no approved fallback is configured
    When a provider key is missing or the selected model is unavailable
    Then the agent fails closed with an actionable configuration error
    And no other provider is called

Feature: Revision and accessibility safety
  Scenario: Editing cannot change an active run
    Given a run is executing revision R1
    When I save a different graph revision R2
    Then the run continues on R1 and its event log names R1
    And the board can switch between R1 run status and the R2 draft

  Scenario: Keyboard user can build and inspect a route
    Given focus is on an output port
    When I use the keyboard to choose a target input and confirm
    Then focus moves to the edge Definition editor
    And the full route, endpoints, order, and status have accessible names
```

## 4. Edge cases and validation rules

| Concern | Required rule | User-facing result |
|---|---|---|
| Cycles | Forward subgraph is a DAG; feedback only to a forward ancestor, with 1–5 rounds and a run-wide invocation ceiling | Explain the exact edge and offer bounded feedback route |
| Missing/invalid Definition | Draft may save; publish/run fails until schema, hash, condition, mapping, and classification validate | Edge and checklist identify the missing field |
| Dangling/duplicate IDs | Unique node, port, and edge IDs; every endpoint exists; reject duplicate source-port/target-port pair unless the two edges have distinct condition semantics explicitly permitted by policy | Highlight broken or duplicate route |
| Port capacity/type | Respect per-port connection cap, direction, feedback mode, and schema compatibility | Keep source drag active and show compatible targets |
| Trigger/output rules | One prompt-only trigger; no incoming edge to it; output has no outgoing data edge; all published steps reachable | Name unreachable steps before publish |
| Join deadlock | Resolve skipped/failed predecessor edges; enforce timeout; never wait for impossible quorum | Blocked node shows unmet inputs |
| Unsupported model settings | Check capabilities at save and again at run; model/provider pair must match | Keep draft, block run, offer valid choices |
| Missing provider API key | Secret reference is project-scoped, encrypted, and access-controlled; never serialize key | Configuration error with link to credentials setup |
| Provider failure | Bounded retries; explicit policy-approved fallback only; schema compatibility and cost/data-region checks | Audit primary and fallback, or fail closed |
| Budget exhaustion | Enforce node 1–32 steps, feedback rounds, run time, invocation and token/cost ceilings server-side | Stop cleanly with usage and remediation |
| Human action | Only an authorized project reviewer can approve/reject; approval is idempotent and audited | Review queue retains ownership and history |
| Stale edits | Optimistic revision check; never last-write-wins over another editor | Merge/reload choice that preserves local draft |
| Unsafe data | Validate JSON Schema depth/size, sanitize rendered text, redact secrets/PII in logs, authorize schema references by project | Reject unsafe payload without leaking it |

## 5. Delivery slices and test ownership

1. **Contracts and migration:** Add v2 graph/port/edge validators to shared contracts and project service; migrate v1 JSON losslessly (existing route labels become Definition names, while transfer schemas remain explicitly incomplete). Add API tests for all server-side invariants and revision conflicts.
2. **Editor:** Add logical ports, edge Definition panel, capability-aware model/temperature/criticality/step controls, draft validation, visual route repair, keyboard paths, and persisted undo/redo behavior. Test at horizontal/vertical layout and 60%–200% zoom.
3. **Execution service:** Snapshot revision; implement event log, DAG scheduler, joins, conditional routing, step/round budgets, approval gate, idempotent output, provider adapters, and audited fallback. Use simulated providers in deterministic integration tests before any real provider calls.
4. **Operational release:** Add per-project concurrency/cost quotas, telemetry, alerts for stuck runs, secret rotation, load tests at 80/160, and rollout behind a project feature flag. Do not label the canvas “live” until end-to-end run and approval scenarios pass.

The visual design may evolve, but it must preserve the stable IDs, explicit route contracts, deterministic execution semantics, and clear separation between draft configuration and runtime state.
