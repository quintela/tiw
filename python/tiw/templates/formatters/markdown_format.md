# Code Review by LLM

## Overview

{{overview.Summary}}

{{#if overview.Recommendations}}
### Recommendations
{{#each overview.Recommendations}}
- {{this}}
{{/each}}
{{/if}}

{{#if fileReviews}}
## File Reviews

{{fileReviews}}
{{/if}}

{{#if testReview}}
## Test Review

{{testReview}}
{{/if}}

{{#if generalFeedback}}
## General Feedback

{{generalFeedback}}
{{/if}}

---
Generated using {{metadata.llmProvider}} {{metadata.llmModel}} | Mode: {{metadata.mrMode}} | Platform: {{metadata.gitPlatform}}