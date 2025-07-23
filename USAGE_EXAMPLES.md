# Tiw Usage Examples

This guide provides comprehensive examples of using `tiw` in different scenarios, from basic setup to advanced CI/CD integration.

## Quick Start

### Basic Setup
```bash
# Install tiw globally
npm install -g tiw

# Set up environment variables
export ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
export LLM_PROVIDER=anthropic

# Test basic functionality
tiw --help
```

### Your First Review
```bash
# Review local changes
cd your-project
git add .  # Stage some changes
tiw local --verbose

# Review a specific GitLab MR
tiw url https://gitlab.com/group/project/-/merge_requests/123

# Review a GitHub PR
tiw url https://github.com/owner/repo/pull/456
```

## Local Development Workflow

### Basic Local Reviews
```bash
# Quick review of staged changes
tiw local

# Detailed review with diff preview
tiw local --verbose

# Debug mode with maximum information
tiw local --debug

# Save reviews to custom directory
tiw local --reviews-dir ./my-reviews
```

### Advanced Local Usage
```bash
# Use specific LLM model
tiw local --provider anthropic --model claude-3-sonnet-20240229

# Custom template directory
tiw local --templates ./custom-templates --verbose

# Review with different Git platform detection
tiw local --platform gitlab --verbose
```

### Environment-Specific Configuration
```bash
# Development environment
export LLM_PROVIDER=anthropic
export ANTHROPIC_API_KEY=your-dev-key
export ANTHROPIC_MODEL=claude-3-haiku-20240307  # Faster/cheaper for dev
export VERBOSE=true
tiw local

# Production environment  
export LLM_PROVIDER=anthropic
export ANTHROPIC_API_KEY=your-prod-key
export ANTHROPIC_MODEL=claude-3-7-sonnet-20250219  # Best quality
export MAX_PROMPT_TOKENS=150000
tiw local
```

## URL-Based Reviews

### GitLab Merge Requests
```bash
# Basic GitLab MR review
tiw url https://gitlab.com/group/project/-/merge_requests/123

# GitLab MR with custom settings
tiw url https://gitlab.company.com/team/repo/-/merge_requests/456 \
  --provider anthropic \
  --verbose \
  --reviews-dir ./gitlab-reviews

# Self-hosted GitLab instance
export GITLAB_URL=https://gitlab.company.com
export GITLAB_TOKEN=glpat-your-token
tiw url https://gitlab.company.com/team/project/-/merge_requests/789
```

### GitHub Pull Requests
```bash
# Basic GitHub PR review
tiw url https://github.com/owner/repo/pull/123

# GitHub PR with custom configuration
tiw url https://github.com/company/project/pull/456 \
  --provider anthropic \
  --model claude-3-7-sonnet-20250219 \
  --debug

# Private GitHub repository
export GITHUB_TOKEN=ghp_your-token
tiw url https://github.com/private-org/private-repo/pull/789
```

### Batch URL Processing
```bash
#!/bin/bash
# Review multiple MRs/PRs
urls=(
  "https://gitlab.com/project1/-/merge_requests/1"
  "https://gitlab.com/project1/-/merge_requests/2"
  "https://github.com/owner/repo/pull/3"
)

for url in "${urls[@]}"; do
  echo "Reviewing: $url"
  tiw url "$url" --reviews-dir "./batch-reviews/$(date +%Y%m%d)"
  sleep 5  # Rate limiting
done
```

## CI/CD Integration

### GitLab CI Configuration

#### Basic GitLab CI Setup
```yaml
# .gitlab-ci.yml
stages:
  - review

variables:
  LLM_PROVIDER: anthropic
  IGNORE_LOCK_FILES: 'true'
  VERBOSE: 'true'

mr-review:
  stage: review
  image: node:20-alpine
  before_script:
    - npm install -g tiw
  script:
    - tiw ci
  only:
    - merge_requests
  variables:
    # Set these as protected variables in GitLab CI/CD settings:
    # ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY
    # GITLAB_TOKEN: $GITLAB_TOKEN
```

