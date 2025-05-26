# TypeScript to Python Conversion Notes

This document outlines the conversion of the Tiw project from TypeScript to Python.

## Project Structure

- Maintained the original modular architecture
- Adapted to Python conventions while preserving the core functionality
- Used Python's asyncio for async operations (equivalent to Promises in TypeScript)

## Major Libraries Used

### TypeScript vs Python Equivalents

| TypeScript | Python |
|------------|--------|
| Node.js | Python standard library |
| Commander.js | Click |
| dotenv | python-dotenv |
| Anthropic SDK | anthropic |
| OpenAI SDK | openai |
| GitLab API | python-gitlab |
| GitHub API | pygithub |
| Custom console logging | loguru |

## Key Conversion Decisions

1. **Class Structure**: 
   - Maintained the abstract base classes and adapter pattern
   - Used Python's `abc` module for abstract classes

2. **Configuration Management**:
   - Used Python dataclasses instead of TypeScript interfaces
   - Implemented similar environment variable loading

3. **CLI Implementation**:
   - Used Click instead of Commander.js
   - Maintained the same command structure and options

4. **Async Programming**:
   - Used Python's asyncio instead of JavaScript Promises
   - Methods that were async in TypeScript are also async in Python

5. **Type Annotations**:
   - Added Python type hints throughout the codebase
   - Used TypedDict for structured JSON responses

6. **Error Handling**:
   - Used Python's exception handling patterns
   - Maintained similar error messages and reporting

## Not Yet Implemented

1. **DeepSeek and Copilot Adapters**:
   - Framework is in place, but actual implementations are placeholders

2. **Testing Suite**:
   - Basic test structure is in place
   - Detailed unit tests need to be written

## Usage

The Python version can be used with the same commands and options as the TypeScript version:

```bash
# Local mode
tiw local --provider anthropic

# URL mode
tiw url https://github.com/owner/repo/pull/123 --provider openai

# CI mode
tiw ci --platform gitlab
```

## Configuration

The configuration system works the same way, supporting both environment variables and command-line options with the same names and behaviors.