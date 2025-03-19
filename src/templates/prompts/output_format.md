Structure your response in JSON format for easier parsing, following this structure:
```json
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
          "severity": "critical|high|medium|low",
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
```
