#!/usr/bin/env python3
"""Fix Bedrock world LevelDB: remove stale custom biome registry entries and jigsaw joint_type errors."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from amulet_nbt import load as load_nbt, NamedTag, CompoundTag, ListTag, StringTag
from leveldb import LevelDB

REMOVED_BIOME_PREFIXES = ("bop_ks:", "wypnt_bab:")
JOINT_TYPE_DEFAULT = "aligned"


def should_remove_biome(name: str) -> bool:
    return name.startswith(REMOVED_BIOME_PREFIXES)


def filter_biome_ids_table(raw: bytes) -> tuple[bytes | None, int]:
    tag = load_nbt(raw, compressed=False, little_endian=True)
    root = tag.compound
    biome_list = root.get_list("list", ListTag())
    kept = []
    removed = 0
    for entry in biome_list:
        if not isinstance(entry, CompoundTag):
            kept.append(entry)
            continue
        name = entry.get_string("name", StringTag("")).py_str
        if should_remove_biome(name):
            removed += 1
        else:
            kept.append(entry)
    if removed == 0:
        return None, 0
    root["list"] = ListTag(kept)
    return tag.to_nbt(compressed=False, little_endian=True), removed


def walk_fix_jigsaw(obj, fixes: list[str]):
    if isinstance(obj, CompoundTag):
        if "joint_type" in obj:
            jt = obj.get_string("joint_type", StringTag("")).py_str
            if jt not in ("rollable", "aligned"):
                obj["joint_type"] = StringTag(JOINT_TYPE_DEFAULT)
                fixes.append("joint_type -> aligned")
        for value in obj.values():
            walk_fix_jigsaw(value, fixes)
    elif isinstance(obj, ListTag):
        for value in obj:
            walk_fix_jigsaw(value, fixes)


def filter_biome_data(raw: bytes) -> tuple[bytes | None, int]:
    tag = load_nbt(raw, compressed=False, little_endian=True)
    removed = 0

    def scrub(node):
        nonlocal removed
        if isinstance(node, CompoundTag):
            for key in list(node.keys()):
                val = node[key]
                if isinstance(val, StringTag) and should_remove_biome(val.py_str):
                    del node[key]
                    removed += 1
                    continue
                if key == "biomes_server" and isinstance(val, (CompoundTag, ListTag)):
                    if isinstance(val, CompoundTag):
                        for sub_key in list(val.keys()):
                            if should_remove_biome(sub_key) or (
                                isinstance(val[sub_key], StringTag)
                                and should_remove_biome(val[sub_key].py_str)
                            ):
                                del val[sub_key]
                                removed += 1
                    elif isinstance(val, ListTag):
                        kept = []
                        for item in val:
                            if isinstance(item, StringTag) and should_remove_biome(item.py_str):
                                removed += 1
                            else:
                                kept.append(item)
                                scrub(item)
                        val.clear()
                        val.extend(kept)
                    continue
                scrub(val)
        elif isinstance(node, ListTag):
            kept = []
            for item in node:
                if isinstance(item, StringTag) and should_remove_biome(item.py_str):
                    removed += 1
                else:
                    scrub(item)
                    kept.append(item)
            node.clear()
            node.extend(kept)

    scrub(tag.compound)
    if removed == 0:
        return None, 0
    return tag.to_nbt(compressed=False, little_endian=True), removed


def fix_structure_template(raw: bytes) -> tuple[bytes | None, list[str]]:
    tag = load_nbt(raw, compressed=False, little_endian=True)
    fixes: list[str] = []
    walk_fix_jigsaw(tag.compound, fixes)
    if not fixes:
        return None, fixes
    return tag.to_nbt(compressed=False, little_endian=True), fixes


def fix_level_dat(path: Path) -> list[str]:
    changes: list[str] = []
    data = path.read_bytes()
    if len(data) < 8:
        return changes
    payload = data[8:]
    tag = load_nbt(payload, compressed=False, little_endian=True)
    fixes: list[str] = []
    walk_fix_jigsaw(tag.compound, fixes)
    if fixes:
        new_payload = tag.to_nbt(compressed=False, little_endian=True)
        path.write_bytes(data[:4] + len(new_payload).to_bytes(4, "little") + new_payload)
        changes.append(f"level.dat: {len(fixes)} jigsaw joint_type fix(es)")
    return changes


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: fix_world_data.py <world_folder>", file=sys.stderr)
        return 2

    world_dir = Path(sys.argv[1])
    db_dir = world_dir / "db"
    if not db_dir.is_dir():
        print(f"Missing db folder: {db_dir}", file=sys.stderr)
        return 1

    report: dict[str, object] = {"changes": []}
    db = LevelDB(str(db_dir))

    if b"BiomeIdsTable" in db:
        new_raw, removed = filter_biome_ids_table(db[b"BiomeIdsTable"])
        if new_raw is not None:
            if removed and not load_nbt(new_raw, compressed=False, little_endian=True).compound.get_list("list", ListTag()):
                db.delete(b"BiomeIdsTable")
                report["changes"].append(f"deleted BiomeIdsTable ({removed} stale biomes)")
            else:
                db.put(b"BiomeIdsTable", new_raw)
                report["changes"].append(f"BiomeIdsTable: removed {removed} stale biomes")

    if b"BiomeData" in db:
        new_raw, removed = filter_biome_data(db[b"BiomeData"])
        if new_raw is not None:
            db.put(b"BiomeData", new_raw)
            report["changes"].append(f"BiomeData: removed {removed} stale biome references")

    structure_fixes = 0
    for key in db.keys():
        if not key.startswith(b"structuretemplate"):
            continue
        new_raw, fixes = fix_structure_template(db[key])
        if new_raw is not None:
            db.put(key, new_raw)
            structure_fixes += len(fixes)
    if structure_fixes:
        report["changes"].append(
            f"structure templates: fixed {structure_fixes} invalid joint_type value(s)"
        )

    db.close()

    level_dat = world_dir / "level.dat"
    if level_dat.is_file():
        report["changes"].extend(fix_level_dat(level_dat))

    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
