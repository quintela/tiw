"""Logging utilities for the tiw tool."""

import sys
from typing import Optional, Union

from loguru import logger


class Logger:
    """Logger class for the tiw tool."""
    
    def __init__(self, verbose: bool = False):
        """Initialize the logger.
        
        Args:
            verbose: Whether to enable verbose logging
        """
        # Configure Loguru with appropriate format and level
        self.level = "INFO" if verbose else "WARNING"
        self.configure_loguru()
    
    def configure_loguru(self):
        """Configure Loguru logger settings."""
        # Clear existing handlers
        logger.remove()
        
        # Add console handler with custom format - standard error output
        logger.add(
            sys.stderr,
            format="<level>{level}</level> | <green>{time:YYYY-MM-DD HH:mm:ss}</green> | {message}",
            level=self.level,
            colorize=True,
        )
    
    def set_level(self, level: str):
        """Set the logging level.
        
        Args:
            level: The logging level (debug, info, warning, error)
        """
        self.level = level.upper()
        self.configure_loguru()
    
    def debug(self, message: str, *args, **kwargs):
        """Log a debug message.
        
        Args:
            message: The message to log
            args: Additional positional arguments
            kwargs: Additional keyword arguments
        """
        logger.debug(message, *args, **kwargs)
    
    def info(self, message: str, *args, **kwargs):
        """Log an info message.
        
        Args:
            message: The message to log
            args: Additional positional arguments
            kwargs: Additional keyword arguments
        """
        logger.info(message, *args, **kwargs)
    
    def warn(self, message: str, *args, **kwargs):
        """Log a warning message.
        
        Args:
            message: The message to log
            args: Additional positional arguments
            kwargs: Additional keyword arguments
        """
        logger.warning(message, *args, **kwargs)
    
    def error(self, message: Union[str, Exception], error: Optional[Exception] = None, *args, **kwargs):
        """Log an error message.
        
        Args:
            message: The message to log or exception
            error: Optional exception to include
            args: Additional positional arguments
            kwargs: Additional keyword arguments
        """
        if isinstance(message, Exception) and error is None:
            error = message
            message = str(error)
        
        if error:
            logger.error(f"{message}: {str(error)}", *args, **kwargs)
        else:
            logger.error(message, *args, **kwargs)
    
    def user(self, message: str):
        """Output a message directly to the user (without log formatting).
        
        Args:
            message: The message to output
        """
        # Print directly to stdout without log formatting
        print(message)