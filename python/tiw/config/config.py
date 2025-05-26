"""Configuration management for the tiw tool."""

import os
import pathlib
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Dict, List, Optional, Union

import dotenv

from ..utils.git_detector import GitDetector
from ..utils.logging import Logger

# Load environment variables from .env file if it exists
dotenv.load_dotenv()


class LLMProvider(str, Enum):
    """Supported LLM providers."""
    
    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    DEEPSEEK = "deepseek"
    COPILOT = "copilot"


class GitPlatform(str, Enum):
    """Supported Git platforms."""
    
    GITLAB = "gitlab"
    GITHUB = "github"


class MRMode(str, Enum):
    """Supported MR/PR review modes."""
    
    CI = "ci"
    LOCAL = "local"
    URL = "url"


@dataclass
class RequiredVar:
    """Required variable for configuration validation."""
    
    key: str
    name: str


@dataclass
class AppConfig:
    """Application configuration."""
    
    # LLM provider configuration
    llm_provider: LLMProvider = LLMProvider.ANTHROPIC
    anthropic_model: str = "claude-3-7-sonnet-20250219"
    openai_model: str = "gpt-4"
    deepseek_model: str = "deepseek-coder"
    copilot_model: str = "gpt-4"
    anthropic_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    deepseek_api_key: Optional[str] = None
    copilot_api_key: Optional[str] = None
    
    # Token limits
    max_prompt_tokens: int = 100000
    anthropic_max_tokens: int = 190000
    openai_max_tokens: int = 128000
    deepseek_max_tokens: int = 128000
    copilot_max_tokens: int = 128000
    
    # Git platform configuration
    git_platform: GitPlatform = GitPlatform.GITLAB
    gitlab_url: str = "https://gitlab.com"
    gitlab_token: Optional[str] = None
    github_token: Optional[str] = None
    
    # MR/PR identifiers
    project_id: Optional[str] = None
    merge_request_iid: Optional[str] = None
    
    # Mode and URL
    mr_mode: MRMode = MRMode.LOCAL
    git_mr_url: Optional[str] = None
    
    # UI/Output options
    show_diff: bool = False
    verbose: bool = False
    
    # Lock files
    ignore_lock_files: bool = True
    
    # Paths
    reviews_dir: str = str(pathlib.Path.cwd() / "reviews")
    prompt_dir: str = str(pathlib.Path(__file__).parent.parent / "templates" / "prompts")
    formatter_template: str = str(pathlib.Path(__file__).parent.parent / "templates" / "formatters" / "markdown_format.md")
    
    # Additional properties
    extras: Dict[str, Any] = field(default_factory=dict)
    
    def __getitem__(self, key: str) -> Any:
        """Get configuration property by key.
        
        Args:
            key: Configuration property key
        
        Returns:
            Configuration property value
        """
        if hasattr(self, key):
            return getattr(self, key)
        return self.extras.get(key)
    
    def __setitem__(self, key: str, value: Any):
        """Set configuration property by key.
        
        Args:
            key: Configuration property key
            value: Configuration property value
        """
        if hasattr(self, key):
            setattr(self, key, value)
        else:
            self.extras[key] = value


