#!/usr/bin/env node
import { runMcpServer } from './index.js'

runMcpServer().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
