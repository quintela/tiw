"""Process and format review feedback."""

import json
import pathlib
from typing import Any, Dict, List, Optional, TypedDict, Union

from ..utils.file_utils import FileUtils


class Overview(TypedDict, total=False):
    """Type definition for overview section of a review."""
    
    Summary: str
    Recommendations: List[str]
    OverallAssessment: Optional[str]


class CodeIssue(TypedDict, total=False):
    """Type definition for a single code issue."""
    
    Line: Optional[int]
    Description: str
    Severity: Optional[str]
    Suggestion: Optional[str]


class FileReview(TypedDict, total=False):
    """Type definition for a single file review."""
    
    Filename: str
    Issues: List[CodeIssue]
    GoodParts: Optional[List[str]]
    Summary: Optional[str]


class ReviewFeedback(TypedDict, total=False):
    """Type definition for the complete review feedback."""
    
    overview: Overview
    fileReviews: List[FileReview]
    testReview: str
    generalFeedback: str


class ReviewData(TypedDict):
    """Type definition for the complete review data."""
    
    metadata: Dict[str, Any]
    feedback: ReviewFeedback


class ReviewFormatter:
    """Process and format reviews from LLM feedback."""
    
    def __init__(self, formatter_template_path: str):
        """Initialize the review formatter.
        
        Args:
            formatter_template_path: Path to the formatter template file
        """
        self.template_path = formatter_template_path
        self.file_utils = FileUtils()
        
        # Load the template
        self.template = self._load_template()
    
    def _load_template(self) -> str:
        """Load the formatter template from a file.
        
        Returns:
            The template content
        """
        try:
            template_path = pathlib.Path(self.template_path)
            return template_path.read_text(encoding="utf-8")
        except Exception as e:
            # If template can't be loaded, use a simple default one
            return """# Code Review

## Overview
{{overview.Summary}}

{{#if overview.Recommendations}}
### Recommendations
{{#each overview.Recommendations}}
- {{this}}
{{/each}}
{{/if}}

## Issues Found
{{#each fileReviews}}
### {{this.Filename}}
{{#each this.Issues}}
- {{this.Description}}{{#if this.Suggestion}} - Suggestion: {{this.Suggestion}}{{/if}}
{{/each}}
{{/each}}

{{#if testReview}}
## Test Review
{{testReview}}
{{/if}}

{{#if generalFeedback}}
## General Feedback
{{generalFeedback}}
{{/if}}
"""
    
    def format(self, review_data: ReviewData) -> str:
        """Format the review using the template.
        
        Args:
            review_data: Review data containing metadata and feedback
            
        Returns:
            Formatted review
        """
        try:
            template = self.template
            feedback_obj = self._ensure_feedback_is_object(review_data["feedback"])
            
            # Simple template replacement for now - could be enhanced with a proper template engine
            formatted_review = self._apply_template(template, feedback_obj, review_data["metadata"])
            
            return formatted_review
        except Exception as e:
            return f"Error formatting review: {str(e)}\n\nRaw feedback:\n{review_data['feedback']}"
    
    def _ensure_feedback_is_object(self, feedback: Union[str, Dict]) -> Dict:
        """Ensure feedback is an object, parsing it if it's a string.
        
        Args:
            feedback: Feedback string or object
            
        Returns:
            Feedback object
        """
        if isinstance(feedback, dict):
            return feedback
        
        try:
            return json.loads(feedback)
        except Exception:
            # If parsing fails, return a simple object with the raw text
            return {
                "overview": {
                    "Summary": "Could not parse feedback as JSON"
                },
                "fileReviews": [],
                "generalFeedback": feedback
            }
    
    def _apply_template(self, template: str, feedback: Dict, metadata: Dict[str, Any]) -> str:
        """Apply the feedback data to the template.
        
        Args:
            template: Template string
            feedback: Feedback object
            metadata: Metadata object
            
        Returns:
            Formatted review
        """
        # Get components from feedback
        overview = feedback.get("overview", {})
        file_reviews = feedback.get("fileReviews", [])
        test_review = feedback.get("testReview", "")
        general_feedback = feedback.get("generalFeedback", "")
        
        # Start with the template
        result = template
        
        # Replace metadata variables
        for key, value in metadata.items():
            result = result.replace(f"{{{{metadata.{key}}}}}", str(value))
        
        # Replace overview variables
        for key, value in overview.items():
            if isinstance(value, list):
                # Handle lists with simple bullet points
                list_replacement = "\n".join([f"- {item}" for item in value])
                result = result.replace(f"{{{{overview.{key}}}}}", list_replacement)
            else:
                result = result.replace(f"{{{{overview.{key}}}}}", str(value) if value is not None else "")
        
        # Replace file reviews section
        file_reviews_replacements = []
        for file_review in file_reviews:
            file_name = file_review.get("Filename", "")
            
            # Format issues for this file
            issues = file_review.get("Issues", [])
            issues_text = []
            
            for issue in issues:
                line_info = f"Line {issue.get('Line')}: " if issue.get('Line') else ""
                severity_info = f"[{issue.get('Severity')}] " if issue.get('Severity') else ""
                description = issue.get('Description', "")
                suggestion = f"\n   Suggestion: {issue.get('Suggestion')}" if issue.get('Suggestion') else ""
                
                issues_text.append(f"- {severity_info}{line_info}{description}{suggestion}")
            
            # Format good parts for this file
            good_parts = file_review.get("GoodParts", [])
            good_parts_text = []
            
            for part in good_parts:
                good_parts_text.append(f"- {part}")
            
            # Combine into file review section
            file_review_text = [f"### {file_name}"]
            
            if file_review.get("Summary"):
                file_review_text.append(file_review.get("Summary", ""))
            
            if issues_text:
                file_review_text.append("#### Issues:")
                file_review_text.extend(issues_text)
            
            if good_parts_text:
                file_review_text.append("#### Good Parts:")
                file_review_text.extend(good_parts_text)
            
            file_reviews_replacements.append("\n".join(file_review_text))
        
        # Replace the file reviews placeholder
        file_reviews_section = "\n\n".join(file_reviews_replacements)
        result = result.replace("{{fileReviews}}", file_reviews_section)
        
        # Replace test review section
        result = result.replace("{{testReview}}", test_review)
        
        # Replace general feedback section
        result = result.replace("{{generalFeedback}}", general_feedback)
        
        # Handle conditional sections
        result = self._process_conditionals(result, feedback)
        
        # Process loop sections
        result = self._process_loops(result, feedback)
        
        return result
    
    def _process_conditionals(self, template: str, feedback: Dict) -> str:
        """Process conditional sections in the template.
        
        Args:
            template: Template with conditionals
            feedback: Feedback data
            
        Returns:
            Template with conditionals processed
        """
        import re
        
        # Process {{#if var}}...{{/if}} sections
        if_pattern = r'{{#if ([^}]+)}}([\s\S]*?){{/if}}'
        
        def replace_if(match):
            var_path = match.group(1).strip()
            content = match.group(2)
            
            # Navigate the feedback object using the var path
            parts = var_path.split('.')
            value = feedback
            
            for part in parts:
                if isinstance(value, dict) and part in value:
                    value = value[part]
                else:
                    value = None
                    break
            
            # Return content if condition is true (value exists and is not empty)
            if value:
                if isinstance(value, list) and not value:
                    return ""
                return content
            
            return ""
        
        # Apply replacements for all if blocks
        result = re.sub(if_pattern, replace_if, template)
        return result
    
    def _process_loops(self, template: str, feedback: Dict) -> str:
        """Process loop sections in the template.
        
        Args:
            template: Template with loops
            feedback: Feedback data
            
        Returns:
            Template with loops processed
        """
        import re
        
        # Process {{#each var}}...{{/each}} sections
        each_pattern = r'{{#each ([^}]+)}}([\s\S]*?){{/each}}'
        
        def replace_each(match):
            var_path = match.group(1).strip()
            content_template = match.group(2)
            
            # Navigate the feedback object using the var path
            parts = var_path.split('.')
            items = feedback
            
            for part in parts:
                if isinstance(items, dict) and part in items:
                    items = items[part]
                else:
                    items = []
                    break
            
            if not isinstance(items, list):
                return ""
            
            result_parts = []
            
            for item in items:
                # Replace {{this}} and {{this.prop}} with item values
                item_content = content_template
                
                # Handle direct {{this}} replacement
                item_content = item_content.replace("{{this}}", str(item) if isinstance(item, (str, int, float, bool)) else "")
                
                # Handle {{this.prop}} replacements
                if isinstance(item, dict):
                    for prop, value in item.items():
                        if isinstance(value, (str, int, float, bool)):
                            item_content = item_content.replace(f"{{{{this.{prop}}}}}", str(value))
                
                result_parts.append(item_content)
            
            return "".join(result_parts)
        
        # Apply replacements for all each blocks
        result = re.sub(each_pattern, replace_each, template)
        return result