Please evaluate according to these specific criteria:

1. Code Quality:
   - Assess syntax, formatting, and readability
   - Identify any code smells or anti-patterns
   - Evaluate function/method complexity
   - Check error handling and logging approaches
   - Ensure early returns and guards are used properly
   - Verify consistent error handling patterns

2. Best Practices:
   - Follow language and framework best practices
   - Use proper API design principles (if applicable)
   - Consider security implications carefully
   - Prefer early returns and guard clauses over nested conditions
   - Use proper null/undefined checks
   - Avoid mutations when possible
   - Ensure proper type safety in TypeScript
   - Maintain immutability where appropriate

3. JavaScript/TypeScript Specific Rules:
   - Use === instead of == for equality checks
   - Prefer const over let, avoid var
   - Use optional chaining (?.) and nullish coalescing (??) operators
   - Use array/object destructuring where appropriate
   - Implement proper error handling with try/catch
   - Properly handle async/await with try/catch
   - Use proper TypeScript types rather than any
   - Avoid type assertions unless absolutely necessary
   - Use interface for API definitions and type for complex types
   - Follow strict null checking principles

4. Dependencies:
   - Review changes to package.json
   - Evaluate necessity and security of new dependencies
   - Check for potential version conflicts
   - Ensure dependencies are properly scoped (dependencies vs devDependencies)

5. Performance:
   - Identify potential bottlenecks
   - Database query optimization (if applicable)
   - Assess memory/computational efficiency
   - Check for unnecessary re-renders or computations

6. Test Coverage:
   - Evaluate test quality and coverage
   - Check for missing test cases
   - Assess test maintainability
   - Ensure tests are isolated and not dependent on each other
