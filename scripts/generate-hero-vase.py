"""Generate the lightweight, reproducible AB3D hero product as a binary glTF."""

from __future__ import annotations

import json
import struct
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "models" / "ab3d-ribbed-vase.glb"
AROUND = 144
HEIGHT_RINGS = 84
INNER_START = 5
HEIGHT = 2.8


def smoothstep(edge0: float, edge1: float, value: np.ndarray) -> np.ndarray:
    x = np.clip((value - edge0) / (edge1 - edge0), 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


def profile(t: np.ndarray) -> np.ndarray:
    body = 0.68 + 0.60 * np.power(np.sin(np.pi * t), 0.72)
    neck = 0.20 * smoothstep(0.66, 0.94, t)
    rim = 0.23 * smoothstep(0.92, 1.0, t)
    return body - neck + rim


def add_ring(vertices: list[list[float]], t: float, inner: bool = False) -> None:
    theta = np.linspace(0.0, np.pi * 2.0, AROUND, endpoint=False)
    base = float(profile(np.array([t]))[0])
    if inner:
        radius = np.full_like(theta, max(0.35, base - 0.115))
    else:
        rib_strength = 0.025 + 0.035 * np.power(np.sin(np.pi * t), 0.35)
        radius = base * (1.0 + rib_strength * np.cos(24.0 * theta + t * 0.62))
        radius *= 1.0 + 0.007 * np.cos(3.0 * theta - t * 0.4)
    y = t * HEIGHT
    for angle, r in zip(theta, radius, strict=True):
        vertices.append([float(r * np.cos(angle)), y, float(r * np.sin(angle))])


def build_mesh() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    vertices: list[list[float]] = []
    faces: list[list[int]] = []
    ts = np.linspace(0.0, 1.0, HEIGHT_RINGS)

    for t in ts:
        add_ring(vertices, float(t), inner=False)
    outer_count = len(vertices)

    inner_ts = ts[INNER_START:]
    for t in inner_ts:
        add_ring(vertices, float(t), inner=True)

    for ring in range(HEIGHT_RINGS - 1):
        for index in range(AROUND):
            nxt = (index + 1) % AROUND
            a = ring * AROUND + index
            b = ring * AROUND + nxt
            c = (ring + 1) * AROUND + index
            d = (ring + 1) * AROUND + nxt
            faces.extend(([a, c, b], [b, c, d]))

    inner_rings = len(inner_ts)
    for ring in range(inner_rings - 1):
        for index in range(AROUND):
            nxt = (index + 1) % AROUND
            a = outer_count + ring * AROUND + index
            b = outer_count + ring * AROUND + nxt
            c = outer_count + (ring + 1) * AROUND + index
            d = outer_count + (ring + 1) * AROUND + nxt
            faces.extend(([a, b, c], [b, d, c]))

    outer_top = (HEIGHT_RINGS - 1) * AROUND
    inner_top = outer_count + (inner_rings - 1) * AROUND
    for index in range(AROUND):
        nxt = (index + 1) % AROUND
        faces.extend((
            [outer_top + index, inner_top + index, outer_top + nxt],
            [outer_top + nxt, inner_top + index, inner_top + nxt],
        ))

    bottom_center = len(vertices)
    vertices.append([0.0, 0.0, 0.0])
    for index in range(AROUND):
        faces.append([bottom_center, index, (index + 1) % AROUND])

    inner_floor_center = len(vertices)
    floor_y = float(inner_ts[0] * HEIGHT)
    vertices.append([0.0, floor_y, 0.0])
    inner_floor = outer_count
    for index in range(AROUND):
        nxt = (index + 1) % AROUND
        faces.append([inner_floor_center, inner_floor + nxt, inner_floor + index])

    positions = np.asarray(vertices, dtype=np.float32)
    indices = np.asarray(faces, dtype=np.uint32)
    normals = np.zeros_like(positions)
    triangles = positions[indices]
    face_normals = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
    lengths = np.linalg.norm(face_normals, axis=1)
    face_normals[lengths > 0] /= lengths[lengths > 0, None]
    for corner in range(3):
        np.add.at(normals, indices[:, corner], face_normals)
    normal_lengths = np.linalg.norm(normals, axis=1)
    normals[normal_lengths > 0] /= normal_lengths[normal_lengths > 0, None]
    edges = np.sort(np.concatenate((indices[:, [0, 1]], indices[:, [1, 2]], indices[:, [2, 0]])), axis=1)
    _, edge_counts = np.unique(edges, axis=0, return_counts=True)
    if not np.all(edge_counts == 2):
        raise ValueError("Hero vase mesh is not watertight")
    if not np.isfinite(positions).all() or not np.isfinite(normals).all():
        raise ValueError("Hero vase contains invalid geometry values")
    return positions, normals, indices.reshape(-1)


def align4(data: bytes) -> bytes:
    return data + b"\x00" * ((4 - len(data) % 4) % 4)


def write_glb(positions: np.ndarray, normals: np.ndarray, indices: np.ndarray) -> None:
    position_bytes = align4(positions.astype("<f4").tobytes())
    normal_bytes = align4(normals.astype("<f4").tobytes())
    index_bytes = align4(indices.astype("<u4").tobytes())
    binary = position_bytes + normal_bytes + index_bytes

    gltf = {
        "asset": {"version": "2.0", "generator": "AB3D procedural product studio"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "AB3D Ribbed Japandi Vase"}],
        "meshes": [{"name": "Ribbed ceramic vase", "primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1}, "indices": 2, "material": 0}]}],
        "materials": [{
            "name": "Burnt terracotta PLA",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.66, 0.245, 0.125, 1.0],
                "metallicFactor": 0.0,
                "roughnessFactor": 0.48,
            },
            "doubleSided": False,
        }],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(position_bytes), "target": 34962},
            {"buffer": 0, "byteOffset": len(position_bytes), "byteLength": len(normal_bytes), "target": 34962},
            {"buffer": 0, "byteOffset": len(position_bytes) + len(normal_bytes), "byteLength": len(index_bytes), "target": 34963},
        ],
        "accessors": [
            {
                "bufferView": 0,
                "componentType": 5126,
                "count": len(positions),
                "type": "VEC3",
                "min": positions.min(axis=0).tolist(),
                "max": positions.max(axis=0).tolist(),
            },
            {"bufferView": 1, "componentType": 5126, "count": len(normals), "type": "VEC3"},
            {"bufferView": 2, "componentType": 5125, "count": len(indices), "type": "SCALAR"},
        ],
    }

    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_chunk = json_bytes + b" " * ((4 - len(json_bytes) % 4) % 4)
    body = struct.pack("<I4s", len(json_chunk), b"JSON") + json_chunk
    body += struct.pack("<I4s", len(binary), b"BIN\x00") + binary
    glb = struct.pack("<4sII", b"glTF", 2, 12 + len(body)) + body

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(glb)
    print(f"Created {OUTPUT} ({len(glb):,} bytes, {len(positions):,} vertices, {len(indices) // 3:,} triangles)")


if __name__ == "__main__":
    write_glb(*build_mesh())
