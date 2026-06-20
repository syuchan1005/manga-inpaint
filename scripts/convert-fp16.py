# /// script
# dependencies = [
#   "onnx",
#   "onnxruntime",
# ]
# ///

import os
import onnx
from onnx import TensorProto, helper
import onnxruntime as ort
import time
from onnxruntime.transformers.float16 import convert_float_to_float16

def get_precise_types(model):
    print("Running shape inference on original model to get precise type dictionary...")
    inferred = onnx.shape_inference.infer_shapes(model)
    types = {}
    for inp in inferred.graph.input:
        types[inp.name] = inp.type.tensor_type.elem_type
    for out in inferred.graph.output:
        types[out.name] = out.type.tensor_type.elem_type
    for init in inferred.graph.initializer:
        types[init.name] = init.data_type
    for vi in inferred.graph.value_info:
        types[vi.name] = vi.type.tensor_type.elem_type
    return types

def fix_type_mismatches(model, fp32_types, blocked_node_names):
    graph = model.graph
    
    # Initialize tensor types dictionary
    tensor_types = {}
    
    # 1. Add graph inputs (kept as FLOAT)
    for inp in graph.input:
        if inp.name in fp32_types:
            tensor_types[inp.name] = fp32_types[inp.name]
        else:
            tensor_types[inp.name] = TensorProto.FLOAT
            
    # 2. Add initializers
    for init in graph.initializer:
        tensor_types[init.name] = init.data_type
        
    new_nodes = []
    cast_counter = 0
    mismatch_count = 0
    
    print("Scanning nodes in execution order to fix type mismatches...")
    
    # We process nodes in execution order
    for node in graph.node:
        # Determine the target type for this node
        is_blocked = node.name in blocked_node_names or "/fu/" in node.name
        target_type = TensorProto.FLOAT if is_blocked else TensorProto.FLOAT16
        
        # Cast inputs that don't match target_type (only FLOAT/FLOAT16)
        for idx, inp_name in enumerate(node.input):
            if inp_name == "":
                continue
                
            # Get current type of the input tensor
            current_type = tensor_types.get(inp_name)
            if current_type is None:
                # Fallback to fp32_types
                current_type = fp32_types.get(inp_name, TensorProto.FLOAT16)
                
            # We only resolve float vs float16 mismatches.
            if current_type in (TensorProto.FLOAT, TensorProto.FLOAT16) and current_type != target_type:
                mismatch_count += 1
                cast_out_name = f"{inp_name}_cast_{'fp32' if target_type == TensorProto.FLOAT else 'fp16'}_{cast_counter}"
                cast_counter += 1
                
                print(f"  Node '{node.name}' ({node.op_type}): casting input '{inp_name}' from {'FLOAT' if current_type == TensorProto.FLOAT else 'FLOAT16'} to {'FLOAT' if target_type == TensorProto.FLOAT else 'FLOAT16'}")
                
                cast_node = helper.make_node(
                    "Cast",
                    inputs=[inp_name],
                    outputs=[cast_out_name],
                    name=f"Cast_for_mismatch_{cast_out_name}",
                    to=target_type
                )
                new_nodes.append(cast_node)
                node.input[idx] = cast_out_name
                
                # Register the cast output type
                tensor_types[cast_out_name] = target_type
                
                new_vi = helper.make_tensor_value_info(
                    cast_out_name,
                    target_type,
                    None
                )
                graph.value_info.append(new_vi)
                
        # Register the output tensor types of this node
        for out in node.output:
            if out == "":
                continue
            if out in fp32_types:
                t32 = fp32_types[out]
                if t32 == TensorProto.FLOAT:
                    tensor_types[out] = target_type
                else:
                    tensor_types[out] = t32
            else:
                tensor_types[out] = target_type
                
    # Append all new Cast nodes to graph
    for cast_node in new_nodes:
        graph.node.append(cast_node)
        
    print(f"Fixed {mismatch_count} type mismatches by inserting {len(new_nodes)} Cast nodes.")

def resolve_duplicate_tensors(model):
    print("Resolving duplicate tensor definitions...")
    graph = model.graph
    
    defined_tensors = {}
    nodes_to_remove = []
    
    rename_map = {}
    dup_tensor_counter = 0
    
    for node in list(graph.node):
        # Update inputs first
        for idx, inp in enumerate(node.input):
            if inp in rename_map:
                node.input[idx] = rename_map[inp]
                
        # Check outputs
        for out_idx, out in enumerate(node.output):
            if out == "":
                continue
            if out in defined_tensors:
                prev_op, prev_inps, prev_out_idx, prev_node = defined_tensors[out]
                is_identical = (node.op_type == prev_op and list(node.input) == list(prev_inps))
                if is_identical:
                    print(f"  Removing redundant identical node '{node.name}' (Op: {node.op_type}) producing '{out}'")
                    nodes_to_remove.append(node)
                else:
                    new_name = f"{out}_dup_{dup_tensor_counter}"
                    dup_tensor_counter += 1
                    print(f"  Renaming non-identical duplicate output tensor '{out}' in node '{node.name}' -> '{new_name}'")
                    rename_map[out] = new_name
                    node.output[out_idx] = new_name
            else:
                defined_tensors[out] = (node.op_type, list(node.input), out_idx, node)
                
    for node in nodes_to_remove:
        graph.node.remove(node)
        
    print(f"Resolved duplicate tensors. Removed {len(nodes_to_remove)} nodes. Renamed {len(rename_map)} tensors.")

