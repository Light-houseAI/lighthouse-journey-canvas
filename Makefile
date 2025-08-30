# Lighthouse Journey Canvas - Development Makefile
# Abstracts package manager commands for easier development workflow

# Package manager configuration
PKG_MANAGER := pnpm
INSTALL_CMD := $(PKG_MANAGER) install
BUILD_CMD := $(PKG_MANAGER) build
DEV_CMD := $(PKG_MANAGER) dev
TEST_CMD := $(PKG_MANAGER) test
CHECK_CMD := $(PKG_MANAGER) check
START_CMD := $(PKG_MANAGER) start

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

# Default target
.PHONY: help
help: ## Show this help message
	@echo "$(GREEN)Lighthouse Journey Canvas - Development Commands$(NC)"
	@echo ""
	@echo "$(YELLOW)Setup Commands:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '^(install|clean|setup)' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Development Commands:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '^(dev|build|start|check)' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Database Commands:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '^(db-)' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Testing Commands:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '^(test)' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Docker Commands:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '^(docker)' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'

# Setup Commands
.PHONY: install
install: ## Install all dependencies
	@echo "$(GREEN)Installing dependencies with $(PKG_MANAGER)...$(NC)"
	$(INSTALL_CMD)

.PHONY: clean
clean: ## Clean node_modules and lock files
	@echo "$(YELLOW)Cleaning node_modules and lock files...$(NC)"
	rm -rf node_modules pnpm-lock.yaml package-lock.json yarn.lock
	@echo "$(GREEN)Clean complete!$(NC)"

.PHONY: setup
setup: clean install ## Clean and install dependencies
	@echo "$(GREEN)Setup complete!$(NC)"

# Development Commands
.PHONY: dev
dev: ## Start development server with hot reload
	@echo "$(GREEN)Starting development server...$(NC)"
	$(DEV_CMD)

.PHONY: build
build: ## Build production application
	@echo "$(GREEN)Building production application...$(NC)"
	$(BUILD_CMD)

.PHONY: start
start: ## Start production server
	@echo "$(GREEN)Starting production server...$(NC)"
	$(START_CMD)

.PHONY: check
check: ## Run TypeScript type checking
	@echo "$(GREEN)Running TypeScript checks...$(NC)"
	$(CHECK_CMD)

# Database Commands
.PHONY: db-push
db-push: ## Push schema changes to database
	@echo "$(GREEN)Pushing database schema changes...$(NC)"
	$(PKG_MANAGER) db:push

.PHONY: db-init-vector
db-init-vector: ## Initialize vector database
	@echo "$(GREEN)Initializing vector database...$(NC)"
	$(PKG_MANAGER) db:init-vector

.PHONY: db-sync-vector
db-sync-vector: ## Sync vector database
	@echo "$(GREEN)Syncing vector database...$(NC)"
	$(PKG_MANAGER) db:sync-vector

# Testing Commands
.PHONY: test
test: ## Run all unit tests
	@echo "$(GREEN)Running unit tests...$(NC)"
	$(TEST_CMD)

.PHONY: test-watch
test-watch: ## Run unit tests in watch mode
	@echo "$(GREEN)Running unit tests in watch mode...$(NC)"
	$(PKG_MANAGER) test -- --watch

.PHONY: test-specific
test-specific: ## Run specific test file (usage: make test-specific FILE=path/to/test.js)
ifndef FILE
	@echo "$(RED)Please specify a test file: make test-specific FILE=path/to/test.js$(NC)"
	@exit 1
endif
	@echo "$(GREEN)Running test: $(FILE)$(NC)"
	$(PKG_MANAGER) test -- --run $(FILE)

.PHONY: test-e2e
test-e2e: ## Run all Playwright E2E tests
	@echo "$(GREEN)Running E2E tests...$(NC)"
	$(PKG_MANAGER) test:e2e

.PHONY: test-e2e-headed
test-e2e-headed: ## Run E2E tests in headed mode
	@echo "$(GREEN)Running E2E tests in headed mode...$(NC)"
	$(PKG_MANAGER) test:e2e:headed

.PHONY: test-e2e-debug
test-e2e-debug: ## Debug E2E tests
	@echo "$(GREEN)Running E2E tests in debug mode...$(NC)"
	$(PKG_MANAGER) test:e2e:debug

.PHONY: test-e2e-ui
test-e2e-ui: ## Run E2E tests with Playwright UI
	@echo "$(GREEN)Running E2E tests with Playwright UI...$(NC)"
	$(PKG_MANAGER) test:e2e:ui

.PHONY: test-e2e-chrome
test-e2e-chrome: ## Run E2E tests in Chrome only (faster debugging)
	@echo "$(GREEN)Running E2E tests in Chrome...$(NC)"
	$(PKG_MANAGER) test:e2e:chrome

.PHONY: test-api
test-api: ## Run API integration tests
	@echo "$(GREEN)Running API integration tests...$(NC)"
	$(PKG_MANAGER) test:api

# Docker Commands
.PHONY: docker-build
docker-build: ## Build Docker image
	@echo "$(GREEN)Building Docker image...$(NC)"
	docker build -t lighthouse-journey-canvas .

.PHONY: docker-run
docker-run: ## Run Docker container
	@echo "$(GREEN)Running Docker container...$(NC)"
	docker run -p 3000:3000 lighthouse-journey-canvas

.PHONY: docker-dev
docker-dev: docker-build docker-run ## Build and run Docker container

# Utility Commands
.PHONY: lint
lint: ## Run linting
	@echo "$(GREEN)Running linter...$(NC)"
	$(PKG_MANAGER) lint || echo "$(YELLOW)No lint script found$(NC)"

.PHONY: format
format: ## Format code
	@echo "$(GREEN)Formatting code...$(NC)"
	$(PKG_MANAGER) format || echo "$(YELLOW)No format script found$(NC)"

.PHONY: audit
audit: ## Run security audit
	@echo "$(GREEN)Running security audit...$(NC)"
	$(PKG_MANAGER) audit

.PHONY: outdated
outdated: ## Check for outdated dependencies
	@echo "$(GREEN)Checking for outdated dependencies...$(NC)"
	$(PKG_MANAGER) outdated

.PHONY: update
update: ## Update dependencies
	@echo "$(GREEN)Updating dependencies...$(NC)"
	$(PKG_MANAGER) update

# Combined Commands
.PHONY: ci
ci: install check test build ## Run complete CI pipeline (install, check, test, build)
	@echo "$(GREEN)CI pipeline completed successfully!$(NC)"

.PHONY: precommit
precommit: check test ## Run pre-commit checks (type check + tests)
	@echo "$(GREEN)Pre-commit checks passed!$(NC)"


# Info Commands
.PHONY: info
info: ## Show project information
	@echo "$(GREEN)Project: Lighthouse Journey Canvas$(NC)"
	@echo "$(YELLOW)Package Manager:$(NC) $(PKG_MANAGER)"
	@echo "$(YELLOW)Node Version:$(NC) $(shell node --version)"
	@echo "$(YELLOW)Package Manager Version:$(NC) $(shell $(PKG_MANAGER) --version)"
	@echo "$(YELLOW)Project Root:$(NC) $(shell pwd)"