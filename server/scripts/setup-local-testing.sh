#!/bin/bash

echo "🚀 Setting up Journey Canvas for Local Testing"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if PostgreSQL is running
check_postgres() {
    if command_exists psql; then
        if pg_isready -q; then
            echo -e "${GREEN}✅ PostgreSQL is running${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️  PostgreSQL is installed but not running${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ PostgreSQL is not installed${NC}"
        return 2
    fi
}

# Function to start PostgreSQL (macOS with Homebrew)
start_postgres_mac() {
    if command_exists brew; then
        echo -e "${BLUE}🔄 Starting PostgreSQL with Homebrew...${NC}"
        brew services start postgresql@14 || brew services start postgresql
        sleep 3
        if pg_isready -q; then
            echo -e "${GREEN}✅ PostgreSQL started successfully${NC}"
            return 0
        fi
    fi
    return 1
}

# Function to create test database
create_test_database() {
    local db_name="journey_canvas_test"
    local db_user="postgres"
    
    echo -e "${BLUE}🔄 Creating test database: ${db_name}${NC}"
    
    # Try to create database
    if createdb -U ${db_user} ${db_name} 2>/dev/null; then
        echo -e "${GREEN}✅ Database '${db_name}' created successfully${NC}"
    else
        # Database might already exist
        if psql -U ${db_user} -lqt | cut -d \| -f 1 | grep -qw ${db_name}; then
            echo -e "${YELLOW}⚠️  Database '${db_name}' already exists${NC}"
        else
            echo -e "${RED}❌ Failed to create database '${db_name}'${NC}"
            echo -e "${YELLOW}💡 Trying with default user...${NC}"
            
            # Try with current user
            if createdb ${db_name} 2>/dev/null; then
                echo -e "${GREEN}✅ Database '${db_name}' created with current user${NC}"
                db_user=$(whoami)
            else
                echo -e "${RED}❌ Failed to create database. Please create manually:${NC}"
                echo -e "${BLUE}   createdb journey_canvas_test${NC}"
                return 1
            fi
        fi
    fi
    
    # Set the DATABASE_URL
    export DATABASE_URL="postgresql://${db_user}@localhost:5432/${db_name}"
    echo "DATABASE_URL=${DATABASE_URL}" > .env.local
    echo -e "${GREEN}✅ DATABASE_URL set to: ${DATABASE_URL}${NC}"
    
    return 0
}

# Function to setup test environment
setup_test_env() {
    echo -e "${BLUE}🔄 Setting up test environment variables...${NC}"
    
    cat > .env.local << EOF
# Local Testing Environment
DATABASE_URL=postgresql://postgres@localhost:5432/journey_canvas_test
OPENAI_API_KEY=sk-test-mock-key-for-api-testing-only
ANTHROPIC_API_KEY=test-anthropic-key-for-testing
SESSION_SECRET=test-session-secret-for-local-development
NODE_ENV=test

# Optional services (will be mocked if not available)
REDIS_URL=redis://localhost:6379
QDRANT_URL=http://localhost:6333
EOF
    
    echo -e "${GREEN}✅ Test environment file created: .env.local${NC}"
}

# Function to run database migrations
run_migrations() {
    echo -e "${BLUE}🔄 Running database migrations...${NC}"
    
    # Source the environment
    if [ -f .env.local ]; then
        export $(cat .env.local | grep -v '#' | grep -v '^$' | xargs)
    fi
    
    # Run migrations
    if npm run db:push; then
        echo -e "${GREEN}✅ Database migrations completed${NC}"
        return 0
    else
        echo -e "${RED}❌ Database migrations failed${NC}"
        return 1
    fi
}

