## REVIEW PRIORITIES & DECISION FRAMEWORK

### BLOCKING PRIORITIES (Block Deployment)

**1. Security Vulnerabilities**
- Hardcoded credentials, API keys, or sensitive data exposure
- Authentication/authorization bypass opportunities
- SQL injection, XSS, or other injection vulnerabilities
- Unsafe deserialization or file handling
- Dependency vulnerabilities with known exploits

**2. Data Integrity & Breaking Changes**
- Operations that could cause data loss or corruption
- API changes without version bump or migration path
- Database schema changes without rollback strategy
- Breaking changes to public interfaces

**3. System Stability Risks**
- Memory leaks or resource exhaustion patterns
- Infinite loops or recursion without bounds
- Unhandled exceptions that could crash the system
- Race conditions in concurrent code

### MAJOR PRIORITIES (Request Changes)

**4. Performance Bottlenecks**
- N+1 query patterns or inefficient database operations
- Algorithmic complexity issues (O(n²) where O(n) possible)
- Missing indexes on frequently queried columns
- Unnecessary network calls or computations

**5. Architecture Violations**
- Breaking established patterns (adapter, factory, dependency injection)
- Violations of single responsibility principle
- Circular dependencies or inappropriate tight coupling
- Missing separation between business logic and infrastructure

**6. Type Safety & Error Handling**
- Usage of `any` type without justification
- Missing null/undefined checks in TypeScript
- Unhandled promise rejections
- Silent failures without proper error propagation

### MINOR PRIORITIES (Comment)

**7. Code Quality & Maintainability**
- Functions exceeding reasonable complexity (>50 lines, high cyclomatic complexity)
- Poor naming that obscures intent
- Missing error handling for edge cases
- Code duplication that should be abstracted

**8. Testing & Documentation**
- Missing tests for new functionality or edge cases
- Tests that don't properly isolate units under test
- Complex logic without explanatory comments
- Missing documentation for non-obvious behavior

### COMMENT QUALITY STANDARDS

**Every issue must include:**
- **Specific Location**: `file_path#L42` reference
- **Clear Problem**: What specifically is wrong and why it matters
- **Concrete Solution**: Working code example showing the fix
- **Business Impact**: Why this matters for system reliability or maintainability
- **Confidence Integration**: Naturally woven into the description

**Issue Format Template:**
```
**Priority<type>**: Brief description

🎯 Located in `file_path#L42`:

Describe the specific problem and why it needs attention.

BEFORE:
[problematic code from diff]

AFTER:
[specific fix with proper syntax]

⚠️ WHY THIS MATTERS: [consequences if not addressed]
```

### REVIEW COMPLETION VERIFICATION

**Before submitting analysis:**
- [ ] All security vulnerabilities identified and documented
- [ ] Performance bottlenecks flagged with specific impact assessment
- [ ] Architecture violations noted with pattern-compliant alternatives
- [ ] Each suggestion includes working code examples
- [ ] Confidence levels justified with technical reasoning
- [ ] Risk assessment reflects highest priority issues found
- [ ] No subjective style preferences without technical justification

**Decision Threshold**: Would I be comfortable deploying this code to production and maintaining it long-term?