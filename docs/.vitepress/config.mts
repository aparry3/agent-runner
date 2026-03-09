import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'agent-runner',
  description: 'TypeScript SDK for defining, running, and evaluating AI agents',
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
  ],
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/runner' },
      { text: 'Studio', link: '/studio/overview' },
      { text: 'GitHub', link: 'https://github.com/AaronBidworthy/agent-runner' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is agent-runner?', link: '/guide/what-is-agent-runner' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Hello World', link: '/guide/hello-world' },
          ],
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Agents', link: '/guide/agents' },
            { text: 'Tools', link: '/guide/tools' },
            { text: 'Sessions', link: '/guide/sessions' },
            { text: 'Context', link: '/guide/context' },
            { text: 'Stores', link: '/guide/stores' },
          ],
        },
        {
          text: 'Advanced',
          items: [
            { text: 'MCP Integration', link: '/guide/mcp' },
            { text: 'Agent Chains', link: '/guide/agent-chains' },
            { text: 'Streaming', link: '/guide/streaming' },
            { text: 'Evals & Testing', link: '/guide/evals' },
            { text: 'Error Handling & Retry', link: '/guide/error-handling' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'createRunner()', link: '/api/runner' },
            { text: 'defineAgent()', link: '/api/agent' },
            { text: 'defineTool()', link: '/api/tool' },
            { text: 'Store Interfaces', link: '/api/stores' },
            { text: 'Types', link: '/api/types' },
          ],
        },
      ],
      '/studio/': [
        {
          text: 'Studio',
          items: [
            { text: 'Overview', link: '/studio/overview' },
            { text: 'Agent Editor', link: '/studio/agent-editor' },
            { text: 'Playground', link: '/studio/playground' },
            { text: 'Tool Catalog', link: '/studio/tool-catalog' },
            { text: 'Evals Dashboard', link: '/studio/evals' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/AaronBidworthy/agent-runner' },
    ],
    search: {
      provider: 'local',
    },
    footer: {
      message: 'Released under the MIT License.',
    },
  },
})
