## Overview

**{{overview.summary}}**

- **Risk Level**: {{overview.riskLevel}}
- **Recommended Action**: {{overview.recommendedAction}}

## General Feedback

{{#if generalFeedback.strengths.length}}
### Strengths

{{#each generalFeedback.strengths}}
- {{this}}
{{/each}}

{{/if}}
{{#if generalFeedback.concerns.length}}
### Concerns

{{#each generalFeedback.concerns}}
- {{this}}
{{/each}}

{{/if}}
{{#if generalFeedback.suggestions.length}}
### Suggestions

{{#each generalFeedback.suggestions}}
- {{this}}
{{/each}}

{{/if}}
## File Reviews

{{#if fileReviews.length}}
{{#each fileReviews}}
### {{file}}

{{#if comments.length}}
{{#each comments}}
**Line {{line}}**
{{type}}({{severity}}): {{comment}}

{{#if suggestion}}
```suggestion
{{suggestion}}
```

{{else}}

{{/if}}
{{/each}}
{{else}}
No specific issues found in this file.

{{/if}}
{{/each}}
{{else}}
No file-specific issues found.

{{/if}}
## Test Review

- **Compliance**: {{testReview.compliance}}

{{#if testReview.missingTests.length}}
### Missing Tests

{{#each testReview.missingTests}}
- {{this}}
{{/each}}

{{/if}}
{{#if testReview.testQualityIssues.length}}
### Test Quality Issues

{{#each testReview.testQualityIssues}}
**{{file}} (Line {{line}})**
Issue: {{issue}}
Suggestion: {{suggestion}}

{{/each}}
{{/if}}
