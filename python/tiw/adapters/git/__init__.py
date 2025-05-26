"""Git adapters package."""

from typing import Dict, Type

from ...config.config import AppConfig, GitPlatform
from .git_adapter import GitAdapter
from .github_adapter import GitHubAdapter
from .gitlab_adapter import GitLabAdapter


class GitAdapterFactory:
    """Factory for creating Git adapters."""
    
    def __init__(self):
        """Initialize the factory."""
        # Registry of adapter classes
        self.adapters: Dict[str, Type[GitAdapter]] = {
            GitPlatform.GITHUB: GitHubAdapter,
            GitPlatform.GITLAB: GitLabAdapter,
            # Add more adapters here as they're implemented
        }
    
    def create(self, config: AppConfig) -> GitAdapter:
        """Create an adapter instance based on configuration.
        
        Args:
            config: Application configuration
            
        Returns:
            Instantiated adapter
            
        Raises:
            ValueError: If platform is not supported
        """
        platform = config.git_platform
        
        if platform not in self.adapters:
            raise ValueError(f"Unsupported Git platform: {platform}")
        
        adapter_class = self.adapters[platform]
        return adapter_class(config)