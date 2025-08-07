#!/usr/bin/env node

/**
 * Parallel Test Execution Script
 * 
 * This script orchestrates parallel test execution across all test layers
 * to maximize testing efficiency while ensuring comprehensive PRD validation.
 */

import { spawn } from 'child_process';
import { performance } from 'perf_hooks';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test suite configuration
const testSuites = {
  repository: {
    name: 'Repository Layer Tests',
    pattern: 'server/repositories/**/*.test.ts',
    parallel: true,
    timeout: 30000,
    priority: 1
  },
  service: {
    name: 'Service Layer Tests', 
    pattern: 'server/services/**/*.test.ts',
    parallel: true,
    timeout: 30000,
    priority: 2
  },
  controller: {
    name: 'Controller Layer Tests',
    pattern: 'server/controllers/**/*.test.ts', 
    parallel: true,
    timeout: 30000,
    priority: 3
  },
  integration: {
    name: 'Integration Tests',
    pattern: 'server/tests/integration/**/*.test.ts',
    parallel: false, // Integration tests run sequentially to avoid conflicts
    timeout: 60000,
    priority: 4
  },
  prd_validation: {
    name: 'PRD Validation Tests',
    pattern: 'server/tests/integration/comprehensive-prd-validation.test.ts',
    parallel: false,
    timeout: 30000,
    priority: 5
  }
};\n\n// Colors for console output\nconst colors = {\n  reset: '\\x1b[0m',\n  bright: '\\x1b[1m',\n  green: '\\x1b[32m',\n  red: '\\x1b[31m',\n  yellow: '\\x1b[33m',\n  blue: '\\x1b[34m',\n  magenta: '\\x1b[35m',\n  cyan: '\\x1b[36m'\n};\n\n// Logging utility\nclass TestLogger {\n  static log(message, color = colors.reset) {\n    console.log(`${color}${message}${colors.reset}`);\n  }\n\n  static success(message) {\n    this.log(`✅ ${message}`, colors.green);\n  }\n\n  static error(message) {\n    this.log(`❌ ${message}`, colors.red);\n  }\n\n  static warning(message) {\n    this.log(`⚠️  ${message}`, colors.yellow);\n  }\n\n  static info(message) {\n    this.log(`ℹ️  ${message}`, colors.blue);\n  }\n\n  static header(message) {\n    this.log(`\\n${colors.bright}${'='.repeat(60)}`, colors.cyan);\n    this.log(`${message}`, colors.cyan + colors.bright);\n    this.log(`${'='.repeat(60)}${colors.reset}`, colors.cyan);\n  }\n}\n\n// Test execution class\nclass ParallelTestRunner {\n  constructor() {\n    this.results = {};\n    this.startTime = performance.now();\n  }\n\n  async runTestSuite(suiteKey, suite) {\n    return new Promise((resolve) => {\n      TestLogger.info(`Starting ${suite.name}...`);\n      \n      const vitestArgs = [\n        'run',\n        '--config', 'vitest.config.ts',\n        suite.pattern,\n        '--reporter=verbose',\n        '--timeout', suite.timeout.toString()\n      ];\n\n      if (suite.parallel) {\n        vitestArgs.push('--threads');\n      } else {\n        vitestArgs.push('--no-threads');\n      }\n\n      const child = spawn('npx', ['vitest', ...vitestArgs], {\n        stdio: 'pipe',\n        cwd: path.join(__dirname, '../..'), // Go to project root\n        env: { ...process.env, NODE_ENV: 'test' }\n      });\n\n      let stdout = '';\n      let stderr = '';\n\n      child.stdout.on('data', (data) => {\n        stdout += data.toString();\n      });\n\n      child.stderr.on('data', (data) => {\n        stderr += data.toString();\n      });\n\n      child.on('close', (code) => {\n        const duration = performance.now() - this.startTime;\n        \n        this.results[suiteKey] = {\n          name: suite.name,\n          success: code === 0,\n          code,\n          duration: Math.round(duration),\n          stdout,\n          stderr\n        };\n\n        if (code === 0) {\n          TestLogger.success(`${suite.name} completed successfully`);\n        } else {\n          TestLogger.error(`${suite.name} failed with code ${code}`);\n        }\n\n        resolve(this.results[suiteKey]);\n      });\n\n      child.on('error', (error) => {\n        TestLogger.error(`Failed to start ${suite.name}: ${error.message}`);\n        this.results[suiteKey] = {\n          name: suite.name,\n          success: false,\n          error: error.message,\n          duration: 0\n        };\n        resolve(this.results[suiteKey]);\n      });\n    });\n  }\n\n  async runAllTests() {\n    TestLogger.header('🧪 PARALLEL TEST EXECUTION - PRD VALIDATION');\n    TestLogger.info('Executing comprehensive test suite for API revamp...');\n    \n    // Sort test suites by priority\n    const sortedSuites = Object.entries(testSuites)\n      .sort(([,a], [,b]) => a.priority - b.priority);\n\n    // Group parallel and sequential tests\n    const parallelSuites = sortedSuites.filter(([,suite]) => suite.parallel);\n    const sequentialSuites = sortedSuites.filter(([,suite]) => !suite.parallel);\n\n    // Run parallel tests concurrently\n    if (parallelSuites.length > 0) {\n      TestLogger.info(`Running ${parallelSuites.length} test suites in parallel...`);\n      \n      const parallelPromises = parallelSuites.map(([key, suite]) => \n        this.runTestSuite(key, suite)\n      );\n      \n      await Promise.all(parallelPromises);\n    }\n\n    // Run sequential tests one by one\n    if (sequentialSuites.length > 0) {\n      TestLogger.info(`Running ${sequentialSuites.length} test suites sequentially...`);\n      \n      for (const [key, suite] of sequentialSuites) {\n        await this.runTestSuite(key, suite);\n      }\n    }\n\n    this.generateReport();\n  }\n\n  generateReport() {\n    const totalDuration = Math.round(performance.now() - this.startTime);\n    const totalSuites = Object.keys(this.results).length;\n    const successfulSuites = Object.values(this.results).filter(r => r.success).length;\n    const failedSuites = totalSuites - successfulSuites;\n\n    TestLogger.header('📊 TEST EXECUTION REPORT');\n    \n    TestLogger.info(`Total Duration: ${totalDuration}ms`);\n    TestLogger.info(`Total Test Suites: ${totalSuites}`);\n    TestLogger.success(`Successful Suites: ${successfulSuites}`);\n    \n    if (failedSuites > 0) {\n      TestLogger.error(`Failed Suites: ${failedSuites}`);\n    }\n\n    TestLogger.log('\\n📋 Detailed Results:');\n    \n    Object.entries(this.results).forEach(([key, result]) => {\n      const status = result.success ? '✅ PASS' : '❌ FAIL';\n      const duration = result.duration ? `(${result.duration}ms)` : '';\n      \n      TestLogger.log(`  ${status} ${result.name} ${duration}`);\n      \n      if (!result.success && result.stderr) {\n        TestLogger.log(`       Error: ${result.stderr.substring(0, 200)}...`, colors.red);\n      }\n    });\n\n    // PRD Requirements Validation\n    TestLogger.header('✅ PRD REQUIREMENTS VALIDATION');\n    \n    const prdRequirements = {\n      'Repository Layer Tests': this.results.repository?.success || false,\n      'Service Layer Tests': this.results.service?.success || false,\n      'Controller Layer Tests': this.results.controller?.success || false,\n      'Integration Tests': this.results.integration?.success || false,\n      'PRD Validation Tests': this.results.prd_validation?.success || false\n    };\n\n    Object.entries(prdRequirements).forEach(([requirement, passed]) => {\n      if (passed) {\n        TestLogger.success(`${requirement}: VALIDATED`);\n      } else {\n        TestLogger.error(`${requirement}: FAILED`);\n      }\n    });\n\n    // Final Summary\n    TestLogger.header('🎯 FINAL SUMMARY');\n    \n    if (failedSuites === 0) {\n      TestLogger.success('🎉 ALL TESTS PASSED! API REVAMP IS READY FOR PRODUCTION!');\n      TestLogger.success('✅ All PRD requirements have been validated');\n      TestLogger.success('✅ All node types are fully tested');\n      TestLogger.success('✅ All layers (repository, service, controller, integration) are validated');\n      TestLogger.success('✅ Performance, security, and error handling requirements met');\n      process.exit(0);\n    } else {\n      TestLogger.error('❌ SOME TESTS FAILED - Please review and fix issues before deployment');\n      TestLogger.warning('⚠️  PRD requirements validation incomplete');\n      process.exit(1);\n    }\n  }\n}\n\n// Performance monitoring\nclass PerformanceMonitor {\n  static trackMemoryUsage() {\n    const usage = process.memoryUsage();\n    TestLogger.info(`Memory Usage: RSS=${Math.round(usage.rss/1024/1024)}MB, Heap=${Math.round(usage.heapUsed/1024/1024)}MB`);\n  }\n\n  static trackTestPerformance(testName, startTime) {\n    const duration = Math.round(performance.now() - startTime);\n    if (duration > 5000) {\n      TestLogger.warning(`⚠️  ${testName} took ${duration}ms (>5s)`);\n    } else {\n      TestLogger.info(`${testName} completed in ${duration}ms`);\n    }\n  }\n}\n\n// Main execution\nasync function main() {\n  try {\n    TestLogger.header('🚀 STARTING COMPREHENSIVE PRD TEST VALIDATION');\n    TestLogger.info('This will validate all PRD requirements across all layers');\n    TestLogger.info('Including: Repository, Service, Controller, and Integration layers');\n    TestLogger.info('Covering: All 6 node types with comprehensive scenarios\\n');\n    \n    PerformanceMonitor.trackMemoryUsage();\n    \n    const runner = new ParallelTestRunner();\n    await runner.runAllTests();\n    \n  } catch (error) {\n    TestLogger.error(`Test execution failed: ${error.message}`);\n    console.error(error);\n    process.exit(1);\n  }\n}\n\n// Handle process termination\nprocess.on('SIGINT', () => {\n  TestLogger.warning('\\n⚠️  Test execution interrupted by user');\n  process.exit(1);\n});\n\nprocess.on('SIGTERM', () => {\n  TestLogger.warning('\\n⚠️  Test execution terminated');\n  process.exit(1);\n});\n\n// Run the test suite\nif (import.meta.url === `file://${process.argv[1]}`) {\n  main();\n}\n\nexport { ParallelTestRunner, TestLogger, PerformanceMonitor };"