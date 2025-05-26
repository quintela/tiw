"""Base Git adapter class."""

import abc
import subprocess
from typing import Any, Dict, List, Optional, Tuple

from ...config.config import AppConfig


class GitCommandResult:
    """Result of a git command execution."""
    
    def __init__(self, success: bool, output: str, error: Optional[Exception] = None):
        self.success = success
        self.output = output
        self.error = error


class GitAdapter(abc.ABC):
    """Base abstract class for Git adapters.
    
    Defines the interface that all Git adapters must implement.
    """
    
    def __init__(self, config: AppConfig):
        """Create a new Git adapter.
        
        Args:
            config: The configuration for the Git platform
        """
        if type(self) is GitAdapter:
            raise TypeError("GitAdapter is an abstract class and cannot be instantiated directly")
        
        self.config = config
    
    @abc.abstractmethod
    def parse_request_url(self, url: str) -> Dict[str, str]:
        """Parse a Git MR/PR URL into project and request identifiers.
        
        Args:
            url: The URL to parse
            
        Returns:
            Object containing platform-specific identifiers
        """
        pass
    
    @abc.abstractmethod
    async def get_request_diff(self, params: Dict[str, str]) -> str:
        """Get the diff of a merge/pull request.
        
        Args:
            params: Parameters needed to identify the MR/PR
            
        Returns:
            The diff content
        """
        pass
    
    @abc.abstractmethod
    async def comment_on_request(self, params: Dict[str, str], comment: str) -> None:
        """Post a comment on a merge/pull request.
        
        Args:
            params: Parameters needed to identify the MR/PR
            comment: The comment content
        """
        pass
    
    def _execute_git_command(self, command: str, cwd: Optional[str] = None, 
                            stdio: str = 'pipe') -> GitCommandResult:
        """Execute a git command safely.
        
        Args:
            command: The git command to execute
            cwd: Current working directory for command execution
            stdio: How to handle standard I/O ('ignore' or 'pipe')
            
        Returns:
            Result of the command execution
        """
        try:
            # Set appropriate stdio option
            stdio_option = subprocess.PIPE if stdio == 'pipe' else subprocess.DEVNULL
            
            # Execute the command
            result = subprocess.run(
                command,
                shell=True,
                cwd=cwd,
                stdout=stdio_option,
                stderr=stdio_option,
                text=True,
                check=False
            )
            
            if result.returncode == 0:
                return GitCommandResult(True, result.stdout.strip() if result.stdout else "")
            else:
                error_msg = result.stderr.strip() if result.stderr else f"Command failed with code {result.returncode}"
                return GitCommandResult(False, "", Exception(error_msg))
        
        except Exception as error:
            return GitCommandResult(False, "", error)
    
    def _get_current_branch(self) -> str:
        """Get the current branch name.
        
        Returns:
            Current branch name or empty string if not found
        """
        result = self._execute_git_command('git rev-parse --abbrev-ref HEAD')
        
        if not result.success or not result.output:
            print("Could not determine current branch")
            return ""
        
        return result.output
    
    def _has_local_changes(self) -> bool:
        """Check if there are local changes (staged or unstaged).
        
        Returns:
            True if there are changes, false otherwise
        """
        # Check for unstaged changes
        unstaged_result = self._execute_git_command('git diff --name-only')
        
        # Check for staged changes
        staged_result = self._execute_git_command('git diff --cached --name-only')
        
        return (
            (unstaged_result.success and unstaged_result.output) or
            (staged_result.success and staged_result.output)
        )
    
    def _get_unstaged_changes(self) -> str:
        """Get only the unstaged changes (working directory changes).
        
        Returns:
            Diff of unstaged changes
        """
        result = self._execute_git_command('git diff')
        
        if not result.success:
            print("Failed to get unstaged changes")
            return ""
        
        return result.output
    
    def _get_staged_changes(self) -> str:
        """Get only the staged changes.
        
        Returns:
            Diff of staged changes
        """
        result = self._execute_git_command('git diff --cached')
        
        if not result.success:
            print("Failed to get staged changes")
            return ""
        
        return result.output
    
    def _get_all_local_changes(self) -> str:
        """Get all local changes (staged and unstaged).
        
        Returns:
            Combined diff of all local changes
        """
        # First check if there are any changes
        if not self._has_local_changes():
            return ""
        
        unstaged = self._get_unstaged_changes()
        staged = self._get_staged_changes()
        
        # Combine the diffs with a separator if both exist
        if unstaged and staged:
            return f"{staged}\n\n# UNSTAGED CHANGES\n\n{unstaged}"
        
        return unstaged or staged
    
    def _get_ci_mode_changes(self) -> str:
        """Get changes for CI mode.
        
        Returns:
            The staged changes in CI mode
            
        Raises:
            Exception: If no staged changes are found
        """
        staged_changes = self._get_staged_changes()
        
        if not staged_changes:
            raise Exception("No staged changes found in CI mode")
        
        return staged_changes
    
    def _compare_with_target_branch(self, target_branch: str) -> str:
        """Compare current branch with target branch.
        
        Args:
            target_branch: Branch to compare against
            
        Returns:
            Diff between current branch and target branch
            
        Raises:
            Exception: If target branch does not exist
        """
        # Verify branch exists
        verify_result = self._execute_git_command(
            f"git rev-parse --verify {target_branch}", 
            stdio='ignore'
        )
        
        if not verify_result.success:
            raise Exception(f"Target branch '{target_branch}' does not exist")
        
        # Get the diff between current branch and target branch
        diff_command = f"git diff {target_branch}...HEAD"
        
        # Add option to exclude lock files if configured
        if self.config.ignore_lock_files:
            diff_command += " -- . ':(exclude)yarn.lock' ':(exclude)package-lock.json' ':(exclude)pnpm-lock.yaml'"
        
        diff_result = self._execute_git_command(diff_command)
        
        if not diff_result.success:
            raise Exception(f"Failed to get diff against {target_branch}")
        
        return diff_result.output
    
    def _branch_exists_on_remote(self, branch_name: str) -> bool:
        """Check if branch exists on remote.
        
        Args:
            branch_name: Name of the branch to check
            
        Returns:
            True if the branch exists on remote
        """
        result = self._execute_git_command(f"git ls-remote --heads origin {branch_name}")
        return result.success and bool(result.output)
    
    def _get_commit_count(self) -> int:
        """Get the commit count for a branch.
        
        Returns:
            Number of commits in the branch
        """
        result = self._execute_git_command('git rev-list --count HEAD')
        if not result.success:
            return 0
        
        try:
            return int(result.output) if result.output else 0
        except ValueError:
            return 0
    
    def _get_diff_with_previous_commit(self) -> str:
        """Get diff between current HEAD and previous commit.
        
        Returns:
            Diff with previous commit
        """
        if self._get_commit_count() <= 0:
            return ""
        
        result = self._execute_git_command('git diff HEAD~1...HEAD')
        if not result.success:
            return ""
        
        print("[INFO] Comparing with previous commit")
        return result.output
    
    def _compare_with_remote(self, branch_name: str) -> str:
        """Compare current branch with remote of same name.
        
        Args:
            branch_name: Current branch name
            
        Returns:
            Diff with remote counterpart
        """
        result = self._execute_git_command(f"git diff origin/{branch_name}...HEAD")
        
        if not result.success or not result.output:
            return ""
        
        print("[INFO] Found unpushed commits, analyzing these changes")
        return result.output
    
    def _compare_with_merge_base(self, base_branch: str) -> str:
        """Find common ancestor with another branch and get diff.
        
        Args:
            base_branch: Base branch to find common ancestor with
            
        Returns:
            Diff from common ancestor
        """
        # Try to find merge-base (common ancestor)
        merge_base_result = self._execute_git_command(f"git merge-base HEAD origin/{base_branch}")
        
        if not merge_base_result.success or not merge_base_result.output:
            return ""
        
        merge_base = merge_base_result.output
        diff_result = self._execute_git_command(f"git diff {merge_base}...HEAD")
        
        return diff_result.output if diff_result.success else ""
    
    def _compare_with_base_branch(self, base_branch: str) -> str:
        """Direct comparison with a base branch.
        
        Args:
            base_branch: Base branch to compare with
            
        Returns:
            Diff with base branch
        """
        result = self._execute_git_command(f"git diff origin/{base_branch}...HEAD")
        return result.output if result.success else ""
    
    def _find_and_compare_with_base_branch(self) -> str:
        """Try to find a suitable base branch for comparison.
        
        Returns:
            Diff using the first successful comparison strategy
        """
        possible_base_branches = ['main', 'master', 'develop', 'development']
        
        for base_branch in possible_base_branches:
            if not self._branch_exists_on_remote(base_branch):
                continue
            
            print(f"[INFO] Using {base_branch} as base branch for comparison")
            
            # Try merge-base approach first
            merge_base_diff = self._compare_with_merge_base(base_branch)
            if merge_base_diff:
                return merge_base_diff
            
            # Fall back to direct comparison
            direct_diff = self._compare_with_base_branch(base_branch)
            if direct_diff:
                return direct_diff
        
        return ""
    
    def _get_unpushed_commits(self) -> str:
        """Get unpushed commits or changes on a new branch.
        
        Returns:
            Diff of changes compared to appropriate base
            
        Raises:
            Exception: If no current branch is detected
        """
        current_branch = self._get_current_branch()
        
        if not current_branch:
            raise Exception("No current branch detected")
        
        # Strategy 1: Compare with remote branch if it exists
        if self._branch_exists_on_remote(current_branch):
            remote_diff = self._compare_with_remote(current_branch)
            if remote_diff:
                return remote_diff
        
        # Strategy 2: Compare with a suitable base branch
        print("[INFO] Branch not found on remote, comparing with likely base branch")
        base_branch_diff = self._find_and_compare_with_base_branch()
        if base_branch_diff:
            return base_branch_diff
        
        # Strategy 3: Compare with previous commit as last resort
        return self._get_diff_with_previous_commit()
    
    async def get_local_diff(self, target_branch: Optional[str] = None) -> str:
        """Get the local git diff comparing to a target branch.
        
        Args:
            target_branch: The branch to compare against (defaults to current branch with local changes)
            
        Returns:
            The diff content
            
        Raises:
            Exception: If there are errors during diff retrieval
        """
        try:
            # Check if we're in CI mode
            if self.config.mr_mode == 'ci':
                return self._get_ci_mode_changes()
            
            # If there are local changes, return them directly
            if self._has_local_changes():
                print("[INFO] Local changes detected, analyzing working directory changes")
                return self._get_all_local_changes()
            
            # If no local changes but a target branch is specified, compare current branch to target
            if target_branch:
                return self._compare_with_target_branch(target_branch)
            
            # If no target branch and no local changes, check if there are unpushed commits
            unpushed_changes = self._get_unpushed_commits()
            if unpushed_changes:
                return unpushed_changes
            
            # Last resort - no changes detected
            raise Exception("No changes detected to analyze")
        
        except Exception as error:
            print(f"Error getting local git diff: {str(error)}")
            raise