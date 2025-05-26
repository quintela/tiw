"""Main class for performing MR/PR reviews."""

import asyncio
import json
import os
from datetime import datetime
from typing import Any, Dict, Optional, Union

from ..adapters.git import GitAdapterFactory
from ..adapters.git.git_adapter import GitAdapter
from ..adapters.llm import LLMAdapterFactory
from ..adapters.llm.llm_adapter import LLMAdapter
from ..config.config import AppConfig, GitPlatform, MRMode
from ..utils.file_utils import FileUtils
from ..utils.logging import Logger
from .review_formatter import ReviewFormatter


class MRReviewer:
    """Main class for performing MR/PR reviews."""
    
    def __init__(self, config: AppConfig):
        """Create a new MR reviewer.
        
        Args:
            config: The loaded and validated configuration
        """
        self.config = config
        self.logger = Logger(config.verbose)
        self.file_utils = FileUtils(self.logger)
        
        # Create adapters using factories
        llm_factory = LLMAdapterFactory()
        git_factory = GitAdapterFactory()
        
        self.llm_adapter: LLMAdapter = llm_factory.create(config)
        self.git_adapter: GitAdapter = git_factory.create(config)
        
        # Create formatter with the configured template
        self.formatter = ReviewFormatter(config.formatter_template)
        
        # Load prompt template from directory
        self.prompt_template = self.file_utils.load_prompt_from_directory(config.prompt_dir)
    
    async def review(self) -> Optional[str]:
        """Execute the review workflow.
        
        Returns:
            Path to the saved review file
        """
        try:
            # Get the diff
            diff = await self.get_diff()
            if self.config.verbose:
                self.logger.debug(f"</diff start>{diff}</diff end>")
            self.logger.info(f"Retrieved diff ({len(diff)} characters)")
            
            if not diff:
                self.logger.warn("No changes detected, skipping LLM analysis")
                return None
            
            if await self.should_cancel_review(diff):
                return None
            
            feedback = await self.analyze_diff(diff)
            self.logger.info("LLM analysis completed")
            
            metadata = self.create_review_metadata()
            
            review_file_path = self.file_utils.save_review_to_file(
                self.config.reviews_dir,
                feedback,
                metadata
            )
            
            parsed_feedback = self.parse_feedback(feedback)
            formatted_comment = self.formatter.format({
                "metadata": metadata,
                "feedback": parsed_feedback
            })
            
            await self.post_comment(formatted_comment)
            
            self.logger.info("Review completed successfully")
            return review_file_path
        
        except Exception as error:
            self.logger.error(f"Review failed: {str(error)}")
            raise
    
    def create_review_metadata(self) -> Dict[str, str]:
        """Create metadata for the review.
        
        Returns:
            Review metadata object
        """
        return {
            "timestamp": datetime.now().isoformat(),
            "llmProvider": self.config.llm_provider,
            "llmModel": self.get_llm_model_name(),
            "mrMode": self.config.mr_mode,
            "gitPlatform": self.config.git_platform,
            "commandLine": " ".join(os.sys.argv)
        }
    
    async def should_cancel_review(self, diff: str) -> bool:
        """Check if the review should be canceled based on user input.
        
        Args:
            diff: The diff content
            
        Returns:
            True if the review should be canceled
        """
        if not self.config.show_diff:
            return False
        
        self.display_diff(diff)
        
        # If we're not in interactive mode, continue with the review
        if not os.isatty(0):  # 0 is stdin file descriptor
            return False
        
        should_cancel = await self.prompt_for_cancellation()
        if should_cancel:
            self.logger.info("LLM analysis cancelled by user")
            return True
        
        return False
    
    def display_diff(self, diff: str):
        """Display the diff to the user.
        
        Args:
            diff: The diff content
        """
        self.logger.user("\n===== DIFF START =====\n")
        self.logger.user(diff)
        self.logger.user("\n===== DIFF END =====\n")
    
    async def prompt_for_cancellation(self) -> bool:
        """Prompt the user for cancellation.
        
        Returns:
            True if the user wants to cancel
        """
        import sys
        
        self.logger.user("Continue with LLM analysis? (Y/n): ")
        sys.stdout.flush()  # Ensure prompt is displayed
        
        answer = input()
        return answer.lower() == 'n'
    
    def parse_feedback(self, feedback: Union[str, Dict]) -> Dict[str, Any]:
        """Parse the feedback string into a structured object.
        
        Args:
            feedback: The feedback string or object from the LLM
            
        Returns:
            Parsed feedback object
        """
        try:
            parsed_feedback = feedback if isinstance(feedback, dict) else json.loads(feedback)
            
            # Create a new object with default values and merge with parsed feedback
            result = {
                # Default values
                "overview": parsed_feedback.get("overview", {}),
                "fileReviews": parsed_feedback.get("fileReviews", []),
                "testReview": parsed_feedback.get("testReview", ""),
                "generalFeedback": parsed_feedback.get("generalFeedback", ""),
            }
            
            # Copy any other properties
            for key, value in parsed_feedback.items():
                if key not in ["overview", "fileReviews", "testReview", "generalFeedback"]:
                    result[key] = value
            
            return result
        
        except Exception as error:
            self.logger.error(f"Error parsing feedback for formatting: {str(error)}")
            raise ValueError("Could not format review due to JSON parsing error")
    
    async def get_diff(self) -> str:
        """Get MR/PR diff based on the configured mode.
        
        Returns:
            The diff content
        """
        try:
            if self.is_running_in_ci():
                return await self.get_ci_diff()
            
            if self.config.mr_mode == MRMode.URL:
                return await self.get_url_diff()
            
            # Default to local mode
            self.logger.info("Running in local mode, fetching diff from local git")
            return await self.git_adapter.get_local_diff()
        
        except Exception as error:
            self.logger.error(f"Error getting MR/PR diff: {str(error)}")
            raise
    
    def is_running_in_ci(self) -> bool:
        """Check if running in CI mode.
        
        Returns:
            True if running in CI mode
        """
        return (
            self.config.mr_mode == MRMode.CI and 
            os.environ.get('CI_PIPELINE_SOURCE') == 'merge_request_event'
        )
    
    async def get_ci_diff(self) -> str:
        """Get diff for CI mode.
        
        Returns:
            The diff content
        """
        self.logger.info("Running in CI mode, fetching diff from Git platform API")
        
        if self.config.git_platform == GitPlatform.GITLAB:
            return await self.git_adapter.get_request_diff({
                "projectId": self.config.project_id or "",
                "mergeRequestIid": self.config.merge_request_iid or "",
            })
        
        if self.config.git_platform == GitPlatform.GITHUB:
            raise ValueError("GitHub CI mode not fully implemented yet")
        
        raise ValueError("Unsupported Git platform for CI mode")
    
    async def get_url_diff(self) -> str:
        """Get diff for URL mode.
        
        Returns:
            The diff content
        """
        if not self.config.git_mr_url:
            raise ValueError("Git MR/PR URL is required for URL mode")
        
        url = self.config.git_mr_url.lower()
        actual_platform = self.config.git_platform
        
        if self.is_github_url(url):
            if self.config.git_platform != GitPlatform.GITHUB:
                return await self.get_github_diff_with_temp_adapter()
        
        if self.is_gitlab_url(url):
            if self.config.git_platform != GitPlatform.GITLAB:
                return await self.get_gitlab_diff_with_temp_adapter()
        
        self.logger.info(f"Running in URL mode, fetching diff from {actual_platform} API using URL")
        
        # Use the default adapter
        parsed_url = self.git_adapter.parse_request_url(self.config.git_mr_url)
        return await self.git_adapter.get_request_diff(parsed_url)
    
    async def get_github_diff_with_temp_adapter(self) -> str:
        """Get GitHub diff using a temporary adapter.
        
        Returns:
            The diff content
        """
        self.logger.info(
            "URL appears to be GitHub, but platform is set to GitLab. Switching to GitHub adapter."
        )
        
        if not self.config.git_mr_url:
            raise ValueError("Git MR/PR URL is required for GitHub adapter")
        
        git_factory = GitAdapterFactory()
        temp_config = AppConfig(
            **vars(self.config),
            git_platform=GitPlatform.GITHUB
        )
        github_adapter = git_factory.create(temp_config)
        
        parsed_url = github_adapter.parse_request_url(self.config.git_mr_url)
        return await github_adapter.get_request_diff(parsed_url)
    
    async def get_gitlab_diff_with_temp_adapter(self) -> str:
        """Get GitLab diff using a temporary adapter.
        
        Returns:
            The diff content
        """
        self.logger.info(
            "URL appears to be GitLab, but platform is set to GitHub. Switching to GitLab adapter."
        )
        
        if not self.config.git_mr_url:
            raise ValueError("Git MR/PR URL is required for GitLab adapter")
        
        git_factory = GitAdapterFactory()
        temp_config = AppConfig(
            **vars(self.config),
            git_platform=GitPlatform.GITLAB
        )
        gitlab_adapter = git_factory.create(temp_config)
        
        parsed_url = gitlab_adapter.parse_request_url(self.config.git_mr_url)
        diff_result = await gitlab_adapter.get_request_diff(parsed_url)
        
        if self.config.verbose:
            self.logger.debug(f"</diff start>{diff_result}</diff end>")
        
        return diff_result
    
    def is_github_url(self, url: str) -> bool:
        """Check if URL is a GitHub URL.
        
        Args:
            url: URL to check
            
        Returns:
            True if URL is a GitHub URL
        """
        return 'github.com' in url or '/pull/' in url
    
    def is_gitlab_url(self, url: str) -> bool:
        """Check if URL is a GitLab URL.
        
        Args:
            url: URL to check
            
        Returns:
            True if URL is a GitLab URL
        """
        return (
            'gitlab' in url or
            '-/merge_requests/' in url or
            '/merge_requests/' in url
        )
    
    async def analyze_diff(self, diff: str) -> str:
        """Analyze the diff with the configured LLM.
        
        Args:
            diff: The code diff to analyze
            
        Returns:
            The LLM feedback
        """
        try:
            prompt = self.prompt_template.replace('{{diff}}', diff)
            self.logger.info(f"Analyzing diff with {self.config.llm_provider} LLM...")
            
            # Only print the prompt in verbose mode - it can be very large
            if self.config.verbose:
                self.logger.debug(f"Prompt length: {len(prompt)} characters")
            
            return await self.llm_adapter.analyze_code(prompt)
        
        except Exception as error:
            self.logger.error(f"Error analyzing diff with LLM: {str(error)}")
            raise
    
    async def post_comment(self, feedback: str) -> None:
        """Post the review comment on the MR/PR.
        
        Args:
            feedback: The formatted feedback
        """
        try:
            if self.config.mr_mode == MRMode.URL:
                await self.post_comment_for_url_mode(feedback)
                return
            
            if self.is_running_in_ci():
                await self.post_comment_for_ci_mode(feedback)
                return
            
            # Default to local mode - just print the feedback
            self.display_local_mode_comment(feedback)
        
        except Exception as error:
            self.logger.error(f"Error posting comment: {str(error)}")
            raise
    
    async def post_comment_for_url_mode(self, feedback: str) -> None:
        """Post comment for URL mode.
        
        Args:
            feedback: The formatted feedback
        """
        if not self.config.git_mr_url:
            raise ValueError("Git MR/PR URL is required for URL mode")
        
        url = self.config.git_mr_url.lower()
        
        if self.is_github_url(url) and self.config.git_platform != GitPlatform.GITHUB:
            await self.post_comment_with_github_adapter(feedback)
            return
        
        if self.is_gitlab_url(url) and self.config.git_platform != GitPlatform.GITLAB:
            await self.post_comment_with_gitlab_adapter(feedback)
            return
        
        # Use the default adapter
        parsed_url = self.git_adapter.parse_request_url(self.config.git_mr_url)
        await self.git_adapter.comment_on_request(parsed_url, feedback)
    
    async def post_comment_with_github_adapter(self, feedback: str) -> None:
        """Post comment using GitHub adapter.
        
        Args:
            feedback: The formatted feedback
        """
        self.logger.info("URL appears to be GitHub, using GitHub adapter for commenting.")
        
        if not self.config.git_mr_url:
            raise ValueError("Git MR/PR URL is required for GitHub comment")
        
        git_factory = GitAdapterFactory()
        temp_config = AppConfig(
            **vars(self.config),
            git_platform=GitPlatform.GITHUB
        )
        github_adapter = git_factory.create(temp_config)
        
        parsed_url = github_adapter.parse_request_url(self.config.git_mr_url)
        await github_adapter.comment_on_request(parsed_url, feedback)
    
    async def post_comment_with_gitlab_adapter(self, feedback: str) -> None:
        """Post comment using GitLab adapter.
        
        Args:
            feedback: The formatted feedback
        """
        self.logger.info("URL appears to be GitLab, using GitLab adapter for commenting.")
        
        if not self.config.git_mr_url:
            raise ValueError("Git MR/PR URL is required for GitLab comment")
        
        git_factory = GitAdapterFactory()
        temp_config = AppConfig(
            **vars(self.config),
            git_platform=GitPlatform.GITLAB
        )
        gitlab_adapter = git_factory.create(temp_config)
        
        parsed_url = gitlab_adapter.parse_request_url(self.config.git_mr_url)
        await gitlab_adapter.comment_on_request(parsed_url, feedback)
    
    async def post_comment_for_ci_mode(self, feedback: str) -> None:
        """Post comment for CI mode.
        
        Args:
            feedback: The formatted feedback
        """
        if self.config.git_platform == GitPlatform.GITLAB:
            await self.git_adapter.comment_on_request(
                {
                    "projectId": self.config.project_id or "",
                    "mergeRequestIid": self.config.merge_request_iid or "",
                },
                feedback
            )
        elif self.config.git_platform == GitPlatform.GITHUB:
            raise ValueError("GitHub CI mode not fully implemented yet")
    
    def display_local_mode_comment(self, feedback: str) -> None:
        """Display comment for local mode.
        
        Args:
            feedback: The formatted feedback
        """
        self.logger.info("Running in local mode, skipping comment creation")
        self.logger.user("\n===== LLM REVIEW ======\n")
        self.logger.user(feedback)
        self.logger.user("\n=======================\n")
    
    def get_llm_model_name(self) -> str:
        """Get the LLM model name based on the provider.
        
        Returns:
            The model name
        """
        if self.config.llm_provider == "anthropic":
            return self.config.anthropic_model
        elif self.config.llm_provider == "openai":
            return self.config.openai_model
        elif self.config.llm_provider == "deepseek":
            return self.config.deepseek_model
        elif self.config.llm_provider == "copilot":
            return self.config.copilot_model
        else:
            return "unknown"