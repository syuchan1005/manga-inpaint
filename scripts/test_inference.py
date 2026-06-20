# /// script
# dependencies = [
#   "onnx",
#   "onnxruntime",
#   "numpy",
# ]
# ///

import os
import onnxruntime as ort
import numpy as np

def test_inference():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    models_dir = os.path.abspath(os.path.join(script_dir, "..", "public", "models"))
    fp32_model_path = os.path.join(models_dir, "lama-manga-onnx-dynamic.onnx")
    fp16_model_path = os.path.join(models_dir, "lama-manga-onnx-dynamic-fp16.onnx")
    
    print("Loading sessions...")
    sess_32 = ort.InferenceSession(fp32_model_path, providers=["CPUExecutionProvider"])
    sess_16 = ort.InferenceSession(fp16_model_path, providers=["CPUExecutionProvider"])
    
    # Generate deterministic inputs
    np.random.seed(42)
    target_size = 256
    image_data = np.random.rand(1, 3, target_size, target_size).astype(np.float32)
    mask_data = (np.random.rand(1, 1, target_size, target_size) > 0.8).astype(np.float32)
    
    # Run FP32 inference
    print("Running FP32 inference...")
    out_32 = sess_32.run(None, {"image": image_data, "mask": mask_data})[0]
    
    # Run FP16 inference
    print("Running FP16 inference...")
    out_16 = sess_16.run(None, {"image": image_data, "mask": mask_data})[0]
    
    # Check for NaN / Inf in FP16 output
    num_nans = np.isnan(out_16).sum()
    num_infs = np.isinf(out_16).sum()
    
    print("\n--- Output Statistics ---")
    print(f"FP32 Output: min={out_32.min():.4f}, max={out_32.max():.4f}, mean={out_32.mean():.4f}")
    print(f"FP16 Output: min={out_16.min():.4f}, max={out_16.max():.4f}, mean={out_16.mean():.4f}")
    print(f"FP16 NaN count: {num_nans}")
    print(f"FP16 Inf count: {num_infs}")
    
    # Compute error metrics
    if num_nans == 0 and num_infs == 0:
        mae = np.abs(out_32 - out_16).mean()
        max_diff = np.abs(out_32 - out_16).max()
        print(f"Mean Absolute Error (MAE): {mae:.6f}")
        print(f"Maximum Difference: {max_diff:.6f}")
        
        # Check if error is within reasonable bounds (usually MAE < 0.05 is fine for FP16)
        if mae < 0.05:
            print("\nSUCCESS: FP16 model output is close to FP32 model and contains no NaNs/Infs!")
        else:
            print("\nWARNING: FP16 model has a high mean error, possibly due to other layers overflowing.")
    else:
        print("\nFAILURE: FP16 model output contains NaNs or Infs! Overflow is still present in the model.")

if __name__ == "__main__":
    test_inference()
