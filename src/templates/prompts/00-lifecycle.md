# SYSTEMATIC REVIEW METHODOLOGY

## REVIEW EXECUTION FRAMEWORK

### Phase 1: Context Analysis
**Quickly assess the change context to guide analysis depth:**

- **Project Type**: CLI tool, web app, library → affects applicable standards
- **Change Scope**: New feature, bug fix, refactor → determines risk level
- **File Patterns**: Identify adapters, configs, tests → expect established patterns
- **Dependencies**: New packages → require security review

### Phase 2: Priority-Based Analysis

**1. Security Assessment (Highest Priority)**
- Hardcoded credentials, API keys, or sensitive data exposure
- Input validation on user-provided data
- Authentication/authorization bypass opportunities
- SQL injection, XSS, or other injection vulnerabilities
- Dependency vulnerabilities or supply chain risks

**2. Performance & Scalability Review**
- N+1 query patterns or inefficient database operations
- Memory leaks from unclosed resources or retained references
- Algorithmic complexity issues (O(n²) where O(n) possible)
- Bundle size increases or unnecessary computations
- Missing caching or optimization opportunities

**3. Architecture & Design Consistency**
- Violations of established project patterns (adapter, factory, DI)
- Single Responsibility Principle compliance
- Circular dependencies or inappropriate coupling
- Separation of concerns (business logic vs presentation)
- Missing abstractions or interface contracts

**4. Code Quality & Maintainability**
- Type safety violations (`any` usage, missing null checks)
- Error handling gaps (unhandled promises, missing try/catch)
- Function complexity (>50 lines, high cyclomatic complexity)
- Unclear naming or missing documentation for complex logic
- Testing coverage for new functionality

### Phase 3: Evidence-Based Verification

**Critical Thinking Checkpoints:**
1. **"What could break in production?"** - Focus on real risks
2. **"Will this scale to 10x the current load?"** - Performance implications
3. **"Can a new team member understand and maintain this?"** - Maintainability
4. **"Does this follow established project patterns?"** - Consistency

**Quality Gates for Every Suggestion:**
- [ ] Issue references specific location (`file_path#L42`)
- [ ] Problem description explains actual risk or impact
- [ ] Suggested fix includes working code example
- [ ] Confidence level integrated naturally into description
- [ ] Addresses genuine issue, not style preference

## COMMENT FORMAT STANDARD

**Required structure for every issue:**
```
**Priority<type>**: Brief issue description

🎯 Located in `file_path#L42`:

BRIEFLY describe the problem and why it needs attention.

BEFORE:
[exact problematic code from diff]

AFTER:
[specific fix with proper syntax]

⚠️ WHY THIS MATTERS: [business/technical consequences if not addressed]
```

**Priority Levels:**
- **BLOCKING**: Security vulnerabilities, data loss risks, breaking changes
- **MAJOR**: Architecture violations, performance bottlenecks, accessibility issues
- **MINOR**: Code quality concerns, maintainability issues, testing gaps
- **SUGGESTION**: Style preferences with technical justification

**Confidence Ratings:**
- **High**: Clear evidence of definite issue
- **Medium**: Likely problem based on best practices
- **Low**: Potential improvement, context-dependent

## COMPLETION VERIFICATION

**Before submitting review:**
- [ ] All blocking security and performance issues identified
- [ ] Each suggestion includes working code examples
- [ ] Confidence levels have evidence-based justification
- [ ] Risk assessment reflects highest priority findings
- [ ] No subjective style opinions without technical merit
- [ ] Analysis focuses on issues that affect system reliability