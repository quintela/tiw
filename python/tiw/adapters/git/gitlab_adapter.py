"""GitLab API adapter for MR operations."""

import re
from typing import Dict, Optional, Union

import gitlab

from ...config.config import AppConfig
from .git_adapter import GitAdapter


class GitLabAdapter(GitAdapter):
    """Adapter for GitLab API."""
    
    def __init__(self, config: AppConfig):
        """Initialize the GitLab adapter.
        
        Args:
            config: Application configuration
        """
        super().__init__(config)
        
        # Initialize the client
        self.gitlab = self._init_client()
    
    def _init_client(self) -> gitlab.Gitlab:
        """Initialize the GitLab API client.
        
        Returns:
            GitLab client
            
        Raises:
            ValueError: If token is missing
        """
        if not self.config.gitlab_token:
            raise ValueError("GitLab token is required")
        
        return gitlab.Gitlab(self.config.gitlab_url, private_token=self.config.gitlab_token)
    
    def parse_request_url(self, url: str) -> Dict[str, str]:
        """Parse a GitLab MR URL into project ID and MR IID.
        
        Args:
            url: The GitLab MR URL
            
        Returns:
            Dictionary with projectId and mergeRequestIid
            
        Raises:
            ValueError: If URL is invalid
        """
        # GitLab MR URL format: https://gitlab.com/group/project/-/merge_requests/123
        pattern = r'https?://[^/]+/(.+?)/-/merge_requests/(\d+)'
        match = re.match(pattern, url)
        
        if not match:
            # Try alternative format without '-/'
            alt_pattern = r'https?://[^/]+/(.+?)/merge_requests/(\d+)'
            match = re.match(alt_pattern, url)
            
            if not match:
                raise ValueError(f"Invalid GitLab MR URL: {url}")
        
        return {
            "projectId": match.group(1),
            "mergeRequestIid": match.group(2),
        }
    
    async def get_request_diff(self, params: Dict[str, str]) -> str:
        """Get the diff of a GitLab MR.
        
        Args:
            params: Parameters needed to identify the MR (projectId, mergeRequestIid)
            
        Returns:
            The diff content
            
        Raises:
            ValueError: If required parameters are missing
            Exception: If GitLab API request fails
        """
        # Validate required params
        if not all(key in params for key in ["projectId", "mergeRequestIid"]):
            raise ValueError("Missing required parameters: projectId, mergeRequestIid")
        
        try:
            # Get project and merge request
            project = self.gitlab.projects.get(params["projectId"])
            mr = project.mergerequests.get(int(params["mergeRequestIid"]))
            
            # Get the changes
            changes = mr.changes()
            
            # Format as a unified diff
            diff_content = []
            for change in changes.get("changes", []):
                filename = change.get("new_path", change.get("old_path", ""))
                
                if self.config.ignore_lock_files and self._is_lock_file(filename):
                    continue
                
                # Add the diff for this file
                if change.get("diff"):
                    diff_content.append(change["diff"])
            
            return "\n".join(diff_content)
        
        except gitlab.exceptions.GitlabError as e:
            raise Exception(f"GitLab API error: {str(e)}")
        except Exception as e:
            raise Exception(f"Error getting MR diff: {str(e)}")
    
    def _is_lock_file(self, filename: str) -> bool:
        """Check if a file is a lock file.
        
        Args:
            filename: Filename to check
            
        Returns:
            True if it's a lock file
        """
        return filename.endswith(('.lock', 'lock.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'))
    
    async def comment_on_request(self, params: Dict[str, str], comment: str) -> None:
        """Post a comment on a GitLab MR.
        
        Args:
            params: Parameters needed to identify the MR (projectId, mergeRequestIid)
            comment: The comment content
            
        Raises:
            ValueError: If required parameters are missing
            Exception: If GitLab API request fails
        """
        # Validate required params
        if not all(key in params for key in ["projectId", "mergeRequestIid"]):
            raise ValueError("Missing required parameters: projectId, mergeRequestIid")
        
        try:
            # Get project and merge request
            project = self.gitlab.projects.get(params["projectId"])
            mr = project.mergerequests.get(int(params["mergeRequestIid"]))
            
            # Post the comment
            mr.notes.create({"body": comment})
        
        except gitlab.exceptions.GitlabError as e:
            raise Exception(f"GitLab API error: {str(e)}")
        except Exception as e:
            raise Exception(f"Error posting comment: {str(e)}")