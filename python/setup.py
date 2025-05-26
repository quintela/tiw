from setuptools import setup, find_packages

setup(
    name="tiw",
    version="0.1.0",
    description="A CLI tool that uses LLMs to review code changes in merge/pull requests",
    author="Tiago",
    author_email="913367+quintela@users.noreply.github.com",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "anthropic>=0.18.0",
        "openai>=1.12.0", 
        "python-dotenv>=1.0.0",
        "click>=8.1.7",
        "python-gitlab>=4.3.0",
        "pygithub>=2.1.1",
        "loguru>=0.7.2",
    ],
    entry_points={
        'console_scripts': [
            'tiw=tiw.cli:main',
        ],
    },
    python_requires='>=3.9',
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: Apache Software License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
)