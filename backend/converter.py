import bpy
import sys
import os
import traceback

def _infer_image_extension(image):
    if image.file_format:
        fmt = image.file_format.lower()
        if fmt in {"jpeg", "jpg"}:
            return "jpg"
        if fmt in {"png", "bmp", "tga", "tif", "tiff", "webp"}:
            return "tif" if fmt == "tiff" else fmt

    # Fallback: try current filepath extension
    filepath = (image.filepath or "").lower()
    ext = os.path.splitext(filepath)[1].lstrip(".")
    if ext in {"jpg", "jpeg", "png", "bmp", "tga", "tif", "tiff", "webp"}:
        return "jpg" if ext == "jpeg" else ("tif" if ext == "tiff" else ext)

    return "png"


def _sanitize_texture_paths():
    # Some imported GLB textures end up with invalid FBX video filenames (e.g. ".fbm"),
    # which causes FBXLoader to reject embedded image content by extension.
    for index, image in enumerate(bpy.data.images):
        if image.source != "FILE":
            continue

        ext = _infer_image_extension(image)
        name = os.path.splitext(image.name)[0] or f"texture_{index}"
        safe_name = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in name)
        image.filepath = f"//{safe_name}.{ext}"


def _blender_format_from_extension(ext):
    if ext == "jpg":
        return "JPEG"
    if ext == "png":
        return "PNG"
    if ext == "bmp":
        return "BMP"
    if ext == "tga":
        return "TARGA"
    if ext == "tif":
        return "TIFF"
    if ext == "webp":
        return "WEBP"
    return "PNG"


def _materialize_textures_for_export(texture_dir):
    os.makedirs(texture_dir, exist_ok=True)
    used_names = set()

    for index, image in enumerate(bpy.data.images):
        if image.source not in {"FILE", "GENERATED"}:
            continue
        if image.size[0] == 0 or image.size[1] == 0:
            continue

        ext = _infer_image_extension(image)
        fmt = _blender_format_from_extension(ext)
        base = os.path.splitext(image.name)[0] or f"texture_{index}"
        safe_base = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in base) or f"texture_{index}"

        filename = f"{safe_base}.{ext}"
        suffix = 1
        while filename in used_names:
            filename = f"{safe_base}_{suffix}.{ext}"
            suffix += 1
        used_names.add(filename)

        output_path = os.path.join(texture_dir, filename)
        try:
            image.filepath_raw = output_path
            image.file_format = fmt
            image.save()
            image.filepath = output_path
        except Exception as exc:
            print(f"WARN: failed to materialize texture '{image.name}': {exc}")


def convert_glb_to_fbx(input_path, output_path):
    # Clear existing objects
    bpy.ops.wm.read_factory_settings(use_empty=True)
    
    # Import GLB
    import_result = bpy.ops.import_scene.gltf(filepath=input_path)
    if 'FINISHED' not in import_result:
        raise RuntimeError(f"GLB import failed: {import_result}")
    _sanitize_texture_paths()
    _materialize_textures_for_export(os.path.join(os.path.dirname(output_path), "textures"))
    
    # Simple MATERIAL FIX logic for FBX compatibility
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        # Ensure Principled BSDF is reachable for the exporter
        for node in mat.node_tree.nodes:
            if node.type == 'OUTPUT_MATERIAL':
                input_node = node.inputs['Surface'].links[0].from_node if node.inputs['Surface'].is_linked else None
                if input_node and input_node.type != 'BSDF_PRINCIPLED':
                    # If it's some other node (like GLTF Settings), we might need to fix it
                    # but usually, GLTF importer creates Principled BSDF or similar
                    pass

    # Pack textures to ensure they are available for copy/embed
    pack_result = bpy.ops.file.pack_all()
    if 'FINISHED' not in pack_result:
        print(f"WARN: pack_all did not finish cleanly: {pack_result}")
    
    # Export FBX
    # We use path_mode='COPY' and embed_textures=True for the most reliable embedding
    export_result = bpy.ops.export_scene.fbx(
        filepath=output_path,
        use_selection=False,
        bake_anim=True,
        path_mode='COPY',
        embed_textures=True
    )
    if 'FINISHED' not in export_result:
        raise RuntimeError(f"FBX export failed: {export_result}")

    if not os.path.exists(output_path):
        raise RuntimeError(f"FBX file was not created at {output_path}")

if __name__ == "__main__":
    # Get arguments passed after "--"
    argv = sys.argv
    try:
        if "--" not in argv:
            raise ValueError("No arguments provided after '--'")

        args = argv[argv.index("--") + 1:]
        if len(args) < 2:
            raise ValueError("Usage: blender --background --python converter.py -- <input_glb> <output_fbx>")

        input_file = args[0]
        output_file = args[1]
        convert_glb_to_fbx(input_file, output_file)
    except Exception as exc:
        print(f"ERROR: {exc}")
        traceback.print_exc()
        sys.exit(1)
