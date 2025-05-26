"""Git platform detection utilities."""

import re
import subprocess
from typing import Dict, Optional, Any

from .logging import Logger


class GitDetector:
    """Utility class for detecting Git platform properties."""
    
    def __init__(self, logger: Logger):
        """Initialize GitDetector.
        
        Args:
            logger: Logger instance for logging messages
        """
        self.logger = logger
    
    async def detect_git_platform(self) -> Optional[Dict[str, Any]]:
        """Detect Git platform from local repository.
        
        Returns:
            Dictionary with platform information or None if not detected
        """
        # First check if we're in a Git repository
        if not self._is_git_repo():
            self.logger.warn("Not a Git repository")
            return None
        
        # Get remote URL
        remote_url = self._get_remote_url()
        if not remote_url:
            self.logger.warn("No remote URL found")
            return None
        
        # Check for GitHub repository
        github_info = self._parse_github_url(remote_url)
        if github_info:
            return {
                "platform": "github",
                **github_info
            }
        
        # Check for GitLab repository
        gitlab_info = self._parse_gitlab_url(remote_url)
        if gitlab_info:
            return {
                "platform": "gitlab",
                **gitlab_info
            }
        
        # Couldn't identify the platform
        self.logger.warn(f"Unknown Git platform URL: {remote_url}")
        return None
    
    def _is_git_repo(self) -> bool:
        """Check if the current directory is a Git repository.
        
        Returns:
            True if it's a Git repository, False otherwise
        """
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--is-inside-work-tree"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=False
            )
            return result.returncode == 0 and result.stdout.strip() == "true"
        except Exception as e:
            self.logger.debug(f"Error checking Git repository: {str(e)}")
            return False
    
    def _get_remote_url(self) -> Optional[str]:
        """Get the remote URL of the repository.
        
        Returns:
            Remote URL or None if not found
        """
        try:
            result = subprocess.run(
                ["git", "remote", "get-url", "origin"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=False
            )
            if result.returncode == 0 and result.stdout:
                return result.stdout.strip()
            return None
        except Exception as e:
            self.logger.debug(f"Error getting remote URL: {str(e)}")
            return None
    
    def _parse_github_url(self, url: str) -> Optional[Dict[str, str]]:
        """Parse a GitHub repository URL.
        
        Args:
            url: Git remote URL
            
        Returns:
            Dictionary with GitHub repository information or None if not a GitHub URL
        """
        # HTTPS URL format: https://github.com/owner/repo.git
        https_match = re.match(r'https?://github\.com/([^/]+)/([^/\.]+)(?:\.git)?/?$', url)
        if https_match:
            return {
                "owner": https_match.group(1),
                "repo": https_match.group(2)
            }
        
        # SSH URL format: git@github.com:owner/repo.git
        ssh_match = re.match(r'git@github\.com:([^/]+)/([^/\.]+)(?:\.git)?/?$', url)
        if ssh_match:
            return {
                "owner": ssh_match.group(1),
                "repo": ssh_match.group(2)
            }
        
        return None
    
    def _parse_gitlab_url(self, url: str) -> Optional[Dict[str, str]]:
        """Parse a GitLab repository URL.
        
        Args:
            url: Git remote URL
            
        Returns:
            Dictionary with GitLab repository information or None if not a GitLab URL
        """
        # Get hostname from URL
        hostname = None
        project_path = None
        
        # HTTPS URL format: https://gitlab.com/group/project.git
        https_match = re.match(r'https?://([^/]+)/(.+?)(?:\.git)?/?$', url)
        if https_match:
            hostname = https_match.group(1)
            project_path = https_match.group(2)
        
        # SSH URL format: git@gitlab.com:group/project.git
        ssh_match = re.match(r'git@([^:]+):(.+?)(?:\.git)?/?$', url)
        if ssh_match:
            hostname = ssh_match.group(1)
            project_path = ssh_match.group(2)
        
        # Check if it's a GitLab URL
        if hostname and ('gitlab' in hostname or self._is_gitlab_instance(hostname)):
            gitlab_url = f"https://{hostname}"
            return {
                "url": gitlab_url,
                "project_path": project_path
            }
        
        return None
    
    def _is_gitlab_instance(self, hostname: str) -> bool:
        """Check if the hostname is a GitLab instance.
        
        Args:
            hostname: Hostname to check
            
        Returns:
            True if it's a GitLab instance, False otherwise
        """
        # This is a simplistic check, could be improved with API validation
        try:
            result = subprocess.run(
                ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", f"https://{hostname}/api/v4/version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=False
            )
            return result.returncode == 0 and result.stdout.strip() in ("200", "401", "403")
        except Exception:
            return False