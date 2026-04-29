# Tool Description Style Guide

All MCP tool descriptions in sapo-mcp must follow this format to maximize LLM tool selection accuracy.

## Format

```
<verb> <object> [for <persona>]. <side-effect note if mutating>.
```

### Verbs

| Intent | Verb |
|--------|------|
| Read list | `List` |
| Read single | `Get` |
| Create new | `Create` |
| Modify existing | `Update` |
| Remove | `Delete` / `Cancel` |
| Composite action | `Search`, `Complete`, `Fulfill` |

### Persona Hints (when non-obvious)

- `for POS staff` — counter ops, shift management
- `for store managers` — analytics, pricing
- `for online operations` — web orders, fulfillments

## Examples

### Good

```typescript
"List all sale orders with optional filters (status, source, date range). Returns paginated results via since_id cursor."
```

```typescript
"Cancel a sale order. Destructive: requires confirm:true and SAPO_ALLOW_OPS includes 'cancel'. Use for refund or dispute workflows."
```

```typescript
"Get a single customer by ID, including their address list and order count."
```

```typescript
"Create a new draft order for a customer. Non-destructive until completed via complete_draft_order."
```

### Bad

```typescript
"Cancel order"           // Too terse — no persona, no safety warning
"Get"                    // Not descriptive
"List products and stuff" // Vague, informal
```

## Destructive Tool Template

For any tool in a destructive category, use this template:

```typescript
{
  description:
    '<Action> <object>. ' +
    'Destructive: requires SAPO_ALLOW_OPS includes \'<category>\'. ' +
    '<When to use this vs alternatives>.'
}
```

Example:
```typescript
{
  description:
    'Permanently delete a customer record and all associated addresses. ' +
    'Destructive: requires SAPO_ALLOW_OPS includes \'delete_strict\'. ' +
    'For GDPR erasure requests. Non-recoverable — prefer deactivation for normal off-boarding.'
}
```

## Length Guidelines

- Minimum: 1 sentence (25+ chars)
- Maximum: 3 sentences (~300 chars)
- If >3 sentences needed: split into multiple tools

## Parameter Descriptions

Every `.describe()` on a Zod field must answer:
1. What it is (type / format)
2. What happens with it (effect)

```typescript
z.string().describe('Sale order ID (numeric string, e.g. "12345"). Required.')
z.boolean().describe('Must be true to confirm the destructive action. Prevents accidental calls.')
z.number().optional().describe('Max results per page (default 20, max 250).')
```
