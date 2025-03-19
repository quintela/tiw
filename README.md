# Tiw

A CLI tool that uses Large Language Models (LLMs) to review code changes in merge/pull requests and provide feedback. Supports multiple LLM providers (Anthropic, OpenAI, DeepSeek, Copilot) and Git platforms (GitLab, GitHub).

Tiw (reads "tiu") is a simple command-line utility that helps you analyze code changes with the help of advanced language models.

## Features

- Analyze code diffs using various LLM providers:
  - Anthropic Claude models
  - OpenAI GPT models
  - DeepSeek Coder
  - GitHub Copilot
- Support for multiple Git platforms:
  - GitLab merge requests
  - GitHub pull requests
- Support for multiple operating modes:
  - Local mode: Review changes in your local git repo
  - CI mode: Review merge/pull requests in CI pipelines
  - URL mode: Review by providing a GitLab MR or GitHub PR URL
- Post review comments directly on merge/pull requests
- Automatic saving of reviews in structured JSON format
- Well-formatted Markdown comments with proper section structure
- Customizable prompt templates
- Configurable review saving directory
- Options to ignore lock files in diffs
- Modular and extensible architecture with adapter pattern
- Written in TypeScript with strict type checking

## Installation

### Global Installation

```sh
yarn global add tiw
# or with npm
npm install -g tiw
```

### Local Development Installation

```sh
yarn install
```

## Configuration

Set the following environment variables or create a `.env` file:

```sh
# LLM Configuration
LLM_PROVIDER=anthropic # or openai, deepseek, copilot
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key
COPILOT_API_KEY=your_copilot_api_key

# LLM Model Selection
ANTHROPIC_MODEL=claude-3-7-sonnet-20250219
OPENAI_MODEL=gpt-4
DEEPSEEK_MODEL=deepseek-coder
COPILOT_MODEL=gpt-4

# Token Limits Configuration
MAX_PROMPT_TOKENS=100000
ANTHROPIC_MAX_TOKENS=190000
OPENAI_MAX_TOKENS=128000
DEEPSEEK_MAX_TOKENS=128000
COPILOT_MAX_TOKENS=128000

# Git Platform Configuration
GIT_PLATFORM=gitlab # or github
GITLAB_URL=https://gitlab.com
GITLAB_TOKEN=your_gitlab_token
GITHUB_TOKEN=your_github_token

# Other Options
VERBOSE=true # Enable verbose logging
IGNORE_LOCK_FILES=true # Skip lock files in diffs (default: true)
```

## Usage

### Running the Tool

For development (directly with TypeScript):

```sh
yarn dev [options]
```

Using the built version:

```sh
yarn build
yarn start [options]
```

Or if installed globally:

```sh
tiw [options]
```

### Local Mode (Default)

Review changes between the current state and the previous commit:

```sh
tiw
```

### URL Mode

Review a merge/pull request by URL:

```sh
# For GitLab MRs
tiw --mode url --mr-url https://gitlab.com/group/project/-/merge_requests/123

# For GitHub PRs
tiw --mode url --mr-url https://github.com/owner/repo/pull/123
```

The tool now automatically detects whether a URL is from GitHub or GitLab, so you don't need to specify the `--platform` flag when using URL mode - it will be determined from the URL.

### Show Diff

View the diff before sending it to the LLM:

```sh
tiw --show-diff
```

### Custom GitLab Instance

Specify a custom GitLab instance URL:

```sh
tiw --gitlab-url https://git.yourcompany.com
```

### CI Mode

When running in a CI pipeline, the tool automatically detects the environment variables:

#### GitLab CI

Create a `.gitlab-ci.yml` file in your repository:

```yaml
stages:
  - review

mr-review:
  stage: review
  image: node:latest
  script:
    - npm install -g tiw
    - tiw --mode ci
  only:
    - merge_requests
  variables:
    LLM_PROVIDER: anthropic
    IGNORE_LOCK_FILES: 'true'
    VERBOSE: 'true'
```

**Important:** Configure these secure variables in GitLab CI/CD settings:

- `GITLAB_TOKEN`: Your GitLab personal access token
- `ANTHROPIC_API_KEY` (or other LLM provider API key)

#### GitHub Actions

Create a `.github/workflows/review.yml` file:

