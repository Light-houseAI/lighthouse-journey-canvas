#!/bin/bash

echo "🚀 Setting up PostgreSQL for Lighthouse Journey Canvas with AI features"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL not found. Installing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install postgresql pgvector
        else
            echo "Please install Homebrew first: https://brew.sh"
            exit 1
        fi
    else
        echo "Please install PostgreSQL and pgvector extension for your system"
        exit 1
    fi
fi

# Check if pgvector is available
if ! psql -c "SELECT 1" &> /dev/null; then
    echo "🔧 Starting PostgreSQL..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew services start postgresql
    else
        sudo systemctl start postgresql
    fi
    
    # Wait a moment for PostgreSQL to start
    sleep 3
fi

# Create database if it doesn't exist
echo "📊 Setting up database..."
createdb lighthouse_journey 2>/dev/null || echo "Database already exists"

# Enable extensions
echo "🔧 Enabling extensions..."
psql lighthouse_journey -c "CREATE EXTENSION IF NOT EXISTS vector;" || {
    echo "❌ Failed to create vector extension. Make sure pgvector is installed."
    echo "📖 Installation guide: https://github.com/pgvector/pgvector#installation"
    exit 1
}

# Create the Mastra AI schema
echo "🤖 Creating AI schema..."
psql lighthouse_journey -c "CREATE SCHEMA IF NOT EXISTS mastra_ai;"

# Grant permissions
echo "🔐 Setting up permissions..."
psql lighthouse_journey -c "GRANT USAGE ON SCHEMA mastra_ai TO CURRENT_USER;"
psql lighthouse_journey -c "GRANT CREATE ON SCHEMA mastra_ai TO CURRENT_USER;"

# Test connection
echo "🧪 Testing database connection..."
if psql lighthouse_journey -c "SELECT version();" &> /dev/null; then
    echo "✅ Database setup complete!"
    echo ""
    echo "📝 Update your .env file:"
    echo "DATABASE_URL=\"postgresql://$(whoami)@localhost:5432/lighthouse_journey?sslmode=disable\""
    echo ""
    echo "🚀 You can now start the application with: npm run dev"
else
    echo "❌ Database connection test failed"
    exit 1
fi