import runpod
import os
import subprocess
import base64
import uuid
import shutil

def handler(event):
    '''
    RunPod Serverless Handler
    Expects input: { "glb_base64": "...", "filename": "..." }
    '''
    job_input = event.get("input", {})
    glb_base64 = job_input.get("glb_base64")
    
    if not glb_base64:
        return {"error": "No GLB data provided"}

    # Setup temporary directory for processing
    job_id = str(uuid.uuid4())
    temp_dir = f"/tmp/{job_id}"
    os.makedirs(temp_dir, exist_ok=True)
    
    input_path = os.path.join(temp_dir, "input.glb")
    output_path = os.path.join(temp_dir, "output.fbx")

    try:
        # Decode GLB base64 and save to disk
        glb_data = base64.b64decode(glb_base64)
        with open(input_path, "wb") as f:
            f.write(glb_data)

        # Execute Blender conversion
        # Blender should be installed at /usr/local/blender/blender or similar in Docker
        blender_path = "blender" # Assuming it's in PATH
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
            return {
                "error": "Blender conversion failed",
                "stdout": result.stdout,
                "stderr": result.stderr
            }

        # Check if output file exists
        if not os.path.exists(output_path):
            return {
                "error": "Output FBX file not generated",
                "stdout": result.stdout,
                "stderr": result.stderr
            }

        # Encode resulting FBX to base64
        with open(output_path, "rb") as f:
            fbx_base64 = base64.b64encode(f.read()).decode('utf-8')

        return {
            "fbx_base64": fbx_base64,
            "filename": job_input.get("filename", "converted.fbx").replace(".glb", ".fbx")
        }

    finally:
        # Cleanup
        if os.path.exists(input_path):
            os.remove(input_path)
        if os.path.exists(output_path):
            os.remove(output_path)
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)

runpod.serverless.start({"handler": handler})
