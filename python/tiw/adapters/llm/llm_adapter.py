"""Base LLM adapter class."""

import abc
import re
from typing import Any, Dict, List, Optional, Protocol

from ...config.config import AppConfig
from ...utils.logging import Logger


class SplitMarkers:
    """Split markers used to identify parts of the prompt that should be preserved when splitting."""
    
    def __init__(self, intro: str = "<!-- INTRO -->", 
                 outro: str = "<!-- OUTRO -->", 
                 continuation: str = "<!-- CONTINUATION -->"):
        self.intro = intro
        self.outro = outro
        self.continuation = continuation


class LLMAdapter(abc.ABC):
    """Base abstract class for LLM adapters.
    
    Defines the interface that all LLM adapters must implement.
    """
    
    def __init__(self, config: AppConfig):
        """Create a new LLM adapter.
        
        Args:
            config: The configuration for the LLM
        """
        if type(self) is LLMAdapter:
            raise TypeError("LLMAdapter is an abstract class and cannot be instantiated directly")
        
        self.config = config
        self.logger = Logger(config.verbose or False)
        self.client: Any = None
        self.split_markers = SplitMarkers()
    
    @abc.abstractmethod
    def init_client(self) -> Any:
        """Initialize the LLM client.
        
        Returns:
            The initialized client
        """
        pass
    
    def get_max_token_limit(self) -> int:
        """Get the maximum token limit for the current provider.
        
        Returns:
            The maximum number of tokens allowed in a prompt
        """
        return self._get_provider_token_limit(self.config.llm_provider)
    
    def _get_provider_token_limit(self, provider: str) -> int:
        """Get token limit for specific provider.
        
        Args:
            provider: The LLM provider name
            
        Returns:
            The token limit for the specified provider
        """
        provider_limits = {
            "anthropic": self.config.anthropic_max_tokens,
            "openai": self.config.openai_max_tokens,
            "deepseek": self.config.deepseek_max_tokens,
            "copilot": self.config.copilot_max_tokens,
        }
        
        return provider_limits.get(provider, self.config.max_prompt_tokens)
    
    def trim_text(self, text: Optional[str]) -> str:
        """Trims whitespace from text while preserving meaningful content.
        
        Args:
            text: Text to trim
            
        Returns:
            Trimmed text
        """
        if not text:
            return ""
        
        # Trim leading/trailing whitespace
        trimmed = text.strip()
        
        # Replace multiple consecutive whitespace with a single space
        trimmed = re.sub(r'\s+', ' ', trimmed)
        
        # Replace multiple consecutive newlines with a single newline
        trimmed = re.sub(r'\n\s*\n\s*\n+', '\n\n', trimmed)
        
        return trimmed
    
    def split_prompt(self, prompt: str) -> List[str]:
        """Split a prompt into multiple parts if it exceeds the token limit.
        
        Args:
            prompt: The prompt to split
            
        Returns:
            An array of prompt parts
        """
        # Check if prompt has markers and needs splitting
        if not self._has_valid_markers(prompt) or self._is_within_token_limit(prompt):
            return [prompt]
        
        # Extract sections based on markers
        intro, outro = self._extract_marked_sections(prompt)
        parts = self._split_content_at_continuation_markers(prompt)
        
        # Combine parts with intro and outro
        return self._combine_split_parts(parts, intro, outro)
    
    def _has_valid_markers(self, prompt: str) -> bool:
        """Check if prompt has valid intro and outro markers.
        
        Args:
            prompt: The prompt to check
            
        Returns:
            Whether prompt has valid markers
        """
        return self.split_markers.intro in prompt and self.split_markers.outro in prompt
    
    def _is_within_token_limit(self, prompt: str) -> bool:
        """Check if prompt is within token limit.
        
        Args:
            prompt: The prompt to check
            
        Returns:
            Whether prompt is within limit
        """
        return self.estimate_token_count(prompt) <= self.get_max_token_limit()
    
    def _extract_marked_sections(self, prompt: str) -> tuple[str, str]:
        """Extract intro and outro sections from prompt.
        
        Args:
            prompt: The prompt with markers
            
        Returns:
            Object containing intro and outro text
        """
        intro_pattern = f"{re.escape(self.split_markers.intro)}([\\s\\S]*?)(?={re.escape(self.split_markers.continuation)}|{re.escape(self.split_markers.outro)})"
        outro_pattern = f"{re.escape(self.split_markers.outro)}([\\s\\S]*)$"
        
        intro_match = re.search(intro_pattern, prompt)
        outro_match = re.search(outro_pattern, prompt)
        
        intro = self.trim_text(intro_match.group(1)) if intro_match else ""
        outro = self.trim_text(outro_match.group(1)) if outro_match else ""
        
        return intro, outro
    
    def _split_content_at_continuation_markers(self, prompt: str) -> List[str]:
        """Split the main content at continuation markers.
        
        Args:
            prompt: The full prompt
            
        Returns:
            Array of content parts
        """
        # Get the main content (everything between intro and outro)
        intro_pattern = f"{re.escape(self.split_markers.intro)}[\\s\\S]*?(?={re.escape(self.split_markers.continuation)})"
        outro_pattern = f"{re.escape(self.split_markers.outro)}[\\s\\S]*$"
        
        main_content = re.sub(intro_pattern, "", prompt)
        main_content = re.sub(outro_pattern, "", main_content)
        
        # Split main content at continuation markers
        return main_content.split(self.split_markers.continuation)
    
    def _combine_split_parts(self, parts: List[str], intro: str, outro: str) -> List[str]:
        """Combine split parts with intro and outro.
        
        Args:
            parts: Array of content parts
            intro: Intro section text
            outro: Outro section text
            
        Returns:
            Array of complete prompts
        """
        combined_parts = []
        
        for i, part in enumerate(parts):
            trimmed_part = self.trim_text(part)
            
            if i == 0:
                # First part gets intro + part
                combined_parts.append(f"{self.split_markers.intro}{intro}{trimmed_part}")
            elif i == len(parts) - 1:
                # Last part gets part + outro
                combined_parts.append(f"{trimmed_part}{self.split_markers.outro}{outro}")
            else:
                # Middle parts just get the part itself
                combined_parts.append(trimmed_part)
        
        return combined_parts
    
    def merge_responses(self, responses: List[str]) -> str:
        """Merge multiple responses into a single response.
        
        Args:
            responses: Array of responses from LLM
            
        Returns:
            Merged response
        """
        # For now, just concatenate the responses
        return "\n".join(responses)
    
    def estimate_token_count(self, text: str) -> int:
        """Rough estimation of token count (not perfect but good enough for safety checks).
        
        Args:
            text: The text to estimate token count for
            
        Returns:
            Estimated number of tokens
        """
        # A simple approximation: 4 characters per token
        import math
        return math.ceil(len(text) / 4)
    
    async def analyze_code(self, prompt: str) -> str:
        """Analyze code with the LLM, handling large prompts by splitting if necessary.
        
        Args:
            prompt: The prompt to send to the LLM
            
        Returns:
            The response from the LLM
        """
        try:
            # Apply basic trimming to the full prompt to reduce size before splitting
            trimmed_prompt = self._apply_trimming(prompt)
            prompt_parts = self.split_prompt(trimmed_prompt)
            
            if len(prompt_parts) > 1:
                self.logger.debug(f"Prompt split into {len(prompt_parts)} parts due to token limit")
                return await self._handle_multi_part_request(prompt_parts)
            
            # Standard single request
            return await self.send_request(prompt_parts[0] if prompt_parts else "")
        except Exception as error:
            self.logger.error(f"Error analyzing code: {str(error)}")
            raise
    
    async def _handle_multi_part_request(self, prompt_parts: List[str]) -> str:
        """Handle multiple request parts sequentially.
        
        Args:
            prompt_parts: Array of prompt parts
            
        Returns:
            Combined response
        """
        responses = []
        
        for i, part in enumerate(prompt_parts):
            self.logger.debug(f"Sending part {i + 1} of {len(prompt_parts)}")
            response = await self.send_request(part or "")
            responses.append(response)
        
        return self.merge_responses(responses)
    
    def _apply_trimming(self, prompt: str) -> str:
        """Apply trimming to a prompt while preserving sections marked by special markers.
        
        Args:
            prompt: The prompt to trim
            
        Returns:
            The trimmed prompt with markers preserved
        """
        # Check if prompt has markers for splitting
        if not self._has_valid_markers(prompt):
            return self.trim_text(prompt)
        
        return self._trim_with_markers_preserved(prompt)
    
    def _trim_with_markers_preserved(self, prompt: str) -> str:
        """Trim text while preserving marker sections.
        
        Args:
            prompt: The prompt with markers
            
        Returns:
            Trimmed prompt with preserved markers
        """
        # Extract all marker positions
        marker_positions = self._find_all_marker_positions(prompt)
        
        # Process each section between markers
        parts = []
        current_idx = 0
        
        for marker in marker_positions:
            # Add text before marker (trimmed)
            if current_idx < marker["pos"]:
                before_marker = prompt[current_idx:marker["pos"]]
                parts.append(self.trim_text(before_marker))
            
            # Add the marker itself
            parts.append(self._get_marker_by_type(marker["type"]))
            
            # Move past the marker
            current_idx = marker["pos"] + len(self._get_marker_by_type(marker["type"]))
        
        # Add any remaining text after the last marker
        if current_idx < len(prompt):
            after_markers = prompt[current_idx:]
            parts.append(self.trim_text(after_markers))
        
        return "".join(parts)
    
    def _find_all_marker_positions(self, prompt: str) -> List[Dict[str, Any]]:
        """Find all marker positions in the prompt.
        
        Args:
            prompt: The prompt to search in
            
        Returns:
            Array of marker positions and types
        """
        # Find all marker positions
        intro_index = prompt.find(self.split_markers.intro)
        outro_index = prompt.find(self.split_markers.outro)
        continuation_indices = self._find_all_continuation_markers(prompt)
        
        # Sort all marker positions
        all_markers = [
            {"pos": intro_index, "type": "intro"},
            {"pos": outro_index, "type": "outro"},
        ]
        
        all_markers.extend([{"pos": pos, "type": "continuation"} for pos in continuation_indices])
        
        # Sort by position and filter out non-existent markers
        return sorted(
            [m for m in all_markers if m["pos"] != -1],
            key=lambda x: x["pos"]
        )
    
    def _find_all_continuation_markers(self, prompt: str) -> List[int]:
        """Find all continuation marker positions.
        
        Args:
            prompt: The prompt to search in
            
        Returns:
            Array of positions
        """
        indices = []
        idx = prompt.find(self.split_markers.continuation)
        
        while idx != -1:
            indices.append(idx)
            idx = prompt.find(self.split_markers.continuation, idx + 1)
        
        return indices
    
    def _get_marker_by_type(self, marker_type: str) -> str:
        """Get marker string by type.
        
        Args:
            type: The marker type
            
        Returns:
            Marker string
        """
        marker_map = {
            "intro": self.split_markers.intro,
            "outro": self.split_markers.outro,
            "continuation": self.split_markers.continuation,
        }
        
        return marker_map.get(marker_type, "")
    
    @abc.abstractmethod
    async def send_request(self, prompt: str) -> str:
        """Send a request to the LLM.
        
        Args:
            prompt: The prompt to send
            
        Returns:
            The response from the LLM
        """
        pass
    
    def process_response(self, response: str) -> str:
        """Process the LLM response into a consistent format.
        
        Args:
            response: The raw response from the LLM
            
        Returns:
            The processed response
        """
        # Try to extract JSON from code blocks first
        extracted_json = self._extract_json_from_code_blocks(response)
        if extracted_json:
            return extracted_json
        
        # Try to parse as direct JSON
        return self._parse_as_direct_json(response)
    
    def _extract_json_from_code_blocks(self, response: str) -> Optional[str]:
        """Extract JSON from code blocks.
        
        Args:
            response: LLM response text
            
        Returns:
            JSON string or None if not valid
        """
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', response)
        if not json_match or not json_match.group(1):
            return None
        
        try:
            import json
            parsed_json = json.loads(json_match.group(1).strip())
            return json.dumps(parsed_json)
        except Exception as parse_error:
            self.logger.warn(f"Found JSON-like content but it could not be parsed: {str(parse_error)}")
            return None
    
    def _parse_as_direct_json(self, response: str) -> str:
        """Parse response as direct JSON.
        
        Args:
            response: LLM response text
            
        Returns:
            Parsed JSON or original text
        """
        try:
            import json
            parsed = json.loads(response)
            return json.dumps(parsed)
        except Exception as error:
            self.logger.warn(f"Response is not valid JSON, returning as plain text {error}")
            return response