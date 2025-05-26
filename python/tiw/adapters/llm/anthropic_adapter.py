"""Anthropic Claude API adapter for LLM requests."""

from typing import Any, Dict

from anthropic import Anthropic

from ...config.config import AppConfig
from .llm_adapter import LLMAdapter


class AnthropicAdapter(LLMAdapter):
    """Adapter for Anthropic Claude API."""
    
    def __init__(self, config: AppConfig):
        """Initialize the Anthropic adapter.
        
        Args:
            config: Application configuration
        """
        super().__init__(config)
        
        # Initialize the client
        self.client = self.init_client()
    
    def init_client(self) -> Anthropic:
        """Initialize the Anthropic API client.
        
        Returns:
            Anthropic client
            
        Raises:
            ValueError: If API key is missing
        """
        if not self.config.anthropic_api_key:
            raise ValueError("Anthropic API key is required")
        
        return Anthropic(api_key=self.config.anthropic_api_key)
    
    async def send_request(self, prompt: str) -> str:
        """Send a request to the Anthropic API.
        
        Args:
            prompt: The prompt to send
            
        Returns:
            The response from the API
            
        Raises:
            Exception: If the API request fails
        """
        try:
            self.logger.info(f"Sending request to Anthropic API using model {self.config.anthropic_model}")
            
            # Create message parameters
            params: Dict[str, Any] = {
                "model": self.config.anthropic_model,
                "max_tokens": 4000,
                "temperature": 0.2,
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            }
            
            # Adjust parameters based on model (newer models use messages format)
            if "claude-3" in self.config.anthropic_model.lower():
                # Use the newer messages API format for Claude 3 models
                response = await self.client.messages.create(**params)
                content = response.content[0].text
            else:
                # Use legacy API for older models
                response = await self.client.completions.create(
                    model=self.config.anthropic_model,
                    prompt=f"\n\nHuman: {prompt}\n\nAssistant:",
                    max_tokens_to_sample=4000,
                    temperature=0.2
                )
                content = response.completion
            
            # Process the response to standardize format
            return self.process_response(content)
        
        except Exception as e:
            self.logger.error(f"Anthropic API request failed: {str(e)}")
            raise