def make_node_names_unique(model):
    print("Ensuring all node names are unique...")
    seen_names = set()
    counter = 0
    for node in model.graph.node:
        if not node.name:
            node.name = f"Unnamed_Node_{counter}"
            counter += 1
        elif node.name in seen_names:
            orig_name = node.name
            while f"{orig_name}_unique_{counter}" in seen_names:
                counter += 1
            node.name = f"{orig_name}_unique_{counter}"
            counter += 1
            print(f"Renamed duplicate node name '{orig_name}' -> '{node.name}'")
        seen_names.add(node.name)

def convert_to_fp16_robust(input_path, output_path):
    print(f"Converting {input_path} to Robust Hybrid FP16...")
    try:
        model = onnx.load(input_path)
        start_time = time.time()
        
        fp32_types = get_precise_types(model)
        
        print("Identifying blocked nodes...")
        blocked_node_names = set()
        
        # 1. Block all Fourier Unit nodes
        fu_nodes = [node.name for node in model.graph.node if "/fu/" in node.name]
        blocked_node_names.update(fu_nodes)
        
        # 2. Block all BatchNormalization nodes
        bn_nodes = [node.name for node in model.graph.node if node.op_type == "BatchNormalization"]
        blocked_node_names.update(bn_nodes)
        
        # 3. Block input-processing Conv nodes (model.1 to model.4)
        input_subgraphs = [
            "generator/model/model.1/",
            "generator/model/model.2/",
            "generator/model/model.3/",
            "generator/model/model.4/"
        ]
        input_layer_nodes = [
            node.name for node in model.graph.node 
            if any(sub in node.name for sub in input_subgraphs)
        ]
        blocked_node_names.update(input_layer_nodes)
        
        # 4. Block output-reconstruction & upsampling nodes (model.24 to model.35)
        output_subgraphs = [
            f"generator/model/model.{i}/" for i in range(24, 36)
        ]
        output_layer_nodes = [
            node.name for node in model.graph.node 
            if any(sub in node.name for sub in output_subgraphs)
        ]
        blocked_node_names.update(output_layer_nodes)
        
        # 5. Block outer boundary nodes
        outer_nodes = [
            "generator/Sub",
            "generator/Mul",
            "generator/Concat",
            "Mul_13615",
            "Mul_13616",
            "Add_13617"
        ]
        blocked_node_names.update(outer_nodes)
        
        # 6. Recursively block Constant nodes that feed directly into blocked nodes (optimized O(N) lookup)
        tensor_producers = {}
        for n in model.graph.node:
            for out in n.output:
                if out != "":
                    tensor_producers[out] = n
                    
        for _ in range(3):
            constants_to_block = []
            for node in model.graph.node:
                if node.name in blocked_node_names:
                    for inp in node.input:
                        prod = tensor_producers.get(inp)
                        if prod and prod.op_type == "Constant":
                            constants_to_block.append(prod.name)
            if constants_to_block:
                blocked_node_names.update(constants_to_block)
        
        print(f"Blocking a total of {len(blocked_node_names)} nodes:")
        print(f"  - Fourier Units: {len(fu_nodes)}")
        print(f"  - Batch Normalizations: {len(bn_nodes)}")
        print(f"  - Input Layers: {len(input_layer_nodes)}")
        print(f"  - Output Layers: {len(output_layer_nodes)}")
        print(f"  - Outer Boundary: {len(outer_nodes)}")
        print(f"  - Total (including Constant propagation): {len(blocked_node_names)}")
        
        # Convert to FP16
        model_fp16 = convert_float_to_float16(
            model,
            keep_io_types=True,
            node_block_list=list(blocked_node_names),
            op_block_list=None,
            disable_shape_infer=True
        )
        
        print("Fixing type mismatches at blocked/unblocked boundaries...")
        fix_type_mismatches(model_fp16, fp32_types, blocked_node_names)
        
        # Resolve duplicate tensor definitions
        resolve_duplicate_tensors(model_fp16)
        
        # Make node names unique to fix duplicate node name errors
        make_node_names_unique(model_fp16)
        
        print(f"Saving converted and patched model to {output_path}...")
        onnx.save(model_fp16, output_path)
        print(f"Robust FP16 model saved successfully in {time.time() - start_time:.2f} seconds!")
        
        if os.path.exists(output_path):
            size_mb = os.path.getsize(output_path) / (1024 * 1024)
            print(f"Model size: {size_mb:.2f} MB")
            
    except Exception as e:
        print(f"Error during FP16 conversion: {e}")

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    models_dir = os.path.abspath(os.path.join(script_dir, "..", "public", "models"))
    
    fp32_model_path = os.path.join(models_dir, "lama-manga-onnx-dynamic.onnx")
    fp16_robust_path = os.path.join(models_dir, "lama-manga-onnx-dynamic-fp16.onnx")
    
    if not os.path.exists(fp32_model_path):
        print(f"FP32 model not found at {fp32_model_path}.")
    else:
        convert_to_fp16_robust(fp32_model_path, fp16_robust_path)