class Config:
    """Configuration manager for the MR reviewer.
    
    Handles loading configs from environment variables, files, and CLI args.
    """
    
    _instance = None  # Singleton instance
    
    @classmethod
    def get_instance(cls, options: Dict[str, Any] = None) -> 'Config':
        """Get singleton instance of Config.
        
        Args:
            options: Configuration options from CLI or calling code
            
        Returns:
            The Config instance
        """
        if cls._instance is None:
            cls._instance = Config(options or {})
        return cls._instance
    
    def __init__(self, options: Dict[str, Any] = None):
        """Create a new configuration instance.
        
        Args:
            options: Configuration options from CLI or calling code
        """
        self.logger = Logger()
        self.git_detector = GitDetector(self.logger)
        self.options = options or {}
        self.defaults = self._create_default_config()
        self.config = None  # Will be set after loading
    
    def _create_default_config(self) -> AppConfig:
        """Create default configuration from environment variables.
        
        Returns:
            Default configuration
        """
        # Helper to get environment variables
        def get_env(name: str, default: Any = None) -> Any:
            return os.environ.get(name, default)
        
        def get_env_bool(name: str, default: bool = False) -> bool:
            value = os.environ.get(name)
            if value is None:
                return default
            return value.lower() in ('true', 'yes', '1', 'y')
        
        def get_env_int(name: str, default: int = 0) -> int:
            value = os.environ.get(name)
            if not value:
                return default
            try:
                return int(value)
            except ValueError:
                return default
        
        # Create default configuration with environment variables
        return AppConfig(
            # LLM provider configuration
            llm_provider=get_env('LLM_PROVIDER', LLMProvider.ANTHROPIC),
            anthropic_model=get_env('ANTHROPIC_MODEL', 'claude-3-7-sonnet-20250219'),
            openai_model=get_env('OPENAI_MODEL', 'gpt-4'),
            deepseek_model=get_env('DEEPSEEK_MODEL', 'deepseek-coder'),
            copilot_model=get_env('COPILOT_MODEL', 'gpt-4'),
            anthropic_api_key=get_env('ANTHROPIC_API_KEY'),
            openai_api_key=get_env('OPENAI_API_KEY'),
            deepseek_api_key=get_env('DEEPSEEK_API_KEY'),
            copilot_api_key=get_env('COPILOT_API_KEY'),
            
            # Token limits
            max_prompt_tokens=get_env_int('MAX_PROMPT_TOKENS', 100000),
            anthropic_max_tokens=get_env_int('ANTHROPIC_MAX_TOKENS', 190000),
            openai_max_tokens=get_env_int('OPENAI_MAX_TOKENS', 128000),
            deepseek_max_tokens=get_env_int('DEEPSEEK_MAX_TOKENS', 128000),
            copilot_max_tokens=get_env_int('COPILOT_MAX_TOKENS', 128000),
            
            # Git platform configuration
            git_platform=get_env('GIT_PLATFORM', GitPlatform.GITLAB),
            gitlab_url=get_env('GITLAB_URL', 'https://gitlab.com'),
            gitlab_token=get_env('GITLAB_TOKEN'),
            github_token=get_env('GITHUB_TOKEN'),
            
            # MR/PR identifiers
            project_id=get_env('CI_PROJECT_ID'),
            merge_request_iid=get_env('CI_MERGE_REQUEST_IID'),
            
            # Mode: default to local
            mr_mode=MRMode.LOCAL,
            
            # UI/Output options
            verbose=get_env_bool('VERBOSE'),
            
            # Lock files
            ignore_lock_files=not get_env_bool('IGNORE_LOCK_FILES', False),
        )
    
    def _merge_with_env_and_options(self, config: AppConfig, options: Dict[str, Any]) -> AppConfig:
        """Merge environment variables and command line options.
        
        Environment variables take precedence.
        
        Args:
            config: Base configuration
            options: Command line options
            
        Returns:
            Merged configuration
        """
        # Helper to get environment variables
        def get_env(name: str, default: Any = None) -> Any:
            return os.environ.get(name, default)
        
        def get_env_bool(name: str, default_value: Optional[bool] = None) -> Optional[bool]:
            value = os.environ.get(name)
            if value is None:
                return default_value
            return value.lower() in ('true', 'yes', '1', 'y')
        
        def get_env_int(name: str, default_value: Optional[int] = None) -> Optional[int]:
            value = os.environ.get(name)
            if not value:
                return default_value
            try:
                return int(value)
            except ValueError:
                return default_value
        
        # Define default token limits
        DEFAULT_TOKENS = {
            'max_prompt': 100000,
            'anthropic': 190000,
            'openai': 128000,
            'deepseek': 128000,
            'copilot': 128000,
        }
        
        # First, apply options from command line
        result = AppConfig(
            # LLM provider configuration
            llm_provider=options.get('llm_provider', config.llm_provider),
            anthropic_model=options.get('anthropic_model', config.anthropic_model),
            openai_model=options.get('openai_model', config.openai_model),
            deepseek_model=options.get('deepseek_model', config.deepseek_model),
            copilot_model=options.get('copilot_model', config.copilot_model),
            anthropic_api_key=options.get('anthropic_api_key', config.anthropic_api_key),
            openai_api_key=options.get('openai_api_key', config.openai_api_key),
            deepseek_api_key=options.get('deepseek_api_key', config.deepseek_api_key),
            copilot_api_key=options.get('copilot_api_key', config.copilot_api_key),
            
            # Token limits
            max_prompt_tokens=options.get('max_prompt_tokens', config.max_prompt_tokens),
            anthropic_max_tokens=options.get('anthropic_max_tokens', config.anthropic_max_tokens),
            openai_max_tokens=options.get('openai_max_tokens', config.openai_max_tokens),
            deepseek_max_tokens=options.get('deepseek_max_tokens', config.deepseek_max_tokens),
            copilot_max_tokens=options.get('copilot_max_tokens', config.copilot_max_tokens),
            
            # Git platform configuration
            git_platform=options.get('git_platform', config.git_platform),
            gitlab_url=options.get('gitlab_url', config.gitlab_url),
            gitlab_token=options.get('gitlab_token', config.gitlab_token),
            github_token=options.get('github_token', config.github_token),
            
            # MR/PR identifiers
            project_id=options.get('project_id', config.project_id),
            merge_request_iid=options.get('merge_request_iid', config.merge_request_iid),
            
            # Mode and URL
            mr_mode=options.get('mr_mode', config.mr_mode),
            git_mr_url=options.get('git_mr_url', config.git_mr_url),
            
            # UI/Output options
            show_diff=options.get('show_diff', config.show_diff),
            verbose=options.get('verbose', config.verbose),
            
            # Lock files
            ignore_lock_files=options.get('ignore_lock_files', config.ignore_lock_files),
            
            # Paths
            reviews_dir=options.get('reviews_dir', config.reviews_dir),
            prompt_dir=options.get('prompt_dir', config.prompt_dir),
            formatter_template=options.get('formatter_template', config.formatter_template),
        )
        
        # Then, override with environment variables
        # This ensures env vars take precedence over both defaults and CLI options
        
        # LLM provider configuration
        llm_provider_env = get_env('LLM_PROVIDER')
        if llm_provider_env:
            result.llm_provider = llm_provider_env
            
        result.anthropic_model = get_env('ANTHROPIC_MODEL', result.anthropic_model)
        result.openai_model = get_env('OPENAI_MODEL', result.openai_model)
        result.deepseek_model = get_env('DEEPSEEK_MODEL', result.deepseek_model)
        result.copilot_model = get_env('COPILOT_MODEL', result.copilot_model)
        
        result.anthropic_api_key = get_env('ANTHROPIC_API_KEY', result.anthropic_api_key)
        result.openai_api_key = get_env('OPENAI_API_KEY', result.openai_api_key)
        result.deepseek_api_key = get_env('DEEPSEEK_API_KEY', result.deepseek_api_key)
        result.copilot_api_key = get_env('COPILOT_API_KEY', result.copilot_api_key)
        
        # Token limits with proper defaults
        result.max_prompt_tokens = get_env_int('MAX_PROMPT_TOKENS', result.max_prompt_tokens or DEFAULT_TOKENS['max_prompt'])
        result.anthropic_max_tokens = get_env_int('ANTHROPIC_MAX_TOKENS', result.anthropic_max_tokens or DEFAULT_TOKENS['anthropic'])
        result.openai_max_tokens = get_env_int('OPENAI_MAX_TOKENS', result.openai_max_tokens or DEFAULT_TOKENS['openai'])
        result.deepseek_max_tokens = get_env_int('DEEPSEEK_MAX_TOKENS', result.deepseek_max_tokens or DEFAULT_TOKENS['deepseek'])
        result.copilot_max_tokens = get_env_int('COPILOT_MAX_TOKENS', result.copilot_max_tokens or DEFAULT_TOKENS['copilot'])
        
        # Git platform configuration
        git_platform_env = get_env('GIT_PLATFORM')
        if git_platform_env:
            result.git_platform = git_platform_env
            
        result.gitlab_url = get_env('GITLAB_URL', result.gitlab_url)
        
        # MR/PR identifiers
        result.project_id = get_env('CI_PROJECT_ID', result.project_id)
        result.merge_request_iid = get_env('CI_MERGE_REQUEST_IID', result.merge_request_iid)
        
        # Tokens
        result.gitlab_token = get_env('GITLAB_TOKEN', result.gitlab_token)
        result.github_token = get_env('GITHUB_TOKEN', result.github_token)
        
        # UI/Output options
        verbose_env = get_env_bool('VERBOSE')
        if verbose_env is not None:
            result.verbose = verbose_env
            
        # Lock files
        ignore_lock_env = get_env('IGNORE_LOCK_FILES')
        if ignore_lock_env is not None:
            result.ignore_lock_files = ignore_lock_env.lower() != 'false'
        
        return result
    
    def _map_model_to_provider(self, config: AppConfig) -> AppConfig:
        """Map model option to specific provider model property.
        
        Args:
            config: Current configuration
            
        Returns:
            Updated configuration with model mapped to provider-specific property
        """
        # Check if model was specified by the user and map it to the right provider's model
        if 'model' in self.options and self.options['model']:
            model = self.options['model']
            if config.llm_provider == LLMProvider.ANTHROPIC:
                config.anthropic_model = model
            elif config.llm_provider == LLMProvider.OPENAI:
                config.openai_model = model
            elif config.llm_provider == LLMProvider.DEEPSEEK:
                config.deepseek_model = model
            elif config.llm_provider == LLMProvider.COPILOT:
                config.copilot_model = model
        
        return config
    
    def _resolve_template_paths(self, config: AppConfig) -> AppConfig:
        """Resolve paths for templates and reviews directory.
        
        Args:
            config: Current configuration
            
        Returns:
            Updated configuration with resolved paths
        """
        updated_config = config
        
        # If templates directory provided but no specific formatter template
        if 'templates' in self.options and not self.options.get('formatter_template'):
            templates_dir = self.options['templates']
            updated_config.formatter_template = str(pathlib.Path(templates_dir) / 'formatter.txt')
            updated_config.prompt_dir = templates_dir
        
        return updated_config
    
    async def load(self) -> AppConfig:
        """Load and validate configuration.
        
        Returns:
            The complete configuration
        """
        # Auto-detect git platform if not specified in options or env
        if not self.options.get('git_platform') and not os.environ.get('GIT_PLATFORM'):
            await self._auto_detect_git_platform()
        
        # Merge defaults with options and environment variables
        # Environment variables take precedence
        merged_config = self._merge_with_env_and_options(self.defaults, self.options)
        
        # Map model to provider-specific model property
        merged_config = self._map_model_to_provider(merged_config)
        
        # Resolve paths for templates
        merged_config = self._resolve_template_paths(merged_config)
        
        self.config = merged_config
        return self.config
    
    def _get_llm_required_vars(self, provider: LLMProvider) -> List[RequiredVar]:
        """Get required variables for specific LLM provider.
        
        Args:
            provider: LLM provider
            
        Returns:
            List of required variables
        """
        if provider == LLMProvider.ANTHROPIC:
            return [RequiredVar(key="anthropic_api_key", name="Anthropic API Key")]
        elif provider == LLMProvider.OPENAI:
            return [RequiredVar(key="openai_api_key", name="OpenAI API Key")]
        elif provider == LLMProvider.DEEPSEEK:
            return [RequiredVar(key="deepseek_api_key", name="DeepSeek API Key")]
        elif provider == LLMProvider.COPILOT:
            return [RequiredVar(key="copilot_api_key", name="Copilot API Key")]
        else:
            raise ValueError(f"Unsupported LLM provider: {provider}")
    
    def _get_ci_required_vars(self, platform: GitPlatform) -> List[RequiredVar]:
        """Get required variables for CI mode.
        
        Args:
            platform: Git platform
            
        Returns:
            List of required variables
        """
        if platform == GitPlatform.GITLAB:
            return [
                RequiredVar(key="gitlab_token", name="GitLab Token"),
                RequiredVar(key="project_id", name="CI_PROJECT_ID"),
                RequiredVar(key="merge_request_iid", name="CI_MERGE_REQUEST_IID"),
            ]
        elif platform == GitPlatform.GITHUB:
            return [
                RequiredVar(key="github_token", name="GitHub Token"),
                # Add GitHub-specific fields
            ]
        else:
            raise ValueError(f"Unsupported Git platform: {platform}")
    
    def _get_url_required_vars(self, platform: GitPlatform) -> List[RequiredVar]:
        """Get required variables for URL mode.
        
        Args:
            platform: Git platform
            
        Returns:
            List of required variables
        """
        if platform == GitPlatform.GITLAB:
            return [
                RequiredVar(key="gitlab_token", name="GitLab Token"),
                RequiredVar(key="git_mr_url", name="Git MR/PR URL"),
            ]
        elif platform == GitPlatform.GITHUB:
            return [
                RequiredVar(key="github_token", name="GitHub Token"),
                RequiredVar(key="git_mr_url", name="Git MR/PR URL"),
            ]
        else:
            raise ValueError(f"Unsupported Git platform: {platform}")
    
    def _build_required_vars_list(self) -> List[RequiredVar]:
        """Build list of required variables based on configuration.
        
        Returns:
            List of required variables
        """
        # Start with LLM provider requirements
        required_vars = self._get_llm_required_vars(self.config.llm_provider)
        
        # Add mode-specific requirements
        if (
            self.config.mr_mode == MRMode.CI and
            os.environ.get('CI_PIPELINE_SOURCE') == 'merge_request_event'
        ):
            required_vars.extend(self._get_ci_required_vars(self.config.git_platform))
        elif self.config.mr_mode == MRMode.URL:
            required_vars.extend(self._get_url_required_vars(self.config.git_platform))
        
        return required_vars
    
    def _find_missing_vars(self, required_vars: List[RequiredVar]) -> List[RequiredVar]:
        """Check if all required variables are present.
        
        Args:
            required_vars: List of required variables
            
        Returns:
            List of missing variables
        """
        return [var for var in required_vars if not self.config[var.key]]
    
    def validate(self):
        """Validate the configuration based on the selected mode.
        
        Raises:
            ValueError: If required configuration is missing
        """
        required_vars = self._build_required_vars_list()
        missing_vars = self._find_missing_vars(required_vars)
        
        if missing_vars:
            missing_names = ", ".join([v.name for v in missing_vars])
            raise ValueError(f"Missing required configuration: {missing_names}")
    
    async def _auto_detect_git_platform(self):
        """Auto-detect Git platform from repository."""
        platform_info = await self.git_detector.detect_git_platform()
        
        if not platform_info:
            self.logger.warn("Could not auto-detect Git platform, using default")
            return
        
        self.logger.info(f"Auto-detected Git platform: {platform_info.get('platform')}")
        
        self._update_git_platform_defaults(platform_info)
    
    def _update_git_platform_defaults(self, platform_info: Dict[str, Any]):
        """Update Git platform defaults based on detected information.
        
        Args:
            platform_info: Detected platform information
        """
        if platform_info.get('platform') == 'github':
            self.defaults.git_platform = GitPlatform.GITHUB
            # Set GitHub-specific defaults
            if platform_info.get('owner') and platform_info.get('repo'):
                self.logger.debug(f"GitHub repository: {platform_info['owner']}/{platform_info['repo']}")
        elif platform_info.get('platform') == 'gitlab':
            self.defaults.git_platform = GitPlatform.GITLAB
            if platform_info.get('url'):
                self.defaults.gitlab_url = platform_info['url']
                self.logger.debug(f"GitLab URL: {platform_info['url']}")
            if platform_info.get('project_path'):
                self.logger.debug(f"GitLab project path: {platform_info['project_path']}")