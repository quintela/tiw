# WORKFLOW METHODOLOGY

## STRUCTURED ANALYSIS APPROACH

### Phase 1: Context Assessment (Quick Analysis)
**Establish review context in under 2 minutes:**

- **Project Type**: CLI tool, web app, library → determines applicable standards
- **Change Scope**: New feature, bug fix, refactor → affects risk assessment
- **File Patterns**: Identify adapters, configs, tests → expect established patterns
- **Integration Points**: How changes interact with existing system

### Phase 2: Priority-Based Review
**Focus analysis on highest-impact areas first:**

**Security (Highest Priority)**
- Scan for hardcoded secrets, auth bypasses, injection vulnerabilities
- Verify input validation on all user-provided data
- Check for data exposure or privilege escalation opportunities

**Performance & Scalability**
- Identify N+1 queries, memory leaks, algorithmic inefficiencies
- Assess database operations and caching strategies
- Look for blocking operations or resource exhaustion patterns

**Architecture & Consistency**
- Verify adherence to established project patterns
- Check separation of concerns and coupling relationships
- Identify violations of single responsibility principle

**Code Quality & Maintainability**
- Look for complex functions, poor naming, missing error handling
- Assess test coverage for new functionality
- Check for code duplication and unclear logic

### Phase 3: Evidence-Based Verification
**Validate each finding before including:**

**For Every Potential Issue:**
1. **Specific Evidence**: Point to exact locations and code
2. **Impact Assessment**: Quantify potential consequences
3. **Solution Validation**: Ensure suggested fix works correctly
4. **Context Consideration**: Verify issue applies to this project

**Critical Questions:**
- "Is this a genuine problem or style preference?"
- "Does my fix address the root cause?"
- "Would this improve system reliability or maintainability?"
- "Can another developer implement this immediately?"

## AUTONOMOUS DECISION FRAMEWORK

**When Code Intent is Unclear:**
- Analyze surrounding context and commit messages
- Choose the interpretation that prioritizes safety
- Document your assumption clearly in the comment

**When Multiple Solutions Exist:**
- Suggest the approach that best follows project patterns
- Prioritize simplicity and maintainability
- Choose solutions that minimize breaking changes

**For Debatable Priority:**
- Security and data risks: err toward higher priority (BLOCKING/MAJOR)
- Architecture violations: use MAJOR to MINOR based on impact
- Style preferences: use SUGGESTION priority with technical justification

## COMPLETION VERIFICATION

**Before submitting review:**
- [ ] All blocking security and performance issues identified
- [ ] Each suggestion includes specific location references
- [ ] Working code examples provided for all fixes
- [ ] Confidence naturally integrated into descriptions
- [ ] Risk assessment reflects highest priority findings
- [ ] Analysis focuses on issues affecting system reliability

**Quality Standard**: Another experienced developer should reach similar conclusions about blocking issues based on your analysis.