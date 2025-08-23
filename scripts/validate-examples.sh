#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EXAMPLES_DIR="$ROOT_DIR/examples"

log_info "Starting Orquel examples validation..."
log_info "Root directory: $ROOT_DIR"
log_info "Examples directory: $EXAMPLES_DIR"

# Check if examples directory exists
if [[ ! -d "$EXAMPLES_DIR" ]]; then
    log_error "Examples directory not found: $EXAMPLES_DIR"
fi

# Function to validate example structure
validate_example_structure() {
    local example_dir="$1"
    local example_name="$(basename "$example_dir")"
    
    log_info "Validating structure of example: $example_name"
    
    # Required files
    local required_files=(
        "package.json"
        "src/index.ts"
        "README.md"
        "tsconfig.json"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$example_dir/$file" ]]; then
            log_error "Missing required file: $file in $example_name"
        fi
    done
    
    # Check package.json structure
    local package_json="$example_dir/package.json"
    if ! jq -e '.scripts.dev' "$package_json" > /dev/null 2>&1; then
        log_error "Missing 'dev' script in package.json for $example_name"
    fi
    
    if ! jq -e '.scripts.build' "$package_json" > /dev/null 2>&1; then
        log_error "Missing 'build' script in package.json for $example_name"
    fi
    
    if ! jq -e '.scripts.typecheck' "$package_json" > /dev/null 2>&1; then
        log_error "Missing 'typecheck' script in package.json for $example_name"
    fi
    
    log_success "Structure validation passed for $example_name"
}

# Function to validate TypeScript compilation
validate_typescript() {
    local example_dir="$1"
    local example_name="$(basename "$example_dir")"
    
    log_info "Type checking example: $example_name"
    
    cd "$example_dir"
    
    if ! pnpm typecheck > /dev/null 2>&1; then
        log_error "TypeScript compilation failed for $example_name"
    fi
    
    log_success "TypeScript validation passed for $example_name"
}

# Function to validate API usage
validate_api_usage() {
    local example_dir="$1"
    local example_name="$(basename "$example_dir")"
    
    log_info "Validating API usage in example: $example_name"
    
    local index_file="$example_dir/src/index.ts"
    
    # Check for required imports/usage
    if ! grep -q "createOrquel" "$index_file"; then
        log_error "Example $example_name should use createOrquel function"
    fi
    
    if ! grep -q "OrquelUtils" "$index_file"; then
        log_warning "Example $example_name should demonstrate OrquelUtils usage"
    fi
    
    # Check for deprecated patterns
    if grep -q "chunk\.source\.title" "$index_file"; then
        log_error "Found deprecated pattern in $example_name: chunk.source.title (should be chunk.metadata.source.title)"
    fi
    
    # Check for proper error handling
    if ! grep -q "try\|catch" "$index_file"; then
        log_warning "Example $example_name should demonstrate error handling"
    fi
    
    log_success "API usage validation passed for $example_name"
}

# Function to validate documentation
validate_documentation() {
    local example_dir="$1"
    local example_name="$(basename "$example_dir")"
    
    log_info "Validating documentation for example: $example_name"
    
    local readme_file="$example_dir/README.md"
    
    # Check for required sections
    local required_sections=(
        "## Installation"
        "## Usage"
    )
    
    for section in "${required_sections[@]}"; do
        if ! grep -q "$section" "$readme_file"; then
            log_error "Missing required section '$section' in README for $example_name"
        fi
    done
    
    # Check for code examples
    if ! grep -q "\`\`\`typescript" "$readme_file"; then
        log_warning "README for $example_name should include TypeScript code examples"
    fi
    
    # Check for environment setup instructions
    if ! grep -q "OPENAI_API_KEY\|API.*KEY\|\.env" "$readme_file"; then
        log_warning "README for $example_name should mention environment setup"
    fi
    
    log_success "Documentation validation passed for $example_name"
}

# Function to build example
build_example() {
    local example_dir="$1"
    local example_name="$(basename "$example_dir")"
    
    log_info "Building example: $example_name"
    
    cd "$example_dir"
    
    if ! pnpm build > /dev/null 2>&1; then
        log_error "Build failed for example $example_name"
    fi
    
    # Check that build output exists
    if [[ ! -f "dist/index.js" ]] && [[ ! -f "dist/index.cjs" ]]; then
        log_error "Build output not found for example $example_name"
    fi
    
    log_success "Build validation passed for $example_name"
}

# Function to check dependencies
validate_dependencies() {
    local example_dir="$1"
    local example_name="$(basename "$example_dir")"
    
    log_info "Validating dependencies for example: $example_name"
    
    local package_json="$example_dir/package.json"
    
    # Check for required Orquel dependencies
    if ! jq -e '.dependencies."@orquel/core"' "$package_json" > /dev/null 2>&1; then
        log_error "Example $example_name missing @orquel/core dependency"
    fi
    
    # Check that workspace dependencies are used correctly
    local orquel_deps=$(jq -r '.dependencies | to_entries[] | select(.key | startswith("@orquel/")) | .value' "$package_json")
    for dep in $orquel_deps; do
        if [[ "$dep" != "workspace:*" ]]; then
            log_warning "Example $example_name should use 'workspace:*' for Orquel dependencies, found: $dep"
        fi
    done
    
    log_success "Dependencies validation passed for $example_name"
}

# Main validation function
validate_example() {
    local example_dir="$1"
    local example_name="$(basename "$example_dir")"
    
    if [[ ! -d "$example_dir" ]]; then
        log_error "Example directory not found: $example_dir"
    fi
    
    log_info "===================="
    log_info "Validating example: $example_name"
    log_info "===================="
    
    validate_example_structure "$example_dir"
    validate_dependencies "$example_dir"
    validate_typescript "$example_dir"
    validate_api_usage "$example_dir"
    validate_documentation "$example_dir"
    build_example "$example_dir"
    
    log_success "All validations passed for $example_name"
}

# Check prerequisites
log_info "Checking prerequisites..."

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    log_error "jq is required but not installed. Please install jq first."
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    log_error "pnpm is required but not installed. Please install pnpm first."
fi

# Make sure we're in the root directory
cd "$ROOT_DIR"

# Install dependencies if needed
if [[ ! -d "node_modules" ]]; then
    log_info "Installing dependencies..."
    pnpm install --frozen-lockfile
fi

# Build packages first
log_info "Building Orquel packages..."
pnpm build

# Find and validate all examples
log_info "Finding examples..."
examples=($(find "$EXAMPLES_DIR" -maxdepth 1 -type d -not -path "$EXAMPLES_DIR"))

if [[ ${#examples[@]} -eq 0 ]]; then
    log_warning "No examples found in $EXAMPLES_DIR"
    exit 0
fi

log_info "Found ${#examples[@]} examples"

# Validate specific example if provided as argument
if [[ -n "$1" ]]; then
    example_path="$EXAMPLES_DIR/$1"
    if [[ -d "$example_path" ]]; then
        validate_example "$example_path"
    else
        log_error "Example '$1' not found in $EXAMPLES_DIR"
    fi
else
    # Validate all examples
    failed_examples=()
    
    for example_dir in "${examples[@]}"; do
        if ! validate_example "$example_dir" 2>/dev/null; then
            failed_examples+=("$(basename "$example_dir")")
        fi
    done
    
    if [[ ${#failed_examples[@]} -gt 0 ]]; then
        log_error "Validation failed for examples: ${failed_examples[*]}"
    fi
fi

log_success "All example validations completed successfully! 🎉"