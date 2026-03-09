# Tool Catalog

The Tool Catalog shows all tools available in the runner's registry, regardless of source.

## Features

- **Unified View** — See inline tools, MCP tools, and agent tools in one place
- **Schema Inspector** — View the JSON Schema for each tool's input
- **Source Labels** — Identify where each tool comes from (`inline`, `mcp:github`, etc.)
- **Test Execution** — Execute any tool with custom input directly from the catalog

## Tool Sources

| Source | Description |
|--------|-------------|
| `inline` | Defined via `defineTool()` in code |
| `mcp:<server>` | Discovered from an MCP server |
| `agent:<id>` | Another agent exposed as a tool |
