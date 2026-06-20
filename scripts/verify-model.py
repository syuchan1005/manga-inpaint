# /// script
# dependencies = [
#   "onnxruntime",
# ]
# ///

import os
import sys
import onnxruntime as ort

def verify_model(model_path):
    print(f"Verifying model: {model_path}", flush=True)
    if not os.path.exists(model_path):
        print(f"FAILED: File not found at {model_path}", flush=True)
        return False
        
    try:
        # We try to create an InferenceSession with CPU provider
        # This will trigger graph validation and type checking
        session = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
        print("SUCCESS: Model loaded and validated successfully!", flush=True)
        return True
    except Exception as e:
        print("FAILED: Model validation failed with the following error:", flush=True)
        print(e, flush=True)
        return False

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    models_dir = os.path.abspath(os.path.join(script_dir, "..", "public", "models"))
    fp16_model_path = os.path.join(models_dir, "lama-manga-onnx-dynamic-fp16.onnx")
    
    if len(sys.argv) > 1:
        fp16_model_path = sys.argv[1]
        
    verify_model(fp16_model_path)
