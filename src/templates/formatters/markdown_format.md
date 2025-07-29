## Code Review Analysis

**{{overview.summary}}**

- **Risk Level**: {{overview.riskLevel}}
- **Recommended Action**: {{overview.recommendedAction}}

## Issues and Concerns

{{#if generalFeedback.concerns.length}}
### Critical Concerns

{{#each generalFeedback.concerns}}
- {{this}}
{{/each}}

{{/if}}
{{#if generalFeedback.suggestions.length}}
### Improvement Recommendations

{{#each generalFeedback.suggestions}}
- {{this}}
{{/each}}

{{/if}}

## File Analysis

{{#if fileReviews.length}}
{{#each fileReviews}}
### `{{file}}`

{{#if comments.length}}
{{#each comments}}
**{{type}} ({{priority}})** | Line {{line}}
{{comment}}

{{#if suggestion}}
```
{{suggestion}}
```

{{/if}}
---

{{/each}}
{{else}}
No specific issues identified in this file.

{{/if}}
{{/each}}
{{else}}
No file-specific issues found.

{{/if}}

## Testing Analysis

**Test Coverage Compliance**: {{testReview.compliance}}

{{#if testReview.missingTests.length}}
### Missing Test Coverage

{{#each testReview.missingTests}}
- {{this}}
{{/each}}

{{/if}}
{{#if testReview.testQualityIssues.length}}
### Test Quality Issues

{{#each testReview.testQualityIssues}}
**{{file}}** (Line {{line}})
- **Issue**: {{issue}}
- **Fix**: {{suggestion}}

{{/each}}
{{/if}}

---
*Review focused on identifying issues and improvements only. No positive feedback provided per configuration.*