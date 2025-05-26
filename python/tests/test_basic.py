"""Basic tests for the tiw package."""

import unittest
from tiw import __version__


class TestBasic(unittest.TestCase):
    """Basic tests for the tiw package."""
    
    def test_version(self):
        """Test that the version is a string."""
        self.assertIsInstance(__version__, str)
        self.assertTrue(len(__version__) > 0)
    
    def test_imports(self):
        """Test that key modules can be imported."""
        # Test that key components can be imported
        from tiw.config.config import Config, AppConfig
        from tiw.core.mr_reviewer import MRReviewer
        from tiw.adapters.llm.llm_adapter import LLMAdapter
        from tiw.adapters.git.git_adapter import GitAdapter
        
        # Simple assertion just to verify imports worked
        self.assertTrue(True)


if __name__ == "__main__":
    unittest.main()