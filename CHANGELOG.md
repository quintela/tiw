# Changelog

## [1.2.0] - 2025-03-21

### Added
- Automatically save reviews to a local directory with timestamp and metadata
- Format review comments with improved markdown structure
- Organized output with clear sections for overview, general feedback, file reviews, and test reviews
- Added .gitignore entry for review storage directory

### Changed
- Enhanced comment formatting to include line numbers and severity information
- Updated documentation with new features and review storage information
- Upgraded Anthropic model reference to latest version

## [1.1.0] - 2025-03-21

### Added
- New URL mode to review GitLab merge requests by providing a direct URL
- Added ability to specify a custom GitLab instance URL
- Added --show-diff option to view the diff before sending it to the LLM
- Interactive confirmation when showing diff to proceed with LLM analysis
- Created comprehensive README with usage instructions
- Better error handling and logging for API requests

### Changed
- Improved command-line options for better usability
- Refactored code to support multiple operating modes (local, CI, URL)
- Enhanced error messages with more details about API responses

## [1.0.0] - Initial Release

- First version of MR checker
- Support for local git diff analysis
- Support for GitLab CI pipeline integration
- OpenAI and Anthropic LLM providers