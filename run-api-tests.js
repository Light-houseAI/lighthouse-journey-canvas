#!/usr/bin/env node

import newman from 'newman';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const config = {
  collection: path.join(__dirname, 'postman-collection.json'),
  environment: path.join(__dirname, 'postman-environment.json'),
  reporters: ['cli', 'json', 'html'],
  reporterOptions: {
    json: {
      export: path.join(__dirname, 'test-results.json')
    },
    html: {
      export: path.join(__dirname, 'test-results.html')
    }
  },
  insecure: true,
  timeout: 30000,
  delayRequest: 500 // Add delay between requests to avoid overwhelming the server
};

console.log('🚀 Starting Journey Canvas API Tests...\n');
console.log('📋 Test Configuration:');
console.log(`   Collection: ${config.collection}`);
console.log(`   Environment: ${config.environment}`);
console.log(`   Timeout: ${config.timeout}ms`);
console.log(`   Delay between requests: ${config.delayRequest}ms\n`);

// Check if server is running
const checkServer = async () => {
  const ports = [5003, 3000]; // Try both possible ports
  
  for (const port of ports) {
    try {
      const response = await fetch(`http://localhost:${port}/`);
      if (response.ok) {
        console.log(`✅ Server is running on http://localhost:${port}\n`);
        // Update the base URL for this port
        const envData = JSON.parse(fs.readFileSync(config.environment, 'utf8'));
        envData.values.find(v => v.key === 'baseUrl').value = `http://localhost:${port}`;
        fs.writeFileSync(config.environment, JSON.stringify(envData, null, 2));
        return true;
      }
    } catch (error) {
      // Continue to next port
    }
  }
  
  console.error('❌ Server is not running on http://localhost:3000 or http://localhost:5003');
  console.error('   Please start the development server with: npm run dev\n');
  console.error('   Or use: npm run test:api:with-server to auto-start\n');
  return false;
};

// Set test environment variables
const setTestEnvironment = () => {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-mock-key-for-api-testing';
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';
  
  console.log('🔧 Test environment configured with mock API keys\n');
};

// Run the Newman collection
const runTests = () => {
  return new Promise((resolve, reject) => {
    newman.run(config, (err, summary) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(summary);
    });
  });
};

// Generate PRD compliance report
const generatePRDReport = (summary) => {
  const prdReport = {
    timestamp: new Date().toISOString(),
    totalRequests: summary.run.stats.requests.total,
    passedTests: summary.run.stats.tests.passed,
    failedTests: summary.run.stats.tests.failed,
    totalTests: summary.run.stats.tests.total,
    successRate: ((summary.run.stats.tests.passed / summary.run.stats.tests.total) * 100).toFixed(2),
    prdCompliance: {
      authentication: { status: 'unknown', tests: [] },
      aiChat: { status: 'unknown', tests: [] },
      skillExtraction: { status: 'unknown', tests: [] },
      milestoneManagement: { status: 'unknown', tests: [] },
      timelineNavigation: { status: 'unknown', tests: [] },
      performanceTests: { status: 'unknown', tests: [] }
    },
    issues: [],
    recommendations: []
  };

  // Analyze test results for PRD compliance
  summary.run.executions.forEach(execution => {
    const folderName = execution.item.parent()?.name || 'Root';
    const testName = execution.item.name;
    const assertions = execution.assertions || [];
    
    assertions.forEach(assertion => {
      const testResult = {
        name: assertion.assertion,
        status: assertion.error ? 'failed' : 'passed',
        error: assertion.error?.message
      };

      // Categorize by PRD feature
      if (folderName.includes('Authentication')) {
        prdReport.prdCompliance.authentication.tests.push(testResult);
      } else if (folderName.includes('AI Chat')) {
        prdReport.prdCompliance.aiChat.tests.push(testResult);
      } else if (folderName.includes('Skill')) {
        prdReport.prdCompliance.skillExtraction.tests.push(testResult);
      } else if (folderName.includes('Milestone')) {
        prdReport.prdCompliance.milestoneManagement.tests.push(testResult);
      } else if (folderName.includes('Timeline Navigation')) {
        prdReport.prdCompliance.timelineNavigation.tests.push(testResult);
      } else if (folderName.includes('Performance')) {
        prdReport.prdCompliance.performanceTests.tests.push(testResult);
      }

      // Collect issues
      if (assertion.error) {
        prdReport.issues.push({
          category: folderName,
          test: testName,
          assertion: assertion.assertion,
          error: assertion.error.message
        });
      }
    });

    // Check for missing PRD endpoints
    if (execution.response?.code === 404) {
      prdReport.issues.push({
        category: 'Missing PRD Endpoint',
        test: testName,
        error: `Endpoint not implemented: ${execution.request.url}`
      });
    }
  });

  // Determine compliance status for each category
  Object.keys(prdReport.prdCompliance).forEach(category => {
    const tests = prdReport.prdCompliance[category].tests;
    if (tests.length === 0) {
      prdReport.prdCompliance[category].status = 'not_tested';
    } else {
      const passedTests = tests.filter(t => t.status === 'passed').length;
      const successRate = (passedTests / tests.length) * 100;
      
      if (successRate >= 90) {
        prdReport.prdCompliance[category].status = 'compliant';
      } else if (successRate >= 70) {
        prdReport.prdCompliance[category].status = 'partially_compliant';
      } else {
        prdReport.prdCompliance[category].status = 'non_compliant';
      }
    }
  });

  // Generate recommendations
  if (prdReport.prdCompliance.timelineNavigation.status !== 'compliant') {
    prdReport.recommendations.push({
      priority: 'high',
      category: 'Timeline Navigation',
      description: 'Implement missing /api/timeline/navigate endpoint as specified in PRD',
      prdSection: 'US1: Dynamic Timeline Navigation'
    });
  }

  if (prdReport.prdCompliance.skillExtraction.status !== 'compliant') {
    prdReport.recommendations.push({
      priority: 'high',
      category: 'Skill Extraction',
      description: 'Ensure real-time skill extraction during chat conversations',
      prdSection: 'US3: Automatic Skill Tracking'
    });
  }

  if (prdReport.failedTests > 0) {
    prdReport.recommendations.push({
      priority: 'medium',
      category: 'Error Handling',
      description: 'Review and fix failing test cases to improve system reliability'
    });
  }

  return prdReport;
};