# Function to test server startup
test_server_startup() {
    echo -e "${BLUE}🔄 Testing server startup...${NC}"
    
    # Source environment
    if [ -f .env.local ]; then
        export $(cat .env.local | grep -v '#' | grep -v '^$' | xargs)
    fi
    
    # Start server in background
    npm run dev &
    SERVER_PID=$!
    
    # Wait for server to start
    echo -e "${YELLOW}⏳ Waiting for server to start...${NC}"
    sleep 10
    
    # Check if server is responding
    if curl -s http://localhost:3000/ > /dev/null || curl -s http://localhost:5003/ > /dev/null; then
        echo -e "${GREEN}✅ Server started successfully${NC}"
        
        # Kill the test server
        kill $SERVER_PID 2>/dev/null
        wait $SERVER_PID 2>/dev/null
        
        return 0
    else
        echo -e "${RED}❌ Server failed to start properly${NC}"
        
        # Kill the test server
        kill $SERVER_PID 2>/dev/null
        wait $SERVER_PID 2>/dev/null
        
        return 1
    fi
}

# Main setup process
main() {
    echo -e "${BLUE}🔍 Checking system requirements...${NC}"
    
    # Check Node.js
    if command_exists node; then
        echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"
    else
        echo -e "${RED}❌ Node.js is not installed${NC}"
        exit 1
    fi
    
    # Check npm
    if command_exists npm; then
        echo -e "${GREEN}✅ npm: $(npm --version)${NC}"
    else
        echo -e "${RED}❌ npm is not installed${NC}"
        exit 1
    fi
    
    # Check PostgreSQL
    echo -e "${BLUE}🔍 Checking PostgreSQL...${NC}"
    postgres_status=$(check_postgres)
    postgres_result=$?
    
    if [ $postgres_result -eq 1 ]; then
        echo -e "${YELLOW}💡 Attempting to start PostgreSQL...${NC}"
        if ! start_postgres_mac; then
            echo -e "${RED}❌ Could not start PostgreSQL automatically${NC}"
            echo -e "${YELLOW}💡 Please start PostgreSQL manually:${NC}"
            echo -e "${BLUE}   - macOS (Homebrew): brew services start postgresql${NC}"
            echo -e "${BLUE}   - macOS (App): Start PostgreSQL.app${NC}"
            echo -e "${BLUE}   - Linux: sudo systemctl start postgresql${NC}"
            exit 1
        fi
    elif [ $postgres_result -eq 2 ]; then
        echo -e "${RED}❌ PostgreSQL is not installed${NC}"
        echo -e "${YELLOW}💡 Please install PostgreSQL:${NC}"
        echo -e "${BLUE}   - macOS: brew install postgresql${NC}"
        echo -e "${BLUE}   - Linux: sudo apt-get install postgresql postgresql-contrib${NC}"
        exit 1
    fi
    
    # Install npm dependencies
    echo -e "${BLUE}🔄 Installing npm dependencies...${NC}"
    if npm install; then
        echo -e "${GREEN}✅ Dependencies installed${NC}"
    else
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    fi
    
    # Create test database
    if ! create_test_database; then
        echo -e "${RED}❌ Database setup failed${NC}"
        exit 1
    fi
    
    # Setup test environment
    setup_test_env
    
    # Run migrations
    if ! run_migrations; then
        echo -e "${RED}❌ Migration setup failed${NC}"
        exit 1
    fi
    
    # Test server startup
    if ! test_server_startup; then
        echo -e "${YELLOW}⚠️  Server startup test failed, but setup may still work${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}🎉 Setup completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}📋 Next steps:${NC}"
    echo -e "${YELLOW}1. Start the development server:${NC}"
    echo -e "   ${BLUE}npm run dev${NC}"
    echo ""
    echo -e "${YELLOW}2. Run API tests:${NC}"
    echo -e "   ${BLUE}npm run test:api${NC}"
    echo ""
    echo -e "${YELLOW}3. Run tests with auto-server start:${NC}"
    echo -e "   ${BLUE}npm run test:api:with-server${NC}"
    echo ""
    echo -e "${BLUE}📄 Environment file created: .env.local${NC}"
    echo -e "${BLUE}📊 Test reports will be generated in the project root${NC}"
}

# Run main function
main "$@"