# CORE QUALITY CRITERIA

## BLOCKING VIOLATIONS (Block Deployment)

**Security Risks:**
- Hardcoded credentials, API keys, or sensitive data exposure
- Missing input validation leading to injection vulnerabilities
- Authentication/authorization bypass opportunities
- Unsafe deserialization or file handling

**Type Safety & Error Handling:**
- Usage of `any` type without explicit justification
- Unhandled promise rejections or missing error handling
- Breaking API changes without version bump

**System Stability:**
- Memory leaks from unclosed resources or event listeners
- Infinite loops or recursion without bounds

## MAJOR PRIORITY VIOLATIONS (Request Changes)

**Performance & Scalability:**
- N+1 query patterns or inefficient database operations
- Algorithmic complexity issues (O(n²) where O(n) possible)
- Synchronous file operations in Node.js

**Architecture & Patterns:**
- Violations of established project patterns (adapter, factory, DI)
- Circular dependencies or inappropriate tight coupling
- Mixing business logic with infrastructure concerns

**Modern JavaScript/TypeScript:**
- Use of `==` instead of `===` for equality
- `var` declarations (use `const`/`let`)
- Missing null/undefined checks with optional chaining

## MINOR PRIORITY (Comments)

**Code Quality:**
- Functions exceeding 50 lines or high cyclomatic complexity
- Poor naming that obscures intent
- Code duplication that should be abstracted

**Testing & Documentation:**
- Missing tests for new functionality or edge cases
- Complex logic without explanatory comments

## CODE PATTERN EXAMPLES

**Guard Clauses (Preferred Pattern):**
```typescript
// ✅ GOOD: Early returns
function processUser(user: User | null): string {
  if (!user) return 'No user provided';
  if (!user.email) return 'Email required';
  if (!user.isActive) return 'User inactive';
  
  return `Processing ${user.email}`;
}

// ❌ BAD: Nested conditions
function processUser(user: User | null): string {
  if (user) {
    if (user.email) {
      if (user.isActive) {
        return `Processing ${user.email}`;
      }
    }
  }
  return 'Invalid user';
}
```

**Input Validation & Error Handling:**
```typescript
// ✅ GOOD: Comprehensive validation
function calculateDiscount(price: number, discountPercent?: number): number {
  if (typeof price !== 'number' || price < 0) {
    throw new Error('Price must be a non-negative number');
  }
  
  const discount = discountPercent ?? 0;
  if (discount < 0 || discount > 100) {
    throw new Error('Discount must be between 0 and 100');
  }
  
  return price * (1 - discount / 100);
}

// ❌ BAD: No validation
function calculateDiscount(price: number, discountPercent?: number): number {
  return price * (1 - (discountPercent || 0) / 100);
}
```

**Async Error Handling:**
```typescript
// ✅ GOOD: Proper error handling
async function fetchUserData(id: string): Promise<User | null> {
  try {
    if (!id?.trim()) {
      throw new Error('User ID is required');
    }
    
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch user: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching user:', error);
    return null; // Graceful degradation
  }
}

// ❌ BAD: No error handling
async function fetchUserData(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}
```

## ANALYSIS FOCUS AREAS

**Security Assessment:**
- "What could an attacker exploit here?"
- "Are all inputs validated and sanitized?"
- "Could this leak sensitive information?"

**Performance Analysis:**
- "Will this scale to 10x the current load?"
- "Are there unnecessary computations or network calls?"
- "Could this cause memory leaks or blocking operations?"

**Architecture Review:**
- "Does this follow established patterns in the codebase?"
- "Is this component/function doing too many things?"
- "Would a new developer understand this code?"

## COMMENT REQUIREMENTS

**Every issue must include:**
- Specific location reference using `file_path#L42` format
- Clear problem description with business impact
- Working code example showing the fix
- Confidence naturally integrated into description

**Use this format:**
```
**Priority<type>**: Brief description

🎯 Located in `file_path#L42`:

Explain the specific issue and why it requires attention.

BEFORE:
[problematic code from diff]

AFTER:
[specific fix with proper syntax]

⚠️ WHY THIS MATTERS: [consequences if not addressed]
```