// Main execution
const main = async () => {
  try {
    // Set up test environment
    setTestEnvironment();
    
    // Check if server is running
    const serverRunning = await checkServer();
    if (!serverRunning) {
      process.exit(1);
    }

    console.log('🧪 Running API tests...\n');
    
    // Run the tests
    const summary = await runTests();
    
    // Generate reports
    console.log('\n📊 Test Results Summary:');
    console.log(`   Total Requests: ${summary.run.stats.requests.total}`);
    console.log(`   Passed Tests: ${summary.run.stats.tests.passed}`);
    console.log(`   Failed Tests: ${summary.run.stats.tests.failed}`);
    console.log(`   Total Tests: ${summary.run.stats.tests.total}`);
    console.log(`   Success Rate: ${((summary.run.stats.tests.passed / summary.run.stats.tests.total) * 100).toFixed(2)}%`);
    
    if (summary.run.stats.requests.failed > 0) {
      console.log(`   Failed Requests: ${summary.run.stats.requests.failed}`);
    }

    // Generate PRD compliance report
    const prdReport = generatePRDReport(summary);
    
    // Save PRD report
    fs.writeFileSync(
      path.join(__dirname, 'prd-compliance-report.json'),
      JSON.stringify(prdReport, null, 2)
    );

    console.log('\n📋 PRD Compliance Summary:');
    Object.entries(prdReport.prdCompliance).forEach(([category, data]) => {
      const statusEmoji = {
        'compliant': '✅',
        'partially_compliant': '⚠️',
        'non_compliant': '❌',
        'not_tested': '⏸️'
      };
      
      console.log(`   ${statusEmoji[data.status]} ${category}: ${data.status.replace('_', ' ').toUpperCase()} (${data.tests.length} tests)`);
    });

    if (prdReport.issues.length > 0) {
      console.log('\n⚠️  Issues Found:');
      prdReport.issues.slice(0, 5).forEach((issue, index) => {
        console.log(`   ${index + 1}. [${issue.category}] ${issue.error}`);
      });
      
      if (prdReport.issues.length > 5) {
        console.log(`   ... and ${prdReport.issues.length - 5} more issues`);
      }
    }

    if (prdReport.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      prdReport.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.description}`);
        if (rec.prdSection) {
          console.log(`      PRD Reference: ${rec.prdSection}`);
        }
      });
    }

    console.log('\n📄 Reports Generated:');
    console.log(`   HTML Report: ${path.join(__dirname, 'test-results.html')}`);
    console.log(`   JSON Report: ${path.join(__dirname, 'test-results.json')}`);
    console.log(`   PRD Compliance: ${path.join(__dirname, 'prd-compliance-report.json')}`);

    console.log('\n✅ API testing completed successfully!');
    
    // Exit with error code if tests failed
    if (summary.run.stats.tests.failed > 0) {
      console.log('\n❌ Some tests failed. Please review the reports for details.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Error running tests:', error.message);
    process.exit(1);
  }
};

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('\nUncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('\nUnhandled Rejection:', error.message);
  process.exit(1);
});

// Run the main function
main();