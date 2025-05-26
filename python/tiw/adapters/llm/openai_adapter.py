"""OpenAI API adapter for LLM requests."""

from typing import Any, Dict

import openai

from ...config.config import AppConfig
from .llm_adapter import LLMAdapter


class OpenAIAdapter(LLMAdapter):
    """Adapter for OpenAI API."""
    
    def __init__(self, config: AppConfig):
        """Initialize the OpenAI adapter.
        
        Args:
            config: Application configuration
        """
        super().__init__(config)
        
        # Initialize the client
        self.client = self.init_client()
    
    def init_client(self) -> openai.OpenAI:
        """Initialize the OpenAI API client.
        
        Returns:
            OpenAI client
            
        Raises:
            ValueError: If API key is missing
        """
        if not self.config.openai_api_key:
            raise ValueError("OpenAI API key is required")
        
        return openai.OpenAI(api_key=self.config.openai_api_key)
    
    async def send_request(self, prompt: str) -> str:
        """Send a request to the OpenAI API.
        
        Args:
            prompt: The prompt to send
            
        Returns:
            The response from the API
            
        Raises:
            Exception: If the API request fails
        """
        try:
            self.logger.info(f"Sending request to OpenAI API using model {self.config.openai_model}")
            
            # Create message parameters
            response = await self.client.chat.completions.create(
                model=self.config.openai_model,
                max_tokens=4000,
                temperature=0.2,
                messages=[
                    {"role": "system", "content": "You are a code review assistant that provides feedback on code changes. Return your feedback as valid JSON."},
                    {"role": "user", "content": prompt}
                ]
            )
            
            # Extract content from the response
            content = response.choices[0].message.content if response.choices else ""
            
            # Process the response to standardize format
            return self.process_response(content)
        
        except Exception as e:
            self.logger.error(f"OpenAI API request failed: {str(e)}")
            raise