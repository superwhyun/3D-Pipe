from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import os
import uuid
import shutil

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/convert")
async def convert_file(file: UploadFile = File(...)):
    if not file.filename.endswith(".glb"):
        raise HTTPException(status_code=400, detail="Only .glb files are supported")

    job_id = str(uuid.uuid4())
    temp_dir = f"/tmp/{job_id}"
    os.makedirs(temp_dir, exist_ok=True)
    
    input_path = os.path.join(temp_dir, file.filename)
    output_path = os.path.join(temp_dir, file.filename.replace(".glb", ".fbx"))

    try:
        # Save uploaded GLB
        with open(input_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # Run Blender conversion
        blender_path = "blender"
        conversion_script = os.path.join(os.getcwd(), "converter.py")
        
        result = subprocess.run([
            blender_path,
            "--background",
            "--python", conversion_script,
            "--",
            input_path,
            output_path
        ], capture_output=True, text=True)

        if result.returncode != 0:
            print("Blender Error:", result.stderr)
            raise HTTPException(status_code=500, detail="Blender conversion failed")

        if not os.path.exists(output_path):
            raise HTTPException(status_code=500, detail="Output file not generated")

        # Return the FBX file
        return FileResponse(
            output_path, 
            media_type="application/octet-stream", 
            filename=os.path.basename(output_path)
        )

    finally:
        # Note: We can't immediately delete the file since FileResponse needs it.
        # In a real app, you'd use a BackgroundTask or periodic cleanup.
        pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
