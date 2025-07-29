/**
 * Default prompt template for code review
 */
export const defaultPrompt = `<!-- INTRO -->
Review this code pull request and provide a detailed analysis focusing on:
1. Logical errors and bugs
2. Security vulnerabilities
3. Performance issues
4. Maintainability concerns

Please evaluate according to these specific criteria:

1. Code Quality:
   - Assess syntax, formatting, and readability
   - Identify any code smells or anti-patterns
   - Evaluate function/method complexity
   - Check error handling and logging approaches

2. Best Practices:
   - Language and framework best practices adherence
   - API design principles (if applicable)
   - Security considerations

3. Dependencies:
   - Review changes to package.json
   - Evaluate necessity and security of new dependencies
   - Check for potential version conflicts

4. Performance:
   - Identify potential bottlenecks
   - Database query optimization (if applicable)
   - Assess memory/computational efficiency

5. Test Coverage:
   - Evaluate test quality and coverage
   - Check for missing test cases
   - Assess test maintainability

IMPORTANT: You MUST respond with ONLY valid JSON. Do not include any markdown formatting, explanations, or text outside the JSON structure. Your entire response must be valid JSON that can be parsed directly.

Use this exact JSON structure:
{
  "overview": {
    "summary": "Brief summary of the PR",
    "riskLevel": "high|medium|low",
    "recommendedAction": "approve|request_changes|comment"
  },
  "fileReviews": [
    {
      "file": "path/to/file.js",
      "comments": [
        {
          "line": 42,
          "type": "issue|suggestion|praise",
          "priority": "blocking|major|minor|suggestion",
          "comment": "Detailed comment about the code",
          "suggestion": "Optional code suggestion"
        }
      ]
    }
  ],
  "testReview": {
    "compliance": "high|medium|low",
    "missingTests": ["List of scenarios missing tests"],
    "testQualityIssues": [
      {
        "file": "path/to/test.js",
        "line": 123,
        "issue": "Description of issue with testing approach",
        "suggestion": "How to fix the testing approach"
      }
    ]
  },
  "generalFeedback": {
    "strengths": ["List of strengths"],
    "concerns": ["List of concerns"],
    "suggestions": ["List of suggestions"]
  }
}

Prioritize feedback on:
1. Security vulnerabilities
2. Performance issues
3. Maintainability concerns
4. Documentation completeness
5. Test quality and coverage

Provide specific feedback with line numbers when possible. If no issues are found in a particular category, explicitly state that.

Remember: Return ONLY the JSON response. No markdown headers, no explanations, no additional text - just the raw JSON object.
<!-- CONTINUATION -->

CODE DIFF:
{{diff}}
<!-- OUTRO -->`;