#### Advanced GitLab CI Setup
```yaml
# .gitlab-ci.yml - Advanced configuration
stages:
  - review

.review-template: &review-template
  image: node:20-alpine
  before_script:
    - npm install -g tiw@latest
    - echo "Using tiw version $(tiw --version)"
  after_script:
    - echo "Review completed at $(date)"
  retry:
    max: 2
    when:
      - runner_system_failure
      - stuck_or_timeout_failure

mr-review-anthropic:
  <<: *review-template
  stage: review
  script:
    - tiw ci --provider anthropic --verbose
  variables:
    LLM_PROVIDER: anthropic
    ANTHROPIC_MODEL: claude-3-7-sonnet-20250219
    MAX_PROMPT_TOKENS: 150000
  only:
    - merge_requests
  except:
    variables:
      - $CI_MERGE_REQUEST_SOURCE_BRANCH_NAME =~ /^(release|hotfix)\/.*/

# Optional: Use different provider for different types of changes
mr-review-quick:
  <<: *review-template
  stage: review
  script:
    - tiw ci --provider anthropic --model claude-3-haiku-20240307
  variables:
    LLM_PROVIDER: anthropic
    ANTHROPIC_MODEL: claude-3-haiku-20240307  # Faster for small changes
  only:
    variables:
      - $CI_MERGE_REQUEST_DIFF_BASE_SHA  # Only if diff is available
    changes:
      - "*.md"
      - "*.txt"
      - "docs/**/*"
```

#### GitLab CI with Multiple Providers
```yaml
# .gitlab-ci.yml - Multi-provider setup
mr-review-anthropic:
  stage: review
  image: node:20-alpine
  before_script:
    - npm install -g tiw
  script:
    - tiw ci --provider anthropic
  variables:
    LLM_PROVIDER: anthropic
  only:
    - merge_requests
  when: manual
  allow_failure: true

mr-review-openai:
  stage: review
  image: node:20-alpine
  before_script:
    - npm install -g tiw
  script:
    - tiw ci --provider openai
  variables:
    LLM_PROVIDER: openai
  only:
    - merge_requests
  when: manual
  allow_failure: true
```

### GitHub Actions Configuration

#### Basic GitHub Actions Setup
```yaml
# .github/workflows/review.yml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [main, develop]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Install Tiw
        run: npm install -g tiw
        
      - name: Run AI Review
        run: tiw ci --platform github --verbose
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          LLM_PROVIDER: anthropic
          ANTHROPIC_MODEL: claude-3-7-sonnet-20250219
          MAX_PROMPT_TOKENS: 150000
          IGNORE_LOCK_FILES: 'true'
```

#### Advanced GitHub Actions Setup
```yaml
# .github/workflows/review.yml - Advanced configuration
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [main, develop, 'release/**']

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      
    strategy:
      matrix:
        provider: [anthropic]
        # provider: [anthropic, openai]  # Enable when multiple providers supported
        
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}
          
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Cache tiw installation
        uses: actions/cache@v4
        with:
          path: ~/.npm
          key: ${{ runner.os }}-npm-tiw-${{ hashFiles('**/package-lock.json') }}
          
      - name: Install Tiw
        run: |
          npm install -g tiw@latest
          echo "Installed tiw version: $(tiw --version)"
        
      - name: Run AI Review
        run: |
          tiw ci \
            --platform github \
            --provider ${{ matrix.provider }} \
            --verbose \
            --reviews-dir ./reviews
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          # OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          LLM_PROVIDER: ${{ matrix.provider }}
          MAX_PROMPT_TOKENS: 150000
          IGNORE_LOCK_FILES: 'true'
          
      - name: Upload review artifacts
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: review-results-${{ matrix.provider }}
          path: reviews/
          retention-days: 30
```

