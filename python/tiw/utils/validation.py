"""Validation utilities for the tiw tool."""

import re
from typing import List, Optional, Tuple, Union

from ..config.config import LLMProvider, GitPlatform, MRMode


def validate_llm_provider(provider: str) -> Optional[LLMProvider]:
    """Validate the LLM provider.
    
    Args:
        provider: Provider name to validate
        
    Returns:
        Valid LLMProvider enum value or None if invalid
    """
    valid_providers = [p.value for p in LLMProvider]
    
    if provider.lower() in [p.lower() for p in valid_providers]:
        # Find the case-sensitive match
        for p in valid_providers:
            if p.lower() == provider.lower():
                return LLMProvider(p)
    
    return None


def validate_git_platform(platform: str) -> Optional[GitPlatform]:
    """Validate the Git platform.
    
    Args:
        platform: Platform name to validate
        
    Returns:
        Valid GitPlatform enum value or None if invalid
    """
    valid_platforms = [p.value for p in GitPlatform]
    
    if platform.lower() in [p.lower() for p in valid_platforms]:
        # Find the case-sensitive match
        for p in valid_platforms:
            if p.lower() == platform.lower():
                return GitPlatform(p)
    
    return None


def validate_mr_mode(mode: str) -> Optional[MRMode]:
    """Validate the MR mode.
    
    Args:
        mode: Mode name to validate
        
    Returns:
        Valid MRMode enum value or None if invalid
    """
    valid_modes = [m.value for m in MRMode]
    
    if mode.lower() in [m.lower() for m in valid_modes]:
        # Find the case-sensitive match
        for m in valid_modes:
            if m.lower() == mode.lower():
                return MRMode(m)
    
    return None


def validate_mr_url(url: str) -> Tuple[bool, Optional[GitPlatform], str]:
    """Validate a merge/pull request URL.
    
    Args:
        url: URL to validate
        
    Returns:
        Tuple of (is_valid, platform_type, error_message)
    """
    if not url:
        return False, None, "URL cannot be empty"
    
    # Check for GitLab MR URL
    gitlab_pattern = r'https?://([^/]+)/([^/]+/[^/]+)/-/merge_requests/(\d+)'
    gitlab_match = re.match(gitlab_pattern, url)
    
    if gitlab_match:
        return True, GitPlatform.GITLAB, ""
    
    # Check for GitHub PR URL
    github_pattern = r'https?://github\.com/([^/]+)/([^/]+)/pull/(\d+)'
    github_match = re.match(github_pattern, url)
    
    if github_match:
        return True, GitPlatform.GITHUB, ""
    
    return False, None, "Invalid merge/pull request URL format"


def validate_token(token: Optional[str]) -> Tuple[bool, str]:
    """Validate an API token.
    
    Args:
        token: Token to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not token:
        return False, "Token cannot be empty"
    
    if len(token) < 8:
        return False, "Token is too short"
    
    return True, ""


def validate_directory_path(path: str) -> Tuple[bool, str]:
    """Validate a directory path.
    
    Args:
        path: Path to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not path:
        return False, "Path cannot be empty"
    
    # Simple validation - could be extended with more checks
    return True, ""


def validate_boolean(value: Union[str, bool]) -> Optional[bool]:
    """Validate and convert a boolean value.
    
    Args:
        value: Value to validate
        
    Returns:
        Validated boolean value or None if invalid
    """
    if isinstance(value, bool):
        return value
    
    if isinstance(value, str):
        if value.lower() in ('true', 'yes', 'y', '1'):
            return True
        if value.lower() in ('false', 'no', 'n', '0'):
            return False
    
    return None


def validate_integer(value: Union[str, int], min_value: Optional[int] = None, 
                     max_value: Optional[int] = None) -> Optional[int]:
    """Validate and convert an integer value.
    
    Args:
        value: Value to validate
        min_value: Optional minimum value
        max_value: Optional maximum value
        
    Returns:
        Validated integer value or None if invalid
    """
    try:
        if isinstance(value, str):
            value = int(value)
        
        if not isinstance(value, int):
            return None
        
        if min_value is not None and value < min_value:
            return None
        
        if max_value is not None and value > max_value:
            return None
        
        return value
    except (ValueError, TypeError):
        return None


def validate_prompt_sections(sections: List[str]) -> Tuple[bool, str]:
    """Validate the required prompt sections.
    
    Args:
        sections: List of section filenames
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    required_sections = [
        "output_format.md",
        "diff.md"
    ]
    
    missing_sections = [section for section in required_sections if section not in sections]
    
    if missing_sections:
        return False, f"Missing required prompt sections: {', '.join(missing_sections)}"
    
    return True, ""