# Getting Started
Generates Calls data and stores in it PostGre DB.

## Prerequisites
Setup a PostGre container. Refer to the steps in https://github.com/sahil-khanna-vonage/vonage-hackathon-2025-bot-api


## Start SQLCoder
- Clone the repo from https://github.com/defog-ai/sqlcoder
```
git clone https://github.com/defog-ai/sqlcoder.git
cd sqlcoder
```
- Follow the instructions. Below are the instructions for Mac
```
python3 -m venv llama-env
source llama-env/bin/activate
CMAKE_ARGS="-DLLAMA_METAL=on" pip install "sqlcoder[llama-cpp]"
sqlcoder launch
```