#### Conditional GitHub Actions
```yaml
# .github/workflows/review.yml - Conditional execution
name: Smart AI Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  check-changes:
    runs-on: ubuntu-latest
    outputs:
      should-review: ${{ steps.changes.outputs.code-changes }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v2
        id: changes
        with:
          filters: |
            code-changes:
              - '**/*.ts'
              - '**/*.js'
              - '**/*.tsx'
              - '**/*.jsx'
              - '**/*.py'
              - '**/*.java'
              - '**/*.go'
              - '**/*.rs'
              - '**/*.cpp'
              - '**/*.c'

  review:
    needs: check-changes
    if: needs.check-changes.outputs.should-review == 'true'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install and run Tiw
        run: |
          npm install -g tiw
          tiw ci --platform github --verbose
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          LLM_PROVIDER: anthropic
```

## Configuration Examples

### Environment Variable Files

#### Development .env
```bash
# .env.development
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-api03-your-dev-key
ANTHROPIC_MODEL=claude-3-haiku-20240307  # Faster for development

GIT_PLATFORM=gitlab
GITLAB_URL=https://gitlab.com
GITLAB_TOKEN=glpat-your-dev-token

MAX_PROMPT_TOKENS=50000  # Lower for dev to save costs
VERBOSE=true
IGNORE_LOCK_FILES=true
REVIEWS_DIR=./dev-reviews
```

#### Production .env
```bash
# .env.production
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-api03-your-prod-key
ANTHROPIC_MODEL=claude-3-7-sonnet-20250219  # Best quality

GIT_PLATFORM=gitlab
GITLAB_URL=https://gitlab.company.com
GITLAB_TOKEN=glpat-your-prod-token

MAX_PROMPT_TOKENS=150000
IGNORE_LOCK_FILES=true
REVIEWS_DIR=/var/log/tiw/reviews
```

#### Multi-provider .env
```bash
# .env.multi-provider
# Primary provider
LLM_PROVIDER=anthropic

# All provider credentials
ANTHROPIC_API_KEY=sk-ant-your-key
OPENAI_API_KEY=sk-your-openai-key
DEEPSEEK_API_KEY=your-deepseek-key
COPILOT_API_KEY=your-copilot-key

# Provider-specific models
ANTHROPIC_MODEL=claude-3-7-sonnet-20250219
OPENAI_MODEL=gpt-4
DEEPSEEK_MODEL=deepseek-coder
COPILOT_MODEL=gpt-4

# Platform credentials
GITLAB_TOKEN=glpat-your-token
GITHUB_TOKEN=ghp_your-token
```

## Advanced Usage Patterns

### Custom Templates
```bash
# Create custom template directory
mkdir -p ./custom-templates/prompts
mkdir -p ./custom-templates/formatters

# Create custom prompt
cat > ./custom-templates/prompts/security-focus.md << 'EOF'
# Security-Focused Code Review

You are a security expert reviewing code changes. Focus on:

1. **Authentication & Authorization** - Proper access controls
2. **Input Validation** - All inputs sanitized  
3. **SQL Injection** - Safe database queries
4. **XSS Prevention** - Proper output encoding
5. **Sensitive Data** - No hardcoded secrets
6. **Cryptography** - Secure implementations

## Code Changes
{{{diff}}}

## Security Analysis
Provide detailed security analysis focusing on vulnerabilities and risks.
EOF

# Use custom templates
tiw local --templates ./custom-templates --verbose
```

### Performance Monitoring
```bash
#!/bin/bash
# Performance monitoring script

echo "Starting tiw performance test..."
start_time=$(date +%s)

# Run review with timing
tiw local --verbose 2>&1 | while IFS= read -r line; do
  echo "$(date '+%Y-%m-%d %H:%M:%S'): $line"
done

end_time=$(date +%s)
duration=$((end_time - start_time))

echo "Review completed in ${duration} seconds"
echo "$(date): Duration ${duration}s" >> tiw-performance.log
```

