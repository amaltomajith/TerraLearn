# TerraLearn Backend API

Python FastAPI service powering TerraLearn's LangChain AI Environmental Assistant for farmers.

## Setup Instructions

### 1. Create Virtual Environment
```bash
python -m venv venv
```

### 2. Activate Virtual Environment
- **Windows (Command Prompt / PowerShell):**
  ```cmd
  venv\Scripts\activate
  ```
- **Linux / macOS:**
  ```bash
  source venv/bin/activate
  ```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Environment Variables
Copy `.env.example` to `.env` and provide your OpenAI API key:
```bash
cp .env.example .env
```

`.env` configuration options:
```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

### 5. Run Backend Server locally
Run the following exact command from the `backend/` directory:
```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.

## API Endpoints

### `POST /api/ask`
Sends a natural-language question along with map coordinates and optional frontend crop simulation context.

#### Example Request Body
```json
{
  "question": "Is the temperature and air quality suitable for growing corn here?",
  "lat": 40.7128,
  "lng": -74.0060,
  "cropContext": {
    "crop": "Corn",
    "plantingDate": "2026-05-15",
    "yieldEstimate": 10.5,
    "viabilityScore": 88,
    "profit": 12500
  }
}
```

#### Example cURL
```bash
curl -X POST "http://localhost:8000/api/ask" \
     -H "Content-Type: application/json" \
     -d '{"question": "How is the AQI for growing crops?", "lat": 40.7128, "lng": -74.0060}'
```