```yaml
name: Code Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install -g tiw
      - name: Run Tiw
        run: tiw --platform github --mode ci
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          LLM_PROVIDER: anthropic
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### LLM Provider Configuration

#### Anthropic Claude

```sh
# Use Anthropic Claude
tiw --provider anthropic --model claude-3-7-sonnet-20250219
# OR using environment variables
export LLM_PROVIDER=anthropic
export ANTHROPIC_API_KEY=your_api_key
export ANTHROPIC_MODEL=claude-3-7-sonnet-20250219
tiw
```

#### OpenAI

```sh
# Use OpenAI
tiw --provider openai --model gpt-4
# OR using environment variables
export LLM_PROVIDER=openai
export OPENAI_API_KEY=your_api_key
export OPENAI_MODEL=gpt-4
tiw
```

#### DeepSeek

```sh
# Use DeepSeek
tiw --provider deepseek --model deepseek-coder
# OR using environment variables
export LLM_PROVIDER=deepseek
export DEEPSEEK_API_KEY=your_api_key
export DEEPSEEK_MODEL=deepseek-coder
tiw
```

#### Copilot

```sh
# Use GitHub Copilot
tiw --provider copilot --model gpt-4
# OR using environment variables
export LLM_PROVIDER=copilot
export COPILOT_API_KEY=your_api_key
export COPILOT_MODEL=gpt-4
tiw
```

### Additional Options

```sh
# Use a custom prompt template
tiw --prompt /path/to/your/template.ts

# Change where reviews are saved
tiw --reviews-dir /path/to/review/directory

# View the diff before sending to LLM for review
tiw --show-diff

# Enable verbose logging
tiw --verbose
```

## Review Storage

All generated reviews are automatically saved to the `reviews` directory in JSON format. Each file contains:

- Metadata about the review:
  - Timestamp when the review was performed
  - LLM provider and model used
  - Git platform (GitLab, GitHub)
  - MR mode (local, CI, URL)
  - Command line arguments used to run the tool
- Complete JSON response from the LLM

These saved reviews can be used for:

- Tracking review history
- Comparing reviews over time
- Analyzing LLM performance
- Debugging issues

## Development

### Project Structure

```
src/
├── index.ts                      # Main executable entry point
├── config/
│   └── config.ts                 # Configuration management
├── core/
│   ├── MRReviewer.ts             # Main application class
│   └── ReviewFormatter.ts        # Process and format reviews
├── adapters/
│   ├── llm/
│   │   ├── LLMAdapter.ts         # Base LLM adapter interface
│   │   ├── AnthropicAdapter.ts   # Anthropic implementation
│   │   ├── OpenAIAdapter.ts      # OpenAI implementation
│   │   └── index.ts              # Factory for LLM adapters
│   └── git/
│       ├── GitAdapter.ts         # Base Git adapter interface
│       ├── GitLabAdapter.ts      # GitLab implementation
│       ├── GitHubAdapter.ts      # GitHub implementation
│       └── index.ts              # Factory for Git adapters
├── templates/
│   └── default-prompt.ts         # Default prompt template
└── utils/
    ├── validation.ts             # Input validation utilities
    ├── logging.ts                # Logging utilities
    └── fileUtils.ts              # File operations utilities
```

### Development Commands

```sh
# Development mode (run with ts-node)
yarn dev

# Build the project
yarn build

# Run the built version
yarn start

# Type checking without output generation
yarn tsc:check

# Run tests
yarn test

# Run linter
yarn lint

# Run linter with auto-fix
yarn lint:fix

# Format the code with Prettier
yarn fmt:fix

# Check Format the code with Prettier
yarn fmt:check

# Find dead/unused code
yarn knip

# sort package.json
yarn sort-package-json
```

### Git Hooks

The project uses Husky to set up Git hooks:

- Pre-commit: Runs linting and formatting on staged files

### Code Quality Tools

This project uses several tools to ensure code quality:

- **TypeScript**: Static type checking
- **ESLint**: Code quality rules with the following plugins:
  - typescript-eslint
  - eslint-plugin-import
  - eslint-plugin-prettier
- **Prettier**: Code formatting with import sorting
- **Jest**: Testing framework
- **Knip**: Dead code detection

## Extending

### Adding a New LLM Provider

1. Create a new adapter in `src/adapters/llm/`
2. Extend the `LLMAdapter` abstract class
3. Implement required methods:
   - `constructor`: Setup API client with config
   - `analyzeCode`: Handle code review with your LLM
4. Add the new provider to the factory in `src/adapters/llm/index.ts`
5. Add relevant configuration options in `src/config/config.ts`

### Adding a New Git Platform

1. Create a new adapter in `src/adapters/git/`
2. Extend the `GitAdapter` abstract class
3. Implement required methods:
   - `parseRequestUrl`: Extract identifiers from platform-specific URLs
   - `getRequestDiff`: Get diff content from the platform's API
   - `commentOnRequest`: Post comments on merge/pull requests
4. Add the new platform to the factory in `src/adapters/git/index.ts`
5. Update auto-detection in `src/utils/gitDetector.ts`

### Customizing Prompts and Formatting

To modify the default prompts and output formatting:

1. Create custom prompt files in `src/templates/prompts/`
2. Create custom formatter templates in `src/templates/formatters/`
3. Use the `--prompt` and `--formatter-template` options to use your custom templates

## Help

```sh
tiw --help
```

## License

This project is licensed under the Apache License, Version 2.0.

See [LICENSE.md](LICENSE.md) for more details.

## Author

© 2025 Tiago <913367+quintela@users.noreply.github.com>
