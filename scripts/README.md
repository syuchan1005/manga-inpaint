# AI Inpaint Models & Scripts

This directory contains python scripts for downloading, converting, and validating the AI inpainting model used by this application.

## Core Scripts

1. **`download-model.py`**
   - **Purpose**: Downloads the original dynamic Float32 LaMa Manga inpainting model (~206 MB) and saves it to `public/models/lama-manga-onnx-dynamic.onnx`.
   
2. **`convert-fp16.py`**
   - **Purpose**: Converts the Float32 model to a type-safe **Hybrid FP16/FP32 model** (~115 MB).
   - **Details**:
     - Keeps sensitive mathematical layers (**Fourier Units** and **BatchNormalizations**) in Float32 to prevent overflows (white patches) and precision loss.
     - Keeps **Input/Output Boundary Layers** in Float32 to protect downsampling/upsampling logic from native GPU color drift.
     - Automatically resolves all intermediate type mismatches by tracing the graph and injecting type-safe `Cast` nodes.
     - Cleans up duplicate redundant `Cast` nodes and ensures all node names are unique.
     - Converts the heavy residual backbone convolutions to FP16 to halve the model size and enable native GPU (WebGPU) execution speedups.

3. **`verify-model.py`**
   - **Purpose**: Checks the integrity of the generated FP16 model by loading it into `onnxruntime` to ensure that all graph and type constraints are valid.

4. **`test_inference.py`**
   - **Purpose**: Runs a comparative inference test between the FP32 and FP16 models, calculating and printing the **Mean Absolute Error (MAE)** and **Maximum Difference** to verify mathematical correctness.

---

## npm Scripts

The following convenience scripts are registered in `package.json`:

- **`npm run download-model`**
  - Downloads the original Float32 model.
- **`npm run convert-model`**
  - Converts the Float32 model to Hybrid FP16 and runs the integrity check (`verify-model.py`).
- **`npm run test-inference`**
  - Runs the comparison test to output MAE and Max Difference.
- **`npm run prepare-models`**
  - Downloads the model and converts it (all-in-one script).