### Error Handling and Retry
```bash
#!/bin/bash
# Robust review script with retry logic

max_retries=3
retry_count=0

while [ $retry_count -lt $max_retries ]; do
  echo "Attempt $((retry_count + 1)) of $max_retries"
  
  if tiw local --verbose; then
    echo "Review successful!"
    exit 0
  else
    retry_count=$((retry_count + 1))
    if [ $retry_count -lt $max_retries ]; then
      wait_time=$((retry_count * 30))
      echo "Review failed, waiting ${wait_time} seconds before retry..."
      sleep $wait_time
    fi
  fi
done

echo "Review failed after $max_retries attempts"
exit 1
```

### Integration with External Tools

#### Slack Notifications
```bash
#!/bin/bash
# Send review results to Slack

SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Run review and capture output
review_output=$(tiw local --verbose 2>&1)
exit_code=$?

if [ $exit_code -eq 0 ]; then
  status="✅ Success"
  color="good"
else
  status="❌ Failed"
  color="danger"
fi

# Send to Slack
curl -X POST -H 'Content-type: application/json' \
  --data "{
    \"attachments\": [{
      \"color\": \"$color\",
      \"title\": \"Code Review: $status\",
      \"text\": \"$review_output\",
      \"footer\": \"Tiw Review Bot\",
      \"ts\": $(date +%s)
    }]
  }" \
  $SLACK_WEBHOOK_URL
```

#### Jira Integration
```bash
#!/bin/bash
# Create Jira ticket for review findings

JIRA_URL="https://your-company.atlassian.net"
JIRA_USER="your-email@company.com"
JIRA_TOKEN="your-jira-token"

# Run review and save output
tiw local --reviews-dir ./temp --verbose
review_file=$(ls -t ./temp/*.json | head -1)

if [ -f "$review_file" ]; then
  # Parse review results (requires jq)
  issues_count=$(jq '.review.issues | length' "$review_file")
  
  if [ "$issues_count" -gt 0 ]; then
    # Create Jira ticket
    curl -u "$JIRA_USER:$JIRA_TOKEN" \
      -X POST \
      -H "Content-Type: application/json" \
      "$JIRA_URL/rest/api/3/issue" \
      -d "{
        \"fields\": {
          \"project\": {\"key\": \"DEV\"},
          \"summary\": \"Code Review: $issues_count issues found\",
          \"description\": \"Automated code review found $issues_count issues. See attached review file.\",
          \"issuetype\": {\"name\": \"Task\"}
        }
      }"
  fi
fi
```

## Troubleshooting Examples

### Debug Configuration Issues
```bash
# Check environment variables
env | grep -E "(ANTHROPIC|GITLAB|GITHUB|LLM)" | sort

# Test configuration loading
tiw local --debug | head -20

# Verify API connectivity
curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
  https://api.anthropic.com/v1/messages \
  -d '{"model":"claude-3-haiku-20240307","max_tokens":10,"messages":[{"role":"user","content":"test"}]}'
```

### Handle Large Repositories
```bash
# For large repositories, use token limits
MAX_PROMPT_TOKENS=50000 tiw local --verbose

# Review only specific file patterns
git diff --name-only | grep -E '\.(ts|js|py)$' | head -10 | xargs git add
tiw local --verbose

# Split large changes into smaller reviews
git log --oneline -10  # Find recent commits
git diff HEAD~2 HEAD~1 | tiw local --verbose  # Review specific commit range
```

### Performance Optimization
```bash
# Use faster model for quick feedback
LLM_PROVIDER=anthropic ANTHROPIC_MODEL=claude-3-haiku-20240307 tiw local

# Reduce token usage
MAX_PROMPT_TOKENS=25000 IGNORE_LOCK_FILES=true tiw local

# Parallel processing for multiple reviews
for url in "${urls[@]}"; do
  tiw url "$url" --reviews-dir "./parallel-reviews" &
done
wait  # Wait for all background jobs to complete
```

This comprehensive set of examples should help users get started with `tiw` and adapt it to their specific workflows and requirements.