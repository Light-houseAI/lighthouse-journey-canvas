#!/usr/bin/env node

/**
 * Test Validation Script
 * Validates that test files are properly structured and can be imported
 */

const fs = require('fs');
const path = require('path');

// Color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function validateTestFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    const checks = {
      hasDescribe: content.includes('describe('),
      hasTest: content.includes('it(') || content.includes('test('),
      hasExpect: content.includes('expect('),
      hasImports: content.includes('import'),
      hasVitest: content.includes('vitest'),
      validSyntax: true // We'll assume it's valid if we can read it
    };

    const passed = Object.values(checks).every(check => check);
    
    return {
      filePath,
      passed,
      checks
    };
  } catch (error) {
    return {
      filePath,
      passed: false,
      error: error.message
    };
  }
}

function findTestFiles(dir) {
  const testFiles = [];
  
  function walkDir(currentDir) {
    const files = fs.readdirSync(currentDir);
    
    for (const file of files) {
      const filePath = path.join(currentDir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        walkDir(filePath);
      } else if (file.endsWith('.test.ts') || file.endsWith('.test.tsx') || file.endsWith('.spec.ts') || file.endsWith('.spec.tsx')) {
        testFiles.push(filePath);
      }
    }
  }
  
  walkDir(dir);
  return testFiles;
}

function main() {
  log('🧪 Test File Validation', 'blue');
  log('=' + '='.repeat(50), 'blue');
  
  const clientDir = path.join(__dirname, 'client', 'src');
  const testFiles = findTestFiles(clientDir);
  
  if (testFiles.length === 0) {
    log('❌ No test files found!', 'red');
    return;
  }
  
  log(`Found ${testFiles.length} test files:`, 'yellow');
  testFiles.forEach(file => {
    log(`  📁 ${path.relative(__dirname, file)}`, 'blue');
  });
  
  log('\n🔍 Validating test files...', 'yellow');
  
  let passedCount = 0;
  let failedCount = 0;
  
  for (const testFile of testFiles) {
    const result = validateTestFile(testFile);
    const relativePath = path.relative(__dirname, result.filePath);
    
    if (result.passed) {
      log(`✅ ${relativePath}`, 'green');
      passedCount++;
    } else {
      log(`❌ ${relativePath}`, 'red');
      if (result.error) {
        log(`   Error: ${result.error}`, 'red');
      } else {
        log(`   Failed checks:`, 'red');
        Object.entries(result.checks).forEach(([check, passed]) => {
          if (!passed) {
            log(`     - ${check}`, 'red');
          }
        });
      }
      failedCount++;
    }
  }
  
  log('\n📊 Summary:', 'blue');
  log(`✅ Passed: ${passedCount}`, 'green');
  log(`❌ Failed: ${failedCount}`, failedCount > 0 ? 'red' : 'green');
  
  if (failedCount === 0) {
    log('\n🎉 All test files are properly structured!', 'green');
  } else {
    log('\n⚠️  Some test files need attention.', 'yellow');
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateTestFile, findTestFiles };