# /// script
# dependencies = [
#   "huggingface-hub",
#   "onnx",
#   "onnxruntime",
#   "sympy",
# ]
# ///

import os
import shutil
from huggingface_hub import hf_hub_download
from onnxruntime.quantization.preprocess import quant_pre_process

def main():
    repo_id = "ogkalu/lama-manga-onnx-dynamic"
    hf_filename = "lama-manga-dynamic.onnx"
    
    # Define paths (handles Google Colab/Jupyter where __file__ is undefined)
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        output_dir = os.path.abspath(os.path.join(script_dir, "..", "public", "models"))
    except NameError:
        output_dir = os.path.abspath(os.path.join(os.getcwd(), "models"))
        print(f"Interactive environment detected (Jupyter/Colab). Output directory set to: {output_dir}")

    os.makedirs(output_dir, exist_ok=True)
    
    original_path = os.path.join(output_dir, "lama-manga-onnx-dynamic.onnx")
    
    # Download original model if not exists
    if os.path.exists(original_path):
        print(f"Using existing original model at {original_path}...")
    else:
        print(f"Downloading {hf_filename} from {repo_id}...")
        downloaded_file = hf_hub_download(repo_id=repo_id, filename=hf_filename)
        print(f"Copying original model to {original_path}...")
        shutil.copy(downloaded_file, original_path)

    print("Model downloaded successfully!")

if __name__ == "__main__":
    main()
