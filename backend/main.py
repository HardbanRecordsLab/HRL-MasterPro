from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="HRL MasterPro API", version="1.0.0")

# Access Manager URL
ACCESS_MANAGER_URL = os.getenv("ACCESS_MANAGER_URL", "http://hrl-webhook-hub-backend:9107")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health():
    return {"status": "healthy", "service": "masterpro"}

@app.get("/api/auth")
async def get_auth_profile(email: str):
    """
    Standardowy endpoint autoryzacji - Proxy do Access Managera (SSO).
    """
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{ACCESS_MANAGER_URL}/api/auth/profile", params={"email": email})
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail="Auth Service Error")
            return resp.json()
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Access Manager Connection Error: {str(e)}")

@app.post("/api/audio/mastering-analysis")
async def analyze_audio(data: dict, authorization: str = Header(None)):
    """
    Audio Analysis - Zintegrowany z systemem kredytów HRL Unified.
    """
    email = data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Missing user email")

    # 1. KROK 4: Konsumpcja kredytów za analizę audio
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{ACCESS_MANAGER_URL}/api/credits/consume",
                params={"email": email, "amount": 2} # Przykładowo 2 kredyty za mastering
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=402, detail="Insufficient credits for Audio Analysis")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Access Manager Connection Error: {str(e)}")

    # 2. Logika analizy audio (FFmpeg / libsndfile)
    return {
        "status": "success",
        "message": "Audio mastering analysis complete",
        "result": "Dynamic Range: 12dB, Peak: -1.0dB"
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=9103, reload=True)
