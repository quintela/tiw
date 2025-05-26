"""File operations utilities."""

import datetime
import json
import os
import pathlib
from typing import Any, Dict, Optional

from .logging import Logger


class FileUtils:
    """Utility class for file operations."""
    
    def __init__(self, logger: Optional[Logger] = None):
        """Initialize FileUtils.
        
        Args:
            logger: Optional logger instance
        """
        self.logger = logger or Logger()
    
    def load_prompt_from_directory(self, prompt_dir: str) -> str:
        """Load the prompt template from a directory.
        
        Args:
            prompt_dir: Directory containing prompt files
            
        Returns:
            Combined prompt template
            
        Raises:
            FileNotFoundError: If prompt directory doesn't exist
        """
        prompt_dir_path = pathlib.Path(prompt_dir)
        
        if not prompt_dir_path.exists() or not prompt_dir_path.is_dir():
            self.logger.error(f"Prompt directory not found: {prompt_dir}")
            raise FileNotFoundError(f"Prompt directory not found: {prompt_dir}")
        
        # List of prompt sections to load and combine
        sections = [
            "introduction.md",
            "criteria.md",
            "priorities.md",
            "diff.md",
            "output_format.md"
        ]
        
        combined_prompt = ""
        for section in sections:
            section_path = prompt_dir_path / section
            if section_path.exists():
                section_content = section_path.read_text(encoding="utf-8")
                combined_prompt += f"{section_content}\n\n"
                self.logger.debug(f"Loaded prompt section: {section}")
            else:
                self.logger.warn(f"Prompt section not found: {section}")
        
        if not combined_prompt:
            self.logger.error("No prompt sections found")
            raise FileNotFoundError("No prompt sections found in directory")
        
        return combined_prompt
    
    def save_review_to_file(
        self, 
        reviews_dir: str,
        feedback: str,
        metadata: Dict[str, Any]
    ) -> str:
        """Save review to a file.
        
        Args:
            reviews_dir: Directory to save the review
            feedback: LLM review feedback
            metadata: Review metadata
            
        Returns:
            Path to the saved file
        """
        # Create reviews directory if it doesn't exist
        reviews_path = pathlib.Path(reviews_dir)
        reviews_path.mkdir(parents=True, exist_ok=True)
        
        # Generate filename with timestamp
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"review_{timestamp}.json"
        file_path = reviews_path / filename
        
        # Create review object with metadata and feedback
        review_data = {
            "metadata": metadata,
            "feedback": feedback
        }
        
        # Write to file
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(review_data, f, indent=2)
        
        self.logger.info(f"Review saved to: {file_path}")
        return str(file_path)
    
    def ensure_directory_exists(self, directory_path: str) -> str:
        """Ensure that a directory exists, creating it if necessary.
        
        Args:
            directory_path: Path to the directory
            
        Returns:
            Absolute path to the directory
        """
        path = pathlib.Path(directory_path).resolve()
        path.mkdir(parents=True, exist_ok=True)
        return str(path)
    
    def read_file(self, file_path: str) -> str:
        """Read the contents of a file.
        
        Args:
            file_path: Path to the file
            
        Returns:
            File contents
            
        Raises:
            FileNotFoundError: If the file doesn't exist
        """
        path = pathlib.Path(file_path)
        
        if not path.exists():
            self.logger.error(f"File not found: {file_path}")
            raise FileNotFoundError(f"File not found: {file_path}")
        
        try:
            return path.read_text(encoding="utf-8")
        except Exception as e:
            self.logger.error(f"Error reading file {file_path}: {str(e)}")
            raise