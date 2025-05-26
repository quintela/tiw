"""LLM adapters package."""

from typing import Dict, Type

from ...config.config import AppConfig, LLMProvider
from .llm_adapter import LLMAdapter
from .anthropic_adapter import AnthropicAdapter
from .openai_adapter import OpenAIAdapter


class LLMAdapterFactory:
    """Factory for creating LLM adapters."""
    
    def __init__(self):
        """Initialize the factory."""
        # Registry of adapter classes
        self.adapters: Dict[str, Type[LLMAdapter]] = {
            LLMProvider.ANTHROPIC: AnthropicAdapter,
            LLMProvider.OPENAI: OpenAIAdapter,
            # Add more adapters here as they're implemented
        }
    
    def create(self, config: AppConfig) -> LLMAdapter:
        """Create an adapter instance based on configuration.
        
        Args:
            config: Application configuration
            
        Returns:
            Instantiated adapter
            
        Raises:
            ValueError: If provider is not supported
        """
        provider = config.llm_provider
        
        if provider not in self.adapters:
            raise ValueError(f"Unsupported LLM provider: {provider}")
        
        adapter_class = self.adapters[provider]
        return adapter_class(config)