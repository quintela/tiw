"""GitHub API adapter for PR operations."""

import re
from typing import Dict, Optional

from github import Github
from github.GithubException import GithubException

from ...config.config import AppConfig
from .git_adapter import GitAdapter


class GitHubAdapter(GitAdapter):
    """Adapter for GitHub API."""
    
    def __init__(self, config: AppConfig):
        """Initialize the GitHub adapter.
        
        Args:
            config: Application configuration
        """
        super().__init__(config)
        
        # Initialize the client
        self.github = self._init_client()
    
    def _init_client(self) -> Github:
        """Initialize the GitHub API client.
        
        Returns:
            GitHub client
            
        Raises:
            ValueError: If token is missing
        """
        if not self.config.github_token:
            raise ValueError("GitHub token is required")
        
        return Github(self.config.github_token)
    
    def parse_request_url(self, url: str) -> Dict[str, str]:
        """Parse a GitHub PR URL into owner, repo, and PR number.
        
        Args:
            url: The GitHub PR URL
            
        Returns:
            Dictionary with owner, repo, and PR number
            
        Raises:
            ValueError: If URL is invalid
        """
        # GitHub PR URL format: https://github.com/owner/repo/pull/123
        pattern = r'https?://github\.com/([^/]+)/([^/]+)/pull/(\d+)'
        match = re.match(pattern, url)
        
        if not match:
            raise ValueError(f"Invalid GitHub PR URL: {url}")
        
        return {
            "owner": match.group(1),
            "repo": match.group(2),
            "pr_number": match.group(3),
        }
    
    async def get_request_diff(self, params: Dict[str, str]) -> str:
        """Get the diff of a GitHub PR.
        
        Args:
            params: Parameters needed to identify the PR (owner, repo, pr_number)
            
        Returns:
            The diff content
            
        Raises:
            ValueError: If required parameters are missing
            Exception: If GitHub API request fails
        """
        # Validate required params
        if not all(key in params for key in ["owner", "repo", "pr_number"]):
            raise ValueError("Missing required parameters: owner, repo, pr_number")
        
        try:
            # Get repository and pull request
            repo = self.github.get_repo(f"{params['owner']}/{params['repo']}")
            pr = repo.get_pull(int(params["pr_number"]))
            
            # Get the diff
            # GitHub API doesn't provide diff directly, so we'll fetch all files changed
            files = pr.get_files()
            
            # Format as a unified diff
            diff_content = []
            for file in files:
                if self.config.ignore_lock_files and self._is_lock_file(file.filename):
                    continue
                
                if file.status == "removed":
                    # File was deleted
                    diff_content.append(f"diff --git a/{file.filename} b/{file.filename}")
                    diff_content.append(f"deleted file mode 100644")
                    diff_content.append(f"--- a/{file.filename}")
                    diff_content.append(f"+++ /dev/null")
                    if file.patch:
                        diff_content.append(file.patch)
                elif file.status == "added":
                    # File was added
                    diff_content.append(f"diff --git a/{file.filename} b/{file.filename}")
                    diff_content.append(f"new file mode 100644")
                    diff_content.append(f"--- /dev/null")
                    diff_content.append(f"+++ b/{file.filename}")
                    if file.patch:
                        diff_content.append(file.patch)
                else:
                    # File was modified
                    diff_content.append(f"diff --git a/{file.filename} b/{file.filename}")
                    diff_content.append(f"--- a/{file.filename}")
                    diff_content.append(f"+++ b/{file.filename}")
                    if file.patch:
                        diff_content.append(file.patch)
            
            return "\n".join(diff_content)
        
        except GithubException as e:
            raise Exception(f"GitHub API error: {e.status} - {e.data.get('message', str(e))}")
        except Exception as e:
            raise Exception(f"Error getting PR diff: {str(e)}")
    
    def _is_lock_file(self, filename: str) -> bool:
        """Check if a file is a lock file.
        
        Args:
            filename: Filename to check
            
        Returns:
            True if it's a lock file
        """
        return filename.endswith(('.lock', 'lock.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'))
    
    async def comment_on_request(self, params: Dict[str, str], comment: str) -> None:
        """Post a comment on a GitHub PR.
        
        Args:
            params: Parameters needed to identify the PR (owner, repo, pr_number)
            comment: The comment content
            
        Raises:
            ValueError: If required parameters are missing
            Exception: If GitHub API request fails
        """
        # Validate required params
        if not all(key in params for key in ["owner", "repo", "pr_number"]):
            raise ValueError("Missing required parameters: owner, repo, pr_number")
        
        try:
            # Get repository and pull request
            repo = self.github.get_repo(f"{params['owner']}/{params['repo']}")
            pr = repo.get_pull(int(params["pr_number"]))
            
            # Post the comment
            pr.create_issue_comment(comment)
        
        except GithubException as e:
            raise Exception(f"GitHub API error: {e.status} - {e.data.get('message', str(e))}")
        except Exception as e:
            raise Exception(f"Error posting comment: {str(e)}")