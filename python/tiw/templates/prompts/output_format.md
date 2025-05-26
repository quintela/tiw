# Output Format

Structure your review as a valid JSON object with the following format:

```json
{
  "overview": {
    "Summary": "Brief summary of the changes and your overall assessment.",
    "Recommendations": [
      "Top recommendation 1",
      "Top recommendation 2",
      "..."
    ]
  },
  "fileReviews": [
    {
      "Filename": "path/to/file.ext",
      "Summary": "Brief summary of changes to this file.",
      "Issues": [
        {
          "Line": 42,
          "Description": "Description of the issue",
          "Severity": "Critical/Major/Minor",
          "Suggestion": "Suggested fix or improvement"
        }
      ],
      "GoodParts": [
        "Specific positive feedback about what was done well"
      ]
    }
  ],
  "testReview": "Assessment of test coverage, quality, and recommendations for tests.",
  "generalFeedback": "Overall feedback about code quality, architecture, and general suggestions."
}
```

The `Line` field is optional if the issue isn't tied to a specific line. Ensure your JSON is valid.
<!-- OUTRO -->