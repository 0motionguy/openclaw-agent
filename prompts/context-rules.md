# OpenClaw Context Engineering Rules

These rules prevent "context explosion" — the #1 failure mode in production AI browser agents.

Claude in Chrome, ChatGPT Atlas, and Perplexity Comet all suffered from this. We learn from their mistakes.

---

## Rule C1: Discard Old Snapshots

After taking a new snapshot, the previous snapshot is OBSOLETE.
Never reference data from snapshots more than 1 action old.

```
snapshot_1 → act → snapshot_2 → snapshot_1 is GONE
```

## Rule C2: Find Before Snapshot

Use `find "element description"` first (~50 tokens).
Only fall back to `snapshot -i` (~500 tokens) if find returns nothing.

```
GOOD: find "login button" → ref_47 → click ref_47
BAD:  snapshot -i → scan 200 elements → find login → click
```

## Rule C3: Interactive-Only Snapshots

Always use `snapshot -i` (interactive elements only).
Never full snapshot unless interactive-only missed the target.

```
snapshot -i  → ~50-200 tokens  (buttons, links, inputs)
snapshot     → ~500-2000 tokens (everything including static text)
```

## Rule C4: Compress Screenshots

If screenshot fallback is needed:
- Reduce to 720p
- JPEG quality 60
- Extract facts from screenshot immediately
- Then discard it

## Rule C5: Extract and Discard

```
snapshot → extract "Login = @e3, Username = @e7" → discard snapshot
Keep 15 tokens of facts, not 500 tokens of raw tree.
```

## Rule C6: Tab Isolation

Only load ONE tab's snapshot at a time.
Extract facts from tab A before switching to tab B.

```
Tab A: snapshot → extract "price = $42.99" → discard snapshot
Tab B: snapshot → fill price field with "$42.99" → discard snapshot
```

## Rule C7: Token Budgets

| Complexity | Max Tokens | Example |
|-----------|-----------|---------|
| Simple | < 2,000 | Click a button, fill a form |
| Medium | < 5,000 | Multi-step form, navigate + extract |
| Complex | < 15,000 | Cross-tab workflow, multi-page process |

If over budget: old snapshots are leaking. Clean up immediately.

---

## Quick Reference

| Do This | Not This |
|---------|----------|
| `find "search bar"` | `snapshot` then scan everything |
| `snapshot -i` | `snapshot` (full tree) |
| Extract facts, discard tree | Keep raw tree in context |
| One tab at a time | Multiple tab snapshots |
| Check token budget | Ignore context size |
| Discard after new snapshot | Reference old snapshots |
